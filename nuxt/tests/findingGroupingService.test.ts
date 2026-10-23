import { describe, expect, it } from 'vitest'
import { groupScanEvidence } from '../server/services/findingGroupingService'
import type { EngineRun, FindingGroupingDecision, ScanObservation } from '../shared/types/scanEvidence'
import { axeRule, pa11yIssue, runContext } from './fixtures/scanResults'

function run(id: string, overrides: Partial<EngineRun> = {}): EngineRun {
  return {
    id, sampleId: 'sample', stateId: 'default', tool: 'axe', engine: 'axe', status: 'completed',
    startedAt: runContext.startedAt, completedAt: runContext.completedAt,
    requestedUrl: runContext.url, resolvedUrl: runContext.url, standard: 'WCAG21AA', configuration: {},
    capture: { documentId: 'document', fingerprint: 'stable-state', stable: true },
    ...overrides,
  }
}

function observation(id: string, runId: string, overrides: Partial<ScanObservation> = {}): ScanObservation {
  const { nodes, ...rule } = axeRule()
  return {
    id, runId, ruleId: rule.id, outcome: 'violation', title: rule.help, tags: rule.tags,
    evidence: { kind: 'axe', rule, node: nodes[0] },
    element: {
      documentId: 'document', locator: { kind: 'axe-target', target: ['#search'] }, html: '<button id="search"></button>',
      identity: { documentId: 'document', elementId: 'search-button', signature: 'unchanged-element' },
    },
    ...overrides,
  }
}

function pair() {
  return {
    runs: [run('direct'), run('wrapped', { tool: 'pa11y', runner: 'axe' })],
    observations: [observation('one', 'direct'), observation('two', 'wrapped', {
      evidence: { kind: 'pa11y', issue: pa11yIssue() },
      element: {
        documentId: 'document', locator: { kind: 'css-selector', selector: 'header > button' },
        identity: { documentId: 'document', elementId: 'search-button', signature: 'unchanged-element' },
      },
    })],
  }
}

function decision(occurrenceIds: string[], overrides: Partial<FindingGroupingDecision> = {}): FindingGroupingDecision {
  return { id: 'review-1', action: 'combine', occurrenceIds, reviewer: 'Evaluator', timestamp: runContext.completedAt, reason: 'Confirmed shared header implementation', ...overrides }
}

