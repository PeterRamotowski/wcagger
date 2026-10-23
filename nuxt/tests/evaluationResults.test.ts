import { describe, expect, it } from 'vitest'
import { combineEvaluationResults } from '../server/services/evaluationResultsService'
import { reviewGrouping } from '../server/services/groupingReviewService'
import { buildGroupedReport } from '../shared/utils/reportPresentation'
import { duplicateSampleIds, newEvaluationSample, parseBulkUrls, parseTypeTags, scanMatchesSample, validateEvaluation } from '../shared/utils/evaluation'
import { generateCSVContent, prepareExportData } from '../app/utils/exportReport'
import { reportFixture } from './fixtures/groupedReport'
import { evaluationFixture } from './fixtures/evaluation'
import { generateGroupedReportHTML } from '../server/utils/pdf/groupedReportTemplate'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

describe('evaluation sample definition and combined evidence', () => {
  it('keeps tags, full URLs, intentional repetitions and independent state identities', () => {
    const { evaluation } = evaluationFixture(true)
    expect(validateEvaluation(evaluation).samples).toHaveLength(3)
    expect(new Set(evaluation.samples.map(sample => sample.state.id)).size).toBe(3)
    expect(duplicateSampleIds(evaluation.samples)).toHaveLength(3)
    expect(parseBulkUrls(' https://example.com/?a=1#x\nhttps://example.com/?a=2#x\nhttps://example.com/?a=1#x ')).toHaveLength(3)
    expect(duplicateSampleIds([newEvaluationSample('https://example.com/?a=1#x'), newEvaluationSample('https://example.com/?a=2#x')])).toEqual([])
    expect(parseTypeTags('article, video, article, , form')).toEqual(['article', 'video', 'form'])
  })

  it('rejects invalid URLs, duplicate identities, oversized sets and invalid targets', () => {
    const { evaluation } = evaluationFixture()
    for (const url of ['javascript:alert(1)', '/relative', 'https://user:secret@example.com/']) expect(() => validateEvaluation({ ...evaluation, samples: [{ ...evaluation.samples[0], url }] })).toThrow()
    expect(() => validateEvaluation({ ...evaluation, samples: [evaluation.samples[0], evaluation.samples[0]] })).toThrow()
    expect(() => validateEvaluation({ ...evaluation, samples: Array.from({ length: 21 }, () => newEvaluationSample('https://example.com')) })).toThrow()
    expect(() => validateEvaluation({ ...evaluation, targetStandard: 'WCAG99AA' })).toThrow()
  })

  it('combines observed pages without merging common selectors, and retains unscanned states', () => {
    const input = evaluationFixture()
    const result = combineEvaluationResults(input)
    const report = buildGroupedReport(result)
    expect(report.summary).toMatchObject({ uniqueFindings: 6, observedOccurrences: 6, affectedSamples: 2, rawObservations: 16 })
    expect(report.pages).toHaveLength(2)
    expect(report.pages.some(page => page.label.includes('Article'))).toBe(true)
    expect(result.evidence.evaluation!.samples).toHaveLength(3)
    expect(result.evidence.evaluation!.scannedSampleIds).toHaveLength(2)
    expect(report.findings.flatMap(item => item.occurrences).map(item => item.sampleName)).toContain('Contact')
    expect(result.evidence.grouping!.reviews.some(item => item.reason === 'possible-shared-problem')).toBe(true)
    input.evaluation.samples[0]!.name = 'Changed draft'
    expect(result.evidence.evaluation!.samples[0]!.name).toBe('Article')
  })

  it('requires confirmation before combining shared problems across sampled pages', () => {
    const input = evaluationFixture(true)
    const result = combineEvaluationResults(input)
    const buttons = result.evidence.grouping!.findings.filter(item => item.issueType === 'axe:button-name')
    const grouping = reviewGrouping({ evidence: result.evidence, decision: { id: 'shared-header', action: 'combine', occurrenceIds: buttons.flatMap(item => item.occurrenceIds), reviewer: 'Evaluator', timestamp: new Date().toISOString(), reason: 'Same header implementation confirmed' } })
    result.evidence.grouping = grouping
    const combined = buildGroupedReport(result).findings.find(item => item.issueType === 'axe:button-name')!
    expect(combined.affectedSamples).toBe(2)
    expect(combined.occurrences).toHaveLength(2)
    expect(combined.occurrences.every(item => item.observations.length === 2)).toBe(true)
    expect(grouping.summary.uniqueFindings).toBe(5)
    const rebuilt = combineEvaluationResults({ ...input, decisions: grouping.decisions })
    expect(rebuilt.evidence.grouping!.decisions).toEqual(grouping.decisions)
    expect(rebuilt.evidence.grouping!.summary.uniqueFindings).toBe(5)
  })

  it('exports labels, selection rationale, states and missing sample coverage', () => {
    const data = prepareExportData(combineEvaluationResults(evaluationFixture()))
    expect(data.report.evaluation!.scannedSampleIds).toHaveLength(2)
    const csv = generateCSVContent(data)
    expect(csv).toContain('Representative article with video')
    expect(csv).toContain('Validation errors after submission')
    expect(csv).toContain('"sample"')
    expect(csv).toContain('"unscanned"')
    const request = new IncomingMessage(new Socket())
    const event = createEvent(request, new ServerResponse(request))
    const html = generateGroupedReportHTML(event, data.report)
    expect(html).toContain('Scanned samples: 2 of 3')
    expect(html).toContain('Validation errors after submission')
    expect(html).toContain('Representative article with video')
  })

  it('retains page-level HTMLCS notices with null context through combination and review', () => {
    const input = evaluationFixture()
    const observation = input.scans[0]!.evidence.observations.find(item => item.evidence.kind === 'pa11y')!
    if (observation.evidence.kind !== 'pa11y') throw new Error('Missing Pa11y fixture')
    observation.evidence.issue.context = null
    observation.evidence.issue.selector = ''
    observation.element = undefined
    observation.outcome = 'notice'
    const result = combineEvaluationResults(input)
    const original = result.evidence.observations.find(item => item.id === observation.id)!
    expect(original.evidence).toEqual(observation.evidence)
    expect(original.element).toBeUndefined()
    const occurrence = result.evidence.grouping!.occurrences.find(item => item.observationIds.includes(observation.id))!
    expect(() => reviewGrouping({ evidence: result.evidence, decision: { id: 'null-context', action: 'separate', occurrenceIds: [occurrence.id], reviewer: 'Evaluator', reason: 'Keep document-level notice', timestamp: new Date().toISOString() } })).not.toThrow()
  })

  it('rejects mismatched, duplicate, manual and oversized evidence rather than relabelling it', () => {
    const input = evaluationFixture()
    expect(() => combineEvaluationResults({ ...input, scans: [] })).toThrow()
    expect(() => combineEvaluationResults({ ...input, scans: [input.scans[0], input.scans[0]] })).toThrow()
    expect(() => combineEvaluationResults({ ...input, scans: [{ ...input.scans[0], sampleId: input.evaluation.samples[2]!.id }] })).toThrow()
    input.scans[0]!.evidence.runs[0]!.standard = 'WCAG20A'
    expect(() => combineEvaluationResults(input)).toThrow('target')
    input.scans[0]!.evidence.runs[0]!.standard = 'WCAG22AA'
    input.scans[0]!.evidence.sample.url = 'https://other.example/'
    expect(() => combineEvaluationResults(input)).toThrow('URL')
  })

  it('excludes stale scans after target, URL, state, or engine settings change, but permits label edits', () => {
    const { evaluation, scans } = evaluationFixture()
    const sample = evaluation.samples[0]!
    const scan = { sample: structuredClone(sample), standard: evaluation.targetStandard, tools: ['axe', 'pa11y'], runners: ['axe', 'htmlcs'], results: { ...reportFixture(), evidence: scans[0]!.evidence } }
    expect(scanMatchesSample(scan, { ...sample, name: 'New label' }, evaluation.targetStandard, ['pa11y', 'axe'], ['htmlcs', 'axe'])).toBe(true)
    expect(scanMatchesSample(scan, sample, 'WCAG20AA', scan.tools, scan.runners)).toBe(false)
    expect(scanMatchesSample(scan, { ...sample, url: sample.url + 'x' }, scan.standard, scan.tools, scan.runners)).toBe(false)
    expect(scanMatchesSample(scan, { ...sample, state: { ...sample.state, description: 'New state' } }, scan.standard, scan.tools, scan.runners)).toBe(false)
    expect(scanMatchesSample(scan, sample, scan.standard, ['axe'], scan.runners)).toBe(false)
    expect(scanMatchesSample(scan, sample, scan.standard, scan.tools, ['axe'])).toBe(false)
  })
})
