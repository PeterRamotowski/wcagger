import type { AssessmentOutcome } from './manualAssessment'

export type WorkflowStageKey = 'scope' | 'exploration' | 'sampling' | 'evaluation' | 'reporting'
export interface WorkflowReview { stage: WorkflowStageKey, reviewer: string, reviewedAt: string, notes: string, basis: string }
export interface ReportingNotes {
  schemaVersion: 1
  conclusion: string
  limitations: string
  additionalRequirements: string
  explorationNotes: string
  processNotes: string
  conformanceNotes: string
  reviews: WorkflowReview[]
}
export interface CriterionSampleOutcome {
  sampleId: string
  stateId: string
  sampleName: string
  url: string
  state: string
  outcome: AssessmentOutcome
  recordedOutcome?: AssessmentOutcome
  assessmentId?: string
  stale: boolean
  conflict: boolean
  reconciled: boolean
  findingIds: string[]
  occurrenceIds: string[]
  automatedOutcomes: string[]
}
export interface CriterionReportRow { id: string, title: string, level: string, url: string, outcome: AssessmentOutcome, samples: CriterionSampleOutcome[] }
export interface IssueTypeIndex { issueType: string, findingIds: string[], occurrenceIds: string[], sampleIds: string[], criteria: string[] }
export interface UnresolvedWork {
  id: string
  stage: WorkflowStageKey
  code: string
  severity: 'blocking' | 'limitation'
  count: number
  sampleIds: string[]
  criterionIds: string[]
  findingIds: string[]
  details: string[]
}
export interface WorkflowStageReport {
  key: WorkflowStageKey
  status: 'not-reviewed' | 'needs-attention' | 'reviewed'
  stale: boolean
  review?: WorkflowReview
  unresolvedIds: string[]
}
export interface EvaluationReviewReport {
  support: 'evaluator-workflow-support'
  status: 'incomplete' | 'reviewed'
  notes: ReportingNotes
  stages: WorkflowStageReport[]
  criteria: CriterionReportRow[]
  issueTypes: IssueTypeIndex[]
  unresolved: UnresolvedWork[]
  limitations: string[]
}
