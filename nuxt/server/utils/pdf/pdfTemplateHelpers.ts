import type { H3Event } from 'h3';
import { readFileSync } from 'fs';
import path from 'path';
import { getTranslatedString } from '~~/server/utils/localeHelper';

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function getNodeSelector(node: any): string {
  if (!node.target) return '';
  return Array.isArray(node.target) ? node.target.join(', ') : node.target;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString();
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString();
}

export function generatePDFStyles(): string {
  const cssPath = path.join(process.cwd(), 'server/utils/pdf/pdfStyles.css');
  const cssContent = readFileSync(cssPath, 'utf-8');
  return `<style>${cssContent}</style>`;
}

export function generateHeaderSection(event: H3Event): string {
  const currentDate = new Date();
  return `
    <div class="header">
      <h1>
        <span class="icon">W</span>
        ${getTranslatedString(event, 'wcag_accessibility_report')}
      </h1>
      <div class="subtitle">
        ${getTranslatedString(event, 'generated_on_date_at_time', { date: formatDate(currentDate), time: formatTime(currentDate) })}
      </div>
    </div>
  `;
}

export function generateMetadataSection(
  event: H3Event,
  results: AccessibilityCheckResults,
  selectedTools: string[],
  wcagLevel: string,
  selectedStandardInfo?: { name: string; description: string; recommendation: string } | null
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
          <div class="metadata-value">${formatDateTime(new Date(results.timestamp))}</div>
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
