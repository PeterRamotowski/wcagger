import { groupScanEvidence } from './findingGroupingService'
import type { EvidenceGrouping, FindingGroupingDecision, ScanEvidence } from '~~/shared/types/scanEvidence'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}
function hasStrings(value: unknown, keys: string[]): boolean {
  return record(value) && keys.every(key => typeof value[key] === 'string')
}
function validDecision(value: unknown): value is FindingGroupingDecision {
  return record(value) && ['combine', 'separate'].includes(String(value.action)) && strings(value.occurrenceIds)
    && ['id', 'reviewer', 'timestamp', 'reason'].every(key => typeof value[key] === 'string')
}
function validElement(value: unknown): boolean {
  if (value === undefined) return true
  if (!record(value) || typeof value.documentId !== 'string' || !record(value.locator)) return false
  const locator = value.locator
  if (locator.kind === 'css-selector' ? typeof locator.selector !== 'string' : locator.kind !== 'axe-target' || !Array.isArray(locator.target) || !locator.target.every(item => typeof item === 'string' || strings(item))) return false
  if (value.html !== undefined && typeof value.html !== 'string') return false
  return value.identity === undefined || hasStrings(value.identity, ['documentId', 'elementId', 'signature'])
}

export function reviewGrouping(input: unknown): EvidenceGrouping {
  if (!record(input) || !record(input.evidence) || !validDecision(input.decision)) throw new Error('Invalid grouping request')
  const evidence = input.evidence
  const sample = evidence.sample
  if (evidence.schemaVersion !== 1 || !record(sample) || !hasStrings(sample, ['id', 'url']) || !hasStrings(sample.state, ['id', 'description'])) throw new Error('Invalid sample metadata')
  if (!Array.isArray(evidence.runs) || !Array.isArray(evidence.observations) || evidence.runs.length > 1000 || evidence.observations.length > 20000) throw new Error('Invalid or oversized evidence')
  for (const run of evidence.runs) {
    if (!record(run) || !['id', 'sampleId', 'stateId', 'resolvedUrl', 'requestedUrl', 'standard', 'startedAt', 'completedAt'].every(key => typeof run[key] === 'string') || !['axe', 'pa11y'].includes(String(run.tool)) || !['axe', 'htmlcs', 'unknown'].includes(String(run.engine))) throw new Error('Invalid engine run')
    if (run.capture !== undefined && (!record(run.capture) || typeof run.capture.documentId !== 'string' || typeof run.capture.stable !== 'boolean' || (run.capture.fingerprint !== undefined && typeof run.capture.fingerprint !== 'string'))) throw new Error('Invalid capture metadata')
  }
  for (const item of evidence.observations) {
    if (!record(item) || !['id', 'runId', 'ruleId', 'title'].every(key => typeof item[key] === 'string') || !['violation', 'incomplete', 'warning', 'notice', 'pass', 'inapplicable', 'unknown'].includes(String(item.outcome)) || !strings(item.tags) || !validElement(item.element) || !record(item.evidence)) throw new Error('Invalid observation')
    if (item.evidence.kind === 'pa11y' ? !record(item.evidence.issue) || typeof item.evidence.issue.context !== 'string' : item.evidence.kind !== 'axe' || !record(item.evidence.rule)) throw new Error('Invalid source evidence')
  }
  const history = record(evidence.grouping) ? evidence.grouping.decisions : []
  if (!Array.isArray(history) || history.length > 1000 || !history.every(validDecision)) throw new Error('Invalid review history')
  return groupScanEvidence(evidence as unknown as ScanEvidence, [...history, input.decision])
}
