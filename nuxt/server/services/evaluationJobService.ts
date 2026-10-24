import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AccessibilityCheckResults, TestRequest } from '~~/shared/types/accessibility'
import type { EngineAttempt, EngineTask, EngineTaskKey, EngineUpdate, EvaluationJob } from '~~/shared/types/evaluationJob'
import { validateEvaluation } from '~~/shared/utils/evaluation'
import { AccessibilityCheckService } from './accessibilityCheckService'
import { AccessibilityRequestValidator } from './accessibilityRequestValidator'
import type { FindingGroupingDecision } from '~~/shared/types/scanEvidence'
import { groupScanEvidence } from './findingGroupingService'
import { ResultsProcessor } from './resultsProcessor'
import { combineEvaluationResults } from './evaluationResultsService'

interface StoredAttempt extends EngineAttempt {
  result?: AccessibilityCheckResults
}
interface StoredJob extends Omit<EvaluationJob, 'tasks'> {
  decisions?: FindingGroupingDecision[]
  tasks: (Omit<EngineTask, 'attempts'> & {
    attempts: StoredAttempt[]
  })[]
}
type Executor = (request: TestRequest, onUpdate: (update: EngineUpdate) => Promise<void>, signal: AbortSignal) => Promise<unknown>
const latest = <T>(values: T[]) => values[values.length - 1]!
const terminal = (job: EvaluationJob) => !['queued', 'running'].includes(job.status)
const KEYS: EngineTaskKey[] = ['axe', 'pa11y:htmlcs', 'pa11y:axe']
export class EvaluationJobService {
  private jobs = new Map<string, StoredJob>()
  private active = new Set<string>()
  private writes = new Map<string, Promise<void>>()
  private initialized?: Promise<void>
  private pumping = false
  constructor(
    private readonly directory = join(process.cwd(), '.data', 'evaluation-jobs'),
    private readonly execute: Executor = (request, update, signal) => new AccessibilityCheckService().runPartial(request, update, signal),
    private readonly concurrency = 2,
    private readonly sampleTimeout = 125000,
  ) {}

  async start() {
    await this.init()
    this.kick()
  }

