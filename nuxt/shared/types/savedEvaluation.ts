import type { ReportingNotes } from './evaluationReport'
import type { Evaluation, SampleScan } from './evaluation'
import type { ManualAssessment } from './manualAssessment'
import type { AccessibilityCheckResults } from './accessibility'

export interface SavedEvaluation {
  format: 'wcagger-workspace'
  schemaVersion: 1
  id: string
  revision: number
  savedAt: string
  evaluation: Evaluation
  reporting?: ReportingNotes
  assessments: ManualAssessment[]
  assessmentHistory: ManualAssessment[]
  sampleErrors?: Record<string, string>
  scans: Record<string, SampleScan>
  scanHistory: SampleScan[]
  report: AccessibilityCheckResults | null
  reportHistory: AccessibilityCheckResults[]
  tools: string[]
  runners: string[]
}
export interface SavedEvaluationSummary { id: string, revision: number, savedAt: string, name: string, samples: number }
