import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EvaluationJobService } from '../server/services/evaluationJobService'
import type { EngineTaskKey, EvaluationJob } from '../shared/types/evaluationJob'
import { newEvaluation, newEvaluationSample } from '../shared/utils/evaluation'
import { reportFixture } from './fixtures/groupedReport'
import { prepareExportData, generateCSVContent } from '../app/utils/exportReport'

const directories: string[] = []
afterEach(async () => {
  for (const path of directories.splice(0))
    await rm(path, { recursive: true, force: true })
})
async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'wcagger-job-test-'))
  directories.push(path)
  return path
}
function definition(count = 2) {
  return { ...newEvaluation(), targetStandard: 'WCAG22AA', samples: Array.from({ length: count }, (_, index) => newEvaluationSample('https://example.com/page-' + index)) }
}
function evidence(url: string, key: EngineTaskKey) {
  const result = reportFixture()
  result.evidence.sample.url = url
  result.evidence.grouping = undefined
  result.evidence.runs = result.evidence.runs.filter(run => key === 'axe' ? run.tool === 'axe' : run.tool === 'pa11y' && run.engine === key.split(':')[1])
  for (const run of result.evidence.runs) {
    run.requestedUrl = url
    run.resolvedUrl = url
  }
  const ids = new Set(result.evidence.runs.map(run => run.id))
  result.evidence.observations = result.evidence.observations.filter(item => ids.has(item.runId))
  return result
}
async function finished(service: EvaluationJobService, id: string): Promise<EvaluationJob> {
  let job: EvaluationJob | undefined
  await vi.waitFor(async () => {
    job = await service.get(id)
    expect(['queued', 'running']).not.toContain(job.status)
  }, { timeout: 4000, interval: 10 })
  return job!
}
describe('durable evaluation jobs', () => {
  it('bounds concurrent samples and returns without waiting for scanners', async () => {
    let active = 0
    let maximum = 0
    const releases: (() => void)[] = []
    const service = new EvaluationJobService(await directory(), async (request, update) => {
      active++
      maximum = Math.max(maximum, active)
      await update({ key: 'axe', status: 'running' })
      await new Promise<void>(resolve => releases.push(resolve))
      await update({ key: 'axe', status: 'completed', result: evidence(request.url, 'axe') })
      active--
    })
    const job = await service.create({ evaluation: definition(3), tools: ['axe'] })
    await vi.waitFor(() => expect(releases).toHaveLength(2))
    expect(maximum).toBe(2)
    expect((await service.get(job.id)).tasks.filter(task => task.attempts[0]!.status === 'queued')).toHaveLength(1)
    releases[0]!()
    await vi.waitFor(() => expect(releases).toHaveLength(3))
    releases[1]!()
    releases[2]!()
    expect((await finished(service, job.id)).status).toBe('completed')
    expect(maximum).toBe(2)
  })
  it('keeps successful evidence, marks partial coverage and retries only failed engines', async () => {
    let fail = true
    const calls: string[] = []
    const service = new EvaluationJobService(await directory(), async (request, update) => {
      const keys: EngineTaskKey[] = [...(request.tools.includes('axe') ? ['axe' as const] : []), ...(request.tools.includes('pa11y') ? (request.runners ?? []).map(runner => ('pa11y:' + runner) as EngineTaskKey) : [])]
      for (const key of keys) {
        calls.push(key)
        await update({ key, status: 'running' })
        await update(key === 'pa11y:htmlcs' && fail ? { key, status: 'failed', error: 'HTMLCS timed out' } : { key, status: 'completed', result: evidence(request.url, key) })
      }
    })
    const job = await service.create({ evaluation: definition(1), tools: ['axe', 'pa11y'], runners: ['axe', 'htmlcs'] })
    expect((await finished(service, job.id)).status).toBe('incomplete')
    const first = await service.report(job.id)
    expect(first.evidence.runs).toHaveLength(2)
    expect(first.evidence.evaluation!.scannedSampleIds).toEqual([])
    expect(first.evidence.evaluation!.partiallyScannedSampleIds).toHaveLength(1)
    expect(generateCSVContent(prepareExportData(first))).toContain('HTMLCS timed out')
    const firstIds = first.evidence.runs.map(run => run.id)
    fail = false
    await service.retry(job.id)
    expect((await finished(service, job.id)).status).toBe('completed')
    expect(calls.filter(key => key === 'axe')).toHaveLength(1)
    expect(calls.filter(key => key === 'pa11y:axe')).toHaveLength(1)
    expect(calls.filter(key => key === 'pa11y:htmlcs')).toHaveLength(2)
    const report = await service.report(job.id)
    expect(report.evidence.runs).toHaveLength(3)
    expect(firstIds.every(id => report.evidence.runs.some(run => run.id === id))).toBe(true)
    expect(report.evidence.evaluation!.scannedSampleIds).toHaveLength(1)
    const history = report.evidence.evaluation!.execution!.tasks.find(task => task.key === 'pa11y:htmlcs')!.attempts
    expect(history.map(item => item.status)).toEqual(['failed', 'completed'])
    expect(report.evidence.observations).toHaveLength(8)
  })
  it('retains earlier engine success after an executor failure and reports skipped states', async () => {
    const service = new EvaluationJobService(await directory(), async (request, update) => {
      await update({ key: 'axe', status: 'running' })
      await update({ key: 'axe', status: 'completed', result: evidence(request.url, 'axe') })
      throw new Error('Browser disconnected')
    })
    const evaluation = definition(2)
    evaluation.samples[1]!.preparation = 'manual'
    const job = await service.create({ evaluation, tools: ['axe', 'pa11y'], runners: ['htmlcs'] })
    const final = await finished(service, job.id)
    expect(final.tasks.map(task => task.attempts[0]!.status)).toEqual(['completed', 'failed', 'skipped', 'skipped'])
    expect((await service.report(job.id)).evidence.runs).toHaveLength(1)
    expect(final.status).toBe('incomplete')
  })
  it('enforces attempt limits and keeps failures visible even with no successful observations', async () => {
    const service = new EvaluationJobService(await directory(), async () => {
      throw new Error('Navigation failed')
    })
    const job = await service.create({ evaluation: definition(1), tools: ['axe'] })
    for (let index = 0; index < 2; index++) {
      await finished(service, job.id)
      await service.retry(job.id)
    }
    expect((await finished(service, job.id)).status).toBe('failed')
    await expect(service.retry(job.id)).rejects.toThrow('three attempts')
    const report = await service.report(job.id)
    expect(report.evidence.grouping!.summary.rawObservations).toBe(0)
    expect(report.evidence.evaluation!.execution!.status).toBe('failed')
    expect(prepareExportData(report).standards).toEqual(['WCAG22AA'])
    expect(prepareExportData(report).selectedTools).toEqual(['axe'])
  })
  it('aborts a timed-out sample and releases the slot for other work', async () => {
    const service = new EvaluationJobService(await directory(), async (request, update, signal) => {
      if (request.url.endsWith('0')) {
        await update({ key: 'axe', status: 'running' })
        await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Sample timeout')), { once: true }))
      } else
        await update({ key: 'axe', status: 'completed', result: evidence(request.url, 'axe') })
    }, 1, 30)
    const job = await service.create({ evaluation: definition(), tools: ['axe'] })
    const final = await finished(service, job.id)
    expect(final.tasks.map(task => task.attempts[0]!.status)).toEqual(['failed', 'completed'])
  })
  it('recovers interrupted attempts after restart without turning old work into success', async () => {
    const path = await directory()
    const service = new EvaluationJobService(path, async () => {
      throw new Error('Original failure')
    })
    const job = await service.create({ evaluation: definition(1), tools: ['axe'] })
    await finished(service, job.id)
    const stored = JSON.parse(await readFile(join(path, job.id + '.json'), 'utf8'))
    stored.tasks[0].attempts[0].status = 'running'
    stored.status = 'running'
    await writeFile(join(path, job.id + '.json'), JSON.stringify(stored))
    const restored = new EvaluationJobService(path)
    const recovered = await restored.get(job.id)
    expect(recovered.status).toBe('failed')
    expect(recovered.tasks[0]!.attempts[0]!.error).toContain('server restart')
    expect(JSON.stringify(recovered)).not.toContain('observations')
    await expect(restored.get('missing')).rejects.toThrow('not found')
  })
})

