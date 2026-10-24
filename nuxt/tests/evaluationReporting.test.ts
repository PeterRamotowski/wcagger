import { describe, expect, it } from 'vitest'
import { readonly } from 'vue'
import { parse } from 'csv-parse/sync'
import { buildGroupedReport } from '../shared/utils/reportPresentation'
import { normalizeReportingNotes, newReportingNotes } from '../shared/utils/reportingNotes'
import { prepareExportData, generateCSVContent, generateJSONContent } from '../app/utils/exportReport'
import { generateEvaluationReviewHTML } from '../server/utils/pdf/evaluationReviewTemplate'
import { escapeReportHTML } from '../server/utils/pdf/groupedReportTemplate'
import { validateSavedEvaluation } from '../shared/utils/savedEvaluation'
import { savedFixture } from './fixtures/savedEvaluation'
import { completeReviewFixture, sharedFindingReviewFixture } from './fixtures/evaluationReview'
import en from '../i18n/locales/en.json'

const t = (key: string) => (en as Record<string, string>)[key] ?? key
describe('evaluation reporting and methodology progress', () => {
  it('indexes criteria and issue types while leaving unassessed samples untested despite automated passes', () => {
    const report = buildGroupedReport(readonly(savedFixture().report!))
    const review = report.evaluationReview!
    expect(review.criteria).toHaveLength(55)
    expect(review.criteria.every(item => item.outcome === 'not-tested')).toBe(true)
    expect(review.issueTypes.flatMap(item => item.findingIds).sort()).toEqual(report.findings.map(item => item.id).sort())
    expect(review.status).toBe('incomplete')
    expect(review.stages.every(stage => stage.status === 'not-reviewed')).toBe(true)
    expect(review.unresolved.find(item => item.code === 'manual-coverage')!.count).toBe(55)
  })
  it('preserves per-page outcomes and automated occurrences under a confirmed shared problem', () => {
    const results = sharedFindingReviewFixture()
    let report = buildGroupedReport(readonly(results))
    const finding = report.findings.find(item => item.issueType === 'axe:button-name')!
    expect(finding.occurrences).toHaveLength(2)
    const criterion = report.evaluationReview!.criteria.find(item => item.id === '4.1.2')!
    expect(criterion.outcome).toBe('failed')
    expect(criterion.samples.map(item => item.outcome)).toEqual(['needs-review', 'failed'])
    expect(criterion.samples[0]!.recordedOutcome).toBe('passed')
    expect(report.evaluationReview!.unresolved.some(item => item.code === 'manual-tool-disagreement')).toBe(true)
    results.evidence.evaluation!.manualAssessments![0]!.reconciliation = 'Verified an accessible name manually; documented why the tool result is a false positive in this state'
    report = buildGroupedReport(readonly(results))
    expect(report.evaluationReview!.criteria.find(item => item.id === '4.1.2')!.samples.map(item => item.outcome)).toEqual(['passed', 'failed'])
    expect(report.findings.find(item => item.id === finding.id)!.occurrences).toHaveLength(2)
    expect(report.findings.find(item => item.id === finding.id)!.outcome).toBe('violation')
    const indexed = report.evaluationReview!.issueTypes.find(item => item.issueType === 'axe:button-name')!
    expect(indexed.findingIds).toEqual([finding.id])
    expect(new Set(indexed.sampleIds)).toEqual(new Set(results.evidence.evaluation!.samples.map(sample => sample.id)))
  })
  it('can finish the recorded methodology review while accessibility failures remain', () => {
    const review = buildGroupedReport(readonly(completeReviewFixture())).evaluationReview!
    expect(review.status).toBe('reviewed')
    expect(review.stages.every(stage => stage.status === 'reviewed')).toBe(true)
    expect(review.criteria.find(item => item.id === '1.1.1')!.outcome).toBe('failed')
    expect(review.unresolved.every(item => item.severity === 'limitation')).toBe(true)
    expect(review.limitations).toContain('sample-only')
  })
  it('invalidates stage reviews after context changes, without silently rewriting their provenance', () => {
    const result = completeReviewFixture()
    const old = structuredClone(result.evidence.evaluation!.reporting!.reviews)
    result.evidence.evaluation!.scope.boundaries = 'Expanded product scope'
    const review = buildGroupedReport(readonly(result)).evaluationReview!
    expect(review.status).toBe('incomplete')
    expect(review.stages.every(stage => stage.stale)).toBe(true)
    expect(result.evidence.evaluation!.reporting!.reviews).toEqual(old)
    expect(review.criteria.every(criterion => criterion.samples.every(sample => sample.outcome === 'not-tested'))).toBe(true)
  })
  it('changes only the report-stage review when conclusions change', () => {
    const result = completeReviewFixture()
    result.evidence.evaluation!.reporting!.conclusion = 'Updated recommendations'
    const review = buildGroupedReport(readonly(result)).evaluationReview!
    expect(review.stages.filter(stage => stage.stale).map(stage => stage.key)).toEqual(['reporting'])
    expect(review.stages.slice(0, 4).every(stage => stage.status === 'reviewed')).toBe(true)
  })
  it('keeps random quota exhaustion and automated scan gaps explicit without turning failures into workflow blockers', () => {
    const result = completeReviewFixture()
    result.evidence.evaluation!.samples[1]!.selection = { kind: 'structured', source: '', method: '' }
    result.evidence.evaluation!.sampling!.exhaustionReason = 'No other distinct views remain in the complete population'
    const review = buildGroupedReport(readonly(result)).evaluationReview!
    expect(review.unresolved.find(item => item.code === 'random-shortfall')!.severity).toBe('limitation')
    expect(review.unresolved.find(item => item.code === 'automated-coverage')!.severity).toBe('limitation')
    expect(review.unresolved.some(item => item.code === 'manual-tool-disagreement')).toBe(false)
  })
  it('requires reproducible examples for manual-only failures and an explanation when no processes are described', () => {
    const result = completeReviewFixture()
    const failed = result.evidence.evaluation!.manualAssessments!.find(item => item.outcome === 'failed')!
    failed.supportingEvidence = ''
    result.evidence.evaluation!.reporting!.processNotes = ''
    const review = buildGroupedReport(readonly(result)).evaluationReview!
    expect(review.unresolved.find(item => item.code === 'failure-example')!.criterionIds).toEqual(['1.1.1'])
    expect(review.unresolved.some(item => item.code === 'process-applicability')).toBe(true)
  })
  it('validates review provenance and versions while keeping older workspaces readable', () => {
    expect(normalizeReportingNotes(undefined)).toEqual(newReportingNotes())
    expect(() => normalizeReportingNotes({ ...newReportingNotes(), schemaVersion: 2 })).toThrow()
    const result = completeReviewFixture()
    const notes = result.evidence.evaluation!.reporting!
    expect(() => normalizeReportingNotes({ ...notes, reviews: [...notes.reviews.slice(0, 1), ...notes.reviews.slice(0, 1)] })).toThrow('duplicate')
    expect(() => normalizeReportingNotes({ ...notes, reviews: [{ ...notes.reviews[0], reviewer: '' }] })).toThrow('requires')
    const workspace = savedFixture()
    workspace.report = result
    workspace.reporting = notes
    const saved = validateSavedEvaluation(workspace)
    expect(saved.reporting).toEqual(notes)
    expect(saved.report!.evidence.evaluation!.reporting).toEqual(notes)
    expect(validateSavedEvaluation(savedFixture()).reporting).toEqual(newReportingNotes())
  })
  it('uses matching captured indexes and unresolved records in JSON/CSV/PDF, with escaped free text', () => {
    const result = sharedFindingReviewFixture()
    result.evidence.evaluation!.reporting = { ...newReportingNotes(), conclusion: '<script>bad()</script> & recommendations', limitations: 'Sampled states only' }
    const data = prepareExportData(readonly(result))
    const exported = JSON.parse(generateJSONContent(data))
    expect(exported.report.evaluationReview.criteria).toEqual(data.report.evaluationReview!.criteria)
    const rows = parse(generateCSVContent(data), { columns: true }) as Record<string, string>[]
    expect(rows.filter(item => item['Record type'] === 'criterion-sample')).toHaveLength(110)
    expect(rows.filter(item => item['Record type'] === 'workflow-stage')).toHaveLength(5)
    expect(rows.filter(item => item['Record type'] === 'issue-type')).toHaveLength(data.report.evaluationReview!.issueTypes.length)
    expect(rows.filter(item => item['Record type'] === 'finding')).toHaveLength(data.report.findings.length)
    const html = generateEvaluationReviewHTML(data.report, t, escapeReportHTML)
    expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt; &amp; recommendations')
    expect(html).not.toContain('<script>')
    expect(generateEvaluationReviewHTML(data.report, t, escapeReportHTML, 'indexes')).toContain('Manual success/absence disagrees')
  })
})
