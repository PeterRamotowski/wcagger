import { samplingCoverage, compareSamplingSets } from './sampling'
import type { DeepReadonly } from 'vue'
import type { AccessibilityCheckResults } from '../types/accessibility'
import type { ElementReference, EngineRun, ScanObservation } from '../types/scanEvidence'
import type { GroupedReport, ReportFinding, ReportGroup, ReportObservation, ReportOccurrence } from '../types/report'

export function formatLocator(element?: DeepReadonly<ElementReference>): string {
  if (!element) return ''
  const locator = element.locator
  if (locator.kind === 'css-selector') return locator.selector
  if (locator.target.length === 1 && typeof locator.target[0] === 'string') return locator.target[0]
  return JSON.stringify(locator.target)
}

export function formatSource(run: DeepReadonly<EngineRun>): string {
  return run.tool === 'axe' ? 'Axe' : 'Pa11y / ' + (run.engine === 'htmlcs' ? 'HTMLCS' : run.engine === 'axe' ? 'Axe' : run.runner ?? 'unknown')
}

export function safeReportLink(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined
  } catch { return undefined }
}

function criteriaFor(observation: DeepReadonly<ScanObservation>): string[] {
  const tags = observation.tags.flatMap((tag) => {
    const match = /^wcag(\d)(\d)(\d+)$/.exec(tag)
    return match ? [match.slice(1).join('.')] : []
  })
  const code = /\.(\d)_(\d)_(\d+)\./.exec(observation.ruleId)
  return [...new Set([...tags, ...(code ? [code.slice(1).join('.')] : [])])]
}

