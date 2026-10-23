import { describe, expect, it } from 'vitest'
import { createAxeEvidence, createPa11yEvidence } from '../server/services/scanEvidenceService'
import { axeNode, axeResults, axeRule, pa11yIssue, pa11yResults, runContext } from './fixtures/scanResults'

describe('Axe evidence', () => {
  it('expands affected nodes and preserves original evidence for every outcome', () => {
    const raw = axeResults()
    const before = structuredClone(raw)
    const evidence = createAxeEvidence(raw, runContext, ['wcag2a'], 20000)
    const violations = evidence.observations.filter(item => item.outcome === 'violation')
    expect(violations).toHaveLength(2)
    expect(violations.map(item => item.element?.locator)).toEqual([
      { kind: 'axe-target', target: ['#search'] },
      { kind: 'axe-target', target: ['#menu'] },
    ])
    for (const [group, outcome] of [['violations', 'violation'], ['incomplete', 'incomplete'], ['passes', 'pass'], ['inapplicable', 'inapplicable']] as const) {
      const { nodes, ...rule } = raw[group][0]!
      const observations = evidence.observations.filter(item => item.outcome === outcome)
      expect(observations).toHaveLength(nodes.length || 1)
      observations.forEach((item, index) => {
        expect(item.evidence).toEqual({ kind: 'axe', rule, node: nodes[index] })
        expect(item.tags).toEqual(rule.tags)
      })
    }
    expect(new Set(evidence.observations.map(item => item.id)).size).toBe(evidence.observations.length)
    expect(raw).toEqual(before)
  })

  it('keeps frame and shadow selector boundaries intact through JSON serialization', () => {
    const target = axeNode(['iframe#checkout', ['payment-widget', 'button.confirm']]).target
    const raw = axeResults({ violations: [axeRule({ nodes: [axeNode(target)] })] })
    const evidence = JSON.parse(JSON.stringify(createAxeEvidence(raw, runContext, [])))
    expect(evidence.observations[0].element.locator).toEqual({ kind: 'axe-target', target })
    expect(evidence.observations[0].evidence.node.target).toEqual(target)
  })

  it('retains nodeless and unlocatable results without inventing an element', () => {
    const raw = axeResults({ violations: [axeRule({ nodes: [] }), axeRule({ id: 'unknown-target', nodes: [axeNode([])] })] })
    const observations = createAxeEvidence(raw, runContext, []).observations.filter(item => item.outcome === 'violation')
    expect(observations).toHaveLength(2)
    expect(observations.every(item => item.element === undefined)).toBe(true)
    expect(observations[1]?.evidence).toMatchObject({ node: { target: [], failureSummary: 'Provide an accessible name' } })
  })

  it('records engine identity, redirect destination, timing and configuration', () => {
    const evidence = createAxeEvidence(axeResults(), runContext, ['wcag2a'], 20000)
    expect(evidence.runs[0]).toMatchObject({
      tool: 'axe', engine: 'axe', engineVersion: '4.11.4', status: 'completed',
      requestedUrl: runContext.url, resolvedUrl: 'https://example.test/resolved',
      startedAt: runContext.startedAt, completedAt: runContext.completedAt,
      standard: 'WCAG22AA', configuration: { tags: ['wcag2a'], timeout: 20000 },
    })
    expect(evidence.observations.every(item => item.runId === evidence.runs[0]?.id)).toBe(true)
    expect(evidence.observations.filter(item => item.element).every(item => item.element?.documentId === item.runId)).toBe(true)
  })
})

describe('Pa11y evidence', () => {
  it('recognizes review-required results without losing original error classifications', () => {
    const raw = pa11yResults()
    const evidence = createPa11yEvidence(raw, runContext, ['axe', 'htmlcs'])
    expect(evidence.observations.map(item => item.outcome)).toEqual(['violation', 'incomplete', 'warning', 'notice'])
    expect(evidence.observations[1]?.evidence).toEqual({ kind: 'pa11y', issue: raw.issues[1] })
    expect(evidence.observations[0]).toMatchObject({ description: 'Missing name', impact: 'serious', helpUrl: 'https://example.test/rules/button-name' })
  })

  it('attributes each issue to its actual runner, including unknown runners', () => {
    const raw = pa11yResults({ issues: [pa11yIssue(), pa11yIssue({ runner: 'htmlcs' }), pa11yIssue({ runner: undefined }), pa11yIssue({ runner: 'custom' })] })
    const evidence = createPa11yEvidence(raw, runContext, ['axe', 'htmlcs'])
    expect(evidence.observations.map(item => evidence.runs.find(run => run.id === item.runId)?.engine)).toEqual(['axe', 'htmlcs', 'unknown', 'unknown'])
    expect(evidence.observations.map(item => evidence.runs.find(run => run.id === item.runId)?.tool)).toEqual(['pa11y', 'pa11y', 'pa11y', 'pa11y'])
    expect(evidence.runs.every(run => run.engineVersion === undefined)).toBe(true)
    expect(evidence.runs[0]).toMatchObject({ standard: 'WCAG22AA', configuration: { standard: 'WCAG2AA' } })
  })

  it('retains completed runners with zero issues without inventing automated passes', () => {
    const evidence = createPa11yEvidence(pa11yResults({ issues: [] }), runContext, ['axe', 'htmlcs'])
    expect(evidence.runs.map(run => run.engine)).toEqual(['axe', 'htmlcs'])
    expect(evidence.runs.every(run => run.status === 'completed')).toBe(true)
    expect(evidence.observations).toEqual([])
  })

  it('preserves unknown classifications and missing locators for review', () => {
    const issue = pa11yIssue({ type: 'unexpected', selector: '', runnerExtras: { detail: { original: true } } })
    const evidence = createPa11yEvidence(pa11yResults({ issues: [issue] }), runContext, ['axe'])
    expect(evidence.observations[0]).toMatchObject({ outcome: 'unknown', evidence: { kind: 'pa11y', issue } })
    expect(evidence.observations[0]?.element).toBeUndefined()
  })
})
