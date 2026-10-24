import { newSamplingPlan, normalizeEvaluationPlanning } from './sampling'
import type { Evaluation, EvaluationSample, SampleScan } from '../types/evaluation'

export const MAX_EVALUATION_SAMPLES = 20
export function newRecordId(): string {
  return globalThis.crypto.randomUUID?.() ?? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
}
export function newEvaluationSample(url = ''): EvaluationSample {
  return { id: newRecordId(), url, name: '', typeTags: [], selectionReason: '', preparation: 'initial-page', selection: { kind: 'structured', source: '', method: '' }, inventoryIds: [], state: { id: newRecordId(), description: 'Initial page state' } }
}
export function newEvaluation(): Evaluation {
  return { schemaVersion: 1, id: newRecordId(), name: '', scope: { description: '' }, targetStandard: 'WCAG21AA', inventory: [], sampling: newSamplingPlan(), samples: [newEvaluationSample()] }
}
export function parseTypeTags(value: string): string[] {
  return [...new Set(value.split(',').map(tag => tag.trim()).filter(Boolean))]
}
export function parseBulkUrls(value: string): string[] {
  return value.split(/\r?\n/).map(url => url.trim()).filter(Boolean)
}
export function validSampleUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password
  } catch { return false }
}
export function duplicateSampleIds(samples: EvaluationSample[]): string[] {
  const groups = new Map<string, string[]>()
  for (const sample of samples) {
    if (!validSampleUrl(sample.url)) continue
    const key = new URL(sample.url).href
    groups.set(key, [...(groups.get(key) ?? []), sample.id])
  }
  return [...groups.values()].filter(ids => ids.length > 1).flat()
}
export function scanMatchesSample(scan: Pick<SampleScan, 'sample' | 'standard' | 'tools' | 'runners'> | undefined, sample: EvaluationSample, standard: string, tools: string[], runners: string[]): boolean {
  const sameSet = (a: string[], b: string[]) => [...a].sort().join(',') === [...b].sort().join(',')
  return !!scan && sample.preparation === 'initial-page' && scan.sample.id === sample.id
    && scan.sample.url === sample.url.trim() && scan.sample.state.id === sample.state.id
    && scan.sample.state.description === sample.state.description.trim() && scan.sample.preparation === sample.preparation
    && scan.standard === standard && sameSet(scan.tools, tools)
    && (!tools.includes('pa11y') || sameSet(scan.runners, runners))
}

export function validateEvaluation(value: unknown): Evaluation {
  const record = (item: unknown): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)
  const text = (item: unknown, max = 2000): item is string => typeof item === 'string' && item.length <= max
  const id = (item: unknown): item is string => text(item, 100) && !!item.trim()
  if (!record(value) || value.schemaVersion !== 1 || !id(value.id) || !text(value.name, 200) || !record(value.scope) || !text(value.scope.description, 5000) || typeof value.targetStandard !== 'string' || !/^WCAG2[012]A{1,3}$/.test(value.targetStandard)) throw new Error('Invalid evaluation metadata')
  if (!Array.isArray(value.samples) || !value.samples.length || value.samples.length > MAX_EVALUATION_SAMPLES) throw new Error('An evaluation requires 1–20 samples')
  const ids = new Set<string>()
  const states = new Set<string>()
  const samples = value.samples.map((sample) => {
    if (!record(sample) || !id(sample.id) || ids.has(sample.id) || !text(sample.url, 4000) || !validSampleUrl(sample.url.trim()) || !text(sample.name, 200) || !text(sample.selectionReason) || !['initial-page', 'manual'].includes(String(sample.preparation)) || !record(sample.state) || !id(sample.state.id) || states.has(sample.state.id) || !text(sample.state.description) || !sample.state.description.trim() || !Array.isArray(sample.typeTags) || sample.typeTags.length > 20 || !sample.typeTags.every(tag => text(tag, 100) && !!tag.trim())) throw new Error('Invalid or duplicate sample identity')
    ids.add(sample.id)
    states.add(sample.state.id)
    return { id: sample.id, url: sample.url.trim(), name: sample.name.trim(), selectionReason: sample.selectionReason.trim(), preparation: sample.preparation as EvaluationSample['preparation'], typeTags: [...new Set(sample.typeTags as string[])], state: { id: sample.state.id, description: sample.state.description.trim() } }
  })
  return { schemaVersion: 1, id: value.id, name: value.name.trim(), targetStandard: value.targetStandard, ...normalizeEvaluationPlanning(value, samples) }
}
