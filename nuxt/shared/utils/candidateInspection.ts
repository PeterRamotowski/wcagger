import type { CandidateInspection } from '../types/candidateInspection'
import { INSPECTION_BYTES, INSPECTION_DURATIONS } from '../types/candidateInspection'

export function normalizeCandidateTypes(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20 || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 100)) throw new Error('Invalid candidate content types')
  return [...new Set(value.map(item => (item as string).trim()))]
}
export function normalizeCandidateInspection(input: unknown): CandidateInspection {
  if (!input || typeof input !== 'object') throw new Error('Invalid candidate inspection')
  const value = input as Record<string, unknown>
  const text = (key: string, limit: number) => {
    if (typeof value[key] !== 'string' || (value[key] as string).length > limit) throw new Error('Invalid inspection text')
    return value[key] as string
  }
  const url = (key: string) => {
    const result = text(key, 4000)
    const parsed = new URL(result)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Invalid inspection URL')
    return result
  }
  if (value.schemaVersion !== 1 || value.method !== 'static-html-v1' || !INSPECTION_DURATIONS.includes(value.durationLimitMs as 5000) || !INSPECTION_BYTES.includes(value.byteLimit as 131072)
    || !Number.isInteger(value.bytes) || Number(value.bytes) < 0 || Number(value.bytes) > Number(value.byteLimit) || !Number.isFinite(Date.parse(text('inspectedAt', 40)))) throw new Error('Invalid inspection metadata')
  const requestedUrl = url('requestedUrl')
  const finalUrl = url('finalUrl')
  if (new URL(requestedUrl).origin !== new URL(finalUrl).origin) throw new Error('Inspection crossed an origin boundary')
  return { schemaVersion: 1, method: 'static-html-v1', requestedUrl, finalUrl, inspectedAt: text('inspectedAt', 40), durationLimitMs: Number(value.durationLimitMs), byteLimit: Number(value.byteLimit), bytes: Number(value.bytes), contentType: text('contentType', 200), title: text('title', 200), suggestedTypes: normalizeCandidateTypes(value.suggestedTypes) }
}
