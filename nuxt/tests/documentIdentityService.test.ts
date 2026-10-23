import { AxeAnalysisService } from '../server/services/axeAnalysisService'
import { Pa11yAnalysisService } from '../server/services/pa11yAnalysisService'
import { ResultsProcessor } from '../server/services/resultsProcessor'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Browser, Page } from 'puppeteer'
import { createBrowser, configurePage } from '../server/utils/browserConfig'
import { attachDocumentIdentity, captureDocument } from '../server/services/documentIdentityService'
import { createAxeEvidence, createPa11yEvidence } from '../server/services/scanEvidenceService'
import { axeNode, axeResults, axeRule, pa11yIssue, pa11yResults, runContext } from './fixtures/scanResults'

// Local, in-memory documents only. No network requests or running app are required.
describe('document identity in Chromium', () => {
  let browser: Browser
  let page: Page
  beforeAll(async () => {
    browser = await createBrowser()
    page = await browser.newPage()
    await configurePage(page)
  })
  afterAll(async () => {
    await browser?.close()
  })

  it('resolves different unique selectors to the same actual element', async () => {
    await page.setContent('<header><button id="search">Search</button></header>')
    const context = { page, documentId: 'same-document' }
    const before = await captureDocument(context)
    expect(before).toBeTypeOf('string')
    const raw = createAxeEvidence(axeResults(), runContext, [])
    const direct = await attachDocumentIdentity(raw, context, before)
    const wrapped = await attachDocumentIdentity(createPa11yEvidence(pa11yResults({ issues: [pa11yIssue({ selector: 'header > button' })] }), runContext, ['axe']), context, before)
    expect(direct.runs[0]?.capture?.stable).toBe(true)
    expect(direct.observations[0]?.element?.identity).toEqual(wrapped.observations[0]?.element?.identity)
    expect(direct.observations[1]?.element?.identity).toBeUndefined()
  })

  it('preserves identity through scanner script injection but rejects changed DOM state', async () => {
    await page.setContent('<button id="search">Search</button>')
    const context = { page, documentId: 'script-document' }
    const before = await captureDocument(context)
    await page.addScriptTag({ content: 'window.fixtureScanner = true' })
    expect(await captureDocument(context)).toBe(before)
    await page.evaluate(() => {
      document.querySelector('button')!.textContent = 'Changed'
    })
    const evidence = await attachDocumentIdentity(createAxeEvidence(axeResults(), runContext, []), context, before)
    expect(evidence.runs[0]?.capture?.stable).toBe(false)
  })

  it('resolves frame and shadow boundaries and does not use a flattened selector', async () => {
    await page.setContent('<iframe id="checkout" srcdoc="<payment-widget></payment-widget>"></iframe>')
    await page.waitForFunction(() => !!document.querySelector('iframe')?.contentDocument?.querySelector('payment-widget'))
    await page.evaluate(() => {
      const host = document.querySelector('iframe')!.contentDocument!.querySelector('payment-widget')!
      host.attachShadow({ mode: 'open' }).innerHTML = '<button id="confirm">Confirm</button>'
    })
    const context = { page, documentId: 'frame-document' }
    const before = await captureDocument(context)
    const raw = createAxeEvidence(axeResults({ violations: [axeRule({ nodes: [axeNode(['#checkout', ['payment-widget', '#confirm']])] })] }), runContext, [])
    const evidence = await attachDocumentIdentity(raw, context, before)
    expect(evidence.observations[0]?.element?.identity?.elementId).toBeTypeOf('string')
    expect(evidence.runs[0]?.capture?.stable).toBe(true)
  })

  it('does not resolve ambiguous or invalid selectors to an invented identity', async () => {
    await page.setContent('<button>One</button><button>Two</button>')
    const context = { page, documentId: 'ambiguous-document' }
    const before = await captureDocument(context)
    const raw = createPa11yEvidence(pa11yResults({ issues: [pa11yIssue({ selector: 'button' }), pa11yIssue({ selector: '???' })] }), runContext, ['axe'])
    const evidence = await attachDocumentIdentity(raw, context, before)
    expect(evidence.observations.every(item => item.element?.identity === undefined)).toBe(true)
    expect(evidence.observations).toHaveLength(2)
  })

  it('captures live input values and styling changes that do not alter HTML attributes', async () => {
    await page.setContent('<input id="name"><style>input { color: black }</style>')
    const context = { page, documentId: 'form-document' }
    const initial = await captureDocument(context)
    await page.evaluate(() => {
      document.querySelector('input')!.value = 'Changed'
    })
    const changed = await captureDocument(context)
    expect(changed).not.toBe(initial)
    await page.evaluate(() => {
      const rule = document.styleSheets[0]!.cssRules[0] as CSSStyleRule
      rule.style.color = 'red'
    })
    expect(await captureDocument(context)).not.toBe(changed)
  })

  it('keeps successful evidence when optional identity capture fails', async () => {
    const context = { page, documentId: 'unavailable-identity' }
    const evidence = createAxeEvidence(axeResults(), runContext, [])
    const spy = vi.spyOn(page, 'evaluate').mockRejectedValue(new Error('Execution context unavailable'))
    try {
      expect(await captureDocument(context)).toBeUndefined()
      const attached = await attachDocumentIdentity(evidence, context)
      expect(attached.observations).toEqual(evidence.observations)
      expect(attached.runs[0]?.capture?.stable).toBe(false)
    } finally { spy.mockRestore() }
  })

  it('combines real engine findings in a shared local document', async () => {
    await page.setContent('<html lang="en"><head><title>Local scan fixture</title></head><body><main><button id="search"></button><img id="photo" width="10" height="10" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></main></body></html>')
    const context = { page, documentId: 'real-engine-document' }
    const axe = await new AxeAnalysisService(browser).analyze('about:blank', 'WCAG21AA', context)
    const pa11y = await new Pa11yAnalysisService(browser).analyze('about:blank', 'WCAG21AA', ['htmlcs', 'axe'], context)
    const processor = new ResultsProcessor()
    const result = processor.finalizeResults(processor.addPa11yResults(processor.addAxeResults(processor.createInitialResults('about:blank'), axe), pa11y))
    const grouped = result.evidence.grouping!
    const button = grouped.occurrences.find(item => item.issueType === 'axe:button-name' && item.outcome === 'violation')
    const image = grouped.occurrences.find(item => item.issueType === 'axe:image-alt' && item.outcome === 'violation')
    expect(result.evidence.runs.every(run => run.capture?.stable)).toBe(true)
    expect(button?.observationIds).toHaveLength(2)
    expect(image?.observationIds).toHaveLength(3)
    expect(grouped.summary.observedOccurrences).toBeLessThan(grouped.summary.actionableObservations)
  }, 15000)

  it('detects identical-markup node replacements and new document generations', async () => {
    await page.setContent('<button id="search">Search</button>')
    const context = { page, documentId: 'replacement-document' }
    const initial = await captureDocument(context)
    await page.evaluate(() => {
      const button = document.querySelector('button')!
      button.replaceWith(button.cloneNode(true))
    })
    const replaced = await captureDocument(context)
    expect(replaced).not.toBe(initial)
    await page.goto('about:blank')
    await page.setContent('<button id="search">Search</button>')
    expect(await captureDocument(context)).not.toBe(replaced)
  })
})
