import type { DeepReadonly } from 'vue'
// IDs, levels and English titles: W3C WCAG 2.1 and WCAG 2.2 Recommendations.
// https://www.w3.org/TR/WCAG21/ and https://www.w3.org/TR/WCAG22/
import catalog from '../wcagCriteria.json'
import type { Evaluation, EvaluationSnapshot } from '../types/evaluation'
import type { ManualAssessment, AssessmentBasis, AssessmentOutcome, AssessmentMethod } from '../types/manualAssessment'
import type { AccessibilityCheckResults } from '../types/accessibility'

export const ASSESSMENT_OUTCOMES: AssessmentOutcome[] = ['not-tested', 'needs-review', 'passed', 'failed', 'not-present']
export const ASSESSMENT_METHODS: AssessmentMethod[] = ['keyboard', 'assistive-technology', 'interaction', 'content', 'other']
export const MAX_ASSESSMENTS = 1740
export function criteriaForTarget(standard: string) {
  const match = /^WCAG(20|21|22)(A{1,3})$/.exec(standard)
  return match ? catalog.filter(criterion => criterion.versions.includes(match[1]!) && criterion.level.length <= match[2]!.length) : []
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, value]) => value !== undefined && value !== '' && !(Array.isArray(value) && !value.length)).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => JSON.stringify(key) + ':' + canonical(value)).join(',') + '}'
  return JSON.stringify(typeof value === 'string' ? value.trim() : value) ?? 'null'
}
export function assessmentBasis(evaluation: DeepReadonly<Evaluation>, sampleId: string, runIds: readonly string[]): AssessmentBasis {
  const sample = evaluation.samples.find(sample => sample.id === sampleId)
  return { scope: canonical({ scope: evaluation.scope, target: evaluation.targetStandard }), sample: canonical(sample ? { id: sample.id, url: sample.url.trim(), state: sample.state, preparation: sample.preparation } : null), runIds: [...new Set(runIds)].sort() }
}
export function assessmentIsStale(assessment: DeepReadonly<ManualAssessment>, evaluation: DeepReadonly<Evaluation>, runIds: readonly string[]): boolean {
  const current = assessmentBasis(evaluation, assessment.sampleId, runIds)
  return assessment.basis.scope !== current.scope || assessment.basis.sample !== current.sample || canonical([...assessment.basis.runIds].sort()) !== canonical(current.runIds)
}
export function normalizeAssessments(input: unknown): ManualAssessment[] {
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  const text = (value: unknown, max = 5000): string => {
    if (typeof value !== 'string' || value.length > max) throw new Error('Invalid assessment text')
    return value
  }
  const identity = (value: unknown) => {
    const id = text(value, 100)
    if (!id.trim()) throw new Error('Missing assessment reference')
    return id
  }
  const strings = (value: unknown, limit: number): string[] => {
    if (!Array.isArray(value) || value.length > limit) throw new Error('Invalid assessment references')
    return [...new Set(value.map(identity))]
  }
  if (input === undefined) return []
  if (!Array.isArray(input) || input.length > MAX_ASSESSMENTS) throw new Error('Too many assessments')
  const ids = new Set<string>()
  const pairs = new Set<string>()
  return input.map((value) => {
    if (!record(value) || value.schemaVersion !== 1 || !ASSESSMENT_OUTCOMES.includes(value.outcome as AssessmentOutcome) || !record(value.basis) || !Array.isArray(value.methods) || !value.methods.every(method => ASSESSMENT_METHODS.includes(method))) throw new Error('Invalid assessment')
    const assessment: ManualAssessment = { schemaVersion: 1, id: identity(value.id), sampleId: identity(value.sampleId), stateId: identity(value.stateId), criterionId: identity(value.criterionId), outcome: value.outcome as AssessmentOutcome, justification: text(value.justification), reviewer: text(value.reviewer, 200), reviewedAt: text(value.reviewedAt, 100), environment: text(value.environment, 2000), methods: [...new Set(value.methods)] as AssessmentMethod[], notes: text(value.notes), supportingEvidence: text(value.supportingEvidence), observationIds: strings(value.observationIds, 1000), basis: { scope: text(value.basis.scope, 250000), sample: text(value.basis.sample, 10000), runIds: strings(value.basis.runIds, 1000) } }
    const key = canonical([assessment.sampleId, assessment.criterionId])
    if (ids.has(assessment.id) || pairs.has(key) || !catalog.some(criterion => criterion.id === assessment.criterionId) || !Number.isFinite(Date.parse(assessment.reviewedAt))) throw new Error('Invalid or duplicate assessment')
    if (['passed', 'failed', 'not-present'].includes(assessment.outcome) && (!assessment.justification.trim() || !assessment.reviewer.trim() || !assessment.environment.trim() || !assessment.methods.length)) throw new Error('An assessed outcome requires justification, reviewer, environment and testing method')
    ids.add(assessment.id)
    pairs.add(key)
    return assessment
  })
}
export function manualAssessmentCoverage(evaluation: DeepReadonly<Evaluation & { manualAssessments?: ManualAssessment[] }>, runIds: (sampleId: string) => readonly string[], observationIds?: readonly string[]) {
  const criteria = criteriaForTarget(evaluation.targetStandard)
  const available = observationIds ? new Set(observationIds) : null
  const assessments = evaluation as DeepReadonly<EvaluationSnapshot>
  const records = (assessments.manualAssessments ?? []).map(assessment => ({ ...assessment, stale: assessmentIsStale(assessment, evaluation, runIds(assessment.sampleId)) || (!!available && assessment.observationIds.some(id => !available.has(id))), inTarget: criteria.some(criterion => criterion.id === assessment.criterionId) && evaluation.samples.some(sample => sample.id === assessment.sampleId && sample.state.id === assessment.stateId) }))
  const expected = criteria.length * evaluation.samples.length
  const current = records.filter(record => record.inTarget && !record.stale)
  const counts = Object.fromEntries(ASSESSMENT_OUTCOMES.map(outcome => [outcome, current.filter(record => record.outcome === outcome).length])) as Record<AssessmentOutcome, number>
  counts['not-tested'] += expected - current.length
  return { expected, counts, stale: records.filter(record => record.stale || !record.inTarget).length, records }
}
export function emptyEvaluationReport(evaluation: Evaluation, timestamp = new Date().toISOString()): AccessibilityCheckResults {
  return { url: evaluation.samples[0]!.url, timestamp, summary: { totalViolations: 0, totalWarnings: 0, totalPassed: 0 }, combined: { violations: [], warnings: [], passed: [] }, evidence: { schemaVersion: 1, sample: evaluation.samples[0]!, samples: evaluation.samples, evaluation: { ...evaluation, scannedSampleIds: [] }, runs: [], observations: [], grouping: { findings: [], occurrences: [], elements: [], reviews: [], decisions: [], summary: { rawObservations: 0, actionableObservations: 0, uniqueFindings: 0, observedOccurrences: 0, affectedElements: 0, unresolvedElementOccurrences: 0, affectedSamples: 0 } } } }
}