describe('observation matching', () => {
  it('combines direct and wrapped Axe evidence on the same verified element, even with different selectors', () => {
    const evidence = pair()
    const before = structuredClone(evidence)
    const grouped = groupScanEvidence(evidence)
    expect(grouped.findings).toHaveLength(1)
    expect(grouped.occurrences).toHaveLength(1)
    expect(grouped.occurrences[0]?.observationIds).toEqual(['one', 'two'])
    expect(grouped.summary).toMatchObject({ rawObservations: 2, actionableObservations: 2, uniqueFindings: 1, observedOccurrences: 1, affectedElements: 1, affectedSamples: 1 })
    expect(evidence).toEqual(before)
    expect(groupScanEvidence({ runs: [...evidence.runs].reverse(), observations: [...evidence.observations].reverse() })).toEqual(grouped)
  })

  it('keeps two problems on one element as separate findings in one element group', () => {
    const evidence = pair()
    evidence.observations[1]!.ruleId = 'color-contrast'
    const grouped = groupScanEvidence(evidence)
    expect(grouped.findings).toHaveLength(2)
    expect(grouped.elements).toHaveLength(1)
    expect(grouped.elements[0]?.findingIds).toHaveLength(2)
  })

  it('does not combine different elements sharing HTML, issue type or selectors', () => {
    const evidence = pair()
    evidence.observations[1]!.element!.identity!.elementId = 'another-button'
    const grouped = groupScanEvidence(evidence)
    expect(grouped.findings).toHaveLength(2)
    expect(grouped.reviews).toEqual([])
  })

  it.each(['changed', 'unstable', 'missing', 'signature', 'redirect', 'target'])('keeps %s captures separate', (condition) => {
    const evidence = pair()
    if (condition === 'changed') evidence.runs[1]!.capture!.fingerprint = 'changed-state'
    if (condition === 'unstable') evidence.runs[1]!.capture!.stable = false
    if (condition === 'missing') delete evidence.runs[1]!.capture
    if (condition === 'signature') evidence.observations[1]!.element!.identity!.signature = 'changed-style'
    if (condition === 'redirect') evidence.runs[1]!.resolvedUrl = 'https://example.test/login'
    if (condition === 'target') evidence.runs[1]!.standard = 'WCAG22AA'
    expect(groupScanEvidence(evidence).occurrences).toHaveLength(2)
  })

  it('does not combine missing identities and locators or infer page-level equivalence', () => {
    const evidence = pair()
    for (const item of evidence.observations) delete item.element
    const grouped = groupScanEvidence(evidence)
    expect(grouped.occurrences).toHaveLength(2)
    expect(grouped.elements).toEqual([])
    expect(grouped.reviews).toEqual([])
  })

  it('offers unverified selector matches for review without merging or counting resolved elements', () => {
    const evidence = pair()
    evidence.observations[1]!.element!.locator = { kind: 'css-selector', selector: '#search' }
    for (const item of evidence.observations) delete item.element!.identity
    const grouped = groupScanEvidence(evidence)
    expect(grouped.findings).toHaveLength(2)
    expect(grouped.reviews[0]?.reason).toBe('unverified-element')
    expect(grouped.summary).toMatchObject({ affectedElements: 0, unresolvedElementOccurrences: 2 })
  })

  it.each(['pass', 'incomplete', 'warning'] as const)('preserves a %s/violation disagreement for review', (outcome) => {
    const evidence = pair()
    evidence.observations[1]!.outcome = outcome
    const grouped = groupScanEvidence(evidence)
    expect(grouped.reviews[0]?.reason).toBe('conflicting-outcomes')
    expect(grouped.findings.some(item => item.outcome === 'violation')).toBe(true)
    expect(grouped.occurrences).toHaveLength(outcome === 'pass' ? 1 : 2)
    expect(grouped.summary.rawObservations).toBe(2)
  })

  it('does not count successful or inapplicable checks as remediation findings', () => {
    const evidence = pair()
    evidence.observations[0]!.outcome = 'pass'
    evidence.observations[1]!.outcome = 'inapplicable'
    const grouped = groupScanEvidence(evidence)
    expect(grouped.findings).toEqual([])
    expect(grouped.summary).toMatchObject({ rawObservations: 2, actionableObservations: 0 })
  })

  it('uses the verified missing-image-alt mapping, keeping unrelated HTMLCS rules separate', () => {
    const evidence = pair()
    evidence.runs[1]!.engine = 'htmlcs'
    evidence.runs[1]!.runner = 'htmlcs'
    evidence.observations[0]!.ruleId = 'image-alt'
    const wrapped = evidence.observations[1]!
    wrapped.ruleId = 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37'
    wrapped.evidence = { kind: 'pa11y', issue: pa11yIssue({ code: wrapped.ruleId, runner: 'htmlcs', context: '<img src="photo.png">' }) }
    expect(groupScanEvidence(evidence).occurrences).toHaveLength(1)
    wrapped.ruleId = 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H67.2'
    expect(groupScanEvidence(evidence).occurrences).toHaveLength(2)
  })

  it('does not collapse an iframe or shadow target into a top-level CSS selector', () => {
    const evidence = pair()
    evidence.observations[0]!.element = { documentId: 'doc-a', locator: { kind: 'axe-target', target: ['iframe', ['widget', 'button']] } }
    evidence.observations[1]!.element = { documentId: 'doc-b', locator: { kind: 'css-selector', selector: 'iframe widget button' } }
    const grouped = groupScanEvidence(evidence)
    expect(grouped.occurrences).toHaveLength(2)
    expect(grouped.reviews).toEqual([])
  })

  it('rejects broken observation provenance instead of silently losing evidence', () => {
    const evidence = pair()
    evidence.observations[0]!.runId = 'missing'
    expect(() => groupScanEvidence(evidence)).toThrow('unknown run')
  })
})

