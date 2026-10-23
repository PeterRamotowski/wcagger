import { randomUUID } from 'node:crypto'
import { attachDocumentIdentity, captureDocument } from '~~/server/services/documentIdentityService'
import type { ScanPageContext } from '~~/server/services/documentIdentityService'
import { createAxeEvidence } from '~~/server/services/scanEvidenceService'
import type { AxeProcessedResults } from '~~/shared/types/accessibility'
import { AxePuppeteer } from '@axe-core/puppeteer'
import type { Browser } from 'puppeteer'
import type { AxeResults } from 'axe-core'
import { getAxeTags } from '~~/server/utils/wcagMapping'
import { configurePage, defaultBrowserConfig } from '~~/server/utils/browserConfig'

export class AxeAnalysisService {
  private browser: Browser

  constructor(browser: Browser) {
    this.browser = browser
  }

  async analyze(url: string, standard: string, context?: ScanPageContext): Promise<AxeProcessedResults> {
    const startedAt = new Date().toISOString()
    const page = context?.page ?? await this.browser.newPage()
    const documentContext = context ?? { page, documentId: randomUUID() }

    try {
      if (!context) {
        await configurePage(page)
        await page.goto(url, { waitUntil: 'networkidle0', timeout: defaultBrowserConfig.timeout })
      }
      const before = await captureDocument(documentContext)

      const axe = new AxePuppeteer(page)
      const axeResults: AxeResults = await axe
        .withTags(getAxeTags(standard))
        .analyze()

      return {
        ...this.processResults(axeResults),
        evidence: await attachDocumentIdentity(createAxeEvidence(axeResults, {
          url, standard, startedAt, completedAt: new Date().toISOString(),
        }, getAxeTags(standard), defaultBrowserConfig.timeout), documentContext, before),
      }
    } finally {
      if (!context) await page.close()
    }
  }

  private processResults(axeResults: AxeResults): Omit<AxeProcessedResults, 'evidence'> {
    return {
      violations: axeResults.violations.map(violation => ({
        code: violation.id,
        impact: violation.impact ?? undefined,
        title: violation.help || violation.description,
        description: violation.help && violation.description && violation.help !== violation.description ? violation.description : undefined,
        helpUrl: violation.helpUrl,
        tags: violation.tags,
        nodes: violation.nodes.map(node => ({
          target: node.target,
          html: node.html,
          impact: node.impact,
          any: node.any,
          all: node.all,
          none: node.none,
          failureSummary: node.failureSummary,
        })),
      })),
      incomplete: axeResults.incomplete.map(item => ({
        code: item.id,
        impact: item.impact ?? undefined,
        title: item.help || item.description,
        description: item.help && item.description && item.help !== item.description ? item.description : undefined,
        helpUrl: item.helpUrl,
        tags: item.tags,
        nodes: item.nodes.map(node => ({
          target: node.target,
          html: node.html,
        })),
      })),
      passes: axeResults.passes.map(pass => ({
        code: pass.id,
        title: pass.help || pass.description,
        description: pass.help && pass.description && pass.help !== pass.description ? pass.description : undefined,
        tags: pass.tags,
      })),
    }
  }
}
