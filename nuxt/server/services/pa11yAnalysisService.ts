import { createPa11yEvidence } from '~~/server/services/scanEvidenceService'
import type { Pa11yProcessedResults } from '~~/shared/types/accessibility'
import type { Pa11yIssue, Pa11yScanResults } from '~~/shared/types/scanEvidence'
import pa11y from 'pa11y'
import type { Browser } from 'puppeteer'
import { getPa11yStandard } from '~~/server/utils/wcagMapping'

export class Pa11yAnalysisService {
  private browser: Browser

  constructor(browser: Browser) {
    this.browser = browser
  }

  async analyze(url: string, standard: string, runners: string[] = ['htmlcs', 'axe']): Promise<Pa11yProcessedResults> {
    const startedAt = new Date().toISOString()
    // Let scan failures reach the API error handler instead of returning empty results.
    const pa11yResults = await pa11y(url, {
      standard: getPa11yStandard(standard),
      runners,
      browser: this.browser,
      timeout: 20000,
      wait: 2000,
      includeNotices: true,
      includeWarnings: true,
    })

    return {
      ...this.processResults(pa11yResults),
      evidence: createPa11yEvidence(pa11yResults, {
        url, standard, startedAt, completedAt: new Date().toISOString(),
      }, runners),
    }
  }

  private processResults(pa11yResults: Pa11yScanResults): Omit<Pa11yProcessedResults, 'evidence'> {
    const processedResults: Omit<Pa11yProcessedResults, 'evidence'> = {
      errors: [],
      warnings: [],
      notices: [],
    }

    pa11yResults.issues.forEach((issue: Pa11yIssue) => {
      const processedIssue = {
        code: issue.code,
        type: issue.type,
        title: issue.message,
        description: undefined, // Pa11y doesn't provide additional description
        context: issue.context,
        selector: issue.selector,
        runner: issue.runner,
        runnerExtras: issue.runnerExtras,
      }

      switch (issue.type) {
        case 'error':
          processedResults.errors.push(processedIssue)
          break
        case 'warning':
          processedResults.warnings.push(processedIssue)
          break
        case 'notice':
          processedResults.notices.push(processedIssue)
          break
      }
    })

    return processedResults
  }
}
