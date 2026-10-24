import type { EvidenceGrouping, FindingGroupingDecision } from '~~/shared/types/scanEvidence'
import { useI18n } from '#i18n'

export const useAccessibilityCheck = () => {
  const { t } = useI18n()
  const isLoading = ref(false)
  const loadingStep = ref(t('initializing_accessibility_check'))
  const results = ref<AccessibilityCheckResults | null>(null)
  const error = ref<string | null>(null)
  const isGrouping = ref(false)
  const groupingError = ref<string | null>(null)

  const checkAccessibility = async (url: string, tools: string[], standard: string, runners?: string[]) => {
    if (!url.trim()) return

    isLoading.value = true
    error.value = null
    results.value = null
    groupingError.value = null

    try {
      const urlPattern = /^https?:\/\/.+/
      if (!urlPattern.test(url.trim())) {
        throw new Error('Please enter a valid URL starting with http:// or https://')
      }

      loadingStep.value = t('launching_accessibility_scanners')

      const response = await $fetch<ApiResponse>('/api/check-accessibility', {
        method: 'POST',
        body: {
          url: url.trim(),
          tools,
          standard,
          ...(runners && { runners }),
        },
      })

      if (response.success) {
        results.value = response.data!
        loadingStep.value = t('accessibility_check_complete')
      } else {
        throw new Error(response.error || 'Failed to check accessibility')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      error.value = errorMessage
      console.error('Accessibility check error:', err)
    } finally {
      isLoading.value = false
    }
  }

  const applyGroupingDecision = async (decision: FindingGroupingDecision, persistJob = true) => {
    const current = results.value
    if (!current || isGrouping.value) return
    isGrouping.value = true
    groupingError.value = null
    try {
      const response = await $fetch<{ success: boolean, data: EvidenceGrouping }>('/api/group-findings', {
        method: 'POST', body: { evidence: { ...current.evidence, evaluation: current.evidence.evaluation ? { ...current.evidence.evaluation, manualAssessments: undefined, reporting: undefined, ...(!persistJob && { execution: undefined }) } : undefined }, decision },
      })
      if (results.value === current) {
        results.value = { ...current, evidence: { ...current.evidence, grouping: response.data } }
      }
    } catch (error) {
      if (results.value === current) groupingError.value = error instanceof Error ? error.message : 'Could not update grouping'
    } finally {
      isGrouping.value = false
    }
  }

  const resetTest = () => {
    isLoading.value = false
    loadingStep.value = t('initializing_accessibility_check')
    results.value = null
    error.value = null
  }

  return {
    isLoading: readonly(isLoading),
    loadingStep: readonly(loadingStep),
    results: readonly(results),
    error: readonly(error),

    isGrouping: readonly(isGrouping),
    groupingError: readonly(groupingError),
    applyGroupingDecision,
    setResults: (value: AccessibilityCheckResults) => {
      results.value = value
      error.value = null
      groupingError.value = null
    },
    checkAccessibility,
    resetTest,
  }
}
