import type { DeepReadonly } from 'vue'
import type { GroupedReport } from './report'
import type { EngineEvidence, ScanEvidence } from './scanEvidence'

export interface ViolationNode {
  target?: string | string[]
  html?: string
  selector?: string
  failureSummary?: string
  any?: unknown[]
  all?: unknown[]
  none?: unknown[]
}

export interface Locale {
  code: string
  name: string
  iso?: string
  file?: string
}

export interface TestRequest {
  url: string
  tools: string[]
  standard: string
  runners?: string[] // Pa11y runners: 'htmlcs', 'axe'
}

export interface WcagStandard {
  name: string
  description: string
  recommendation: string
}

// Tool-specific processed results (server-side only)
export interface AxeProcessedResults {
  violations: Omit<CombinedResultItem, 'source'>[]
  incomplete: Omit<CombinedResultItem, 'source'>[]
  passes: Omit<CombinedResultItem, 'source'>[]
  evidence: EngineEvidence
}
export interface Pa11yProcessedResults {
  errors: Omit<CombinedResultItem, 'source'>[]
  warnings: Omit<CombinedResultItem, 'source'>[]
  notices: Omit<CombinedResultItem, 'source'>[]
  evidence: EngineEvidence
}

export interface CombinedResultItem {
  code?: string
  impact?: string
  title?: string
  description?: string
  helpUrl?: string
  nodes?: readonly unknown[]
  selector?: string
  context?: string
  tags?: readonly string[]
  source: 'axe' | 'pa11y'
  runner?: string // Pa11y runner
  type?: string
  runnerExtras?: Record<string, unknown>
}

export interface CombinedResults {
  violations: readonly CombinedResultItem[]
  warnings: readonly CombinedResultItem[]
  passed: readonly CombinedResultItem[]
}

export interface AccessibilityCheckResults {
  evidence: ScanEvidence
  url: string
  timestamp: string
  summary: {
    totalViolations: number
    totalWarnings: number
    totalPassed: number
  }
  combined: CombinedResults
}

// Export data structure for reports
export interface ExportData {
  schemaVersion: 2
  url: string
  timestamp: string
  selectedTools: string[]
  standards: string[]
  summary: GroupedReport['summary']
  report: GroupedReport
  evidence: DeepReadonly<ScanEvidence>
}

export interface ApiResponse {
  success: boolean
  data?: AccessibilityCheckResults
  error?: string
  details?: string
}
