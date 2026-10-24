import { createScanNetwork } from './scanNetworkService'
import type { ScanNetwork } from './scanNetworkService'
import type { EngineTaskKey, EngineUpdate } from '~~/shared/types/evaluationJob'
import { randomUUID } from 'node:crypto'
import type { Page, Browser } from 'puppeteer'
import { createBrowser, configurePage, defaultBrowserConfig } from '~~/server/utils/browserConfig'
import { AxeAnalysisService } from '~~/server/services/axeAnalysisService'
import { Pa11yAnalysisService } from '~~/server/services/pa11yAnalysisService'
import { defaultResultsProcessor } from '~~/server/services/resultsProcessor'
import type { AccessibilityCheckResults, AxeProcessedResults, Pa11yProcessedResults, TestRequest } from '~~/shared/types/accessibility'

async function finishWithin(operation: () => Promise<void>, timeout: number, onTimeout = () => {
}) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([operation(), new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        onTimeout()
        resolve()
      }, timeout)
    })])
  } catch (error) {
    onTimeout()
    throw error
  } finally {
    clearTimeout(timer)
  }
}
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
    private readonly networkFactory: () => Promise<ScanNetwork> = createScanNetwork,
    private readonly timeoutMs = 120000,
  ) {}

  async run(request: TestRequest): Promise<AccessibilityCheckResults> {
    return this.execute(request)
  }

  async runPartial(request: TestRequest, onEngine: (update: EngineUpdate) => Promise<void>, signal?: AbortSignal): Promise<AccessibilityCheckResults> {
    return this.execute(request, onEngine, signal)
  }

  private async execute(request: TestRequest, onEngine?: (update: EngineUpdate) => Promise<void>, signal?: AbortSignal): Promise<AccessibilityCheckResults> {
    let browser: Browser | null = null
    let page: Page | null = null
    let network: ScanNetwork | null = null
    let expired = false
    const close = () => {
      expired = true
      if (browser) {
        browser.process?.()?.kill('SIGKILL')
        void browser.close().catch(() => {
        })
      }
    }
    const timer = setTimeout(close, this.timeoutMs)
    signal?.addEventListener('abort', close, { once: true })
    let results = this.resultsProcessor.createInitialResults(request.url)
    try {
      if (signal?.aborted)
        throw new Error('Scan cancelled')
      network = await this.networkFactory()
      await network.assertTarget(request.url)
      browser = await this.browserFactory({ ...defaultBrowserConfig, additionalArgs: network.args })
      if (expired || signal?.aborted)
        throw new Error('Sample scan timed out or was cancelled')
      page = await browser.newPage()
      await configurePage(page)
      const navigation = await page.goto(request.url, { waitUntil: request.tools.includes('axe') ? 'networkidle0' : 'networkidle2', timeout: defaultBrowserConfig.timeout })
      network.assertHealthy?.()
      if (navigation && navigation.status() >= 400)
        throw new Error('Target page returned HTTP ' + navigation.status())
      const documentContext = { page, documentId: randomUUID() }
      const executeEngine = async (key: EngineTaskKey, analyze: () => Promise<AccessibilityCheckResults>) => {
        if (expired || signal?.aborted)
          throw new Error('Sample scan timed out or was cancelled')
        await onEngine?.({ key, status: 'running' })
        try {
          const incoming = await analyze()
          network?.assertHealthy?.()
          await onEngine?.({ key, status: 'completed', result: incoming })
        } catch (error) {
          if (!onEngine)
            throw error
          await onEngine({ key, status: 'failed', error: error instanceof Error ? error.message : 'Engine scan failed' })
        }
      }
      const initial = () => ({ ...this.resultsProcessor.createInitialResults(request.url), evidence: { ...results.evidence, runs: [], observations: [], grouping: undefined } })
      if (request.tools.includes('axe')) {
        await executeEngine('axe', async () => {
          const incoming = await this.axeAnalysisFactory(browser!).analyze(request.url, request.standard, documentContext)
          const own = this.resultsProcessor.finalizeResults(this.resultsProcessor.addAxeResults(initial(), incoming))
          results = this.resultsProcessor.addAxeResults(results, incoming)
          return own
        })
      }
      if (request.tools.includes('pa11y')) {
        const runnerSets = onEngine ? (request.runners ?? ['htmlcs', 'axe']).map(runner => [runner]) : [request.runners]
        for (const runners of runnerSets) {
          await executeEngine(('pa11y:' + (runners?.[0] ?? 'htmlcs')) as EngineTaskKey, async () => {
            const incoming = await this.pa11yAnalysisFactory(browser!).analyze(request.url, request.standard, runners, documentContext)
            const own = this.resultsProcessor.finalizeResults(this.resultsProcessor.addPa11yResults(initial(), incoming))
            results = this.resultsProcessor.addPa11yResults(results, incoming)
            return own
          })
        }
      }
      return this.resultsProcessor.finalizeResults(results)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', close)
      try {
        if (page)
          await finishWithin(() => page!.close(), 1000)
      } finally {
        try {
          if (browser)
            await finishWithin(() => browser!.close(), 2000, () => browser?.process?.()?.kill('SIGKILL'))
        } finally {
          await network?.close()
        }
      }
    }
  }
}
