import { readonly } from 'vue'
import { newEvaluation, newEvaluationSample, validateEvaluation } from '../../shared/utils/evaluation'
import { assessmentBasis, criteriaForTarget, emptyEvaluationReport } from '../../shared/utils/manualAssessments'
import { newReportingNotes, WORKFLOW_STAGES } from '../../shared/utils/reportingNotes'
import { workflowReviewBasis } from '../../shared/utils/evaluationReporting'
import { buildGroupedReport } from '../../shared/utils/reportPresentation'
import { reportFixture } from './groupedReport'
import { combineEvaluationResults } from '../../server/services/evaluationResultsService'
import { reviewGrouping } from '../../server/services/groupingReviewService'
import type { ManualAssessment } from '../../shared/types/manualAssessment'

export function completeReviewFixture() {
  const source = newEvaluation()
  source.targetStandard = 'WCAG22AA'
  source.name = 'Completed review with an accessibility failure'
  source.scope = { description: 'All public Example product pages', productName: 'Example product', productUrl: 'https://example.test/', boundaries: 'Public content and shared components', evaluator: 'Evaluator', startDate: '2026-10-24', supportBaseline: 'Firefox with NVDA and keyboard-only use' }
  source.inventory = [{ id: 'views', kind: 'common-view', name: 'Public view', description: '' }, { id: 'functions', kind: 'function', name: 'Read information', description: '' }, { id: 'html', kind: 'technology', name: 'HTML', description: '' }]
  const first = newEvaluationSample('https://example.test/structured')
  const second = newEvaluationSample('https://example.test/random')
  first.name = 'Structured page'
  second.name = 'Random page'
  first.selectionReason = 'Representative public content'
  second.selectionReason = 'Additional independently selected example'
  first.inventoryIds = second.inventoryIds = ['views', 'functions', 'html']
  second.selection = { kind: 'random', source: 'Full product list', method: 'Random selection from the full list' }
  source.samples = [first, second]
  source.sampling!.source = 'Full product list'
  source.sampling!.coverage = 'whole-scope'
  source.sampling!.rationale = 'Select representative content and check against a random example'
  source.sampling!.comparisonNotes = 'Manually compared both sets; no additional content types or outcomes require expanding the sample'
  const evaluation = validateEvaluation(source)
  const results = emptyEvaluationReport(evaluation, '2026-10-24T12:00:00Z')
  const notes = newReportingNotes()
  notes.additionalRequirements = 'No additional requirements'
  notes.explorationNotes = 'Explored all public views and relied-upon technologies'
  notes.processNotes = 'The product only provides static information; no multi-step complete processes apply'
  notes.conformanceNotes = 'Checked full pages, complete-process applicability, accessibility support, alternative-version applicability and non-interference'
  notes.conclusion = 'One sampled criterion failure needs remediation; other recorded work has been reviewed'
  notes.limitations = 'Sampled evaluation; no automatic whole-site conformance claim'
  results.evidence.evaluation!.reporting = notes
  results.evidence.evaluation!.manualAssessments = evaluation.samples.flatMap(sample => criteriaForTarget(evaluation.targetStandard).map((criterion): ManualAssessment => ({ schemaVersion: 1, id: sample.id + '-' + criterion.id, sampleId: sample.id, stateId: sample.state.id, criterionId: criterion.id, outcome: sample.id === second.id && criterion.id === '1.1.1' ? 'failed' : 'not-present', reviewer: 'Evaluator', reviewedAt: '2026-10-24T12:00:00Z', justification: 'Evaluator checked this criterion in the captured state', supportingEvidence: 'Observed example and reproduction notes for the sample state', environment: 'Firefox and NVDA; desktop 1280 x 800', methods: ['keyboard', 'assistive-technology', 'content', 'interaction'], notes: '', observationIds: [], basis: assessmentBasis(evaluation, sample.id, []) })))
  for (const stage of WORKFLOW_STAGES) {
    const report = buildGroupedReport(readonly(results))
    notes.reviews.push({ stage, reviewer: 'Evaluator', reviewedAt: '2026-10-24T12:00:00Z', notes: 'Reviewed this stage, its evidence, outcomes and limitations', basis: workflowReviewBasis(stage, report, notes) })
  }
  return results
}
export function sharedFindingReviewFixture() {
  const evaluation = newEvaluation()
  evaluation.targetStandard = 'WCAG22AA'
  evaluation.samples = [newEvaluationSample('https://example.test/start'), newEvaluationSample('https://example.test/other')]
  const scans = evaluation.samples.map((sample) => {
    const scan = reportFixture()
    scan.evidence.sample.url = sample.url
    for (const run of scan.evidence.runs) {
      run.requestedUrl = sample.url
      run.resolvedUrl = sample.url
    }
    return { sampleId: sample.id, evidence: scan.evidence }
  })
  const results = combineEvaluationResults({ evaluation, scans })
  const members = results.evidence.grouping!.occurrences.filter(item => item.issueType === 'axe:button-name')
  results.evidence.grouping = reviewGrouping({ evidence: results.evidence, decision: { id: 'shared-header-review', action: 'combine', occurrenceIds: members.map(item => item.id), reviewer: 'Evaluator', timestamp: '2026-10-24T12:00:00Z', reason: 'Confirmed shared header implementation' } })
  results.evidence.evaluation!.manualAssessments = evaluation.samples.map((sample, index) => ({ schemaVersion: 1, id: 'assessment-' + index, sampleId: sample.id, stateId: sample.state.id, criterionId: '4.1.2', outcome: index === 0 ? 'passed' : 'failed', reviewer: 'Evaluator', reviewedAt: '2026-10-24T12:00:00Z', justification: 'Checked each affected sampled state independently', environment: 'Firefox with NVDA', methods: ['assistive-technology', 'interaction'], notes: '', supportingEvidence: 'Header button checked in each page state', observationIds: [], basis: assessmentBasis(evaluation, sample.id, results.evidence.runs.filter(run => run.sampleId === sample.id).map(run => run.id)) }))
  return results
}
