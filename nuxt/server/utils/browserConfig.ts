import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';

export interface BrowserConfig {
  headless?: boolean;
  timeout?: number;
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
  additionalArgs?: string[];
}

export const defaultBrowserConfig: BrowserConfig = {
  headless: true,
  timeout: 20000,
  viewport: {
    width: 1920,
    height: 1080
  },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

export const createBrowser = async (config: BrowserConfig = defaultBrowserConfig): Promise<Browser> => {
  const baseArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--max-old-space-size=4096',
    '--disable-extensions',
    `--window-size=${config.viewport?.width || 1920}x${config.viewport?.height || 1080}`
  ];
  
  const allArgs = config.additionalArgs ? [...baseArgs, ...config.additionalArgs] : baseArgs;
  
  return await puppeteer.launch({
    headless: config.headless,
    args: allArgs
  });
};

export const configurePage = async (page: any, config: BrowserConfig = defaultBrowserConfig) => {
  if (config.viewport) {
    await page.setViewport(config.viewport);
  }
  
  if (config.userAgent) {
    await page.setUserAgent(config.userAgent);
  }
};