  private init(): Promise<void> {
    return this.initialized ??= (async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 })
      for (const file of await readdir(this.directory)) {
        if (file.endsWith('.tmp')) {
          await unlink(join(this.directory, file))
          continue
        }
        if (!/^[a-f0-9-]{36}\.json$/.test(file))
          continue
        const job: StoredJob = JSON.parse(await readFile(join(this.directory, file), 'utf8'))
        if (Date.parse(job.expiresAt) <= Date.now()) {
          await unlink(join(this.directory, file))
          continue
        }
        this.jobs.set(job.id, job)
        for (const task of job.tasks) {
          const attempt = latest(task.attempts)
          if (attempt.status === 'running' || (attempt.status === 'queued' && attempt.startedAt))
            Object.assign(attempt, { status: 'failed', error: 'Scan interrupted by server restart', completedAt: new Date().toISOString() })
        }
        this.updateStatus(job)
        await this.save(job)
      }
      const cleanup = setInterval(() => {
        void this.sweep().catch(error => console.error('Evaluation expiry error:', error))
      }, 60000)
      cleanup.unref()
    })()
  }

  private async sweep() {
    for (const job of this.jobs.values()) {
      if (Date.parse(job.expiresAt) > Date.now() || [...this.active].some(key => key.startsWith(job.id + '/')))
        continue
      await this.writes.get(job.id)
      this.jobs.delete(job.id)
      this.writes.delete(job.id)
      await unlink(join(this.directory, job.id + '.json'))
    }
  }

  private save(job: StoredJob): Promise<void> {
    job.updatedAt = new Date().toISOString()
    const pending = (this.writes.get(job.id) ?? Promise.resolve()).catch(() => {
    }).then(async () => {
      const path = join(this.directory, job.id + '.json')
      const temporary = path + '.' + randomUUID() + '.tmp'
      try {
        await writeFile(temporary, JSON.stringify(job), { mode: 0o600 })
        await rename(temporary, path)
      } finally {
        await unlink(temporary).catch(() => {
        })
      }
    })
    this.writes.set(job.id, pending)
    return pending
  }

  private updateStatus(job: StoredJob) {
    const statuses = job.tasks.map(task => latest(task.attempts).status)
    job.status = [...this.active].some(key => key.startsWith(job.id + '/')) || statuses.includes('running')
      ? 'running'
      : statuses.includes('queued')
        ? 'queued'
        : statuses.every(status => status === 'completed')
          ? 'completed'
          : statuses.some(status => ['completed', 'skipped'].includes(status)) ? 'incomplete' : 'failed'
  }

  private present(job: StoredJob): EvaluationJob {
    return structuredClone({ ...job, tasks: job.tasks.map(task => ({ ...task, attempts: task.attempts.map(attempt => ({ id: attempt.id, status: attempt.status, startedAt: attempt.startedAt, completedAt: attempt.completedAt, error: attempt.error })) })) })
  }

  async create(input: unknown): Promise<EvaluationJob> {
    await this.init()
    if (!input || typeof input !== 'object')
      throw new Error('Invalid batch request')
    const body = input as Record<string, unknown>
    const evaluation = validateEvaluation(body.evaluation)
    const config = new AccessibilityRequestValidator().validate({ url: evaluation.samples[0]!.url, tools: body.tools, runners: body.runners, standard: evaluation.targetStandard })
    await this.sweep()
    if (this.jobs.size >= 20)
      throw new Error('The retained evaluation limit is reached; jobs expire after 24 hours')
    if ([...this.jobs.values()].filter(job => !terminal(job)).length >= 4)
      throw new Error('The scan queue is full; wait for an evaluation to finish')
    const keys = KEYS.filter(key => key === 'axe' ? config.tools.includes('axe') : config.tools.includes('pa11y') && config.runners?.includes(key.split(':')[1]!))
    const now = new Date().toISOString()
    const job: StoredJob = {
      schemaVersion: 1, id: randomUUID(), evaluation, tools: [...new Set(config.tools)], runners: [...new Set(config.runners ?? [])],
      status: 'queued', createdAt: now, updatedAt: now, expiresAt: new Date(Date.now() + 86400000).toISOString(),
      tasks: evaluation.samples.flatMap(sample => keys.map(key => ({ sampleId: sample.id, key, attempts: [{ id: randomUUID(), status: sample.preparation === 'manual' ? 'skipped' : 'queued', ...(sample.preparation === 'manual' && { error: 'State preparation is required' }) }] }))),
    }
    this.updateStatus(job)
    await this.save(job)
    this.jobs.set(job.id, job)
    this.kick()
    return this.present(job)
  }

  async get(id: string): Promise<EvaluationJob> {
    const job = await this.find(id)
    this.kick()
    return this.present(job)
  }

  private async find(id: string): Promise<StoredJob> {
    await this.init()
    const job = this.jobs.get(id)
    if (!job || Date.parse(job.expiresAt) <= Date.now())
      throw new Error('Evaluation job not found or expired')
    await this.writes.get(id)
    return job
  }

  async retry(id: string): Promise<EvaluationJob> {
    const job = await this.find(id)
    if (!terminal(job))
      throw new Error('Wait until the current scan finishes')
    if ([...this.jobs.values()].filter(job => !terminal(job)).length >= 4)
      throw new Error('The scan queue is full; wait for an evaluation to finish')
    const failed = job.tasks.filter(task => latest(task.attempts).status === 'failed' && task.attempts.length < 3)
    if (!failed.length)
      throw new Error('No failed engine work is eligible for retry (maximum three attempts)')
    for (const task of failed)
      task.attempts.push({ id: randomUUID(), status: 'queued' })
    this.updateStatus(job)
    await this.save(job)
    this.kick()
    return this.present(job)
  }

  async report(id: string): Promise<AccessibilityCheckResults> {
    const job = await this.find(id)
    const scans = job.evaluation.samples.flatMap((sample) => {
      const parts = job.tasks.filter(task => task.sampleId === sample.id).flatMap((task) => {
        const attempt = latest(task.attempts)
        return attempt.status === 'completed' && attempt.result ? [attempt.result.evidence] : []
      })
      if (!parts.length)
        return []
      const first = parts[0]!
      return [{ sampleId: sample.id, evidence: { ...first, grouping: undefined, runs: parts.flatMap(part => part.runs.map(run => ({ ...run, sampleId: first.sample.id, stateId: first.sample.state.id }))), observations: parts.flatMap(part => part.observations) } }]
    })
    const processor = new ResultsProcessor()
    const empty = processor.createInitialResults(job.evaluation.samples[0]!.url)
    empty.timestamp = job.updatedAt
    empty.evidence = { ...empty.evidence, sample: job.evaluation.samples[0]!, samples: job.evaluation.samples, evaluation: { ...job.evaluation, scannedSampleIds: [] } }
    const result = scans.length ? combineEvaluationResults({ evaluation: job.evaluation, scans }) : processor.finalizeResults(empty)
    result.evidence.grouping = groupScanEvidence(result.evidence, job.decisions)
    const snapshot = result.evidence.evaluation!
    snapshot.partiallyScannedSampleIds = snapshot.scannedSampleIds.filter(sampleId => job.tasks.some(task => task.sampleId === sampleId && latest(task.attempts).status !== 'completed'))
    snapshot.scannedSampleIds = snapshot.scannedSampleIds.filter(id => !snapshot.partiallyScannedSampleIds!.includes(id))
    snapshot.execution = { tools: [...job.tools], runners: [...job.runners], jobId: job.id, status: job.status, tasks: this.present(job).tasks }
    return structuredClone(result)
  }

  async review(id: string, runIds: string[], decisions: FindingGroupingDecision[]) {
    const job = await this.find(id)
    if (!terminal(job))
      throw new Error('Wait until the evaluation finishes before reviewing grouping')
    const current = await this.report(id)
    if (JSON.stringify([...runIds].sort()) !== JSON.stringify(current.evidence.runs.map(run => run.id).sort()))
      throw new Error('The scan evidence changed; rebuild the report before reviewing')
    groupScanEvidence(current.evidence, decisions)
    job.decisions = structuredClone(decisions)
    await this.save(job)
  }

  private kick() {
    void this.pump().catch(error => console.error('Evaluation queue error:', error))
  }

  private async pump() {
    if (this.pumping)
      return
    this.pumping = true
    try {
      while (this.active.size < this.concurrency) {
        const job = [...this.jobs.values()].find(job => job.tasks.some(task => latest(task.attempts).status === 'queued' && !this.active.has(job.id + '/' + task.sampleId)))
        if (!job)
          break
        const sampleId = job.tasks.find(task => latest(task.attempts).status === 'queued' && !this.active.has(job.id + '/' + task.sampleId))!.sampleId
        const key = job.id + '/' + sampleId
        this.active.add(key)
        for (const task of job.tasks.filter(task => task.sampleId === sampleId && latest(task.attempts).status === 'queued'))
          latest(task.attempts).startedAt = new Date().toISOString()
        this.updateStatus(job)
        try {
          await this.save(job)
        } catch (error) {
          this.active.delete(key)
          for (const task of job.tasks.filter(task => task.sampleId === sampleId && latest(task.attempts).status === 'queued'))
            Object.assign(latest(task.attempts), { status: 'failed', error: 'Could not persist scan state', completedAt: new Date().toISOString() })
          this.updateStatus(job)
          throw error
        }
        void this.runSample(job, sampleId).finally(async () => {
          this.active.delete(key)
          this.updateStatus(job)
          await this.save(job)
          this.kick()
        }).catch(error => console.error('Evaluation sample error:', error))
      }
    } finally {
      this.pumping = false
    }
  }

  private async runSample(job: StoredJob, sampleId: string) {
    const sample = job.evaluation.samples.find(sample => sample.id === sampleId)!
    const tasks = job.tasks.filter(task => task.sampleId === sampleId && latest(task.attempts).status === 'queued')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.sampleTimeout)
    try {
      await this.execute({ url: sample.url, standard: job.evaluation.targetStandard, tools: [...new Set(tasks.map(task => task.key === 'axe' ? 'axe' : 'pa11y'))], runners: tasks.filter(task => task.key !== 'axe').map(task => task.key.split(':')[1]!) }, async (update) => {
        const task = tasks.find(task => task.key === update.key)
        if (!task)
          throw new Error('Unexpected engine update')
        const attempt = latest(task.attempts)
        if (!['queued', 'running'].includes(attempt.status))
          throw new Error('Engine attempt is already terminal')
        if (update.status === 'completed') {
          if (!update.result?.evidence.runs.length)
            throw new Error('Engine returned no run evidence')
          const count = job.tasks.reduce((total, task) => total + (latest(task.attempts).result?.evidence.observations.length ?? 0), 0) + update.result.evidence.observations.length
          if (count > 20000)
            throw new Error('Evaluation evidence limit reached (20,000 observations)')
          attempt.result = update.result
        }
        Object.assign(attempt, { status: update.status, ...(update.status === 'running' ? { startedAt: new Date().toISOString() } : { completedAt: new Date().toISOString(), error: update.error }) })
        await this.save(job)
      }, controller.signal)
    } catch (error) {
      for (const task of tasks) {
        const attempt = latest(task.attempts)
        if (['queued', 'running'].includes(attempt.status))
          Object.assign(attempt, { status: 'failed', error: error instanceof Error ? error.message : 'Sample scan failed', completedAt: new Date().toISOString() })
      }
    } finally {
      clearTimeout(timer)
      for (const task of tasks) {
        const attempt = latest(task.attempts)
        if (['queued', 'running'].includes(attempt.status))
          Object.assign(attempt, { status: 'failed', error: 'Engine did not complete', completedAt: new Date().toISOString() })
      }
    }
  }
}
const runtime = globalThis as typeof globalThis & {
  wcaggerEvaluationJobs?: EvaluationJobService
}
export const evaluationJobs = runtime.wcaggerEvaluationJobs ??= new EvaluationJobService()
