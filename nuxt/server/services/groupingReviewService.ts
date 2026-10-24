import { groupScanEvidence } from './findingGroupingService'
import { validateScanEvidence } from '~~/shared/utils/scanValidation'
import type { EvidenceGrouping, FindingGroupingDecision } from '~~/shared/types/scanEvidence'

export { validateScanEvidence } from '~~/shared/utils/scanValidation'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}
function validDecision(value: unknown): value is FindingGroupingDecision {
  return record(value) && ['combine', 'separate'].includes(String(value.action)) && strings(value.occurrenceIds)
    && ['id', 'reviewer', 'timestamp', 'reason'].every(key => typeof value[key] === 'string')
}

export function reviewGrouping(input: unknown): EvidenceGrouping {
  if (!record(input) || !validDecision(input.decision)) throw new Error('Invalid grouping request')
  const evidence = validateScanEvidence(input.evidence)
  return groupScanEvidence(evidence, [...(evidence.grouping?.decisions ?? []), input.decision])
}
