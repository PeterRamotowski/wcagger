import { describe, expect, it } from 'vitest'
import { validateEvaluation } from '../shared/utils/evaluation'
import { normalizeProcesses, processCoverage } from '../shared/utils/processes'
import { combineEvaluationResults } from '../server/services/evaluationResultsService'
import { buildGroupedReport } from '../shared/utils/reportPresentation'
import { prepareExportData, generateJSONContent, generateCSVContent } from '../app/utils/exportReport'
import { generateProcessesHTML } from '../server/utils/pdf/processTemplate'
import { escapeReportHTML } from '../server/utils/pdf/groupedReportTemplate'
import { processEvaluation } from './fixtures/processEvaluation'
import { reportFixture } from './fixtures/groupedReport'
import en from '../i18n/locales/en.json'

const t = (key: string) => (en as Record<string, string>)[key] ?? key
describe('complete process definitions and coverage', () => {
  it('normalizes legacy definitions and retains ordered paths, roles and instructions without sharing mutable data', () => {
    const value = processEvaluation()
    expect(validateEvaluation({ ...value, processes: undefined }).processes).toEqual([])
    const normalized = validateEvaluation(value)
    expect(normalized.processes).toEqual(value.processes)
    normalized.processes![0]!.paths[0]!.steps[0]!.action = 'Changed'
    expect(value.processes![0]!.paths[0]!.steps[0]!.action).toBe('Open the contact page')
    expect(normalized.processes![0]!.role).toBe('Visitor')
  })
  it('retains incomplete and deleted references as explicit gaps rather than dropping steps', () => {
    const value = processEvaluation()
    value.processes![0]!.name = ''
    value.processes![0]!.startingPoint = ''
    value.processes![0]!.paths[0]!.steps[0]!.sampleId = 'deleted'
    value.processes![0]!.paths[1]!.condition = ''
    const report = processCoverage(validateEvaluation(value), value.samples.map(sample => sample.id))[0]!
    expect(report.gaps).toEqual(['name', 'starting-point'])
    expect(report.paths[0]!.steps[0]!).toMatchObject({ status: 'missing', gaps: ['sample'], sampleId: 'deleted' })
    expect(report.paths[1]!.gaps).toEqual(['condition'])
    expect(report.gapCount).toBe(5)
    value.processes![0]!.paths = []
    expect(processCoverage(validateEvaluation(value))[0]!.gaps).toContain('default-path')
  })
  it('distinguishes scan completion, partial evidence, manual states and changed state identity', () => {
    const value = processEvaluation()
    const sample = value.samples[0]!
    const step = value.processes![0]!.paths[0]!.steps[0]!
    const status = () => processCoverage(value, [sample.id])[0]!.paths[0]!.steps[0]!
    expect(status().status).toBe('scanned')
    expect(processCoverage(value, [], [sample.id])[0]!.paths[0]!.steps[0]!.status).toBe('partial')
    for (const kind of ['form-error', 'confirmation', 'dialog', 'authenticated', 'other'] as const) {
      step.stateKind = kind
      expect(status()).toMatchObject({ status: 'manual', gaps: ['manual-preparation'] })
    }
    sample.preparation = 'manual'
    expect(status()).toMatchObject({ status: 'manual', gaps: [] })
    sample.state.id = 'replacement'
    expect(status()).toMatchObject({ status: 'missing', gaps: ['stale-state'] })
  })
  it('rejects malformed references, duplicate identities/defaults and unbounded structures', () => {
    const processes = processEvaluation().processes!
    expect(() => normalizeProcesses(null)).toThrow()
    expect(() => normalizeProcesses([{ ...processes[0], paths: [{ ...processes[0]!.paths[0], steps: [{ ...processes[0]!.paths[0]!.steps[0], stateId: null }] }] }])).toThrow('reference')
    expect(() => normalizeProcesses([...processes, ...processes])).toThrow('identity')
    expect(() => normalizeProcesses([{ ...processes[0], paths: processes[0]!.paths.map(path => ({ ...path, kind: 'default' })) }])).toThrow('default')
    expect(() => normalizeProcesses([{ ...processes[0], paths: Array(11).fill({}) }])).toThrow('oversized')
    expect(() => normalizeProcesses([{ ...processes[0], name: 'x'.repeat(201) }])).toThrow('text')
    const many = Array.from({ length: 6 }, (_, i) => ({ ...processes[0]!, id: 'p' + i, paths: [{ ...processes[0]!.paths[0]!, id: 'path' + i, steps: Array.from({ length: 40 }, (_, j) => ({ ...processes[0]!.paths[0]!.steps[0]!, id: 'step-' + i + '-' + j })) }] }))
    expect(() => normalizeProcesses(many)).toThrow('Too many process steps')
  })
  it('captures processes in combined evidence and exports the same ordered coverage with escaped instructions', () => {
    const value = processEvaluation()
    value.processes![0]!.paths[0]!.steps[0]!.expectedState = '<script>alert(1)</script> & confirmation'
    const result = combineEvaluationResults({ evaluation: value, scans: [{ sampleId: value.samples[0]!.id, evidence: reportFixture().evidence }] })
    const data = prepareExportData(result)
    value.processes![0]!.name = 'Later draft change'
    expect(data.report.processes![0]!.name).toBe('Contact request')
    expect(buildGroupedReport(result).processes).toEqual(data.report.processes)
    expect(JSON.parse(generateJSONContent(data)).report.processes).toEqual(data.report.processes)
    const csv = generateCSVContent(data)
    expect(csv).toContain('"process-step"')
    expect(csv).toContain('"process-path"')
    expect(csv).toContain('manual-assessment-pending')
    const html = generateProcessesHTML(data.report, t, escapeReportHTML)
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; confirmation')
    expect(html).not.toContain('<script>')
    expect(html).toContain('manual assessment pending')
    expect(html).toContain('The sample is missing')
  })
})
