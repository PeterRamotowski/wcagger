import { randomUUID } from 'node:crypto'
import type { Page, Browser } from 'puppeteer'
import { createBrowser, configurePage, defaultBrowserConfig } from '~~/server/utils/browserConfig'
import { AxeAnalysisService } from '~~/server/services/axeAnalysisService'
import { Pa11yAnalysisService } from '~~/server/services/pa11yAnalysisService'
import { defaultResultsProcessor } from '~~/server/services/resultsProcessor'
import type {
  AccessibilityCheckResults,
  AxeProcessedResults,
  Pa11yProcessedResults,
  TestRequest,
} from '~~/shared/types/accessibility'

type BrowserFactory = typeof createBrowser

type AccessibilityResultsProcessor = {
  createInitialResults(url: string): AccessibilityCheckResults
  addAxeResults(results: AccessibilityCheckResults, axeResults: AxeProcessedResults): AccessibilityCheckResults
  addPa11yResults(results: AccessibilityCheckResults, pa11yResults: Pa11yProcessedResults): AccessibilityCheckResults
  finalizeResults(results: AccessibilityCheckResults): AccessibilityCheckResults
}

type AxeAnalysisFactory = (browser: Browser) => AxeAnalysisService
type Pa11yAnalysisFactory = (browser: Browser) => Pa11yAnalysisService

export class AccessibilityCheckService {
  constructor(
    private readonly browserFactory: BrowserFactory = createBrowser,
    private readonly resultsProcessor: AccessibilityResultsProcessor = defaultResultsProcessor,
    private readonly axeAnalysisFactory: AxeAnalysisFactory = browser => new AxeAnalysisService(browser),
    private readonly pa11yAnalysisFactory: Pa11yAnalysisFactory = browser => new Pa11yAnalysisService(browser),
  ) {}

  async run(request: TestRequest): Promise<AccessibilityCheckResults> {
    let browser: Browser | null = null
    let page: Page | null = null
    let results = this.resultsProcessor.createInitialResults(request.url)

    try {
      browser = await this.browserFactory()
      page = await browser.newPage()
      await configurePage(page)
      await page.goto(request.url, { waitUntil: request.tools.includes('axe') ? 'networkidle0' : 'networkidle2', timeout: defaultBrowserConfig.timeout })
      const documentContext = { page, documentId: randomUUID() }

      if (request.tools.includes('axe')) {
        const axeService = this.axeAnalysisFactory(browser)
        const axeResults = await axeService.analyze(request.url, request.standard, documentContext)
        results = this.resultsProcessor.addAxeResults(results, axeResults)
      }

      if (request.tools.includes('pa11y')) {
        const pa11yService = this.pa11yAnalysisFactory(browser)
        const pa11yResults = await pa11yService.analyze(request.url, request.standard, request.runners, documentContext)
        results = this.resultsProcessor.addPa11yResults(results, pa11yResults)
      }

      return this.resultsProcessor.finalizeResults(results)
    } finally {
      try {
        if (page) await page.close()
      } finally {
        if (browser) await browser.close()
      }
    }
  }
}
