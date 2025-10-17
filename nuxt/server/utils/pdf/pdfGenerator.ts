import type { H3Event } from 'h3';
import { createBrowser, configurePage, type BrowserConfig } from '~~/server/utils/browserConfig';
import {
  generatePDFStyles,
  generateHeaderSection,
  generateMetadataSection,
  generateSummarySection,
  generateFooterSection
} from './pdfTemplateHelpers';
import {
  generateViolationsSection,
  generateWarningsSection,
  generateCompleteHTMLDocument,
  generateMainContentWrapper
} from './pdfTemplateVariations';

export interface PDFGeneratorOptions {
  event: H3Event;
  results: AccessibilityCheckResults;
  selectedTools: string[];
  wcagLevel: string;
  selectedStandardInfo?: {
    name: string;
    description: string;
    recommendation: string;
  } | null;
}

function generateReportHTML(options: PDFGeneratorOptions): string {
  const { event, results, selectedTools, wcagLevel, selectedStandardInfo } = options;

  const styles = generatePDFStyles();
  const header = generateHeaderSection(event);
  const metadata = generateMetadataSection(event, results, selectedTools, wcagLevel, selectedStandardInfo);
  const summary = generateSummarySection(event, results);
  const violations = generateViolationsSection(event, results.combined.violations);
  const warnings = generateWarningsSection(event, results.combined.warnings);
  const footer = generateFooterSection(event, results.url);

  const mainContent = generateMainContentWrapper(
    header + metadata + summary + violations + warnings + footer
  );

  return generateCompleteHTMLDocument(event, styles + mainContent);
}

export class AccessibilityPDFGenerator {
  public async generate(options: PDFGeneratorOptions): Promise<Uint8Array> {
    let browser;
    try {
      const browserConfig: BrowserConfig = {
        headless: true,
        timeout: 60000,
        viewport: {
          width: 1200,
          height: 800
        },
        additionalArgs: [
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      };
      browser = await createBrowser(browserConfig);

      const page = await browser.newPage();

      await configurePage(page, browserConfig);

      const htmlContent = await generateReportHTML(options);

      await page.setViewport({
        width: 1200,
        height: 800,
        deviceScaleFactor: 1
      });

      await page.setContent(htmlContent, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: browserConfig.timeout
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        },
        printBackground: true,
        preferCSSPageSize: true,
        timeout: browserConfig.timeout
      });

      if (pdfBuffer.length === 0) {
        throw new Error('Generated PDF is empty (0 bytes)');
      }

      await browser.close();
      return pdfBuffer;
      
    } catch (error) {
      console.error('Error generating PDF with Puppeteer:', error);
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export async function generateAccessibilityPDF(options: PDFGeneratorOptions): Promise<Uint8Array> {
  try {
    const generator = new AccessibilityPDFGenerator();
    return await generator.generate(options);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Error generating PDF report. Please try again.');
  }
}
