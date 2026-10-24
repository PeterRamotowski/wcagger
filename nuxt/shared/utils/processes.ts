import type { DeepReadonly } from 'vue'
import type { Evaluation, EvaluationProcess, ProcessPath, ProcessStateKind } from '../types/evaluation'

export const MAX_PROCESSES = 20
export const MAX_PROCESS_PATHS = 10
export const MAX_PROCESS_STEPS = 40
export const MAX_TOTAL_PROCESS_STEPS = 200
export const PROCESS_STATE_KINDS: ProcessStateKind[] = ['initial', 'form-error', 'confirmation', 'dialog', 'authenticated', 'other']

// Incomplete definitions are retained so coverage gaps remain reportable.
export function normalizeProcesses(value: unknown): EvaluationProcess[] {
  const record = (item: unknown): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)
  const text = (item: unknown, max = 2000): string => {
    if (typeof item !== 'string' || item.length > max) throw new Error('Invalid process text')
    return item.trim()
  }
  const identities = new Set<string>()
  const identity = (item: unknown): string => {
    const id = text(item, 100)
    if (!id || identities.has(id)) throw new Error('Invalid or duplicate process identity')
    identities.add(id)
    return id
  }
  const list = (item: unknown, max: number): unknown[] => {
    if (!Array.isArray(item) || item.length > max) throw new Error('Invalid or oversized process definition')
    return item
  }
  const reference = (item: unknown): string | null => item === null ? null : text(item, 100)
  let total = 0
  return list(value === undefined ? [] : value, MAX_PROCESSES).map((item) => {
    if (!record(item)) throw new Error('Invalid process')
    const process: EvaluationProcess = { id: identity(item.id), name: text(item.name, 200), startingPoint: text(item.startingPoint), prerequisites: text(item.prerequisites), role: text(item.role, 200), paths: [] }
    process.paths = list(item.paths, MAX_PROCESS_PATHS).map((path) => {
      if (!record(path) || !['default', 'critical-branch'].includes(String(path.kind))) throw new Error('Invalid process path')
      const normalized: ProcessPath = { id: identity(path.id), name: text(path.name, 200), kind: path.kind as ProcessPath['kind'], condition: text(path.condition), steps: [] }
      normalized.steps = list(path.steps, MAX_PROCESS_STEPS).map((step) => {
        if (!record(step) || !PROCESS_STATE_KINDS.includes(step.stateKind as ProcessStateKind)) throw new Error('Invalid process state')
        const sampleId = reference(step.sampleId)
        const stateId = reference(step.stateId)
        if ((sampleId === null) !== (stateId === null) || sampleId === '' || stateId === '') throw new Error('Invalid sample/state reference')
        if (++total > MAX_TOTAL_PROCESS_STEPS) throw new Error('Too many process steps')
        return { id: identity(step.id), name: text(step.name, 200), sampleId, stateId, stateKind: step.stateKind as ProcessStateKind, action: text(step.action), prerequisites: text(step.prerequisites), role: text(step.role, 200), expectedState: text(step.expectedState) }
      })
      return normalized
    })
    if (process.paths.filter(path => path.kind === 'default').length > 1) throw new Error('A process can have only one default path')
    return process
  })
}

export type ProcessGap = 'name' | 'starting-point' | 'default-path' | 'condition' | 'steps' | 'action' | 'expected-state' | 'sample' | 'stale-state' | 'manual-preparation'
export function processCoverage(evaluation: DeepReadonly<Evaluation>, scannedIds: readonly string[] = [], partialIds: readonly string[] = []) {
  return (evaluation.processes ?? []).map((process) => {
    const gaps: ProcessGap[] = []
    if (!process.name.trim()) gaps.push('name')
    if (!process.startingPoint.trim()) gaps.push('starting-point')
    if (!process.paths.some(path => path.kind === 'default')) gaps.push('default-path')
    const paths = process.paths.map((path) => {
      const gaps: ProcessGap[] = []
      if (!path.name.trim()) gaps.push('name')
      if (path.kind === 'critical-branch' && !path.condition.trim()) gaps.push('condition')
      if (!path.steps.length) gaps.push('steps')
      const steps = path.steps.map((step) => {
        const gaps: ProcessGap[] = []
        const sample = evaluation.samples.find(sample => sample.id === step.sampleId)
        if (!step.name.trim()) gaps.push('name')
        if (!step.action.trim()) gaps.push('action')
        if (!step.expectedState.trim()) gaps.push('expected-state')
        if (!sample) gaps.push('sample')
        else if (sample.state.id !== step.stateId) gaps.push('stale-state')
        if (sample && step.stateKind !== 'initial' && sample.preparation !== 'manual') gaps.push('manual-preparation')
        const status = !sample || sample.state.id !== step.stateId ? 'missing' : sample.preparation === 'manual' || step.stateKind !== 'initial' ? 'manual' : scannedIds.includes(sample.id) ? 'scanned' : partialIds.includes(sample.id) ? 'partial' : 'unscanned'
        return { ...step, gaps, status, sampleName: sample?.name, url: sample?.url, sampleState: sample?.state.description }
      })
      return { ...path, gaps, steps }
    })
    const gapCount = gaps.length + paths.reduce((count, path) => count + path.gaps.length + path.steps.reduce((count, step) => count + step.gaps.length, 0), 0)
    return { ...process, paths, gaps, gapCount }
  })
}
