// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, effectScope } from 'vue'
import { mount } from '@vue/test-utils'
import { IDBFactory } from 'fake-indexeddb'
import { useSavedEvaluations } from '../app/composables/useSavedEvaluations'
import { useEvaluation } from '../app/composables/useEvaluation'
import { savedFixture } from './fixtures/savedEvaluation'
import { combineEvaluationResults } from '../server/services/evaluationResultsService'
import { reportFixture } from './fixtures/groupedReport'

describe('saved progress workflow', () => {
  it('protects dirty work and imports backups as separate copies without overwriting the original', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory())
    const source = ref(savedFixture())
    let state!: ReturnType<typeof useSavedEvaluations>
    const wrapper = mount(defineComponent({ setup() {
      state = useSavedEvaluations(() => ({ evaluation: source.value.evaluation, assessments: source.value.assessments, assessmentHistory: [], scans: source.value.scans, scanHistory: [], report: source.value.report, reportHistory: [], tools: source.value.tools, runners: source.value.runners }), (value) => {
        source.value = value
      }, () => {
        source.value = savedFixture()
      })
      return () => h('div')
    } }))
    await vi.waitFor(() => expect(state.busy.value).toBe(false))
    await state.save()
    expect(state.status.value).toBe('saved')
    const saved = state.entries.value[0]!
    source.value.evaluation.name = 'Unsaved change'
    expect(state.dirty.value).toBe(true)
    await state.load(saved.id)
    expect(state.error.value).toContain('Save or download')
    expect(source.value.evaluation.name).toBe('Unsaved change')
    state.discard()
    await state.load(saved.id)
    expect(source.value.evaluation.name).toBe('Saved assessment')
    expect(state.dirty.value).toBe(false)
    const backup = JSON.stringify(source.value)
    await state.importFile(backup)
    expect(state.status.value).toBe('imported')
    expect(state.dirty.value).toBe(true)
    await state.save()
    expect(state.entries.value).toHaveLength(2)
    expect(state.entries.value.map(entry => entry.id)).toContain(saved.id)
    wrapper.unmount()
  })
  it('preserves older individual scans across successful and failed replacements', async () => {
    const scope = effectScope()
    const state = scope.run(() => useEvaluation())!
    state.evaluation.value.samples[0]!.url = 'https://example.test/start'
    state.evaluation.value.targetStandard = 'WCAG22AA'
    const sampleId = state.evaluation.value.samples[0]!.id
    const first = reportFixture()
    const next = reportFixture()
    const fetcher = vi.fn().mockResolvedValueOnce({ success: true, data: first }).mockResolvedValueOnce({ success: true, data: next }).mockResolvedValueOnce({ success: false, error: 'Failed replacement' })
    vi.stubGlobal('$fetch', fetcher)
    await state.scanSample(sampleId, ['axe'], [])
    await state.scanSample(sampleId, ['axe'], [])
    expect(state.scanHistory.value[0]!.results.evidence.runs.map(run => run.id)).toEqual(first.evidence.runs.map(run => run.id))
    await state.scanSample(sampleId, ['axe'], [])
    expect(state.scans.value[sampleId]).toBeUndefined()
    expect(state.scanHistory.value).toHaveLength(2)
    scope.stop()
  })
  it('builds a manual-only evaluation snapshot without a scan request', async () => {
    const scope = effectScope()
    const state = scope.run(() => useEvaluation())!
    state.evaluation.value.samples[0]!.url = 'https://example.test/manual'
    state.evaluation.value.samples[0]!.preparation = 'manual'
    const request = vi.fn()
    vi.stubGlobal('$fetch', request)
    const report = await state.buildReport(['axe'], [])
    expect(report!.evidence.evaluation!.samples[0]!.preparation).toBe('manual')
    expect(report!.evidence.runs).toEqual([])
    expect(report!.evidence.evaluation!.scannedSampleIds).toEqual([])
    expect(request).not.toHaveBeenCalled()
    scope.stop()
  })
  it('rebuilds reopened partial evidence without the expired job and retains its attempt history', async () => {
    const scope = effectScope()
    const state = scope.run(() => useEvaluation())!
    const workspace = savedFixture()
    state.evaluation.value = workspace.evaluation
    state.scans.value = workspace.scans
    const sample = workspace.evaluation.samples[0]!
    state.scans.value[sample.id]!.status = 'partial'
    workspace.report!.evidence.evaluation!.scannedSampleIds = []
    workspace.report!.evidence.evaluation!.partiallyScannedSampleIds = [sample.id]
    workspace.report!.evidence.evaluation!.execution = { jobId: 'expired-job', status: 'incomplete', tools: workspace.tools, runners: workspace.runners, tasks: [{ sampleId: sample.id, key: 'axe', attempts: [{ id: 'failed-attempt', status: 'failed', error: 'Engine failed' }] }] }
    const request = vi.fn().mockImplementation(async (_url, options) => ({ success: true, data: combineEvaluationResults(JSON.parse(JSON.stringify(options.body))) }))
    vi.stubGlobal('$fetch', request)
    const result = await state.buildReport(workspace.tools, workspace.runners, workspace.report!)
    expect(state.error.value).toBeNull()
    expect(result!.evidence.observations).toHaveLength(workspace.report!.evidence.observations.length)
    expect(result!.evidence.evaluation!.scannedSampleIds).toEqual([])
    expect(result!.evidence.evaluation!.partiallyScannedSampleIds).toEqual([sample.id])
    expect(result!.evidence.evaluation!.execution!.tasks[0]!.attempts[0]!.error).toBe('Engine failed')
    expect(state.currentScan(sample, workspace.tools, workspace.runners)).toBe(false)
    expect(state.currentRunIds(sample.id, workspace.tools, workspace.runners)).toHaveLength(workspace.report!.evidence.runs.length)
    expect(request.mock.calls[0]![0]).toBe('/api/evaluation-results')
    expect(request.mock.calls[0]![1].body.scans[0].partial).toBe(true)
    scope.stop()
  })
})
