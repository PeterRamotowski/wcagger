import { normalizeCandidateInspection, normalizeCandidateTypes } from './candidateInspection'
import type { DeepReadonly } from 'vue'
import type { Evaluation, EvaluationSample, EvaluationScope, InventoryEntry, RandomDraw, SampleSelection, SamplingCandidate, SamplingPlan } from '../types/evaluation'
import type { ReportFinding } from '../types/report'

export const MAX_CANDIDATES = 500
export const MAX_DRAWS = 10
export const INVENTORY_KINDS = ['common-view', 'function', 'sample-type', 'technology', 'other'] as const
export function newSamplingPlan(): SamplingPlan {
  return { source: '', coverage: 'unknown', coverageNotes: '', rationale: '', comparisonNotes: '', exhaustionReason: '', candidates: [], draws: [] }
}
export function sampleLocationKey(sample: {
  url: string
  stateDescription: string
  preparation: string
}): string {
  let address = sample.url.trim()
  try {
    address = new URL(address).href
  } catch { /* Keep incomplete drafts editable. */
  }
  return JSON.stringify([address, sample.stateDescription.trim(), sample.preparation])
}
export function locationForSample(sample: DeepReadonly<EvaluationSample>): string {
  return sampleLocationKey({ ...sample, stateDescription: sample.state.description })
}
export function eligibleCandidates(evaluation: DeepReadonly<Evaluation>): SamplingCandidate[] {
  const used = new Set(evaluation.samples.filter(sample => sample.url.trim()).map(locationForSample))
  return uniqueCandidates(evaluation.sampling?.candidates ?? [], used)
}
function uniqueCandidates(candidates: DeepReadonly<SamplingCandidate[]>, used: Set<string>): SamplingCandidate[] {
  return candidates.filter((candidate) => {
    const key = sampleLocationKey(candidate)
    if (used.has(key))
      return false
    used.add(key)
    return true
  }).map(({ typeTags, inspection, ...candidate }) => ({ ...candidate, ...(typeTags !== undefined && { typeTags: [...typeTags] }), ...(inspection && { inspection: normalizeCandidateInspection(inspection) }) }))
}
export function samplingCoverage(evaluation: DeepReadonly<Evaluation>, scannedIds: readonly string[] = []) {
  const structured = evaluation.samples.filter(sample => sample.selection?.kind !== 'random')
  const random = evaluation.samples.filter(sample => sample.selection?.kind === 'random')
  const seen = new Set(structured.filter(sample => sample.url.trim()).map(locationForSample))
  const excludedRandomIds: string[] = []
  const counted = random.filter((sample) => {
    if (!sample.url.trim() || !sample.selection?.source.trim() || !sample.selection.method.trim()) {
      excludedRandomIds.push(sample.id)
      return false
    }
    const key = locationForSample(sample)
    if (seen.has(key)) {
      excludedRandomIds.push(sample.id)
      return false
    }
    seen.add(key)
    return true
  })
  const requiredRandom = Math.ceil(structured.length / 10)
  const missingRandom = Math.max(0, requiredRandom - counted.length)
  let eligible = 0
  // Drafts can contain blank or invalid URLs while the evaluator edits them.
  try {
    eligible = eligibleCandidates(evaluation).length
  } catch { /* Validation occurs before selection or scanning. */
  }
  const inventory = (evaluation.inventory ?? []).map((entry) => {
    const selected = evaluation.samples.filter(sample => sample.inventoryIds?.includes(entry.id))
    return { ...entry, sampleIds: selected.map(sample => sample.id), scannedSampleIds: selected.filter(sample => scannedIds.includes(sample.id)).map(sample => sample.id) }
  })
  return { structured: structured.length, random: random.length, countedRandom: counted.length, requiredRandom, missingRandom, eligibleCandidates: eligible, remainingSlots: Math.max(0, 20 - evaluation.samples.length), excludedRandomIds, inventory, uncoveredInventoryIds: inventory.filter(entry => !entry.sampleIds.length).map(entry => entry.id) }
}
export function compareSamplingSets(evaluation: DeepReadonly<Evaluation>, findings: DeepReadonly<ReportFinding[]>) {
  const structuredIds = new Set(evaluation.samples.filter(sample => sample.selection?.kind !== 'random').map(sample => sample.id))
  const randomIds = new Set(evaluation.samples.filter(sample => sample.selection?.kind === 'random').map(sample => sample.id))
  const rows = (ids: Set<string>) => findings.filter(finding => finding.occurrences.some(item => ids.has(item.sampleId))).map(finding => ({ id: finding.id, title: finding.title, issueType: finding.issueType, outcome: finding.outcome, occurrenceIds: finding.occurrences.filter(item => ids.has(item.sampleId)).map(item => item.id) }))
  const structured = rows(structuredIds)
  const random = rows(randomIds)
  const known = new Set(structured.map(item => item.issueType + '|' + item.outcome))
  const knownTypes = new Set(evaluation.samples.filter(sample => structuredIds.has(sample.id)).flatMap(sample => sample.typeTags))
  return { structured, random, randomOnlyIssues: [...new Set(random.filter(item => !known.has(item.issueType + '|' + item.outcome)).map(item => item.issueType + ' (' + item.outcome + ')'))], randomOnlyContentTypes: [...new Set(evaluation.samples.filter(sample => randomIds.has(sample.id)).flatMap(sample => sample.typeTags).filter(type => !knownTypes.has(type)))] }
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function text(value: unknown, limit = 2000): string {
  if (value === undefined)
    return ''
  if (typeof value !== 'string' || value.length > limit)
    throw new Error('Invalid planning text')
  return value.trim()
}
function id(value: unknown): string {
  const result = text(value, 100)
  if (!result)
    throw new Error('Planning records require an ID')
  return result
}
function list(value: unknown, limit: number): unknown[] {
  if (value === undefined)
    return []
  if (!Array.isArray(value) || value.length > limit)
    throw new Error('Planning list is too large or invalid')
  return value
}
function ids(value: unknown, limit = 100): string[] {
  const values = list(value, limit).map(id)
  if (new Set(values).size !== values.length)
    throw new Error('Duplicate planning reference')
  return values
}
function url(value: unknown): string {
  const result = text(value, 4000)
  const parsed = new URL(result)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error('Invalid planning URL')
  return result
}
function coverage(value: unknown): SamplingPlan['coverage'] {
  if (value === undefined)
    return 'unknown'
  if (!['unknown', 'partial', 'whole-scope'].includes(String(value)))
    throw new Error('Invalid candidate-pool coverage')
  return value as SamplingPlan['coverage']
}
function candidates(value: unknown): SamplingCandidate[] {
  const seen = new Set<string>()
  return list(value, MAX_CANDIDATES).map((value) => {
    if (!record(value))
      throw new Error('Invalid sampling candidate')
    const key = id(value.id)
    const stateDescription = text(value.stateDescription)
    if (seen.has(key) || !stateDescription || !['initial-page', 'manual'].includes(String(value.preparation)))
      throw new Error('Invalid or duplicate candidate identity')
    seen.add(key)
    return { ...(value.typeTags !== undefined && { typeTags: normalizeCandidateTypes(value.typeTags) }), ...(value.inspection !== undefined && { inspection: normalizeCandidateInspection(value.inspection) }), id: key, url: url(value.url), name: text(value.name, 200), stateDescription, preparation: value.preparation as SamplingCandidate['preparation'] }
  })
}
function scopeMetadata(value: Record<string, unknown>): EvaluationScope {
  const result: EvaluationScope = { description: text(value.description, 5000), evaluator: text(value.evaluator, 200), commissioner: text(value.commissioner, 200), productName: text(value.productName, 200), productUrl: text(value.productUrl, 4000), boundaries: text(value.boundaries, 5000), supportBaseline: text(value.supportBaseline, 5000), languages: list(value.languages, 30).map(item => text(item, 100)).filter(Boolean) }
  if (result.productUrl)
    url(result.productUrl)
  for (const key of ['startDate', 'endDate'] as const) {
    const date = text(value[key], 10)
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date))
      throw new Error('Use valid evaluation dates')
    result[key] = date
  }
  if (result.startDate && result.endDate && result.startDate > result.endDate)
    throw new Error('Evaluation end date precedes its start date')
  return result
}
export function normalizeEvaluationPlanning(raw: Record<string, unknown>, baseSamples: EvaluationSample[]) {
  const inventory: InventoryEntry[] = []
  for (const value of list(raw.inventory, 100)) {
    if (!record(value) || !INVENTORY_KINDS.includes(value.kind as InventoryEntry['kind']))
      throw new Error('Invalid inventory entry')
    const entry = { id: id(value.id), kind: value.kind as InventoryEntry['kind'], name: text(value.name, 200), description: text(value.description) }
    if (!entry.name || inventory.some(item => item.id === entry.id))
      throw new Error('Inventory entries need unique IDs and names')
    inventory.push(entry)
  }
  const rawSamples = raw.samples as Record<string, unknown>[]
  const samples = baseSamples.map((sample, index) => {
    const original = rawSamples[index]!
    const links = ids(original.inventoryIds)
    if (links.some(key => !inventory.some(entry => entry.id === key)))
      throw new Error('Sample references an unknown inventory entry')
    const selected = original.selection
    let selection: SampleSelection = { kind: 'structured', source: '', method: '' }
    if (selected !== undefined) {
      if (!record(selected) || !['structured', 'random'].includes(String(selected.kind)))
        throw new Error('Invalid sample selection')
      selection = { kind: selected.kind as SampleSelection['kind'], source: text(selected.source), method: text(selected.method), ...(selected.drawId !== undefined && { drawId: id(selected.drawId) }), ...(selected.candidateId !== undefined && { candidateId: id(selected.candidateId) }) }
      if (!!selection.drawId !== !!selection.candidateId || (selection.drawId && selection.kind !== 'random'))
        throw new Error('Invalid random selection references')
    }
    return { ...sample, selection, inventoryIds: links }
  })
  if (raw.sampling !== undefined && !record(raw.sampling))
    throw new Error('Invalid sampling plan')
  const plan = (raw.sampling ?? {}) as Record<string, unknown>
  const sampling: SamplingPlan = { source: text(plan.source), coverage: coverage(plan.coverage), coverageNotes: text(plan.coverageNotes, 5000), rationale: text(plan.rationale, 5000), comparisonNotes: text(plan.comparisonNotes, 5000), exhaustionReason: text(plan.exhaustionReason, 5000), candidates: candidates(plan.candidates), draws: [] }
  const selectedIds = new Set<string>()
  for (const value of list(plan.draws, MAX_DRAWS)) {
    if (!record(value) || value.method !== 'crypto-random-without-replacement-v1' || !Number.isFinite(Date.parse(String(value.timestamp))))
      throw new Error('Invalid random draw')
    const draw: RandomDraw = { id: id(value.id), timestamp: String(value.timestamp), method: value.method, source: text(value.source), coverage: coverage(value.coverage), coverageNotes: text(value.coverageNotes, 5000), structuredSampleIds: ids(value.structuredSampleIds, 20), pool: candidates(value.pool), excludedLocations: list(value.excludedLocations, 20).map(item => text(item, 6500)), requestedCount: Number(value.requestedCount), eligibleCount: Number(value.eligibleCount), selected: [] }
    if (!draw.source || sampling.draws.some(item => item.id === draw.id) || !Number.isInteger(draw.requestedCount) || draw.requestedCount < 1 || draw.requestedCount > 20)
      throw new Error('Invalid draw metadata')
    const eligible = uniqueCandidates(draw.pool, new Set(draw.excludedLocations))
    if (draw.eligibleCount !== eligible.length)
      throw new Error('Draw population count does not match its snapshot')
    const chosen = new Set<string>()
    for (const item of list(value.selected, 20)) {
      if (!record(item))
        throw new Error('Invalid draw selection')
      const sampleId = id(item.sampleId)
      const candidateId = id(item.candidateId)
      if (selectedIds.has(sampleId) || chosen.has(candidateId) || !eligible.some(candidate => candidate.id === candidateId))
        throw new Error('Invalid or repeated draw selection')
      selectedIds.add(sampleId)
      chosen.add(candidateId)
      draw.selected.push({ sampleId, candidateId })
    }
    if (!draw.selected.length || draw.selected.length > draw.requestedCount)
      throw new Error('Invalid draw size')
    sampling.draws.push(draw)
  }
  for (const sample of samples) {
    const recorded = sampling.draws.find(draw => draw.selected.some(chosen => chosen.sampleId === sample.id))
    if (recorded && sample.selection.drawId !== recorded.id) throw new Error('Sample lost its recorded draw reference')
  }
  for (const sample of samples.filter(sample => sample.selection.drawId)) {
    const selection = sample.selection
    const draw = sampling.draws.find(item => item.id === selection.drawId)
    const candidate = draw?.pool.find(item => item.id === selection.candidateId)
    if (!draw || !candidate || !draw.selected.some(item => item.sampleId === sample.id && item.candidateId === candidate.id) || locationForSample(sample) !== sampleLocationKey(candidate) || selection.source !== draw.source || selection.method !== draw.method)
      throw new Error('Random sample does not match its recorded draw; remove it and draw again')
  }
  return { scope: scopeMetadata(raw.scope as Record<string, unknown>), inventory, sampling, samples }
}
