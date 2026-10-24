import type { EvaluationExecution } from './evaluationJob'
import type { ScanSample } from './scanEvidence'
import type { AccessibilityCheckResults } from './accessibility'

export interface EvaluationSample extends ScanSample {
  name: string
  typeTags: string[]
  selectionReason: string
  preparation: 'initial-page' | 'manual'
}
export interface Evaluation {
  schemaVersion: 1
  id: string
  name: string
  scope: { description: string }
  targetStandard: string
  samples: EvaluationSample[]
}
export interface SampleScan {
  sample: EvaluationSample
  standard: string
  tools: string[]
  runners: string[]
  results: AccessibilityCheckResults
}
export interface EvaluationSnapshot extends Evaluation {
  scannedSampleIds: string[]
  partiallyScannedSampleIds?: string[]
  execution?: EvaluationExecution
}
