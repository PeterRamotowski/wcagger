import { randomUUID } from 'node:crypto'
import type { EngineEvidence, ScanEvidence } from '~~/shared/types/scanEvidence'
import type {
  AccessibilityCheckResults,
  AxeProcessedResults,
  Pa11yProcessedResults,
} from '~~/shared/types/accessibility'

export class ResultsProcessor {
  createInitialResults(url: string): AccessibilityCheckResults {
    return {
      url,
      timestamp: new Date().toISOString(),
      evidence: {
        schemaVersion: 1,
        sample: {
          id: randomUUID(),
          url,
          state: { id: randomUUID(), description: 'Initial page state' },
        },
        runs: [],
        observations: [],
      },
      summary: {
        totalViolations: 0,
        totalWarnings: 0,
        totalPassed: 0,
      },
      combined: {
        violations: [],
        warnings: [],
        passed: [],
      },
    }
  }

  addAxeResults(
    results: AccessibilityCheckResults,
    axeResults: AxeProcessedResults,
  ): AccessibilityCheckResults {
    const axeViolations = axeResults.violations.map(violation => ({
      ...violation,
      source: 'axe' as const,
    }))

    const axeWarnings = axeResults.incomplete.map(warning => ({
      ...warning,
      source: 'axe' as const,
    }))

    const axePasses = axeResults.passes.map(pass => ({
      ...pass,
      source: 'axe' as const,
    }))

    return {
      ...results,
      evidence: this.appendEvidence(results.evidence, axeResults.evidence),
      combined: {
        violations: [...results.combined.violations, ...axeViolations],
        warnings: [...results.combined.warnings, ...axeWarnings],
        passed: [...results.combined.passed, ...axePasses],
      },
    }
  }

  addPa11yResults(
    results: AccessibilityCheckResults,
    pa11yResults: Pa11yProcessedResults,
  ): AccessibilityCheckResults {
    const pa11yViolations = pa11yResults.errors.map(error => ({
      ...error,
      source: 'pa11y' as const,
      runner: error.runner || 'unknown',
    }))

    const pa11yWarnings = pa11yResults.warnings.map(warning => ({
      ...warning,
      source: 'pa11y' as const,
      runner: warning.runner || 'unknown',
    }))

    const pa11yNotices = pa11yResults.notices.map(notice => ({
      ...notice,
      source: 'pa11y' as const,
      runner: notice.runner || 'unknown',
    }))

    return {
      ...results,
      evidence: this.appendEvidence(results.evidence, pa11yResults.evidence),
      combined: {
        violations: [...results.combined.violations, ...pa11yViolations],
        warnings: [...results.combined.warnings, ...pa11yWarnings, ...pa11yNotices],
        passed: [...results.combined.passed],
      },
    }
  }

  private appendEvidence(current: ScanEvidence, incoming: EngineEvidence): ScanEvidence {
    return {
      ...current,
      runs: [...current.runs, ...incoming.runs.map(run => ({
        ...run,
        sampleId: current.sample.id,
        stateId: current.sample.state.id,
      }))],
      observations: [...current.observations, ...incoming.observations],
    }
  }

  finalizeResults(results: AccessibilityCheckResults): AccessibilityCheckResults {
    return {
      ...results,
      summary: {
        totalViolations: results.combined.violations.length,
        totalWarnings: results.combined.warnings.length,
        totalPassed: results.combined.passed.length,
      },
    }
  }
}

export const defaultResultsProcessor = new ResultsProcessor()
