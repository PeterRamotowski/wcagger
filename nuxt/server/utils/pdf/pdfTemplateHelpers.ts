import type { H3Event } from 'h3';
import { getCookie } from 'h3';
import { readFileSync } from 'fs';
import path from 'path';
import { getTranslatedString } from '~~/server/utils/localeHelper';

const DEFAULT_TIME_ZONE = 'UTC';

function resolveLocale(event: H3Event): string {
  return getCookie(event, 'i18n_detected') || 'en';
}

function normalizeTimeZone(timeZone?: string): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function getNodeSelector(node: any): string {
  if (!node.target) return '';
  return Array.isArray(node.target) ? node.target.join(', ') : node.target;
}

export function formatDate(event: H3Event, date: Date, timeZone?: string): string {
  const locale = resolveLocale(event);
  const tz = normalizeTimeZone(timeZone);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: tz
  }).format(date);
}

export function formatTime(event: H3Event, date: Date, timeZone?: string): string {
  const locale = resolveLocale(event);
  const tz = normalizeTimeZone(timeZone);
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: tz,
  }).format(date);
}

export function formatDateTime(event: H3Event, date: Date, timeZone?: string): string {
  const locale = resolveLocale(event);
  const tz = normalizeTimeZone(timeZone);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: tz
  }).format(date);
}

export function generatePDFStyles(): string {
  const cssPath = path.join(process.cwd(), 'server/utils/pdf/pdfStyles.css');
  const cssContent = readFileSync(cssPath, 'utf-8');
  return `<style>${cssContent}</style>`;
}

export function generateHeaderSection(event: H3Event, timeZone?: string): string {
  const currentDate = new Date();
  return `
    <div class="header">
      <h1>
        <span class="icon">W</span>
        ${getTranslatedString(event, 'wcag_accessibility_report')}
      </h1>
      <div class="subtitle">
        ${getTranslatedString(event, 'generated_on_date_at_time', {
          date: formatDate(event, currentDate, timeZone),
          time: formatTime(event, currentDate, timeZone)
        })}
      </div>
    </div>
  `;
}

export function generateMetadataSection(
  event: H3Event,
  results: AccessibilityCheckResults,
  selectedTools: string[],
  wcagLevel: string,
  selectedStandardInfo?: { name: string; description: string; recommendation: string } | null,
  timeZone?: string
): string {
  return `
    <div class="metadata">
      <div class="metadata-grid">
        <div class="metadata-item">
          <div class="metadata-label">${getTranslatedString(event, 'website_url')}</div>
          <div class="metadata-value">${results.url}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">${getTranslatedString(event, 'scan_date')}</div>
          <div class="metadata-value">${formatDateTime(event, new Date(results.timestamp), timeZone)}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">${getTranslatedString(event, 'wcag_standard')}</div>
          <div class="metadata-value">${selectedStandardInfo?.name || wcagLevel}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">${getTranslatedString(event, 'tools_used')}</div>
          <div class="metadata-value">${selectedTools.join(', ')}</div>
        </div>
      </div>
    </div>
  `;
}

export function generateSummarySection(event: H3Event, results: AccessibilityCheckResults): string {
  return `
    <div class="summary">
      <h2>${getTranslatedString(event, 'executive_summary')}</h2>
      <div class="summary-cards">
        <div class="summary-card critical">
          <div class="number">${results.summary.totalViolations}</div>
          <div class="label">${getTranslatedString(event, 'critical_issues')}</div>
        </div>
        <div class="summary-card warning">
          <div class="number">${results.summary.totalWarnings}</div>
          <div class="label">${getTranslatedString(event, 'warnings')}</div>
        </div>
        <div class="summary-card success">
          <div class="number">${results.summary.totalPassed}</div>
          <div class="label">${getTranslatedString(event, 'passed_tests')}</div>
        </div>
      </div>
    </div>
  `;
}

export function generateFooterSection(event: H3Event, url: string): string {
  return `
    <div class="footer">
      <div>${getTranslatedString(event, 'generated_by_wcag_checker')}</div>
      <div style="margin-top: 8px;">${url}</div>
    </div>
  `;
}
