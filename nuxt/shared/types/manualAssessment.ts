export type AssessmentOutcome = 'not-tested' | 'needs-review' | 'passed' | 'failed' | 'not-present'
export type AssessmentMethod = 'keyboard' | 'assistive-technology' | 'interaction' | 'content' | 'other'
export interface AssessmentBasis {
  scope: string
  sample: string
  runIds: string[]
}
export interface ManualAssessment {
  schemaVersion: 1
  id: string
  sampleId: string
  stateId: string
  criterionId: string
  outcome: AssessmentOutcome
  justification: string
  reviewer: string
  reviewedAt: string
  environment: string
  methods: AssessmentMethod[]
  notes: string
  supportingEvidence: string
  observationIds: string[]
  basis: AssessmentBasis
}
