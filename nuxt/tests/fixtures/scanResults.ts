import type { AxeResults, NodeResult, Result } from 'axe-core'
import type { Pa11yIssue, Pa11yScanResults } from '../../shared/types/scanEvidence'

export const runContext = {
  url: 'https://example.test/start',
  standard: 'WCAG22AA',
  startedAt: '2026-10-23T10:00:00.000Z',
  completedAt: '2026-10-23T10:00:01.000Z',
}

export function axeNode(target: NodeResult['target'] = ['#search']): NodeResult {
  return {
    target,
    html: '<button id="search"></button>',
    impact: 'serious',
    any: [{ id: 'has-name', impact: 'serious', message: 'Name is missing', data: { text: '' }, relatedNodes: [{ target: ['#label'], html: '<span id="label"></span>' }] }],
    all: [{ id: 'visible', impact: 'minor', message: 'Visible', data: null }],
    none: [{ id: 'hidden', impact: 'minor', message: 'Not hidden', data: false }],
    failureSummary: 'Provide an accessible name',
    xpath: ['/html/body/button'],
    ancestry: ['html > body > button'],
  }
}

export function axeRule(overrides: Partial<Result> = {}): Result {
  return {
    id: 'button-name',
    help: 'Buttons must have an accessible name',
    description: 'Ensure buttons have discernible text',
    helpUrl: 'https://example.test/rules/button-name',
    impact: 'serious',
    tags: ['wcag2a', 'wcag412'],
    nodes: [axeNode()],
    ...overrides,
  }
}

export function axeResults(overrides: Partial<AxeResults> = {}): AxeResults {
  return {
    url: 'https://example.test/resolved',
    timestamp: runContext.completedAt,
    testEngine: { name: 'axe-core', version: '4.11.4' },
    testRunner: { name: 'axe' },
    testEnvironment: { userAgent: 'Fixture browser', windowWidth: 1280, windowHeight: 720 },
    toolOptions: {},
    violations: [axeRule({ nodes: [axeNode(['#search']), axeNode(['#menu'])] })],
    incomplete: [axeRule({ id: 'color-contrast' })],
    passes: [axeRule({ id: 'document-title' })],
    inapplicable: [axeRule({ id: 'video-caption', nodes: [] })],
    ...overrides,
  }
}

export function pa11yIssue(overrides: Partial<Pa11yIssue> = {}): Pa11yIssue {
  return {
    code: 'button-name',
    type: 'error',
    typeCode: 1,
    message: 'Buttons must have an accessible name',
    selector: '#search',
    context: '<button id="search"></button>',
    runner: 'axe',
    runnerExtras: { needsFurtherReview: false, impact: 'serious', description: 'Missing name', helpUrl: 'https://example.test/rules/button-name' },
    ...overrides,
  }
}

export function pa11yResults(overrides: Partial<Pa11yScanResults> = {}): Pa11yScanResults {
  return {
    documentTitle: 'Fixture page',
    pageUrl: 'https://example.test/resolved',
    issues: [
      pa11yIssue(),
      pa11yIssue({ code: 'color-contrast', runnerExtras: { needsFurtherReview: true } }),
      pa11yIssue({ code: 'HTMLCS.warning', type: 'warning', typeCode: 2, runner: 'htmlcs', runnerExtras: undefined }),
      pa11yIssue({ code: 'HTMLCS.notice', type: 'notice', typeCode: 3, runner: 'htmlcs', runnerExtras: undefined }),
    ],
    ...overrides,
  }
}
