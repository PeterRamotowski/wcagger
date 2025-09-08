import { ref, computed, watch } from 'vue';
import { wcagStandards } from '~/utils/wcagStandards';
import { exportAccessibilityReport, generatePDFReport } from '~/utils/exportReport';

export const useAccessibilityForm = () => {
  const url = ref('');
  const selectedTools = ref(['axe', 'pa11y']);
  const selectedRunners = ref(['htmlcs', 'axe']);
  const wcagLevel = ref('WCAG21AA');

  const selectedStandardInfo = computed<WcagStandard | null>(() => {
    return wcagStandards[wcagLevel.value] || null;
  });

  const handleFormSubmit = (checkAccessibility: (url: string, tools: string[], standard: string, runners?: string[]) => void) => {
    checkAccessibility(url.value, selectedTools.value, wcagLevel.value, selectedRunners.value);
  };

  const exportReport = (format: 'json' | 'csv', results: AccessibilityCheckResults | null) => {
    if (!results) return;
    exportAccessibilityReport(format, url.value, selectedTools.value, results);
  };

  const handlePDFGeneration = async (results: AccessibilityCheckResults | null) => {
    if (!results) return;
    try {
      await generatePDFReport(results, selectedTools.value, wcagLevel.value, selectedStandardInfo.value);
    } catch (error) {
      throw new Error('PDF generation failed');
    }
  };

  watch(selectedTools, (newTools) => {
    if (newTools.includes('pa11y') && selectedRunners.value.length === 0) {
      selectedRunners.value = ['htmlcs', 'axe'];
    }
  });

  return {
    url,
    selectedTools,
    selectedRunners,
    wcagLevel,
    selectedStandardInfo,
    handleFormSubmit,
    exportReport,
    handlePDFGeneration,
  };
};
