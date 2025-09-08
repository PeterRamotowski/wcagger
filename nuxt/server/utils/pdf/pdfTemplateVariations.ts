import { truncateText, getNodeSelector } from './pdfTemplateHelpers';
import { getTranslatedString } from '~~/server/utils/localeHelper';
import type { H3Event } from 'h3';

export function generateViolationsSection(event: H3Event, violations: readonly any[]): string {
  if (violations.length === 0) return '';
  
  return `
    <div class="section">
      <div class="section-header">
        <h3>${getTranslatedString(event, 'critical_accessibility_violations')}</h3>
        <span class="badge critical">${violations.length} ${getTranslatedString(event, 'issues')}</span>
      </div>
      
      ${violations.map((violation, index) => generateViolationItem(event, violation, index)).join('')}
    </div>
  `;
}

export function generateWarningsSection(event: H3Event, warnings: readonly any[]): string {
  if (warnings.length === 0) return '';
  
  const displayedWarnings = warnings.slice(0, 15);
  const hasMoreWarnings = warnings.length > 15;
  
  return `
    <div class="section page-break">
      <div class="section-header warning">
        <h3>${getTranslatedString(event, 'warnings_and_review_items')}</h3>
        <span class="badge warning">${warnings.length} ${getTranslatedString(event, 'items')}</span>
      </div>
      
      ${displayedWarnings.map((warning, index) => generateWarningItem(event, warning, index)).join('')}
      
      ${hasMoreWarnings ? `
        <div style="text-align: center; padding: 20px; color: #6b7280; font-style: italic;">
          ${getTranslatedString(event, 'more_warnings', { count: warnings.length - 15 })}
        </div>
      ` : ''}
    </div>
  `;
}

function generateViolationItem(event: H3Event, violation: any, index: number): string {
  const hasElements = (violation.nodes && violation.nodes.length > 0) || violation.selector;
  
  return `
    <div class="violation">
      <div class="violation-header">
        <span class="violation-title">
          ${index + 1}. ${violation.code}
        </span>
        <span class="badge ${violation.source || ''}">${(violation.source || '').toUpperCase()}</span>
        ${violation.impact ? `<span class="badge ${violation.impact}">${violation.impact.toUpperCase()}</span>` : ''}
      </div>
      
      <div class="violation-description">
        ${violation.title || getTranslatedString(event, 'no_title_available')}
        ${violation.description ? `<br><small>${violation.description}</small>` : ''}
      </div>
      
      ${hasElements ? generateElementsAffected(event, violation) : ''}
    </div>
  `;
}

function generateWarningItem(event: H3Event, warning: any, index: number): string {
  return `
    <div class="violation warning">
      <div class="violation-header">
        <span class="violation-title">
          ${index + 1}. ${warning.code}
        </span>
        <span class="badge ${warning.source || ''}">${(warning.source || '').toUpperCase()}</span>
      </div>
      
      <div class="violation-description">
        ${truncateText(warning.title || '', 200)}
        ${warning.description ? `<br><small>${truncateText(warning.description, 100)}</small>` : ''}
      </div>
    </div>
  `;
}

function generateElementsAffected(event: H3Event, violation: any): string {
  const elementsCount = violation.nodes?.length || 1;
  
  return `
    <div class="elements-affected">
      <div class="elements-label">
        ${getTranslatedString(event, 'affected_elements')} (${elementsCount})
      </div>

      ${generateElementSelectors(event, violation)}
    </div>
  `;
}

function generateElementSelectors(event: H3Event, violation: any): string {
  if (violation.nodes && violation.nodes.length > 0) {
    const displayedNodes = violation.nodes.slice(0, 3);
    const hasMoreNodes = violation.nodes.length > 3;
    
    return `
      ${displayedNodes.map((node: any) => `
        <div class="selector">${getNodeSelector(node)}</div>
      `).join('')}
      
      ${hasMoreNodes ? `
        <div class="more-elements">
          ${getTranslatedString(event, 'more_elements', { count: violation.nodes.length - 3 })}
        </div>
      ` : ''}
    `;
  } else if (violation.selector) {
    return `<div class="selector">${violation.selector}</div>`;
  }
  
  return '';
}

export function generateCompleteHTMLDocument(event: H3Event, content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${getTranslatedString(event, 'wcag_accessibility_report')}</title>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
}

export function generateMainContentWrapper(content: string): string {
  return `<div class="container">${content}</div>`;
}
