import type { NodeResult, Result, UnlabelledFrameSelector } from 'axe-core'

export type ScanTool = 'axe' | 'pa11y'
export type ScanEngine = 'axe' | 'htmlcs' | 'unknown'
export type ObservationOutcome = 'violation' | 'incomplete' | 'warning' | 'notice' | 'pass' | 'inapplicable' | 'unknown'

export interface ScanSample {
  id: string
  url: string
  state: { id: string, description: string }
}

export interface EngineRun {
  id: string
  sampleId: string
  stateId: string
  tool: ScanTool
  engine: ScanEngine
  runner?: string
  engineVersion?: string
  status: 'completed'
  startedAt: string
  completedAt: string
  requestedUrl: string
  resolvedUrl: string
  standard: string
  configuration: {
    standard?: string
    tags?: string[]
    runners?: string[]
    timeout?: number
    wait?: number
  }
}

export interface ElementReference {
  // Each engine navigation is a separate document; matching across runs comes later.
  documentId: string
  locator: { kind: 'axe-target', target: UnlabelledFrameSelector } | { kind: 'css-selector', selector: string }
  html?: string
}

export interface Pa11yIssue {
  code: string
  type: string
  typeCode: number
  message: string
  context: string
  selector: string
  runner?: string
  runnerExtras?: Record<string, unknown>
}

export interface Pa11yScanResults {
  documentTitle: string
  pageUrl: string
  issues: Pa11yIssue[]
}

export type ObservationEvidence = {
  kind: 'axe'
  rule: Omit<Result, 'nodes'>
  node?: Omit<NodeResult, 'element'>
} | {
  kind: 'pa11y'
  issue: Pa11yIssue
}

export interface ScanObservation {
  id: string
  runId: string
  ruleId: string
  outcome: ObservationOutcome
  title: string
  description?: string
  helpUrl?: string
  impact?: string | null
  tags: string[]
  element?: ElementReference
  evidence: ObservationEvidence
}

// Step 2 will populate these records after conservative matching.
export interface FindingOccurrence {
  id: string
  findingId: string
  sampleId: string
  stateId: string
  element?: ElementReference
  observationIds: string[]
}

export interface AccessibilityFinding {
  id: string
  issueType: string
  title: string
  occurrenceIds: string[]
}

export interface EngineEvidence {
  runs: Omit<EngineRun, 'sampleId' | 'stateId'>[]
  observations: ScanObservation[]
}

export interface ScanEvidence {
  schemaVersion: 1
  sample: ScanSample
  runs: EngineRun[]
  observations: ScanObservation[]
}
