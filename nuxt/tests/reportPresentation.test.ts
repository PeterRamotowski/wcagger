import { describe, expect, it } from 'vitest'
import { buildGroupedReport, filterReportFindings, formatLocator, safeReportLink } from '../shared/utils/reportPresentation'
import { reportFixture } from './fixtures/groupedReport'
import { reviewGrouping } from '../server/services/groupingReviewService'

describe('shared report presentation', () => {
  it('uses grouped counts and distinguishes tool paths from underlying engines', () => {
    const scan = reportFixture()
    const report = buildGroupedReport(scan)
    expect(report.summary).toMatchObject({ uniqueFindings: 3, observedOccurrences: 3, rawObservations: 8, affectedSamples: 1 })
    const button = report.findings.find(item => item.issueType === 'axe:button-name')!
    expect(button.sources).toEqual(expect.arrayContaining(['Axe', 'Pa11y / Axe']))
    expect(button.engines).toEqual(['axe'])
    expect(button.occurrences[0]?.observations).toHaveLength(2)
    expect(button.criteria).toContain('4.1.2')
    expect(report.automatedChecks).toEqual({ passedObservations: 1, inapplicableObservations: 1 })
    expect(report.pages).toHaveLength(1)
    expect(report.elements).toHaveLength(2)
  })

  it('filters views without mutating the complete report used by exports', () => {
    const report = buildGroupedReport(reportFixture())
    expect(filterReportFindings(report.findings, { outcome: 'incomplete' })).toHaveLength(1)
    expect(filterReportFindings(report.findings, { source: 'Pa11y / HTMLCS', criterion: '1.1.1' })).toHaveLength(1)
    expect(filterReportFindings(report.findings, { criterion: '9.9.9' })).toEqual([])
    expect(filterReportFindings(report.findings, { issueType: 'axe:button-name' })).toHaveLength(1)
    expect(filterReportFindings(report.findings, { issueType: 'missing' })).toEqual([])
    expect(report.findings).toHaveLength(3)
  })

  it('preserves nested selector boundaries and blocks executable or relative report links', () => {
    expect(formatLocator({ documentId: 'doc', locator: { kind: 'axe-target', target: ['iframe', ['widget', 'button']] } })).toBe('["iframe",["widget","button"]]')
    expect(safeReportLink('javascript:alert(1)')).toBeUndefined()
    expect(safeReportLink('/relative')).toBeUndefined()
    expect(safeReportLink('https://example.com/help')).toBe('https://example.com/help')
  })

  it('marks explicit decisions as reviewed and keeps the history and occurrences', () => {
    const scan = reportFixture(true)
    const initial = buildGroupedReport(scan)
    const review = initial.reviews.find(item => item.observations.every(observation => observation.ruleId === 'button-name'))!
    expect(review.resolved).toBe(false)
    scan.evidence.grouping = reviewGrouping({ evidence: scan.evidence, decision: { id: 'decision-1', action: 'combine', occurrenceIds: review.occurrenceIds, reviewer: 'Evaluator', reason: 'Same shared component verified', timestamp: scan.timestamp } })
    const report = buildGroupedReport(scan)
    expect(report.reviews.find(item => item.id === review.id)?.resolved).toBe(true)
    expect(report.findings.find(item => item.issueType === 'axe:button-name')?.occurrences).toHaveLength(2)
    expect(report.decisions[0]?.reviewer).toBe('Evaluator')
  })

  it.each([null, {}, { evidence: {}, decision: {} }, { evidence: { schemaVersion: 9 }, decision: { action: 'combine' } }])('rejects malformed review requests', (value) => {
    expect(() => reviewGrouping(value)).toThrow()
  })

  it('rejects malformed nested selectors and forged run references', () => {
    const scan = reportFixture(true)
    const decision = { id: 'decision', action: 'separate', occurrenceIds: scan.evidence.grouping!.occurrences.map(item => item.id), reviewer: 'Evaluator', timestamp: scan.timestamp, reason: 'Separate occurrences' }
    scan.evidence.observations[0]!.runId = 'missing'
    expect(() => reviewGrouping({ evidence: scan.evidence, decision })).toThrow('unknown run')
    scan.evidence.observations[0]!.runId = scan.evidence.runs[0]!.id
    const malformed = JSON.parse(JSON.stringify(scan.evidence))
    malformed.observations[0].element.locator = { kind: 'axe-target', target: [42] }
    expect(() => reviewGrouping({ evidence: malformed, decision })).toThrow('Invalid observation')
  })
})
