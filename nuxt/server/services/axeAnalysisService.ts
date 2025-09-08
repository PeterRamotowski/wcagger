import { AxePuppeteer } from '@axe-core/puppeteer';
import type { Browser } from 'puppeteer';
import type { AxeResults } from 'axe-core';
import { getAxeTags } from '~~/server/utils/wcagMapping';
import { configurePage, defaultBrowserConfig } from '~~/server/utils/browserConfig';

export class AxeAnalysisService {
  private browser: Browser;

  constructor(browser: Browser) {
    this.browser = browser;
  }

  async analyze(url: string, standard: string): Promise<AxeProcessedResults> {
    const page = await this.browser.newPage();

    try {
      await configurePage(page);

      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: defaultBrowserConfig.timeout
      });

      const axe = new AxePuppeteer(page);
      const axeResults: AxeResults = await axe
        .withTags(getAxeTags(standard))
        .analyze();

      return this.processResults(axeResults);
    }
    finally {
      await page.close();
    }
  }

  private processResults(axeResults: AxeResults): AxeProcessedResults {
    return {
      violations: axeResults.violations.map(violation => ({
        code: violation.id,
        impact: violation.impact,
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
          failureSummary: node.failureSummary
        }))
      })),
      incomplete: axeResults.incomplete.map(item => ({
        code: item.id,
        impact: item.impact,
        title: item.help || item.description,
        description: item.help && item.description && item.help !== item.description ? item.description : undefined,
        helpUrl: item.helpUrl,
        tags: item.tags,
        nodes: item.nodes.map(node => ({
          target: node.target,
          html: node.html
        }))
      })),
      passes: axeResults.passes.map(pass => ({
        code: pass.id,
        title: pass.help || pass.description,
        description: pass.help && pass.description && pass.help !== pass.description ? pass.description : undefined,
        tags: pass.tags
      }))
    };
  }
}
