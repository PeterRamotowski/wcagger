import { computed, ref, getCurrentInstance, getCurrentScope, onMounted, onScopeDispose } from 'vue'
import type { DeepReadonly } from 'vue'
import type { ApiResponse, AccessibilityCheckResults } from '~~/shared/types/accessibility'
import type { EvaluationJob } from '~~/shared/types/evaluationJob'
import type { EvaluationSample, SampleScan } from '~~/shared/types/evaluation'
import { newEvaluation, scanMatchesSample, validateEvaluation } from '~~/shared/utils/evaluation'

export function useEvaluation() {
  const evaluation = ref(newEvaluation())
  const scans = ref<Record<string, SampleScan>>({})
  const busySampleId = ref<string | null>(null)
  const isBuilding = ref(false)
  const error = ref<string | null>(null)
  const sampleErrors = ref<Record<string, string>>({})
  const batchJob = ref<EvaluationJob | null>(null)
  const batchReport = ref<AccessibilityCheckResults | null>(null)
  const batchError = ref<string | null>(null)
  const startingBatch = ref(false)
  const batchBusy = computed(() => startingBatch.value || (!!batchJob.value && ['queued', 'running'].includes(batchJob.value.status)))
  const busy = computed(() => !!busySampleId.value || isBuilding.value || batchBusy.value)
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let refreshVersion = 0
  const batchMatches = (tools: string[], runners: string[]) => !!batchJob.value && evaluation.value.id === batchJob.value.evaluation.id
    && evaluation.value.samples.length === batchJob.value.evaluation.samples.length
    && evaluation.value.samples.every((sample) => {
      const captured = batchJob.value!.evaluation.samples.find(item => item.id === sample.id)
      // Manual states are retained but never treated as scan evidence.
      return captured && sample.preparation === captured.preparation && sample.url.trim() === captured.url && sample.state.id === captured.state.id && sample.state.description.trim() === captured.state.description
    }) && evaluation.value.targetStandard === batchJob.value.evaluation.targetStandard
    && [...tools].sort().join(',') === [...batchJob.value.tools].sort().join(',')
    && (!tools.includes('pa11y') || [...runners].sort().join(',') === [...batchJob.value.runners].sort().join(','))
  const refreshBatch = async () => {
    const id = batchJob.value?.id
    if (!id || disposed)
      return
    clearTimeout(pollTimer)
    const version = ++refreshVersion
    try {
      const job = await $fetch<EvaluationJob>('/api/evaluation-jobs/' + id, { timeout: 15000 })
      if (disposed || batchJob.value?.id !== id || version !== refreshVersion)
        return
      batchJob.value = job
      batchError.value = null
      if (['queued', 'running'].includes(job.status))
        pollTimer = setTimeout(refreshBatch, 1500)
      else {
        const report = await $fetch<AccessibilityCheckResults>('/api/evaluation-jobs/' + id + '/report', { timeout: 15000 })
        if (disposed || batchJob.value?.id !== id || version !== refreshVersion)
          return
        batchReport.value = report
        for (const sample of job.evaluation.samples.filter(sample => report.evidence.evaluation!.scannedSampleIds.includes(sample.id))) {
          const runs = report.evidence.runs.filter(run => run.sampleId === sample.id)
          const ids = new Set(runs.map(run => run.id))
          scans.value[sample.id] = { sample: structuredClone(sample), standard: job.evaluation.targetStandard, tools: [...job.tools], runners: [...job.runners], results: { ...report, url: sample.url, evidence: { schemaVersion: 1, sample, runs, observations: report.evidence.observations.filter(item => ids.has(item.runId)) } } }
        }
      }
    } catch (cause) {
      if (disposed || batchJob.value?.id !== id || version !== refreshVersion)
        return
      batchError.value = cause instanceof Error ? cause.message : 'Could not refresh the batch scan'
      if (cause && typeof cause === 'object' && 'statusCode' in cause && [404, 410].includes(Number(cause.statusCode))) {
        batchJob.value = null
        try {
          sessionStorage.removeItem('wcagger-evaluation-job')
        } catch { /* Storage may be disabled. */ }
        return
      }
      pollTimer = setTimeout(refreshBatch, 5000)
    }
  }
  const startBatch = async (tools: string[], runners: string[]) => {
    if (busy.value)
      return
    startingBatch.value = true
    batchError.value = null
    refreshVersion++
    clearTimeout(pollTimer)
    try {
      const snapshot = validateEvaluation(evaluation.value)
      const job = await $fetch<EvaluationJob>('/api/evaluation-jobs', { method: 'POST', body: { evaluation: snapshot, tools, runners } })
      batchJob.value = job
      batchReport.value = null
      try {
        sessionStorage.setItem('wcagger-evaluation-job', job.id)
      } catch { /* Storage may be disabled. */ }
      await refreshBatch()
    } catch (cause) {
      batchError.value = cause instanceof Error ? cause.message : 'Could not start the batch scan'
    } finally {
      startingBatch.value = false
    }
  }
  const retryBatch = async () => {
    if (busy.value || !batchJob.value)
      return
    startingBatch.value = true
    batchError.value = null
    try {
      batchJob.value = await $fetch<EvaluationJob>('/api/evaluation-jobs/' + batchJob.value.id + '/retry', { method: 'POST' })
      await refreshBatch()
    } catch (cause) {
      batchError.value = cause instanceof Error ? cause.message : 'Could not retry failed scans'
    } finally {
      startingBatch.value = false
    }
  }
  if (getCurrentInstance())
    onMounted(async () => {
      let id: string | null = null
      try {
        id = sessionStorage.getItem('wcagger-evaluation-job')
      } catch {
        return
      }
      if (!id)
        return
      try {
        const job = await $fetch<EvaluationJob>('/api/evaluation-jobs/' + id)
        if (disposed)
          return
        batchJob.value = job
        evaluation.value = structuredClone(job.evaluation)
        await refreshBatch()
      } catch {
        try {
          sessionStorage.removeItem('wcagger-evaluation-job')
        } catch { /* Storage may be disabled. */ }
      }
    })
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true
      refreshVersion++
      clearTimeout(pollTimer)
    })
  const currentScan = (sample: EvaluationSample, tools: string[], runners: string[]) => scanMatchesSample(scans.value[sample.id], sample, evaluation.value.targetStandard, tools, runners)
  const scanSample = async (id: string, tools: string[], runners: string[]) => {
    if (busy.value)
      return
    const sample = evaluation.value.samples.find(item => item.id === id)
    if (!sample || sample.preparation !== 'initial-page')
      return
    if (batchJob.value) {
      clearTimeout(pollTimer)
      batchJob.value = null
      refreshVersion++
      try {
        sessionStorage.removeItem('wcagger-evaluation-job')
      } catch { /* Storage may be disabled. */ }
    }
    busySampleId.value = id
    error.value = null
    sampleErrors.value = Object.fromEntries(Object.entries(sampleErrors.value).filter(([key]) => key !== id))
    try {
      // Validate just this sample; incomplete draft rows do not block independent scans.
      const snapshot = validateEvaluation({ ...evaluation.value, samples: [sample] })
      const captured = { sample: snapshot.samples[0]!, standard: snapshot.targetStandard, tools: [...tools], runners: [...runners] }
      const response = await $fetch<ApiResponse>('/api/check-accessibility', { method: 'POST', body: { url: captured.sample.url, tools: captured.tools, standard: captured.standard, runners: captured.runners } })
      if (!response.success || !response.data)
        throw new Error(response.error || 'Sample scan failed')
      scans.value[id] = { ...captured, results: response.data }
    } catch (cause) {
      // A failed replacement must not silently reuse an older successful scan.
      scans.value = Object.fromEntries(Object.entries(scans.value).filter(([key]) => key !== id))
      sampleErrors.value[id] = cause instanceof Error ? cause.message : 'Sample scan failed'
    } finally {
      busySampleId.value = null
    }
  }
  const buildReport = async (tools: string[], runners: string[], previous?: DeepReadonly<AccessibilityCheckResults> | null): Promise<AccessibilityCheckResults | null> => {
    if (busy.value)
      return null
    isBuilding.value = true
    error.value = null
    try {
      const snapshot = validateEvaluation(evaluation.value)
      if (batchMatches(tools, runners) && batchJob.value) {
        const report = await $fetch<AccessibilityCheckResults>('/api/evaluation-jobs/' + batchJob.value.id + '/report')
        return { ...report, evidence: { ...report.evidence, sample: snapshot.samples[0]!, samples: snapshot.samples, evaluation: { ...report.evidence.evaluation!, ...snapshot } } }
      }
      const selected = snapshot.samples.filter(sample => currentScan(sample, tools, runners))
      const runIds = selected.flatMap(sample => scans.value[sample.id]!.results.evidence.runs.map(run => run.id)).sort()
      const sameEvidence = previous?.evidence.evaluation?.id === snapshot.id && JSON.stringify(runIds) === JSON.stringify(previous.evidence.runs.map(run => run.id).sort())
      const response = await $fetch<ApiResponse>('/api/evaluation-results', { method: 'POST', body: {
        ...(sameEvidence && { decisions: previous?.evidence.grouping?.decisions }),
        evaluation: snapshot, scans: selected.map(sample => ({ sampleId: sample.id, evidence: scans.value[sample.id]!.results.evidence })),
      } })
      if (!response.success || !response.data)
        throw new Error(response.error || 'Could not build evaluation report')
      return response.data
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not build evaluation report'
      return null
    } finally {
      isBuilding.value = false
    }
  }
  return { batchJob, batchReport, batchError, batchBusy, batchMatches, startBatch, retryBatch, refreshBatch, evaluation, scans, busySampleId, isBuilding, busy, error, sampleErrors, currentScan, scanSample, buildReport }
}
