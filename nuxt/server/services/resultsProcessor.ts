export class ResultsProcessor {
  static createInitialResults(url: string): AccessibilityCheckResults {
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

  static addAxeResults(
    results: AccessibilityCheckResults,
    axeResults: AxeProcessedResults
  ): AccessibilityCheckResults {
    // Add axe violations
    const axeViolations = axeResults.violations.map(violation => ({
      ...violation,
      source: 'axe' as const
    }));

    // Add axe incomplete results
    const axeWarnings = axeResults.incomplete.map(warning => ({
      ...warning,
      source: 'axe' as const
    }));

    // Add axe passes
    const axePasses = axeResults.passes.map(pass => ({
      ...pass,
      source: 'axe' as const
    }));

    results.combined = {
      violations: [...results.combined.violations, ...axeViolations],
      warnings: [...results.combined.warnings, ...axeWarnings],
      passed: [...results.combined.passed, ...axePasses]
    };

    return results;
  }

  static addPa11yResults(
    results: AccessibilityCheckResults,
    pa11yResults: Pa11yProcessedResults
  ): AccessibilityCheckResults {
    // Add pa11y errors
    const pa11yViolations = pa11yResults.errors.map(error => ({
      ...error,
      source: 'pa11y' as const,
      runner: error.runner || 'unknown'
    }));

    // Add pa11y warnings
    const pa11yWarnings = pa11yResults.warnings.map(warning => ({
      ...warning,
      source: 'pa11y' as const,
      runner: warning.runner || 'unknown'
    }));

    // Add pa11y notices
    const pa11yNotices = pa11yResults.notices.map(notice => ({
      ...notice,
      source: 'pa11y' as const,
      runner: notice.runner || 'unknown'
    }));

    results.combined = {
      violations: [...results.combined.violations, ...pa11yViolations],
      warnings: [...results.combined.warnings, ...pa11yWarnings, ...pa11yNotices],
      passed: [...results.combined.passed]
    };

    return results;
  }

  static finalizeResults(results: AccessibilityCheckResults): AccessibilityCheckResults {
    results.summary = {
      totalViolations: results.combined.violations.length,
      totalWarnings: results.combined.warnings.length,
      totalPassed: results.combined.passed.length
    };

    return results;
  }
}
