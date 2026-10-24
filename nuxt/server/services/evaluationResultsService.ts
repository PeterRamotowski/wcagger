import type { AccessibilityCheckResults } from '~~/shared/types/accessibility'
import type { FindingGroupingDecision, ScanEvidence } from '~~/shared/types/scanEvidence'
import { validateEvaluation } from '~~/shared/utils/evaluation'
import { validateScanEvidence } from './groupingReviewService'
import { groupScanEvidence } from './findingGroupingService'

export function combineEvaluationResults(input: unknown): AccessibilityCheckResults {
  if (!input || typeof input !== 'object') throw new Error('Invalid evaluation request')
  const body = input as Record<string, unknown>
  const evaluation = validateEvaluation(body.evaluation)
  if (!Array.isArray(body.scans) || !body.scans.length || body.scans.length > evaluation.samples.length) throw new Error('Choose at least one scanned sample')
  const scanned = new Set<string>()
  const partial = new Set<string>()
  const runs: ScanEvidence['runs'] = []
  const observations: ScanEvidence['observations'] = []
  const decisions: FindingGroupingDecision[] = []
  let timestamp = ''
  for (const entry of body.scans) {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid sample scan')
    const scan = entry as Record<string, unknown>
    const sample = evaluation.samples.find(item => item.id === scan.sampleId)
    if (!sample || scanned.has(sample.id) || sample.preparation !== 'initial-page') throw new Error('Unknown, duplicate, or manual sample')
    const evidence = validateScanEvidence(scan.evidence)
    if (evidence.sample.url.trim() !== sample.url || !evidence.runs.length || evidence.runs.some(run => run.standard !== evaluation.targetStandard || run.requestedUrl !== sample.url || run.sampleId !== evidence.sample.id || run.stateId !== evidence.sample.state.id)) throw new Error('Sample scan does not match its URL or target')
    // Validate references, identities, and any local grouping decisions before remapping sample IDs.
    groupScanEvidence(evidence, evidence.grouping?.decisions)
    scanned.add(sample.id)
    if (scan.partial === true) partial.add(sample.id)
    runs.push(...evidence.runs.map(run => ({ ...run, sampleId: sample.id, stateId: sample.state.id })))
    observations.push(...evidence.observations)
    decisions.push(...(evidence.grouping?.decisions ?? []))
    for (const run of evidence.runs) if (run.completedAt > timestamp) timestamp = run.completedAt
  }
  if (runs.length > 1000 || observations.length > 20000) throw new Error('Combined evidence is too large')
  const evidence: ScanEvidence = {
    schemaVersion: 1, sample: evaluation.samples[0]!, samples: evaluation.samples,
    evaluation: { ...evaluation, scannedSampleIds: [...scanned].filter(id => !partial.has(id)), partiallyScannedSampleIds: [...partial] }, runs, observations,
  }
  const history = validateScanEvidence({ ...evidence, grouping: { decisions: body.decisions ?? decisions } }).grouping!.decisions
  evidence.grouping = groupScanEvidence(evidence, history)
  return {
    url: evaluation.samples[0]!.url, timestamp,
    evidence, combined: { violations: [], warnings: [], passed: [] },
    // Evaluation consumers use evidence.grouping, rather than concatenated legacy rule counts.
    summary: { totalViolations: evidence.grouping.findings.filter(item => item.outcome === 'violation').length, totalWarnings: evidence.grouping.findings.filter(item => item.outcome !== 'violation').length, totalPassed: 0 },
  }
}
