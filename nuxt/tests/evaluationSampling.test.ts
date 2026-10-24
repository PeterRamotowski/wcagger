import { describe, expect, it } from 'vitest'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { selectRandomSamples } from '../server/services/evaluationSamplingService'
import { newEvaluation, newEvaluationSample, newRecordId, validateEvaluation } from '../shared/utils/evaluation'
import { eligibleCandidates, samplingCoverage } from '../shared/utils/sampling'
import { combineEvaluationResults } from '../server/services/evaluationResultsService'
import { buildGroupedReport } from '../shared/utils/reportPresentation'
import { prepareExportData, generateCSVContent, generateJSONContent } from '../app/utils/exportReport'
import { generateGroupedReportHTML } from '../server/utils/pdf/groupedReportTemplate'
import { reportFixture } from './fixtures/groupedReport'
import type { Evaluation, SamplingCandidate } from '../shared/types/evaluation'

function candidate(url: string, stateDescription = 'Initial page state'): SamplingCandidate {
  return { id: newRecordId(), url, name: '', stateDescription, preparation: 'initial-page' }
}
function evaluation(count = 1): Evaluation {
  const value = newEvaluation()
  value.targetStandard = 'WCAG22AA'
  value.samples = Array.from({ length: count }, (_, index) => newEvaluationSample('https://example.com/structured-' + index))
  value.sampling!.source = 'CMS export, 24 October 2026'
  value.sampling!.coverage = 'partial'
  value.sampling!.coverageNotes = 'The authenticated section is not included in the export'
  value.sampling!.candidates = [candidate('https://example.com/random-1'), candidate('https://example.com/random-2'), candidate('https://example.com/random-3')]
  return value
}
describe('scope, inventory and sampling', () => {
  it('normalizes legacy definitions and preserves scope fields without mutating inputs', () => {
    const source = evaluation()
    source.scope = { description: 'Public product', productName: 'Example', evaluator: 'Reviewer', commissioner: 'Product team', startDate: '2026-10-24', endDate: '2026-10-25', boundaries: 'All public pages and shared navigation', languages: ['en', 'pl'], supportBaseline: 'Firefox and NVDA; keyboard-only use' }
    const normalized = validateEvaluation(source)
    expect(normalized.scope).toMatchObject(source.scope)
    normalized.scope.languages!.push('nl')
    expect(source.scope.languages).toEqual(['en', 'pl'])
    const legacy = { ...source, scope: { description: 'Legacy scope' }, inventory: undefined, sampling: undefined, samples: source.samples.map(sample => ({ ...sample, selection: undefined, inventoryIds: undefined })) }
    expect(validateEvaluation(legacy).samples[0]!.selection!.kind).toBe('structured')
    expect(validateEvaluation(legacy).sampling!.draws).toEqual([])
    expect(() => validateEvaluation({ ...source, scope: { ...source.scope, startDate: '2026-02-30' } })).toThrow()
    expect(() => validateEvaluation({ ...source, scope: { ...source.scope, endDate: '2026-10-01' } })).toThrow()
  })
  it('distinguishes selected inventory coverage from observed scan coverage and rejects dangling references', () => {
    const value = evaluation(2)
    value.inventory = [{ id: 'header', kind: 'common-view', name: 'Shared header', description: 'Main navigation' }, { id: 'forms', kind: 'function', name: 'Search', description: '' }]
    value.samples[0]!.inventoryIds = ['header']
    value.samples[1]!.inventoryIds = ['header']
    const coverage = samplingCoverage(validateEvaluation(value), [value.samples[0]!.id])
    expect(coverage.inventory[0]!.sampleIds).toHaveLength(2)
    expect(coverage.inventory[0]!.scannedSampleIds).toHaveLength(1)
    expect(coverage.uncoveredInventoryIds).toEqual(['forms'])
    value.samples[0]!.inventoryIds = ['unknown']
    expect(() => validateEvaluation(value)).toThrow('unknown inventory')
  })
  it('rounds the additional random target up and never substitutes random samples for structured samples', () => {
    expect(samplingCoverage(evaluation(1)).requiredRandom).toBe(1)
    expect(samplingCoverage(evaluation(10)).requiredRandom).toBe(1)
    expect(samplingCoverage(evaluation(11)).requiredRandom).toBe(2)
    const value = selectRandomSamples(evaluation(11), () => 0)
    expect(value.samples).toHaveLength(13)
    expect(samplingCoverage(value)).toMatchObject({ structured: 11, countedRandom: 2, missingRandom: 0 })
    expect(() => selectRandomSamples(value)).toThrow('already met')
  })
  it('draws unique unused views, preserves parameters/fragments/states and records an immutable population snapshot', () => {
    const source = evaluation(11)
    source.sampling!.candidates = [candidate(source.samples[0]!.url), candidate('https://example.com/random?a=1#main'), candidate('https://example.com/random?a=1#main'), candidate('https://example.com/random?a=2#main'), candidate(source.samples[0]!.url, 'Dialog open')]
    expect(eligibleCandidates(source)).toHaveLength(3)
    const result = selectRandomSamples(source, max => max - 1)
    expect(source.samples).toHaveLength(11)
    expect(result.samples.slice(-2).map(sample => sample.url)).toEqual([source.samples[0]!.url, 'https://example.com/random?a=2#main'])
    expect(result.samples.at(-2)!.state.description).toBe('Dialog open')
    const draw = result.sampling!.draws[0]!
    expect(draw).toMatchObject({ eligibleCount: 3, requestedCount: 2, method: 'crypto-random-without-replacement-v1', coverage: 'partial' })
    expect(draw.selected).toHaveLength(2)
    expect(draw.structuredSampleIds).toHaveLength(11)
    source.sampling!.candidates[1]!.url = 'https://edited.example/'
    expect(draw.pool[1]!.url).toBe('https://example.com/random?a=1#main')
    expect(validateEvaluation(result).sampling!.draws).toHaveLength(1)
  })
  it('exposes population and sample-limit shortfalls without reducing the target', () => {
    const source = evaluation(11)
    source.sampling!.candidates = [candidate('https://example.com/only-candidate')]
    const result = selectRandomSamples(source, () => 0)
    expect(samplingCoverage(result)).toMatchObject({ requiredRandom: 2, countedRandom: 1, missingRandom: 1, eligibleCandidates: 0 })
    expect(result.sampling!.draws[0]!.requestedCount).toBe(2)
    expect(() => selectRandomSamples(result)).toThrow('No unused candidate')
    const full = selectRandomSamples(evaluation(19), () => 0)
    expect(full.samples).toHaveLength(20)
    expect(samplingCoverage(full)).toMatchObject({ requiredRandom: 2, missingRandom: 1, remainingSlots: 0 })
  })
  it('does not count undocumented or overlapping external random entries toward the target', () => {
    const source = evaluation()
    const duplicate = newEvaluationSample(source.samples[0]!.url)
    duplicate.selection = { kind: 'random', source: 'External selection', method: 'Random index from complete CMS inventory' }
    const undocumented = newEvaluationSample('https://example.com/undocumented')
    undocumented.selection = { kind: 'random', source: '', method: '' }
    source.samples.push(duplicate, undocumented)
    expect(samplingCoverage(source)).toMatchObject({ random: 2, countedRandom: 0, missingRandom: 1 })
    expect(samplingCoverage(source).excludedRandomIds).toHaveLength(2)
  })
  it('rejects altered draw samples, inconsistent audit references and oversized populations', () => {
    const selected = selectRandomSamples(evaluation(), () => 0)
    selected.samples.at(-1)!.url = 'https://example.com/replaced'
    expect(() => validateEvaluation(selected)).toThrow('recorded draw')
    const stripped = selectRandomSamples(evaluation(), () => 0)
    stripped.samples.at(-1)!.selection = { kind: 'structured', source: '', method: '' }
    expect(() => validateEvaluation(stripped)).toThrow('draw reference')
    const invalid = evaluation()
    invalid.sampling!.candidates = Array.from({ length: 501 }, (_, index) => candidate('https://example.com/' + index))
    expect(() => validateEvaluation(invalid)).toThrow()
    const missingSource = evaluation()
    missingSource.sampling!.source = ''
    expect(() => selectRandomSamples(missingSource)).toThrow('source')
    expect(() => selectRandomSamples(evaluation(), upper => upper)).toThrow('random index')
  })
  it('recalculates the target when new structured samples are added without rewriting earlier draws', () => {
    const initial = selectRandomSamples(evaluation(10), () => 0)
    const first = JSON.stringify(initial.sampling!.draws[0])
    initial.samples.push(newEvaluationSample('https://example.com/new-structured'))
    expect(samplingCoverage(initial).missingRandom).toBe(1)
    const expanded = selectRandomSamples(initial, () => 0)
    expect(expanded.sampling!.draws).toHaveLength(2)
    expect(JSON.stringify(expanded.sampling!.draws[0])).toBe(first)
    expect(samplingCoverage(expanded).missingRandom).toBe(0)
  })
  it('compares evidence by selection group and preserves scope, coverage and provenance in every export', () => {
    const source = evaluation()
    source.scope.evaluator = '<script>Reviewer</script>'
    source.inventory = [{ id: 'media', kind: 'sample-type', name: 'Media', description: 'Audio and video' }, { id: 'table', kind: 'sample-type', name: 'Data table', description: '' }]
    source.samples[0]!.inventoryIds = ['media']
    const selected = selectRandomSamples(source, () => 0)
    const random = selected.samples.at(-1)!
    random.typeTags = ['interactive map']
    const scans = selected.samples.map((sample) => {
      const result = reportFixture()
      result.evidence.sample.url = sample.url
      for (const run of result.evidence.runs) {
        run.requestedUrl = sample.url
        run.resolvedUrl = sample.url
      }
      if (sample.id === random.id)
        result.evidence.observations.find(item => item.ruleId === 'button-name')!.ruleId = 'random-only-rule'
      return { sampleId: sample.id, evidence: result.evidence }
    })
    const combined = combineEvaluationResults({ evaluation: selected, scans })
    const report = buildGroupedReport(combined)
    expect(report.planning!.comparison.randomOnlyContentTypes).toEqual(['interactive map'])
    expect(report.planning!.comparison.randomOnlyIssues.some(issue => issue.includes('random-only-rule'))).toBe(true)
    expect(report.planning!.coverage.uncoveredInventoryIds).toContain('table')
    const data = prepareExportData(combined)
    expect(JSON.parse(generateJSONContent(data)).report.evaluation.sampling.draws).toHaveLength(1)
    const csv = generateCSVContent(data)
    expect(csv).toContain('"random-draw"')
    expect(csv).toContain('"inventory"')
    expect(csv).toContain('"sampling-comparison"')
    const request = new IncomingMessage(new Socket())
    const html = generateGroupedReportHTML(createEvent(request, new ServerResponse(request)), report)
    expect(html).toContain('Data table')
    expect(html).toContain('CMS export')
    expect(html).toContain('Selection method: crypto-random-without-replacement-v1')
    expect(html).toContain('Compare structured and random findings')
    expect(html).toContain('&lt;script&gt;Reviewer&lt;/script&gt;')
    expect(html).not.toContain('<script>Reviewer')
  })
})
