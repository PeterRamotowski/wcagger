import { describe, expect, it } from 'vitest'
import { readonly } from 'vue'
import { assessmentBasis, assessmentIsStale, criteriaForTarget, normalizeAssessments, manualAssessmentCoverage, emptyEvaluationReport } from '../shared/utils/manualAssessments'
import { validateEvaluation, newEvaluationSample } from '../shared/utils/evaluation'
import { savedFixture, assessmentFixture } from './fixtures/savedEvaluation'
import { prepareExportData, generateJSONContent, generateCSVContent } from '../app/utils/exportReport'
import { generateAssessmentsHTML } from '../server/utils/pdf/assessmentTemplate'
import { escapeReportHTML } from '../server/utils/pdf/groupedReportTemplate'
import en from '../i18n/locales/en.json'

const t = (key: string) => (en as Record<string, string>)[key] ?? key
describe('manual criterion assessment', () => {
  it('uses the complete criterion catalog by version/level including the removal of Parsing in 2.2', () => {
    expect(criteriaForTarget('WCAG20AAA')).toHaveLength(61)
    expect(criteriaForTarget('WCAG21AAA')).toHaveLength(78)
    expect(criteriaForTarget('WCAG22AAA')).toHaveLength(86)
    expect(criteriaForTarget('WCAG20AA')).toHaveLength(38)
    expect(criteriaForTarget('WCAG21AA')).toHaveLength(50)
    expect(criteriaForTarget('WCAG22AA')).toHaveLength(55)
    expect(criteriaForTarget('WCAG21A').some(item => item.id === '4.1.1')).toBe(true)
    expect(criteriaForTarget('WCAG22AAA').some(item => item.id === '4.1.1')).toBe(false)
    expect(criteriaForTarget('WCAG22AA').some(item => item.id === '2.4.13')).toBe(false)
    expect(criteriaForTarget('other')).toEqual([])
  })
  it('requires a justified human decision with actual environment and methods, without inferring it from tool evidence', () => {
    const workspace = savedFixture()
    const report = prepareExportData(readonly(workspace.report!)).report
    expect(report.manual!.counts['not-tested']).toBe(55)
    expect(report.manual!.counts.passed).toBe(0)
    const assessment = assessmentFixture(workspace)
    expect(normalizeAssessments([assessment])[0]).toEqual(assessment)
    for (const key of ['justification', 'reviewer', 'environment'] as const) expect(() => normalizeAssessments([{ ...assessment, [key]: '' }])).toThrow('requires')
    expect(() => normalizeAssessments([{ ...assessment, methods: [] }])).toThrow('requires')
    expect(normalizeAssessments([{ ...assessment, outcome: 'needs-review', reviewer: '', justification: '', environment: '', methods: [] }])).toHaveLength(1)
    expect(() => normalizeAssessments([assessment, { ...assessment, id: 'another' }])).toThrow('duplicate')
    expect(() => normalizeAssessments([{ ...assessment, criterionId: '9.9.9' }])).toThrow()
  })
  it('flags scope, target, sample/state and scan changes while metadata labels and normalization preserve valid assessments', () => {
    const workspace = savedFixture()
    const assessment = assessmentFixture(workspace)
    const runs = assessment.basis.runIds
    expect(assessmentIsStale(assessment, validateEvaluation(workspace.evaluation), [...runs].reverse())).toBe(false)
    workspace.evaluation.samples[0]!.name = 'Metadata label'
    expect(assessmentIsStale(assessment, workspace.evaluation, runs)).toBe(false)
    workspace.evaluation.scope.boundaries = 'New scope boundary'
    expect(assessmentIsStale(assessment, workspace.evaluation, runs)).toBe(true)
    assessment.basis = assessmentBasis(workspace.evaluation, assessment.sampleId, runs)
    expect(assessmentIsStale(assessment, workspace.evaluation, ['replacement-run'])).toBe(true)
    workspace.evaluation.samples[0]!.state.description = 'Dialog opened'
    expect(assessmentIsStale(assessment, workspace.evaluation, runs)).toBe(true)
    workspace.evaluation.targetStandard = 'WCAG20A'
    expect(assessmentIsStale(assessment, workspace.evaluation, runs)).toBe(true)
  })
  it('counts sample/criterion pairs separately, retains earlier outcomes and flags unavailable linked evidence', () => {
    const workspace = savedFixture()
    const assessment = assessmentFixture(workspace)
    const second = newEvaluationSample(workspace.evaluation.samples[0]!.url)
    second.preparation = 'manual'
    workspace.evaluation.samples.push(second)
    const evaluation = { ...workspace.evaluation, scannedSampleIds: [], manualAssessments: [assessment] }
    const current = manualAssessmentCoverage(evaluation, () => assessment.basis.runIds, [])
    expect(current).toMatchObject({ expected: 110, counts: { 'failed': 1, 'passed': 0, 'not-tested': 109 } })
    assessment.observationIds = ['gone']
    const stale = manualAssessmentCoverage(evaluation, () => assessment.basis.runIds, [])
    expect(stale).toMatchObject({ stale: 1, counts: { 'failed': 0, 'not-tested': 110 } })
    expect(stale.records[0]!.outcome).toBe('failed')
    workspace.evaluation.samples = [second]
    expect(manualAssessmentCoverage({ ...workspace.evaluation, manualAssessments: [assessment] }, () => []).records[0]!.inTarget).toBe(false)
  })
  it('supports manual-only reports and escaped manual results across export formats without altering automated findings', () => {
    const workspace = savedFixture()
    const assessment = assessmentFixture(workspace)
    assessment.basis = assessmentBasis(workspace.evaluation, assessment.sampleId, [])
    assessment.justification = '<script>bad()</script> & manual rationale'
    const result = emptyEvaluationReport(validateEvaluation(workspace.evaluation))
    result.evidence.evaluation!.manualAssessments = [assessment]
    const data = prepareExportData(readonly(result))
    expect(data.report.findings).toEqual([])
    expect(data.report.manual!.counts.failed).toBe(1)
    expect(JSON.parse(generateJSONContent(data)).evidence.evaluation.manualAssessments).toHaveLength(1)
    expect(generateCSVContent(data)).toContain('"manual-assessment"')
    const html = generateAssessmentsHTML(data.report, t, escapeReportHTML)
    expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt; &amp; manual rationale')
    expect(html).not.toContain('<script>')
    expect(html).toContain('Firefox 144')
  })
})
