import { readonly } from 'vue'
import type { AccessibilityCheckResults } from '../types/accessibility'
import type { SavedEvaluation } from '../types/savedEvaluation'
import type { SampleScan } from '../types/evaluation'
import { validateEvaluation } from './evaluation'
import { normalizeAssessments } from './manualAssessments'
import { validateScanEvidence } from './scanValidation'
import { buildGroupedReport } from './reportPresentation'

export const MAX_WORKSPACE_BYTES = 25 * 1024 * 1024
export const MAX_SCAN_HISTORY = 60
export const MAX_REPORT_HISTORY = 20
export const MAX_ASSESSMENT_HISTORY = 5000
export function validateSavedEvaluation(input: unknown): SavedEvaluation {
  input = JSON.parse(JSON.stringify(input))
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  const list = (value: unknown, max: number): unknown[] => {
    if (!Array.isArray(value) || value.length > max) throw new Error('Invalid or oversized saved workspace')
    return value
  }
  const options = (value: unknown, allowed: string[]) => {
    const values = list(value, allowed.length)
    if (!values.every(value => typeof value === 'string' && allowed.includes(value))) throw new Error('Invalid saved scanner configuration')
    return [...new Set(values)] as string[]
  }
  if (!record(input) || input.format !== 'wcagger-workspace' || input.schemaVersion !== 1 || typeof input.id !== 'string' || !input.id.trim() || input.id.length > 100 || !Number.isInteger(input.revision) || Number(input.revision) < 0 || typeof input.savedAt !== 'string' || !Number.isFinite(Date.parse(input.savedAt))) throw new Error('Unsupported or invalid saved workspace')
  const evaluation = validateEvaluation(input.evaluation)
  const result = (value: unknown, grouped = false): AccessibilityCheckResults => {
    if (!record(value) || typeof value.url !== 'string' || typeof value.timestamp !== 'string' || !Number.isFinite(Date.parse(value.timestamp))) throw new Error('Invalid saved scan')
    const evidence = validateScanEvidence(value.evidence)
    const runIds = new Set(evidence.runs.map(run => run.id))
    const observationIds = new Set(evidence.observations.map(item => item.id))
    if (runIds.size !== evidence.runs.length || observationIds.size !== evidence.observations.length || evidence.observations.some(item => !runIds.has(item.runId))) throw new Error('Broken saved evidence references')
    if (evidence.evaluation) {
      const definition = validateEvaluation(evidence.evaluation)
      const captured = evidence.evaluation
      const execution = captured.execution
      if (execution) {
        if (!record(execution) || typeof execution.jobId !== 'string' || !['queued', 'running', 'completed', 'incomplete', 'failed'].includes(execution.status)) throw new Error('Invalid saved execution')
        options(execution.tools, ['axe', 'pa11y'])
        options(execution.runners, ['axe', 'htmlcs'])
        for (const task of list(execution.tasks, 60)) {
          if (!record(task) || !definition.samples.some(sample => sample.id === task.sampleId) || !['axe', 'pa11y:axe', 'pa11y:htmlcs'].includes(String(task.key))) throw new Error('Invalid saved engine task')
          for (const attempt of list(task.attempts, 3)) {
            if (!record(attempt) || typeof attempt.id !== 'string' || !['queued', 'running', 'completed', 'failed', 'skipped'].includes(String(attempt.status)) || (attempt.error !== undefined && typeof attempt.error !== 'string') || ['startedAt', 'completedAt'].some(key => attempt[key] !== undefined && !Number.isFinite(Date.parse(String(attempt[key]))))) throw new Error('Invalid saved engine attempt')
          }
        }
      }
      if (captured.partiallyScannedSampleIds !== undefined && (!Array.isArray(captured.partiallyScannedSampleIds) || !captured.partiallyScannedSampleIds.every(id => definition.samples.some(sample => sample.id === id)))) throw new Error('Invalid saved partial coverage')
      if (!Array.isArray(evidence.evaluation.scannedSampleIds) || !evidence.evaluation.scannedSampleIds.every(id => definition.samples.some(sample => sample.id === id))) throw new Error('Invalid saved sample coverage')
      evidence.evaluation = { ...definition, scannedSampleIds: [...evidence.evaluation.scannedSampleIds], partiallyScannedSampleIds: evidence.evaluation.partiallyScannedSampleIds ?? [], ...(evidence.evaluation.execution && { execution: evidence.evaluation.execution }), manualAssessments: normalizeAssessments(evidence.evaluation.manualAssessments) }
    }
    const samples = evidence.samples ?? [evidence.sample]
    if (!Array.isArray(samples) || samples.length > 20 || evidence.runs.some(run => !samples.some(sample => sample.id === run.sampleId && sample.state.id === run.stateId))) throw new Error('Invalid saved run sample/state')
    if (evidence.grouping) {
      const group = evidence.grouping
      const occurrences = list(group.occurrences, 20000)
      const findings = list(group.findings, 20000)
      list(group.elements, 20000)
      list(group.reviews, 20000)
      const occurrenceIds = new Set(occurrences.map(item => record(item) ? item.id : null))
      const findingIds = new Set(findings.map(item => record(item) ? item.id : null))
      if (occurrenceIds.size !== occurrences.length || findingIds.size !== findings.length) throw new Error('Duplicate saved grouping identity')
      for (const occurrence of occurrences) {
        if (!record(occurrence) || typeof occurrence.id !== 'string' || !findingIds.has(occurrence.findingId) || !Array.isArray(occurrence.observationIds) || !occurrence.observationIds.length || !occurrence.observationIds.every(id => observationIds.has(id))) throw new Error('Invalid saved report grouping')
      }
      for (const finding of findings) {
        if (!record(finding) || typeof finding.id !== 'string' || !Array.isArray(finding.occurrenceIds) || !finding.occurrenceIds.length || !finding.occurrenceIds.every(id => occurrenceIds.has(id))) throw new Error('Invalid saved report grouping')
      }
      if (group.summary.rawObservations !== evidence.observations.length || group.summary.uniqueFindings !== findings.length || group.summary.observedOccurrences !== occurrences.length) throw new Error('Invalid saved grouping counts')
    }
    const output: AccessibilityCheckResults = { url: value.url, timestamp: value.timestamp, evidence, combined: { violations: [], warnings: [], passed: [] }, summary: { totalViolations: 0, totalWarnings: 0, totalPassed: 0 } }
    if (grouped || evidence.grouping) {
      try {
        const presentation = buildGroupedReport(readonly(output))
        if (!Object.values(presentation.summary).every(value => Number.isInteger(value) && value >= 0)) throw new Error('Invalid summary')
      } catch { throw new Error('Invalid saved report grouping') }
    }
    return output
  }
  const scan = (value: unknown): SampleScan => {
    if (!record(value) || typeof value.standard !== 'string') throw new Error('Invalid saved sample scan')
    if (!record(value.sample)) throw new Error('Invalid saved sample')
    const sample = validateEvaluation({ ...evaluation, samples: [{ ...value.sample, selection: undefined, inventoryIds: undefined }], inventory: [], sampling: undefined }).samples[0]!
    if (value.sample.inventoryIds !== undefined) {
      if (!Array.isArray(value.sample.inventoryIds) || value.sample.inventoryIds.length > 100 || !value.sample.inventoryIds.every(id => typeof id === 'string' && id.length <= 100)) throw new Error('Invalid saved inventory links')
      sample.inventoryIds = [...value.sample.inventoryIds]
    }
    const selection = value.sample.selection
    if (selection !== undefined) {
      if (!record(selection) || !['structured', 'random'].includes(String(selection.kind)) || !['source', 'method'].every(key => typeof selection[key] === 'string' && String(selection[key]).length <= 2000) || ['drawId', 'candidateId'].some(key => selection[key] !== undefined && (typeof selection[key] !== 'string' || String(selection[key]).length > 100))) throw new Error('Invalid saved selection')
      sample.selection = { kind: selection.kind as 'structured' | 'random', source: String(selection.source), method: String(selection.method), ...(typeof selection.drawId === 'string' && { drawId: selection.drawId }), ...(typeof selection.candidateId === 'string' && { candidateId: selection.candidateId }) }
    }
    const results = result(value.results)
    if (sample.preparation !== 'initial-page' || results.evidence.runs.some(run => run.standard !== value.standard || run.requestedUrl !== sample.url)) throw new Error('Saved evidence does not match its sample')
    if (value.status !== undefined && !['complete', 'partial'].includes(String(value.status))) throw new Error('Invalid saved scan status')
    return { ...(value.status !== undefined ? { status: value.status as 'complete' | 'partial' } : {}), sample, standard: value.standard, tools: options(value.tools, ['axe', 'pa11y']), runners: options(value.runners, ['axe', 'htmlcs']), results }
  }
  if (!record(input.scans) || Object.keys(input.scans).length > MAX_SCAN_HISTORY) throw new Error('Invalid saved scans')
  const scans = Object.fromEntries(Object.entries(input.scans).map(([id, value]) => {
    const parsed = scan(value)
    if (parsed.sample.id !== id) throw new Error('Mismatched saved sample ID')
    return [id, parsed]
  }))
  // History can contain successive revisions of the same criterion; validate each revision independently.
  const assessmentHistory = list(input.assessmentHistory, MAX_ASSESSMENT_HISTORY).map(value => normalizeAssessments([value])[0]!)
  const errors = input.sampleErrors ?? {}
  if (!record(errors) || Object.keys(errors).length > MAX_SCAN_HISTORY || !Object.values(errors).every(error => typeof error === 'string' && error.length <= 5000)) throw new Error('Invalid saved scan errors')
  const sampleErrors = errors as Record<string, string>
  const saved: SavedEvaluation = { format: 'wcagger-workspace', schemaVersion: 1, id: input.id, revision: Number(input.revision), savedAt: input.savedAt, evaluation, sampleErrors, assessments: normalizeAssessments(input.assessments), assessmentHistory, scans, scanHistory: list(input.scanHistory, MAX_SCAN_HISTORY).map(scan), report: input.report === null ? null : result(input.report, true), reportHistory: list(input.reportHistory, MAX_REPORT_HISTORY).map(value => result(value, true)), tools: options(input.tools, ['axe', 'pa11y']), runners: options(input.runners, ['axe', 'htmlcs']) }
  if (new TextEncoder().encode(JSON.stringify(saved)).byteLength > MAX_WORKSPACE_BYTES) throw new Error('Saved workspace exceeds 25 MB; export and start a new workspace')
  return saved
}
export function parseSavedEvaluation(text: string): SavedEvaluation {
  if (new TextEncoder().encode(text).byteLength > MAX_WORKSPACE_BYTES) throw new Error('Saved workspace exceeds 25 MB')
  return validateSavedEvaluation(JSON.parse(text))
}
