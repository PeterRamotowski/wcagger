import type { EvaluationSnapshot } from './evaluation'
import type { ImpactValue, Result, UnlabelledFrameSelector } from 'axe-core'

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
  capture?: { documentId: string, fingerprint?: string, stable: boolean }
  status: 'completed'
  startedAt: string
  completedAt: string
  requestedUrl: string
  resolvedUrl: string
  standard: string
  configuration: {
    standard?: string
    viewport?: { width: number, height: number }
    userAgent?: string
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
  // Populated only after resolving the locator in the actual browser document.
  identity?: { documentId: string, elementId: string, signature: string }
}

export interface Pa11yIssue {
  code: string
  type: string
  typeCode: number
  message: string
  context?: string | null
  selector: string
  runner?: string
  runnerExtras?: Record<string, unknown>
}

export interface Pa11yScanResults {
  documentTitle: string
  pageUrl: string
  issues: Pa11yIssue[]
}

// Browser element handles are not part of serialized scan evidence.
export interface AxeNodeEvidence {
  html: string
  impact?: ImpactValue
  target: UnlabelledFrameSelector
  xpath?: string[]
  ancestry?: UnlabelledFrameSelector
  failureSummary?: string
  any: AxeCheckEvidence[]
  all: AxeCheckEvidence[]
  none: AxeCheckEvidence[]
}
export interface AxeCheckEvidence {
  id: string
  impact: string
  message: string
  data: unknown
  relatedNodes?: { html: string, target: UnlabelledFrameSelector, xpath?: string[], ancestry?: UnlabelledFrameSelector }[]
}

export type ObservationEvidence = {
  kind: 'axe'
  rule: Omit<Result, 'nodes'>
  node?: AxeNodeEvidence
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

export interface FindingOccurrence {
  id: string
  findingId: string
  sampleId: string
  stateId: string
  element?: ElementReference
  observationIds: string[]
  issueType: string
  outcome: ObservationOutcome
}

export interface AccessibilityFinding {
  id: string
  issueType: string
  title: string
  occurrenceIds: string[]
  outcome: ObservationOutcome
}

export interface EngineEvidence {
  runs: Omit<EngineRun, 'sampleId' | 'stateId'>[]
  observations: ScanObservation[]
}

export interface ScanEvidence {
  schemaVersion: 1
  grouping?: EvidenceGrouping
  sample: ScanSample
  samples?: ScanSample[]
  evaluation?: EvaluationSnapshot
  runs: EngineRun[]
  observations: ScanObservation[]
}

export interface FindingGroupingDecision {
  id: string
  action: 'combine' | 'separate'
  occurrenceIds: string[]
  reviewer: string
  timestamp: string
  reason: string
}

export interface GroupingReview {
  id: string
  observationIds: string[]
  reason: 'unverified-element' | 'different-state' | 'conflicting-outcomes' | 'possible-shared-problem'
}

export interface ElementFindingGroup {
  id: string
  sampleId: string
  stateId: string
  occurrenceIds: string[]
  findingIds: string[]
}

export interface EvidenceGrouping {
  findings: AccessibilityFinding[]
  occurrences: FindingOccurrence[]
  elements: ElementFindingGroup[]
  reviews: GroupingReview[]
  decisions: FindingGroupingDecision[]
  summary: {
    rawObservations: number
    actionableObservations: number
    uniqueFindings: number
    observedOccurrences: number
    affectedElements: number
    unresolvedElementOccurrences: number
    affectedSamples: number
  }
}
