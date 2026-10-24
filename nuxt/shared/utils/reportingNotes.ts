import type { ReportingNotes, WorkflowStageKey } from '../types/evaluationReport'

export const WORKFLOW_STAGES: WorkflowStageKey[] = ['scope', 'exploration', 'sampling', 'evaluation', 'reporting']
export function newReportingNotes(): ReportingNotes {
  return { schemaVersion: 1, conclusion: '', limitations: '', additionalRequirements: '', explorationNotes: '', processNotes: '', conformanceNotes: '', reviews: [] }
}
export function normalizeReportingNotes(input: unknown): ReportingNotes {
  if (input === undefined) return newReportingNotes()
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  const text = (value: unknown, max = 5000): string => {
    if (typeof value !== 'string' || value.length > max) throw new Error('Invalid reporting notes')
    return value
  }
  if (!record(input) || input.schemaVersion !== 1 || !Array.isArray(input.reviews) || input.reviews.length > 5) throw new Error('Invalid reporting notes version or reviews')
  const notes = newReportingNotes()
  for (const key of ['conclusion', 'limitations', 'additionalRequirements', 'explorationNotes', 'processNotes', 'conformanceNotes'] as const) notes[key] = text(input[key])
  for (const review of input.reviews) {
    if (!record(review) || !WORKFLOW_STAGES.includes(review.stage as WorkflowStageKey) || notes.reviews.some(item => item.stage === review.stage)) throw new Error('Invalid or duplicate workflow review')
    const value = { stage: review.stage as WorkflowStageKey, reviewer: text(review.reviewer, 200), reviewedAt: text(review.reviewedAt, 100), notes: text(review.notes), basis: text(review.basis, 4 * 1024 * 1024) }
    if (!value.reviewer.trim() || !value.notes.trim() || !value.basis || !Number.isFinite(Date.parse(value.reviewedAt))) throw new Error('A workflow review requires reviewer, date, notes and captured context')
    notes.reviews.push(value)
  }
  return notes
}
// Stable comparison treats absent optional fields like empty normalized fields.
export function reportingContext(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(reportingContext).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, value]) => value !== undefined && value !== '' && !(Array.isArray(value) && !value.length)).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => JSON.stringify(key) + ':' + reportingContext(value)).join(',') + '}'
  return JSON.stringify(typeof value === 'string' ? value.trim() : value) ?? 'null'
}
