import type { ReportingNotes } from './evaluationReport'
import type { ManualAssessment } from './manualAssessment'
import type { EvaluationExecution } from './evaluationJob'
import type { ScanSample } from './scanEvidence'
import type { AccessibilityCheckResults } from './accessibility'

export interface EvaluationSample extends ScanSample {
  selection?: SampleSelection
  inventoryIds?: string[]
  name: string
  typeTags: string[]
  selectionReason: string
  preparation: 'initial-page' | 'manual'
}
export interface Evaluation {
  schemaVersion: 1
  id: string
  name: string
  scope: EvaluationScope
  inventory?: InventoryEntry[]
  processes?: EvaluationProcess[]
  sampling?: SamplingPlan
  targetStandard: string
  samples: EvaluationSample[]
}
export interface SampleScan {
  status?: 'complete' | 'partial'
  sample: EvaluationSample
  standard: string
  tools: string[]
  runners: string[]
  results: AccessibilityCheckResults
}
export interface EvaluationSnapshot extends Evaluation {
  reporting?: ReportingNotes
  manualAssessments?: ManualAssessment[]
  scannedSampleIds: string[]
  partiallyScannedSampleIds?: string[]
  execution?: EvaluationExecution
}

export interface EvaluationScope {
  description: string
  evaluator?: string
  commissioner?: string
  productName?: string
  productUrl?: string
  startDate?: string
  endDate?: string
  boundaries?: string
  languages?: string[]
  supportBaseline?: string
}
export type InventoryKind = 'common-view' | 'function' | 'sample-type' | 'technology' | 'other'
export interface InventoryEntry { id: string, kind: InventoryKind, name: string, description: string }
export interface SampleSelection {
  kind: 'structured' | 'random'
  source: string
  method: string
  drawId?: string
  candidateId?: string
}
export interface SamplingCandidate {
  id: string
  url: string
  name: string
  stateDescription: string
  preparation: 'initial-page' | 'manual'
}
export interface RandomDraw {
  id: string
  timestamp: string
  method: 'crypto-random-without-replacement-v1'
  source: string
  coverage: 'unknown' | 'partial' | 'whole-scope'
  coverageNotes: string
  requestedCount: number
  eligibleCount: number
  excludedLocations: string[]
  structuredSampleIds: string[]
  pool: SamplingCandidate[]
  selected: { sampleId: string, candidateId: string }[]
}
export interface SamplingPlan {
  source: string
  coverage: 'unknown' | 'partial' | 'whole-scope'
  coverageNotes: string
  rationale: string
  comparisonNotes: string
  exhaustionReason: string
  candidates: SamplingCandidate[]
  draws: RandomDraw[]
}

export type ProcessStateKind = 'initial' | 'form-error' | 'confirmation' | 'dialog' | 'authenticated' | 'other'
export interface ProcessStep {
  id: string
  name: string
  sampleId: string | null
  stateId: string | null
  stateKind: ProcessStateKind
  action: string
  prerequisites: string
  role: string
  expectedState: string
}
export interface ProcessPath {
  id: string
  name: string
  kind: 'default' | 'critical-branch'
  condition: string
  steps: ProcessStep[]
}
export interface EvaluationProcess {
  id: string
  name: string
  startingPoint: string
  prerequisites: string
  role: string
  paths: ProcessPath[]
}
