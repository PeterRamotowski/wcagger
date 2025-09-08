import pa11y from 'pa11y';
import type { Browser } from 'puppeteer';
import { getPa11yStandard } from '~~/server/utils/wcagMapping';

export class Pa11yAnalysisService {
  private browser: Browser;

  constructor(browser: Browser) {
    this.browser = browser;
  }

  async analyze(url: string, standard: string, runners: string[] = ['htmlcs', 'axe']): Promise<Pa11yProcessedResults> {
    try {
      // Configure Pa11y with selected runners
      const pa11yResults = await pa11y(url, {
        standard: getPa11yStandard(standard) as any,
        runners,
        browser: this.browser,
        timeout: 20000,
        wait: 2000,
        includeNotices: true,
        includeWarnings: true
      });
      
      return this.processResults(pa11yResults);
      
    } catch (error) {
      console.error('Pa11y analysis error:', error);
      return {
        errors: [],
        warnings: [],
        notices: []
      };
    }
  }

  private processResults(pa11yResults: any): Pa11yProcessedResults {
    const processedResults: Pa11yProcessedResults = {
      errors: [],
      warnings: [],
      notices: []
    };
    
    pa11yResults.issues.forEach((issue: any) => {
      const processedIssue = {
        code: issue.code,
        type: issue.type,
        title: issue.message,
        description: undefined, // Pa11y doesn't provide additional description
        context: issue.context,
        selector: issue.selector,
        runner: issue.runner,
        runnerExtras: issue.runnerExtras
      };
      
      switch (issue.type) {
        case 'error':
          processedResults.errors.push(processedIssue);
          break;
        case 'warning':
          processedResults.warnings.push(processedIssue);
          break;
        case 'notice':
          processedResults.notices.push(processedIssue);
          break;
      }
    });
    
    return processedResults;
  }
}
