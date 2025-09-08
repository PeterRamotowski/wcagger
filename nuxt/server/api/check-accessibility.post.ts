import type { Browser } from 'puppeteer';
import { createBrowser } from '~~/server/utils/browserConfig';
import { validateAccessibilityRequest, validateTools, validateStandard, validateRunners } from '~~/server/utils/validation';
import { AxeAnalysisService } from '~~/server/services/axeAnalysisService';
import { Pa11yAnalysisService } from '~~/server/services/pa11yAnalysisService';
import { ResultsProcessor } from '~~/server/services/resultsProcessor';
import { handleError, AccessibilityTestError } from '~~/server/utils/errorHandler';
import type { TestRequest, ApiResponse } from '~~/shared/types/accessibility';

export default defineEventHandler(async (event) => {
  setHeader(event, 'Access-Control-Allow-Origin', '*');
  setHeader(event, 'Access-Control-Allow-Methods', 'POST');
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type');

  try {
    const body = await readBody<TestRequest>(event);
    const { url, tools, standard, runners } = body;

    const requestValidation = validateAccessibilityRequest(body);
    if (!requestValidation.isValid) {
      throw new AccessibilityTestError(requestValidation.error!, 400);
    }

    const toolsValidation = validateTools(tools);
    if (!toolsValidation.isValid) {
      throw new AccessibilityTestError(toolsValidation.error!, 400);
    }

    const standardValidation = validateStandard(standard);
    if (!standardValidation.isValid) {
      throw new AccessibilityTestError(standardValidation.error!, 400);
    }

    if (tools.includes('pa11y') && runners) {
      const runnersValidation = validateRunners(runners);
      if (!runnersValidation.isValid) {
        throw new AccessibilityTestError(runnersValidation.error!, 400);
      }
    }

    let results = ResultsProcessor.createInitialResults(url);
    let browser: Browser | null = null;

    try {
      browser = await createBrowser();

      if (tools.includes('axe')) {
        const axeService = new AxeAnalysisService(browser);
        const axeResults = await axeService.analyze(url, standard);
        results = ResultsProcessor.addAxeResults(results, axeResults);
      }

      if (tools.includes('pa11y')) {
        const pa11yService = new Pa11yAnalysisService(browser);
        const pa11yResults = await pa11yService.analyze(url, standard, runners);
        results = ResultsProcessor.addPa11yResults(results, pa11yResults);
      }

      results = ResultsProcessor.finalizeResults(results);

      const response: ApiResponse = {
        success: true,
        data: results
      };

      return response;

    } finally {
      if (browser) {
        await browser.close();
      }
    }

  } catch (error: unknown) {
    return handleError(error);
  }
});