describe('confirmed shared problems', () => {
  function pages() {
    const evidence = pair()
    evidence.runs[1]!.sampleId = 'article'
    evidence.runs[1]!.resolvedUrl = 'https://example.test/article'
    evidence.observations[1]!.element!.locator = { kind: 'css-selector', selector: '#search' }
    return evidence
  }

  it('preserves page occurrences and proposes a possible shared problem', () => {
    const grouped = groupScanEvidence(pages())
    expect(grouped.findings).toHaveLength(2)
    expect(grouped.occurrences).toHaveLength(2)
    expect(grouped.reviews[0]?.reason).toBe('possible-shared-problem')
    expect(grouped.summary.affectedSamples).toBe(2)
  })

  it('combines confirmed shared findings without merging page evidence, and records the decision', () => {
    const evidence = pages()
    const initial = groupScanEvidence(evidence)
    const confirmation = decision(initial.occurrences.map(item => item.id))
    const grouped = groupScanEvidence(evidence, [confirmation])
    expect(grouped.findings).toHaveLength(1)
    expect(grouped.findings[0]?.occurrenceIds).toHaveLength(2)
    expect(grouped.occurrences.map(item => item.sampleId)).toEqual(['sample', 'article'])
    expect(grouped.decisions).toEqual([confirmation])
    expect(grouped.summary).toMatchObject({ uniqueFindings: 1, observedOccurrences: 2, affectedSamples: 2 })
  })

  it('can separate a previously combined occurrence without losing evidence', () => {
    const evidence = pages()
    const initial = groupScanEvidence(evidence)
    const combine = decision(initial.occurrences.map(item => item.id))
    const split = decision([initial.occurrences[0]!.id], { id: 'review-2', action: 'separate', reason: 'Different implementation confirmed' })
    const grouped = groupScanEvidence(evidence, [combine, split])
    expect(grouped.findings).toHaveLength(2)
    expect(grouped.occurrences.flatMap(item => item.observationIds).sort()).toEqual(['one', 'two'])
    expect(grouped.decisions).toHaveLength(2)
  })

  it('keeps different states separate even when the component identity is shared', () => {
    const evidence = pair()
    evidence.runs[1]!.stateId = 'mobile-open'
    const grouped = groupScanEvidence(evidence)
    expect(grouped.findings).toHaveLength(2)
    expect(grouped.occurrences.map(item => item.stateId)).toEqual(['default', 'mobile-open'])
  })

  it('rejects unaudited decisions and merges of different outcomes or issue types', () => {
    const evidence = pages()
    const initial = groupScanEvidence(evidence)
    const ids = initial.occurrences.map(item => item.id)
    expect(() => groupScanEvidence(evidence, [decision(ids, { reviewer: '' })])).toThrow('reviewer')
    expect(() => groupScanEvidence(evidence, [decision(['not-found', ids[0]!])])).toThrow('Invalid occurrence')
    evidence.observations[1]!.outcome = 'incomplete'
    expect(() => groupScanEvidence(evidence, [decision(ids)])).toThrow('Different issue types or outcomes')
    evidence.observations[1]!.outcome = 'violation'
    evidence.observations[1]!.ruleId = 'color-contrast'
    const different = groupScanEvidence(evidence)
    expect(() => groupScanEvidence(evidence, [decision(different.occurrences.map(item => item.id))])).toThrow('Different issue types or outcomes')
  })

  it('does not reattach a separated occurrence when combining other findings later', () => {
    const evidence = pages()
    evidence.runs.push(run('third', { sampleId: 'contact' }))
    evidence.observations.push(observation('three', 'third'))
    const initial = groupScanEvidence(evidence)
    const one = initial.occurrences.find(item => item.observationIds.includes('one'))!.id
    const two = initial.occurrences.find(item => item.observationIds.includes('two'))!.id
    const three = initial.occurrences.find(item => item.observationIds.includes('three'))!.id
    const grouped = groupScanEvidence(evidence, [
      decision([one, two]),
      decision([one], { id: 'review-2', action: 'separate' }),
      decision([one, three], { id: 'review-3' }),
    ])
    expect(grouped.findings).toHaveLength(2)
    expect(grouped.findings.find(item => item.occurrenceIds.includes(one))?.occurrenceIds.sort()).toEqual([one, three].sort())
    expect(grouped.findings.find(item => item.occurrenceIds.includes(two))?.occurrenceIds).toEqual([two])
  })
})
