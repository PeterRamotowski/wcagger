import type { EvaluationReviewReport } from './evaluationReport'
import type { manualAssessmentCoverage } from '../utils/manualAssessments'
import type { processCoverage } from '../utils/processes'
import type { samplingCoverage, compareSamplingSets } from '../utils/sampling'
import type { EvaluationSnapshot } from './evaluation'
import type { DeepReadonly } from 'vue'
import type { EngineRun, EvidenceGrouping, ObservationOutcome } from './scanEvidence'

export interface ReportObservation {
  id: string
  runId: string
  source: string
  engine: string
  ruleId: string
  outcome: ObservationOutcome
  criteria: string[]
  title: string
  description?: string
  impact?: string | null
  helpUrl?: string
  selector: string
  html?: string
  startedAt: string
  completedAt: string
}
export interface ReportOccurrence {
  id: string
  sampleId: string
  stateId: string
  url: string
  sampleName?: string
  state: string
  selector: string
  observations: ReportObservation[]
}
export interface ReportFinding {
  id: string
  title: string
  issueType: string
  outcome: ObservationOutcome
  criteria: string[]
  sources: string[]
  engines: string[]
  occurrences: ReportOccurrence[]
  affectedSamples: number
}
export interface ReportGroup {
  id: string
  label: string
  findingIds: string[]
  occurrenceIds: string[]
}
export interface ReportReview {
  id: string
  reason: string
  occurrenceIds: string[]
  findingIds: string[]
  observations: ReportObservation[]
  canCombine: boolean
  resolved: boolean
}
export interface GroupedReport {
  evaluationReview?: EvaluationReviewReport
  manual?: ReturnType<typeof manualAssessmentCoverage>
  processes?: ReturnType<typeof processCoverage>
  planning?: { coverage: ReturnType<typeof samplingCoverage>, comparison: ReturnType<typeof compareSamplingSets> }
  evaluation?: DeepReadonly<EvaluationSnapshot>
  url: string
  timestamp: string
  standards: string[]
  tools: string[]
  summary: EvidenceGrouping['summary']
  findings: ReportFinding[]
  elements: ReportGroup[]
  pages: ReportGroup[]
  reviews: ReportReview[]
  decisions: DeepReadonly<EvidenceGrouping['decisions']>
  runs: DeepReadonly<EngineRun>[]
  automatedChecks: { passedObservations: number, inapplicableObservations: number }
}
