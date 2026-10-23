import type {
  AccessibilityCheckResults,
  AxeProcessedResults,
  Pa11yProcessedResults
} from '~~/shared/types/accessibility';

export class ResultsProcessor {
  createInitialResults(url: string): AccessibilityCheckResults {
    return {
      url,
      timestamp: new Date().toISOString(),
      summary: {
        totalViolations: 0,
        totalWarnings: 0,
        totalPassed: 0
      },
      combined: {
        violations: [],
        warnings: [],
        passed: []
      }
    };
  }

  addAxeResults(
    results: AccessibilityCheckResults,
    axeResults: AxeProcessedResults
  ): AccessibilityCheckResults {
    const axeViolations = axeResults.violations.map(violation => ({
      ...violation,
      source: 'axe' as const
    }));

    const axeWarnings = axeResults.incomplete.map(warning => ({
      ...warning,
      source: 'axe' as const
    }));

    const axePasses = axeResults.passes.map(pass => ({
      ...pass,
      source: 'axe' as const
    }));

    return {
      ...results,
      combined: {
        violations: [...results.combined.violations, ...axeViolations],
        warnings: [...results.combined.warnings, ...axeWarnings],
        passed: [...results.combined.passed, ...axePasses]
      }
    };
  }

  addPa11yResults(
    results: AccessibilityCheckResults,
    pa11yResults: Pa11yProcessedResults
  ): AccessibilityCheckResults {
    const pa11yViolations = pa11yResults.errors.map(error => ({
      ...error,
      source: 'pa11y' as const,
      runner: error.runner || 'unknown'
    }));

    const pa11yWarnings = pa11yResults.warnings.map(warning => ({
      ...warning,
      source: 'pa11y' as const,
      runner: warning.runner || 'unknown'
    }));

    const pa11yNotices = pa11yResults.notices.map(notice => ({
      ...notice,
      source: 'pa11y' as const,
      runner: notice.runner || 'unknown'
    }));

    return {
      ...results,
      combined: {
        violations: [...results.combined.violations, ...pa11yViolations],
        warnings: [...results.combined.warnings, ...pa11yWarnings, ...pa11yNotices],
        passed: [...results.combined.passed]
      }
    };
  }

  finalizeResults(results: AccessibilityCheckResults): AccessibilityCheckResults {
    return {
      ...results,
      summary: {
        totalViolations: results.combined.violations.length,
        totalWarnings: results.combined.warnings.length,
        totalPassed: results.combined.passed.length
      }
    };
  }
}

export const defaultResultsProcessor = new ResultsProcessor();
