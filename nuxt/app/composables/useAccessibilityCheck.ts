import { useI18n } from '#i18n'

export const useAccessibilityCheck = () => {
  const { t } = useI18n()
  const isLoading = ref(false);
  const loadingStep = ref(t('initializing_accessibility_check'));
  const results = ref<AccessibilityCheckResults | null>(null);
  const error = ref<string | null>(null);

  const checkAccessibility = async (url: string, tools: string[], standard: string, runners?: string[]) => {
    if (!url.trim()) return;

    isLoading.value = true;
    error.value = null;
    results.value = null;

    try {
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(url.trim())) {
        throw new Error('Please enter a valid URL starting with http:// or https://');
      }

      loadingStep.value = t('launching_accessibility_scanners');

      const response = await $fetch('/api/check-accessibility', {
        method: 'POST',
        body: {
          url: url.trim(),
          tools,
          standard,
          ...(runners && { runners })
        }
      }) as ApiResponse;

      if (response.success) {
        results.value = response.data!;
        loadingStep.value = t('accessibility_check_complete');
      } else {
        throw new Error(response.error || 'Failed to check accessibility');
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      error.value = errorMessage;
      console.error('Accessibility check error:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const resetTest = () => {
    isLoading.value = false;
    loadingStep.value = t('initializing_accessibility_check');
    results.value = null;
    error.value = null;
  };

  return {
    isLoading: readonly(isLoading),
    loadingStep: readonly(loadingStep),
    results: readonly(results),
    error: readonly(error),

    checkAccessibility,
    resetTest
  };
};
