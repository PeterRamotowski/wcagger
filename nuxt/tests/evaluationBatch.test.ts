// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { mount } from '@vue/test-utils'
import { useEvaluation } from '../app/composables/useEvaluation'
import JobProgress from '../app/components/Evaluation/JobProgress.vue'
import type { EvaluationJob } from '../shared/types/evaluationJob'
import en from '../i18n/locales/en.json'
import { reportFixture } from './fixtures/groupedReport'

function setup() {
  const scope = effectScope()
  const state = scope.run(() => useEvaluation())!
  state.evaluation.value.samples[0]!.url = 'https://example.com/'
  const sample = state.evaluation.value.samples[0]!
  const job: EvaluationJob = {
    schemaVersion: 1, id: 'job-test', evaluation: JSON.parse(JSON.stringify(state.evaluation.value)),
    tools: ['axe'], runners: [], status: 'queued', createdAt: '2026-10-23T10:00:00Z', updatedAt: '2026-10-23T10:00:00Z', expiresAt: '2026-10-24T10:00:00Z',
    tasks: [{ sampleId: sample.id, key: 'axe', attempts: [{ id: 'attempt-1', status: 'queued' }] }],
  }
  const report = reportFixture()
  report.evidence.sample = structuredClone(job.evaluation.samples[0]!)
  for (const run of report.evidence.runs) {
    run.sampleId = sample.id
    run.stateId = sample.state.id
  }
  report.evidence.evaluation = { ...job.evaluation, scannedSampleIds: [sample.id] }
  const fetcher = vi.fn().mockImplementation(async (url: string) => url.endsWith('/report') ? report : structuredClone(job))
  vi.stubGlobal('$fetch', fetcher)
  return { scope, state, sample, job, report, fetcher }
}
describe('batch progress and reconnect state', () => {
  it('starts a background job, polls compact status and loads evidence after completion', async () => {
    const { scope, state, job, fetcher } = setup()
    try {
      await state.startBatch(['axe'], [])
      expect(state.batchBusy.value).toBe(true)
      expect(fetcher.mock.calls[0]![0]).toBe('/api/evaluation-jobs')
      expect(fetcher.mock.calls[1]![0]).toBe('/api/evaluation-jobs/job-test')
      expect(sessionStorage.getItem('wcagger-evaluation-job')).toBe(job.id)
      job.status = 'completed'
      job.tasks[0]!.attempts[0]!.status = 'completed'
      await state.refreshBatch()
      expect(state.batchBusy.value).toBe(false)
      expect(state.batchReport.value!.evidence.evaluation!.scannedSampleIds).toHaveLength(1)
      expect(state.batchMatches(['axe'], [])).toBe(true)
    } finally {
      scope.stop()
    }
  })
  it('preserves errors without discarding the job and stops callbacks after the component is disposed', async () => {
    const { scope, state, fetcher } = setup()
    await state.startBatch(['axe'], [])
    fetcher.mockRejectedValueOnce(new Error('Connection interrupted'))
    await state.refreshBatch()
    expect(state.batchError.value).toBe('Connection interrupted')
    expect(state.batchJob.value!.id).toBe('job-test')
    scope.stop()
    const count = fetcher.mock.calls.length
    await state.refreshBatch()
    expect(fetcher).toHaveBeenCalledTimes(count)
  })
  it('retries failed work and preserves captured evidence while updating editable sample labels', async () => {
    const { scope, state, job, fetcher } = setup()
    try {
      job.status = 'incomplete'
      job.tasks[0]!.attempts[0]!.status = 'failed'
      await state.startBatch(['axe'], [])
      state.evaluation.value.samples[0]!.name = 'Updated sample label'
      const result = await state.buildReport(['axe'], [])
      expect(result!.evidence.evaluation!.samples[0]!.name).toBe('Updated sample label')
      expect(job.evaluation.samples[0]!.name).toBe('')
      await state.retryBatch()
      expect(fetcher.mock.calls.some(([url]) => url === '/api/evaluation-jobs/job-test/retry')).toBe(true)
    } finally {
      scope.stop()
    }
  })
  it('shows incomplete work, all attempt outcomes and an eligible retry action', async () => {
    const { scope, job } = setup()
    job.status = 'incomplete'
    job.tasks[0]!.attempts = [{ id: 'first', status: 'failed', error: 'Navigation timed out' }, { id: 'second', status: 'failed', error: 'Connection reset' }]
    const wrapper = mount(JobProgress, { props: { job, error: null, busy: false }, global: { mocks: { $t: (key: string) => (en as Record<string, string>)[key] ?? key } } })
    try {
      expect(wrapper.text()).toContain('Incomplete evaluation scan')
      expect(wrapper.text()).toContain('Navigation timed out')
      expect(wrapper.text()).toContain('Connection reset')
      expect(wrapper.find('progress').attributes('value')).toBe('1')
      await wrapper.find('button').trigger('click')
      expect(wrapper.emitted('retry')).toHaveLength(1)
    } finally {
      wrapper.unmount()
      scope.stop()
    }
  })
})
