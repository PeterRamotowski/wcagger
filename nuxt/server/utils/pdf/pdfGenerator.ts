import type { H3Event } from 'h3'
import type { DeepReadonly } from 'vue'
import type { AccessibilityCheckResults } from '~~/shared/types/accessibility'
import { createBrowser, configurePage } from '~~/server/utils/browserConfig'
import { buildGroupedReport } from '~~/shared/utils/reportPresentation'
import { generateGroupedReportHTML } from './groupedReportTemplate'

export interface PDFGeneratorOptions {
  event: H3Event
  results: DeepReadonly<AccessibilityCheckResults>
  timeZone?: string
}

export class AccessibilityPDFGenerator {
  async generate(options: PDFGeneratorOptions): Promise<Uint8Array> {
    const report = buildGroupedReport(options.results)
    const browser = await createBrowser({ headless: true, viewport: { width: 1200, height: 800 } })
    try {
      const page = await browser.newPage()
      await configurePage(page, { viewport: { width: 1200, height: 800 } })
      await page.setJavaScriptEnabled(false)
      await page.setContent(generateGroupedReportHTML(options.event, report, options.timeZone), { waitUntil: 'domcontentloaded', timeout: 60000 })
      const buffer = await page.pdf({
        format: 'A4', margin: { top: '16mm', right: '14mm', bottom: '18mm', left: '14mm' },
        printBackground: true, displayHeaderFooter: true, headerTemplate: '<div></div>',
        footerTemplate: '<div style="font:9px Arial;width:100%;text-align:center;color:#64748b"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
        timeout: 60000,
      })
      if (!buffer.length) throw new Error('Generated PDF is empty')
      return buffer
    } finally {
      await browser.close()
    }
  }
}
export async function generateAccessibilityPDF(options: PDFGeneratorOptions): Promise<Uint8Array> {
  return new AccessibilityPDFGenerator().generate(options)
}
