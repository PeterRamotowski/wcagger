import { computed, ref } from 'vue'
import type { DeepReadonly } from 'vue'
import type { ApiResponse, AccessibilityCheckResults } from '~~/shared/types/accessibility'
import type { EvaluationSample, SampleScan } from '~~/shared/types/evaluation'
import { newEvaluation, scanMatchesSample, validateEvaluation } from '~~/shared/utils/evaluation'

export function useEvaluation() {
  const evaluation = ref(newEvaluation())
  const scans = ref<Record<string, SampleScan>>({})
  const busySampleId = ref<string | null>(null)
  const isBuilding = ref(false)
  const error = ref<string | null>(null)
  const sampleErrors = ref<Record<string, string>>({})
  const busy = computed(() => !!busySampleId.value || isBuilding.value)
  const currentScan = (sample: EvaluationSample, tools: string[], runners: string[]) => scanMatchesSample(scans.value[sample.id], sample, evaluation.value.targetStandard, tools, runners)
  const scanSample = async (id: string, tools: string[], runners: string[]) => {
    if (busy.value) return
    const sample = evaluation.value.samples.find(item => item.id === id)
    if (!sample || sample.preparation !== 'initial-page') return
    busySampleId.value = id
    error.value = null
    sampleErrors.value = Object.fromEntries(Object.entries(sampleErrors.value).filter(([key]) => key !== id))
    try {
      // Validate just this sample; incomplete draft rows do not block independent scans.
      const snapshot = validateEvaluation({ ...evaluation.value, samples: [sample] })
      const captured = { sample: snapshot.samples[0]!, standard: snapshot.targetStandard, tools: [...tools], runners: [...runners] }
      const response = await $fetch<ApiResponse>('/api/check-accessibility', { method: 'POST', body: { url: captured.sample.url, tools: captured.tools, standard: captured.standard, runners: captured.runners } })
      if (!response.success || !response.data) throw new Error(response.error || 'Sample scan failed')
      scans.value[id] = { ...captured, results: response.data }
    } catch (cause) {
      // A failed replacement must not silently reuse an older successful scan.
      scans.value = Object.fromEntries(Object.entries(scans.value).filter(([key]) => key !== id))
      sampleErrors.value[id] = cause instanceof Error ? cause.message : 'Sample scan failed'
    } finally { busySampleId.value = null }
  }
  const buildReport = async (tools: string[], runners: string[], previous?: DeepReadonly<AccessibilityCheckResults> | null): Promise<AccessibilityCheckResults | null> => {
    if (busy.value) return null
    isBuilding.value = true
    error.value = null
    try {
      const snapshot = validateEvaluation(evaluation.value)
      const selected = snapshot.samples.filter(sample => currentScan(sample, tools, runners))
      const runIds = selected.flatMap(sample => scans.value[sample.id]!.results.evidence.runs.map(run => run.id)).sort()
      const sameEvidence = previous?.evidence.evaluation?.id === snapshot.id && JSON.stringify(runIds) === JSON.stringify(previous.evidence.runs.map(run => run.id).sort())
      const response = await $fetch<ApiResponse>('/api/evaluation-results', { method: 'POST', body: {
        ...(sameEvidence && { decisions: previous?.evidence.grouping?.decisions }),
        evaluation: snapshot, scans: selected.map(sample => ({ sampleId: sample.id, evidence: scans.value[sample.id]!.results.evidence })),
      } })
      if (!response.success || !response.data) throw new Error(response.error || 'Could not build evaluation report')
      return response.data
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not build evaluation report'
      return null
    } finally { isBuilding.value = false }
  }
  return { evaluation, scans, busySampleId, isBuilding, busy, error, sampleErrors, currentScan, scanSample, buildReport }
}
