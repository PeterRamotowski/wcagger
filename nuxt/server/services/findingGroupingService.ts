import { createHash } from 'node:crypto'
import type {
  AccessibilityFinding, ElementFindingGroup, EngineRun, EvidenceGrouping,
  FindingGroupingDecision, FindingOccurrence, GroupingReview, ScanEvidence, ScanObservation,
} from '~~/shared/types/scanEvidence'

function identifier(prefix: string, value: unknown): string {
  return prefix + '-' + createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32)
}

function issueType(observation: ScanObservation, run: EngineRun): string {
  // H37 is HTMLCS's specific missing IMG alt-attribute error (1.1.1 sniff).
  // Keep every other HTMLCS code separate until its equivalence is verified.
  if (run.engine === 'htmlcs'
    && /^WCAG2(?:A|AA|AAA)\.Principle1\.Guideline1_1\.1_1_1\.H37$/.test(observation.ruleId)
    && observation.evidence.kind === 'pa11y'
    && /^<img\b/i.test(observation.evidence.issue.context ?? '')
    && !/\s(?:alt|aria-label|aria-labelledby)\s*=/i.test(observation.evidence.issue.context ?? '')) return 'axe:image-alt'
  return [run.engine === 'unknown' ? run.runner ?? run.tool : run.engine, observation.ruleId].join(':')
}

function locatorKey(observation: ScanObservation): string | undefined {
  const locator = observation.element?.locator
  if (!locator) return undefined
  if (locator.kind === 'css-selector') return JSON.stringify(['css', locator.selector])
  if (locator.target.length === 1 && typeof locator.target[0] === 'string') return JSON.stringify(['css', locator.target[0]])
  return JSON.stringify(['axe-path', locator.target])
}

function elementKey(observation: ScanObservation, run: EngineRun): string | undefined {
  const identity = observation.element?.identity
  if (!identity || !run.capture || identity.documentId !== run.capture.documentId || observation.element?.documentId !== identity.documentId) return undefined
  return JSON.stringify([run.sampleId, run.stateId, identity.documentId, identity.elementId])
}

function matchKey(observation: ScanObservation, run: EngineRun, type: string): string {
  const entity = elementKey(observation, run)
  if (!entity || !run.capture?.stable || !run.capture.fingerprint) return JSON.stringify(['unmatched', observation.id])
  return JSON.stringify([entity, run.capture.fingerprint, observation.element?.identity?.signature, run.resolvedUrl, run.standard, type, observation.outcome])
}