it('persists grouping decisions separately from engine attempts and restores them with the report', async () => {
  const path = await directory()
  const service = new EvaluationJobService(path, async (request, update) => {
    await update({ key: 'axe', status: 'completed', result: evidence(request.url, 'axe') })
  })
  const job = await service.create({ evaluation: definition(2), tools: ['axe'] })
  await finished(service, job.id)
  const report = await service.report(job.id)
  const buttons = report.evidence.grouping!.findings.filter(item => item.issueType === 'axe:button-name')
  const decision = { id: 'shared-component', action: 'combine' as const, occurrenceIds: buttons.flatMap(item => item.occurrenceIds), reviewer: 'Evaluator', reason: 'Same shared header implementation', timestamp: new Date().toISOString() }
  await service.review(job.id, report.evidence.runs.map(run => run.id), [decision])
  const executor = vi.fn()
  const restored = new EvaluationJobService(path, executor)
  const reopened = await restored.report(job.id)
  expect(reopened.evidence.grouping!.decisions).toEqual([decision])
  expect(reopened.evidence.grouping!.findings.filter(item => item.issueType === 'axe:button-name')).toHaveLength(1)
  expect(executor).not.toHaveBeenCalled()
  await expect(restored.review(job.id, [], [decision])).rejects.toThrow('evidence changed')
})

it('removes expired jobs rather than exposing their retained evidence', async () => {
  const path = await directory()
  const service = new EvaluationJobService(path, async () => {
    throw new Error('Failed navigation')
  })
  const job = await service.create({ evaluation: definition(1), tools: ['axe'] })
  await finished(service, job.id)
  const file = join(path, job.id + '.json')
  const data = JSON.parse(await readFile(file, 'utf8'))
  data.expiresAt = '2000-01-01T00:00:00Z'
  await writeFile(file, JSON.stringify(data))
  const restored = new EvaluationJobService(path)
  await expect(restored.get(job.id)).rejects.toThrow('not found')
  await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' })
})