export function buildGroupedReport(results: DeepReadonly<AccessibilityCheckResults>): GroupedReport {
  const evidence = results.evidence
  const grouping = evidence.grouping
  if (!grouping) throw new Error('Grouped evidence is unavailable; run the scan again')
  const samples = new Map((evidence.samples ?? [evidence.sample]).map(sample => [sample.id, sample]))
  const runs = new Map(evidence.runs.map(run => [run.id, run]))
  const originals = new Map(evidence.observations.map(item => [item.id, item]))
  const observations = new Map(evidence.observations.map((item) => {
    const run = runs.get(item.runId)!
    const presented: ReportObservation = {
      id: item.id, runId: item.runId, source: formatSource(run), engine: run.engine,
      ruleId: item.ruleId, outcome: item.outcome, title: item.title,
      description: item.description, impact: item.impact, helpUrl: item.helpUrl,
      selector: formatLocator(item.element), html: item.element?.html,
      startedAt: run.startedAt, completedAt: run.completedAt,
    }
    return [item.id, presented] as const
  }))
  const occurrences = new Map(grouping.occurrences.map((item) => {
    const items = item.observationIds.map(id => observations.get(id)!)
    const run = runs.get(items[0]!.runId)!
    const presented: ReportOccurrence = {
      id: item.id, sampleId: item.sampleId, stateId: item.stateId,
      url: run.resolvedUrl, sampleName: evidence.evaluation?.samples.find(sample => sample.id === item.sampleId)?.name,
      state: samples.get(item.sampleId)?.state.id === item.stateId ? samples.get(item.sampleId)!.state.description : item.stateId,
      selector: formatLocator(item.element), observations: [...items].sort((a, b) => a.source.localeCompare(b.source)),
    }
    return [item.id, presented] as const
  }))
  const findings: ReportFinding[] = grouping.findings.map((item) => {
    const members = item.occurrenceIds.map(id => occurrences.get(id)!)
    const items = members.flatMap(member => member.observations)
    const preferred = items.find(observation => runs.get(observation.runId)?.tool === 'axe') ?? items[0]!
    return {
      id: item.id, title: preferred.title, issueType: item.issueType, outcome: item.outcome,
      criteria: [...new Set(items.flatMap(observation => criteriaFor(originals.get(observation.id)!)))].sort(),
      sources: [...new Set(items.map(observation => observation.source))].sort(),
      engines: [...new Set(items.map(observation => observation.engine).filter(engine => engine !== 'unknown'))],
      occurrences: members, affectedSamples: new Set(members.map(member => member.sampleId)).size,
    }
  })
  const rank: Record<string, number> = { violation: 0, incomplete: 1, unknown: 2, warning: 3, notice: 4 }
  findings.sort((a, b) => (rank[a.outcome] ?? 5) - (rank[b.outcome] ?? 5) || a.issueType.localeCompare(b.issueType))
  const occurrenceFinding = new Map(grouping.occurrences.map(item => [item.id, item.findingId]))
  const observationOccurrence = new Map(grouping.occurrences.flatMap(item => item.observationIds.map(id => [id, item.id] as const)))
  const groups = new Map<string, ReportGroup>()
  for (const occurrence of occurrences.values()) {
    const key = occurrence.sampleId + ':' + occurrence.stateId
    const group = groups.get(key) ?? { id: key, label: (occurrence.sampleName ? occurrence.sampleName + ' · ' : '') + occurrence.url + ' (' + occurrence.state + ')', findingIds: [], occurrenceIds: [] }
    group.occurrenceIds.push(occurrence.id)
    const findingId = occurrenceFinding.get(occurrence.id)!
    if (!group.findingIds.includes(findingId)) group.findingIds.push(findingId)
    groups.set(key, group)
  }
  const elements: ReportGroup[] = grouping.elements.map(group => ({
    ...group, findingIds: [...group.findingIds], occurrenceIds: [...group.occurrenceIds],
    label: occurrences.get(group.occurrenceIds[0]!)?.selector ?? '',
  }))
  const known = new Set(elements.flatMap(group => group.occurrenceIds))
  const unlocated = [...occurrences.values()].filter(item => !known.has(item.id))
  if (unlocated.length) elements.push({ id: 'unresolved-elements', label: '', findingIds: [...new Set(unlocated.map(item => occurrenceFinding.get(item.id)!))], occurrenceIds: unlocated.map(item => item.id) })
  const byFinding = new Map(grouping.findings.map(item => [item.id, item]))
  return {
    evaluation: evidence.evaluation,
    planning: evidence.evaluation ? { coverage: samplingCoverage(evidence.evaluation, evidence.evaluation.scannedSampleIds), comparison: compareSamplingSets(evidence.evaluation, findings) } : undefined,
    url: results.url, timestamp: results.timestamp,
    standards: [...new Set([...(evidence.evaluation ? [evidence.evaluation.targetStandard] : []), ...evidence.runs.map(run => run.standard)])], tools: evidence.evaluation?.execution?.tools ? [...evidence.evaluation.execution.tools] : [...new Set(evidence.runs.map(run => run.tool))],
    summary: { ...grouping.summary }, findings, elements, pages: [...groups.values()], runs: [...evidence.runs], decisions: grouping.decisions,
    automatedChecks: {
      passedObservations: evidence.observations.filter(item => item.outcome === 'pass').length,
      inapplicableObservations: evidence.observations.filter(item => item.outcome === 'inapplicable').length,
    },
    reviews: grouping.reviews.map((review) => {
      const ids = [...new Set(review.observationIds.flatMap(id => observationOccurrence.get(id) ?? []))]
      const findingIds = [...new Set(ids.map(id => occurrenceFinding.get(id)!))]
      const types = new Set(findingIds.map(id => byFinding.get(id)!.issueType))
      const outcomes = new Set(findingIds.map(id => byFinding.get(id)!.outcome))
      const decision = [...grouping.decisions].reverse().find(item => item.action === 'combine' ? ids.length > 1 && ids.every(id => item.occurrenceIds.includes(id)) : ids.some(id => item.occurrenceIds.includes(id)))
      return {
        id: review.id, reason: review.reason, occurrenceIds: ids, findingIds,
        observations: review.observationIds.map(id => observations.get(id)!),
        canCombine: ids.length > 1 && types.size === 1 && outcomes.size === 1 && review.reason !== 'conflicting-outcomes',
        resolved: !!decision && (decision.action === 'combine' ? findingIds.length === 1 : findingIds.length === ids.length),
      }
    }),
  }
}

export interface FindingFilters { outcome?: string, source?: string, criterion?: string, issueType?: string }
export function filterReportFindings(findings: ReportFinding[], filters: FindingFilters): ReportFinding[] {
  return findings.filter(item => (!filters.outcome || item.outcome === filters.outcome)
    && (!filters.issueType || item.issueType === filters.issueType)
    && (!filters.source || item.sources.includes(filters.source))
    && (!filters.criterion || item.criteria.includes(filters.criterion)))
}
