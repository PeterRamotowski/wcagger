import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Browser } from 'puppeteer'
import puppeteer from 'puppeteer'
import pa11y from 'pa11y'
import { AccessibilityCheckService } from '../server/services/accessibilityCheckService'
import { ResultsProcessor } from '../server/services/resultsProcessor'
import { axeResults, pa11yResults } from './fixtures/scanResults'

const scanners = vi.hoisted(() => ({ axe: vi.fn(), tags: vi.fn() }))
vi.mock('puppeteer', () => ({ default: { launch: vi.fn() } }))
vi.mock('pa11y', () => ({ default: vi.fn() }))
vi.mock('@axe-core/puppeteer', () => ({
  AxePuppeteer: class {
    withTags(tags: string[]) {
      scanners.tags(tags)
      return this
    }

    analyze() { return scanners.axe() }
  },
}))

function setup() {
  const page = { goto: vi.fn(), close: vi.fn(), setViewport: vi.fn(), setUserAgent: vi.fn() }
  const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() }
  vi.mocked(puppeteer.launch).mockResolvedValue(browser as unknown as Browser)
  scanners.axe.mockResolvedValue(axeResults())
  vi.mocked(pa11y).mockResolvedValue(pa11yResults())
  return { page, browser, service: new AccessibilityCheckService() }
}

const request = { url: 'https://example.test/', tools: ['axe', 'pa11y'], standard: 'WCAG21AA', runners: ['axe', 'htmlcs'] }

beforeEach(() => {
  vi.mocked(puppeteer.launch).mockReset()
  vi.mocked(pa11y).mockReset()
  scanners.axe.mockReset()
  scanners.tags.mockReset()
})

describe('scan orchestration and compatibility', () => {
  it('preserves legacy summaries while attributing evidence to engines, sample and state', async () => {
    const { service, browser, page } = setup()
    const result = await service.run(request)
    expect(result.summary).toEqual({ totalViolations: 3, totalWarnings: 3, totalPassed: 1 })
    expect(result.combined.violations.map(item => item.source)).toEqual(['axe', 'pa11y', 'pa11y'])
    expect(result.combined.warnings.map(item => item.code)).toEqual(['color-contrast', 'HTMLCS.warning', 'HTMLCS.notice'])
    expect(result.combined.passed[0]?.code).toBe('document-title')
    expect(result.evidence.runs.map(run => [run.tool, run.engine])).toEqual([['axe', 'axe'], ['pa11y', 'axe'], ['pa11y', 'htmlcs']])
    const runIds = new Set(result.evidence.runs.map(run => run.id))
    expect(result.evidence.observations.every(item => runIds.has(item.runId))).toBe(true)
    expect(result.evidence.runs.every(run => run.sampleId === result.evidence.sample.id && run.stateId === result.evidence.sample.state.id)).toBe(true)
    expect(browser.close).toHaveBeenCalledOnce()
    expect(page.close).toHaveBeenCalledOnce()
  })

  it('keeps separate executions and their sample/state identities independent', async () => {
    const { service } = setup()
    const first = await service.run(request)
    const second = await service.run(request)
    expect(second.evidence.sample.id).not.toBe(first.evidence.sample.id)
    expect(second.evidence.sample.state.id).not.toBe(first.evidence.sample.state.id)
    const priorIds = new Set(first.evidence.runs.map(run => run.id))
    expect(second.evidence.runs.every(run => !priorIds.has(run.id))).toBe(true)
  })

  it('does not mutate previous results when appending or finalizing', async () => {
    const { service } = setup()
    const processor = new ResultsProcessor()
    const initial = processor.createInitialResults(request.url)
    const before = structuredClone(initial)
    const scanned = await service.run({ ...request, tools: ['axe'] })
    const evidence = { runs: scanned.evidence.runs, observations: scanned.evidence.observations }
    const appended = processor.addAxeResults(initial, {
      violations: [{ code: 'button-name' }], incomplete: [], passes: [], evidence,
    })
    const finalized = processor.finalizeResults(appended)
    expect(initial).toEqual(before)
    expect(appended.summary.totalViolations).toBe(0)
    expect(finalized.summary.totalViolations).toBe(1)
    expect(finalized.evidence.runs.every(run => run.sampleId === initial.evidence.sample.id)).toBe(true)
  })
})

describe('scan failure regression', () => {
  it('rejects Pa11y failures instead of returning empty successful results', async () => {
    const { service, browser } = setup()
    const error = new Error('Pa11y navigation failed')
    vi.mocked(pa11y).mockRejectedValue(error)
    await expect(service.run({ ...request, tools: ['pa11y'] })).rejects.toBe(error)
    expect(browser.close).toHaveBeenCalledOnce()
    expect(scanners.axe).not.toHaveBeenCalled()
  })

  it('rejects Axe navigation failures and closes both page and browser', async () => {
    const { service, browser, page } = setup()
    const error = new Error('Axe navigation failed')
    page.goto.mockRejectedValue(error)
    await expect(service.run(request)).rejects.toBe(error)
    expect(page.close).toHaveBeenCalledOnce()
    expect(browser.close).toHaveBeenCalledOnce()
    expect(pa11y).not.toHaveBeenCalled()
  })

  it('rejects Axe analysis failures after successful navigation', async () => {
    const { service, browser, page } = setup()
    const error = new Error('Axe analysis failed')
    scanners.axe.mockRejectedValue(error)
    await expect(service.run(request)).rejects.toBe(error)
    expect(page.close).toHaveBeenCalledOnce()
    expect(browser.close).toHaveBeenCalledOnce()
  })

  it('does not return earlier Axe results as success when Pa11y subsequently fails', async () => {
    const { service, browser } = setup()
    const error = new Error('Pa11y timed out')
    vi.mocked(pa11y).mockRejectedValue(error)
    await expect(service.run(request)).rejects.toBe(error)
    expect(scanners.axe).toHaveBeenCalledOnce()
    expect(browser.close).toHaveBeenCalledOnce()
  })

  it('returns an API failure body when Pa11y throws', async () => {
    const { browser } = setup()
    const error = new Error('Pa11y navigation failed')
    vi.mocked(pa11y).mockRejectedValue(error)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('defineEventHandler', (handler: (event: unknown) => unknown) => handler)
    vi.stubGlobal('setHeader', vi.fn())
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ ...request, tools: ['pa11y'] }))
    const { default: handler } = await import('../server/api/check-accessibility.post')
    const response = await handler({} as Parameters<typeof handler>[0])
    expect(response).toMatchObject({ success: false, error: error.message })
    expect(response).not.toHaveProperty('data')
    expect(browser.close).toHaveBeenCalledOnce()
  })
})
