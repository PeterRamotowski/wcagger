import { describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { EvaluationStore } from '../app/utils/evaluationStore'
import { parseSavedEvaluation, validateSavedEvaluation } from '../shared/utils/savedEvaluation'
import { savedFixture, assessmentFixture } from './fixtures/savedEvaluation'

describe('versioned browser evaluation storage', () => {
  it('round-trips evaluation planning, evidence, manual decisions and earlier revisions without mutating inputs', async () => {
    const value = savedFixture()
    const assessment = assessmentFixture(value)
    value.assessments = [assessment]
    value.assessmentHistory = [{ ...assessment, outcome: 'needs-review', reviewedAt: '2026-10-23T12:00:00Z' }]
    value.scanHistory = [value.scans[value.evaluation.samples[0]!.id]!]
    value.reportHistory = [value.report!]
    value.report!.evidence.evaluation!.manualAssessments = [assessment]
    const store = new EvaluationStore(new IDBFactory())
    const saved = await store.save(value)
    expect(saved.revision).toBe(1)
    expect(value.revision).toBe(0)
    const loaded = await store.get(value.id)
    expect(loaded.assessments).toEqual(value.assessments)
    expect(loaded.assessmentHistory).toEqual(value.assessmentHistory)
    expect(loaded.scanHistory[0]!.results.evidence.observations).toEqual(value.scanHistory[0]!.results.evidence.observations)
    expect(loaded.reportHistory[0]!.evidence.grouping!.decisions).toEqual(value.reportHistory[0]!.evidence.grouping!.decisions)
    expect(loaded.report!.evidence.runs.map(run => run.id)).toEqual(value.report!.evidence.runs.map(run => run.id))
    expect((await store.list())[0]).toMatchObject({ name: value.evaluation.name, revision: 1, samples: 1 })
    expect(parseSavedEvaluation(JSON.stringify(loaded))).toEqual(loaded)
  })
  it('uses an atomic revision check so concurrent saves cannot overwrite each other', async () => {
    const factory = new IDBFactory()
    const first = new EvaluationStore(factory)
    const second = new EvaluationStore(factory)
    const saved = await first.save(savedFixture())
    const next = structuredClone(saved)
    next.evaluation.name = 'Other tab'
    const results = await Promise.allSettled([first.save(saved), second.save(next)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect((await first.get(saved.id)).revision).toBe(2)
    await expect(second.save(saved)).rejects.toThrow('Another tab')
    await expect(second.remove(saved.id, 1)).rejects.toThrow('Another tab')
    expect((await first.get(saved.id)).revision).toBe(2)
  })
  it('deletes only the saved copy and refuses to resurrect a removed revision', async () => {
    const store = new EvaluationStore(new IDBFactory())
    const saved = await store.save(savedFixture())
    await store.remove(saved.id, saved.revision)
    expect(await store.list()).toEqual([])
    await expect(store.get(saved.id)).rejects.toThrow('no longer exists')
    await expect(store.save(saved)).rejects.toThrow()
    expect(saved.evaluation.name).toBe('Saved assessment')
  })
  it('reports storage errors without claiming a successful write or changing the old revision', async () => {
    const store = new EvaluationStore(new IDBFactory())
    const saved = await store.save(savedFixture())
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    await expect(store.save(saved)).rejects.toThrow('Quota exceeded')
    spy.mockRestore()
    expect((await store.get(saved.id)).revision).toBe(1)
  })
  it('rejects unsupported, oversized and broken imports, and strips unsupported top-level credentials', () => {
    const value = savedFixture()
    expect(() => parseSavedEvaluation('not json')).toThrow()
    expect(() => validateSavedEvaluation({ ...value, schemaVersion: 2 })).toThrow('Unsupported')
    expect(() => parseSavedEvaluation(' '.repeat(25 * 1024 * 1024 + 1))).toThrow('25 MB')
    const normalized = validateSavedEvaluation({ ...value, password: 'not-a-supported-field', cookies: ['not-a-supported-field'] })
    expect(normalized).not.toHaveProperty('password')
    expect(normalized).not.toHaveProperty('cookies')
    const broken = structuredClone(value)
    broken.report!.evidence.observations[0]!.runId = 'missing-run'
    expect(() => validateSavedEvaluation(broken)).toThrow('references')
    const grouping = structuredClone(value)
    grouping.report!.evidence.grouping!.findings[0]!.occurrenceIds = ['missing']
    expect(() => validateSavedEvaluation(grouping)).toThrow('grouping')
  })
  it('retains old scan metadata even when current inventory and sample selection have changed', () => {
    const value = savedFixture()
    const sample = value.scans[value.evaluation.samples[0]!.id]!.sample
    sample.inventoryIds = ['deleted-inventory']
    sample.selection = { kind: 'random', source: 'Earlier CMS export', method: 'Earlier draw', drawId: 'old-draw', candidateId: 'old-candidate' }
    // The current definition has moved on; historical sample metadata remains independent.
    value.evaluation.samples = [structuredClone(value.evaluation.samples[0]!)]
    value.evaluation.samples[0]!.inventoryIds = []
    value.evaluation.samples[0]!.selection = { kind: 'structured', source: '', method: '' }
    const parsed = validateSavedEvaluation(value)
    expect(Object.values(parsed.scans)[0]!.sample.selection!.source).toBe('Earlier CMS export')
    expect(Object.values(parsed.scans)[0]!.sample.inventoryIds).toEqual(['deleted-inventory'])
  })
})