export function groupScanEvidence(evidence: Pick<ScanEvidence, 'runs' | 'observations'>, decisions: FindingGroupingDecision[] = []): EvidenceGrouping {
  const runs = new Map(evidence.runs.map(run => [run.id, run]))
  if (runs.size !== evidence.runs.length) throw new Error('Duplicate engine run ID')
  const observationIds = new Set<string>()
  for (const item of evidence.observations) {
    if (!runs.has(item.runId)) throw new Error('Observation references an unknown run: ' + item.id)
    if (observationIds.has(item.id)) throw new Error('Duplicate observation ID: ' + item.id)
    observationIds.add(item.id)
  }
  const ordered = [...evidence.observations].sort((a, b) => a.id.localeCompare(b.id))
  const actionable = ordered.filter(item => item.outcome !== 'pass' && item.outcome !== 'inapplicable')
  const matches = new Map<string, ScanObservation[]>()
  for (const item of actionable) {
    const run = runs.get(item.runId)!
    const key = matchKey(item, run, issueType(item, run))
    const group = matches.get(key) ?? []
    group.push(item)
    matches.set(key, group)
  }
  const occurrences: FindingOccurrence[] = [...matches.values()].map((items) => {
    const first = items[0]!
    const run = runs.get(first.runId)!
    return {
      id: identifier('occurrence', items.map(item => item.id)),
      findingId: '',
      sampleId: run.sampleId,
      stateId: run.stateId,
      element: first.element,
      observationIds: items.map(item => item.id),
      issueType: issueType(first, run),
      outcome: first.outcome,
    }
  })
  const byOccurrence = new Map(occurrences.map(item => [item.id, item]))
  const membership = new Map(occurrences.map(item => [item.id, item.id]))
  const decisionIds = new Set<string>()
  for (const decision of decisions) {
    if (!decision.id.trim() || decisionIds.has(decision.id) || !decision.reviewer.trim() || !decision.reason.trim() || !Number.isFinite(Date.parse(decision.timestamp))) throw new Error('Grouping decisions require unique IDs, reviewer, reason and timestamp')
    decisionIds.add(decision.id)
    const selected = new Set(decision.occurrenceIds)
    if (selected.size !== decision.occurrenceIds.length || selected.size < (decision.action === 'combine' ? 2 : 1) || [...selected].some(id => !byOccurrence.has(id))) throw new Error('Invalid occurrence selection in grouping decision')
    if (decision.action === 'combine') {
      const selectedGroups = new Set([...selected].map(id => membership.get(id)!))
      const members = occurrences.filter(item => selectedGroups.has(membership.get(item.id)!))
      if (new Set(members.map(item => item.issueType)).size !== 1 || new Set(members.map(item => item.outcome)).size !== 1) throw new Error('Different issue types or outcomes cannot be combined')
      const key = identifier('combined', members.map(item => item.id).sort())
      for (const member of members) membership.set(member.id, key)
    } else if (decision.action === 'separate') {
      for (const id of selected) membership.set(id, identifier('separate', [decision.id, id]))
    } else throw new Error('Unknown grouping decision action')
  }
  const findingMembers = new Map<string, FindingOccurrence[]>()
  for (const occurrence of occurrences) {
    const key = membership.get(occurrence.id)!
    const members = findingMembers.get(key) ?? []
    members.push(occurrence)
    findingMembers.set(key, members)
  }
  const byObservation = new Map(ordered.map(item => [item.id, item]))
  const findings: AccessibilityFinding[] = [...findingMembers.values()].map((members) => {
    const first = members[0]!
    const id = identifier('finding', members.map(item => item.id).sort())
    for (const member of members) member.findingId = id
    return {
      id,
      title: byObservation.get(first.observationIds[0]!)!.title,
      issueType: first.issueType,
      occurrenceIds: members.map(item => item.id),
      outcome: first.outcome,
    }
  })
  const byElement = new Map<string, ElementFindingGroup>()
  let unresolvedElementOccurrences = 0
  for (const occurrence of occurrences) {
    const observation = byObservation.get(occurrence.observationIds[0]!)!
    const key = elementKey(observation, runs.get(observation.runId)!)
    if (!key) {
      if (occurrence.element) unresolvedElementOccurrences++
      continue
    }
    const group = byElement.get(key) ?? { id: identifier('element', key), sampleId: occurrence.sampleId, stateId: occurrence.stateId, occurrenceIds: [], findingIds: [] }
    group.occurrenceIds.push(occurrence.id)
    if (!group.findingIds.includes(occurrence.findingId)) group.findingIds.push(occurrence.findingId)
    byElement.set(key, group)
  }
  const occurrenceOf = new Map(occurrences.flatMap(occurrence => occurrence.observationIds.map(id => [id, occurrence.id] as const)))
  const reviews = new Map<string, GroupingReview>()
  const buckets = new Map<string, ScanObservation[]>()
  // Candidate hints may use a locator; they never authorize a merge.
  for (const item of ordered) {
    const run = runs.get(item.runId)!
    const type = issueType(item, run)
    const entity = elementKey(item, run)
    const locator = locatorKey(item)
    const keys = [entity ? JSON.stringify([type, 'element', entity]) : undefined, locator ? JSON.stringify([type, 'locator', locator]) : undefined].filter((key): key is string => key !== undefined)
    for (const key of keys) {
      const prior = buckets.get(key) ?? []
      for (const other of prior) {
        if (!occurrenceOf.has(item.id) && !occurrenceOf.has(other.id)) continue
        if (occurrenceOf.get(item.id) && occurrenceOf.get(item.id) === occurrenceOf.get(other.id)) continue
        const otherRun = runs.get(other.runId)!
        const otherEntity = elementKey(other, otherRun)
        const sameEntity = entity !== undefined && entity === otherEntity
        if (run.sampleId === otherRun.sampleId && run.stateId === otherRun.stateId && entity && otherEntity && item.element?.identity?.documentId === other.element?.identity?.documentId && !sameEntity) continue
        const reason: GroupingReview['reason'] = item.outcome !== other.outcome
          ? 'conflicting-outcomes'
          : run.sampleId !== otherRun.sampleId
            ? 'possible-shared-problem'
            : run.stateId !== otherRun.stateId || (sameEntity && matchKey(item, run, type) !== matchKey(other, otherRun, type)) ? 'different-state' : 'unverified-element'
        const ids = [item.id, other.id].sort()
        const id = identifier('review', [ids, reason])
        reviews.set(id, { id, observationIds: ids, reason })
      }
      prior.push(item)
      buckets.set(key, prior)
    }
  }
  return {
    findings,
    occurrences,
    elements: [...byElement.values()],
    reviews: [...reviews.values()],
    decisions: structuredClone(decisions),
    summary: {
      rawObservations: ordered.length,
      actionableObservations: actionable.length,
      uniqueFindings: findings.length,
      observedOccurrences: occurrences.length,
      affectedElements: byElement.size,
      unresolvedElementOccurrences,
      affectedSamples: new Set(occurrences.map(item => item.sampleId)).size,
    },
  }
}
