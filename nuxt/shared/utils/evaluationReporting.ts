import type { GroupedReport, ReportOccurrence } from '../types/report'
import type { AssessmentOutcome } from '../types/manualAssessment'
import type { CriterionReportRow, EvaluationReviewReport, ReportingNotes, UnresolvedWork, WorkflowStageKey, WorkflowStageReport } from '../types/evaluationReport'
import { criteriaForTarget } from './manualAssessments'
import { normalizeReportingNotes, reportingContext, WORKFLOW_STAGES } from './reportingNotes'

export function workflowReviewBasis(stage: WorkflowStageKey, report: GroupedReport, notes: ReportingNotes): string {
  const evaluation = report.evaluation
  if (!evaluation) throw new Error('An evaluation snapshot is required')
  const scope = { id: evaluation.id, scope: evaluation.scope, target: evaluation.targetStandard, additionalRequirements: notes.additionalRequirements }
  const exploration = { scope, inventory: evaluation.inventory ?? [], notes: notes.explorationNotes }
  const sampling = { exploration, samples: evaluation.samples, sampling: evaluation.sampling, processes: evaluation.processes ?? [], processNotes: notes.processNotes }
  const assessment = { sampling, runs: report.runs, assessments: report.manual?.records.map(item => ({ ...item, basis: undefined })), conformanceNotes: notes.conformanceNotes, decisions: report.decisions }
  if (stage === 'scope') return reportingContext(scope)
  if (stage === 'exploration') return reportingContext(exploration)
  if (stage === 'sampling') return reportingContext(sampling)
  if (stage === 'evaluation') return reportingContext(assessment)
  return reportingContext({ assessment, findings: report.findings.map(item => ({ id: item.id, outcome: item.outcome, issueType: item.issueType, criteria: item.criteria, occurrences: item.occurrences.map(item => ({ id: item.id, sampleId: item.sampleId, stateId: item.stateId, observationIds: item.observations.map(item => item.id) })) })), conclusion: notes.conclusion, limitations: notes.limitations, reviews: notes.reviews.filter(item => item.stage !== 'reporting').sort((a, b) => a.stage.localeCompare(b.stage)) })
}
function aggregateOutcomes(outcomes: AssessmentOutcome[]): AssessmentOutcome {
  if (outcomes.includes('failed')) return 'failed'
  if (outcomes.includes('needs-review')) return 'needs-review'
  if (outcomes.includes('not-tested')) return 'not-tested'
  return outcomes.includes('passed') ? 'passed' : 'not-present'
}
export function buildEvaluationReview(report: GroupedReport, notes: ReportingNotes = normalizeReportingNotes(report.evaluation?.reporting)): EvaluationReviewReport | undefined {
  const evaluation = report.evaluation
  if (!evaluation || !report.manual || !report.planning) return undefined
  const assessmentByPair = new Map(report.manual.records.map(item => [JSON.stringify([item.sampleId, item.criterionId]), item]))
  const sources = new Map<string, { findingId: string, occurrence: ReportOccurrence }[]>()
  for (const finding of report.findings) {
    for (const occurrence of finding.occurrences) {
      for (const criterionId of new Set(occurrence.observations.flatMap(item => item.criteria))) {
        const key = JSON.stringify([occurrence.sampleId, occurrence.stateId, criterionId])
        const members = sources.get(key) ?? []
        members.push({ findingId: finding.id, occurrence })
        sources.set(key, members)
      }
    }
  }
  const criteria: CriterionReportRow[] = criteriaForTarget(evaluation.targetStandard).map((criterion) => {
    const samples = evaluation.samples.map((sample) => {
      const assessment = assessmentByPair.get(JSON.stringify([sample.id, criterion.id]))
      const occurrences = sources.get(JSON.stringify([sample.id, sample.state.id, criterion.id])) ?? []
      const automatedOutcomes = [...new Set(occurrences.flatMap(item => item.occurrence.observations.filter(item => item.criteria.includes(criterion.id)).map(item => item.outcome)))]
      const current = !!assessment && assessment.inTarget && !assessment.stale
      const conflict = current && ['passed', 'not-present'].includes(assessment.outcome) && automatedOutcomes.includes('violation')
      const reconciled = conflict && !!assessment.reconciliation?.trim()
      return { sampleId: sample.id, stateId: sample.state.id, sampleName: sample.name || sample.url, url: sample.url, state: sample.state.description, outcome: !current ? 'not-tested' as const : conflict && !reconciled ? 'needs-review' as const : assessment.outcome, recordedOutcome: assessment?.outcome, assessmentId: assessment?.id, stale: !!assessment && (!assessment.inTarget || assessment.stale), conflict, reconciled, findingIds: [...new Set(occurrences.map(item => item.findingId))], occurrenceIds: occurrences.map(item => item.occurrence.id), automatedOutcomes }
    })
    return { ...criterion, outcome: aggregateOutcomes(samples.map(item => item.outcome)), samples }
  })
  const types = [...new Set(report.findings.map(item => item.issueType))].sort()
  const issueTypes = types.map((issueType) => {
    const findings = report.findings.filter(item => item.issueType === issueType)
    return { issueType, findingIds: findings.map(item => item.id), occurrenceIds: findings.flatMap(item => item.occurrences.map(item => item.id)), sampleIds: [...new Set(findings.flatMap(item => item.occurrences.map(item => item.sampleId)))], criteria: [...new Set(findings.flatMap(item => item.criteria))].sort() }
  })
  const unresolved: UnresolvedWork[] = []
  const add = (stage: WorkflowStageKey, code: string, count = 1, options: Partial<UnresolvedWork> = {}) => unresolved.push({ id: code + ':' + (options.sampleIds?.join(',') || stage) + ':' + (options.criterionIds?.join(',') || ''), stage, code, severity: 'blocking', count, sampleIds: [], criterionIds: [], findingIds: [], details: [], ...options })
  const requiredScope = ['description', 'productName', 'boundaries', 'evaluator', 'startDate', 'supportBaseline'] as const
  const missingScope = requiredScope.filter(key => !evaluation.scope[key]?.trim())
  if (missingScope.length) add('scope', 'scope-details', missingScope.length, { details: missingScope })
  if (!notes.additionalRequirements.trim()) add('scope', 'additional-requirements')
  if (!evaluation.inventory?.length) add('exploration', 'inventory')
  const missingKinds = ['common-view', 'function', 'technology'].filter(kind => !evaluation.inventory?.some(item => item.kind === kind))
  if (missingKinds.length && !notes.explorationNotes.trim()) add('exploration', 'inventory-kinds', missingKinds.length, { details: missingKinds })
  const coverage = report.planning.coverage
  if (coverage.uncoveredInventoryIds.length) add('sampling', 'inventory-coverage', coverage.uncoveredInventoryIds.length, { details: coverage.uncoveredInventoryIds })
  if (!coverage.structured) add('sampling', 'structured-samples')
  if (!evaluation.sampling?.rationale.trim()) add('sampling', 'sampling-rationale')
  if (coverage.missingRandom) add('sampling', 'random-shortfall', coverage.missingRandom, { severity: evaluation.sampling?.exhaustionReason.trim() ? 'limitation' : 'blocking' })
  if (coverage.excludedRandomIds.length) add('sampling', 'random-provenance', coverage.excludedRandomIds.length, { sampleIds: coverage.excludedRandomIds })
  if (evaluation.sampling?.coverage !== 'whole-scope') add('sampling', 'population-coverage')
  const unexplained = evaluation.samples.filter(sample => !sample.selectionReason.trim())
  if (unexplained.length) add('sampling', 'sample-reasons', unexplained.length, { sampleIds: unexplained.map(sample => sample.id) })
  const processGaps = (report.processes ?? []).reduce((sum, process) => sum + process.gapCount, 0)
  if (processGaps) add('sampling', 'process-documentation', processGaps)
  if (!evaluation.processes?.length && !notes.processNotes.trim()) add('sampling', 'process-applicability')
  for (const sample of evaluation.samples) {
    const cells = criteria.map(item => ({ criterionId: item.id, cell: item.samples.find(item => item.sampleId === sample.id)! }))
    const pending = cells.filter(item => ['not-tested', 'needs-review'].includes(item.cell.outcome))
    if (pending.length) add('evaluation', 'manual-coverage', pending.length, { sampleIds: [sample.id], criterionIds: pending.map(item => item.criterionId) })
    for (const { criterionId, cell } of cells.filter(item => item.cell.conflict && !item.cell.reconciled)) add('evaluation', 'manual-tool-disagreement', 1, { sampleIds: [sample.id], criterionIds: [criterionId], findingIds: cell.findingIds })
    for (const { criterionId, cell } of cells.filter(item => item.cell.outcome === 'failed')) {
      const assessment = report.manual.records.find(item => item.id === cell.assessmentId)!
      if (!assessment.supportingEvidence.trim() && !cell.occurrenceIds.length) add('evaluation', 'failure-example', 1, { sampleIds: [sample.id], criterionIds: [criterionId] })
    }
  }
  if (report.manual.stale) add('evaluation', 'stale-assessments', report.manual.stale)
  if (!notes.conformanceNotes.trim()) add('evaluation', 'conformance-requirements')
  if (coverage.random && !evaluation.sampling?.comparisonNotes.trim()) add('evaluation', 'sampling-comparison')
  const unscanned = evaluation.samples.filter(sample => !evaluation.scannedSampleIds.includes(sample.id))
  if (unscanned.length) add('evaluation', 'automated-coverage', unscanned.length, { severity: 'limitation', sampleIds: unscanned.map(sample => sample.id) })
  const reviews = report.reviews.filter(review => !review.resolved)
  if (reviews.length) add('evaluation', 'grouping-candidates', reviews.length, { severity: 'limitation', findingIds: [...new Set(reviews.flatMap(review => review.findingIds))] })
  if (!notes.conclusion.trim()) add('reporting', 'conclusion')
  if (!notes.limitations.trim()) add('reporting', 'limitations')
  const stages: WorkflowStageReport[] = WORKFLOW_STAGES.map((key) => {
    const review = notes.reviews.find(review => review.stage === key)
    const stale = !!review && review.basis !== workflowReviewBasis(key, report, notes)
    const gaps = unresolved.filter(item => item.stage === key && item.severity === 'blocking')
    return { key, status: !review ? 'not-reviewed' : stale || gaps.length ? 'needs-attention' : 'reviewed', stale, review: review ? { ...review } : undefined, unresolvedIds: gaps.map(item => item.id) }
  })
  const earlier = stages.filter(stage => stage.key !== 'reporting' && stage.status !== 'reviewed')
  if (earlier.length) {
    add('reporting', 'earlier-stages', earlier.length, { details: earlier.map(stage => stage.key) })
    const reporting = stages[4]!
    reporting.unresolvedIds.push(unresolved[unresolved.length - 1]!.id)
    if (reporting.review) reporting.status = 'needs-attention'
  }
  return { support: 'evaluator-workflow-support', status: stages.every(stage => stage.status === 'reviewed') ? 'reviewed' : 'incomplete', notes, stages, criteria, issueTypes, unresolved, limitations: ['sample-only', 'human-judgment', 'manual-processes'] }
}
