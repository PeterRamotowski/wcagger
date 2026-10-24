import type { SavedEvaluation } from '../../shared/types/savedEvaluation'
import type { ManualAssessment } from '../../shared/types/manualAssessment'
import { newEvaluation, newEvaluationSample } from '../../shared/utils/evaluation'
import { assessmentBasis } from '../../shared/utils/manualAssessments'
import { combineEvaluationResults } from '../../server/services/evaluationResultsService'
import { reportFixture } from './groupedReport'

export function savedFixture(): SavedEvaluation {
  const evaluation = newEvaluation()
  evaluation.targetStandard = 'WCAG22AA'
  evaluation.name = 'Saved assessment'
  const sample = newEvaluationSample('https://example.test/start')
  evaluation.samples = [sample]
  const raw = reportFixture()
  const report = combineEvaluationResults({ evaluation, scans: [{ sampleId: sample.id, evidence: raw.evidence }] })
  return { format: 'wcagger-workspace', schemaVersion: 1, id: 'workspace-test', revision: 0, savedAt: '2026-10-24T12:00:00Z', evaluation, assessments: [], assessmentHistory: [], scans: { [sample.id]: { sample, standard: evaluation.targetStandard, tools: ['axe', 'pa11y'], runners: ['axe', 'htmlcs'], results: raw } }, scanHistory: [], report, reportHistory: [], tools: ['axe', 'pa11y'], runners: ['axe', 'htmlcs'] }
}
export function assessmentFixture(workspace = savedFixture()): ManualAssessment {
  const sample = workspace.evaluation.samples[0]!
  return { schemaVersion: 1, id: 'assessment-1', sampleId: sample.id, stateId: sample.state.id, criterionId: '1.1.1', outcome: 'failed', justification: 'The meaningful photo has no text alternative', reviewer: 'Reviewer', reviewedAt: '2026-10-24T12:00:00Z', environment: 'Firefox 144 and NVDA 2026; desktop 1280 x 800', methods: ['assistive-technology', 'content'], notes: 'Checked the image in reading order', supportingEvidence: 'Photo is announced as a filename', observationIds: [], basis: assessmentBasis(workspace.evaluation, sample.id, workspace.report!.evidence.runs.map(run => run.id)) }
}
