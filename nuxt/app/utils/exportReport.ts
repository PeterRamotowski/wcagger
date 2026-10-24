import type { DeepReadonly } from 'vue'
import type { AccessibilityCheckResults, ExportData } from '~~/shared/types/accessibility'
import { buildGroupedReport, formatLocator, formatSource } from '~~/shared/utils/reportPresentation'

export function prepareExportData(results: DeepReadonly<AccessibilityCheckResults>): ExportData {
  const report = buildGroupedReport(results)
  return { schemaVersion: 2, url: report.url, timestamp: report.timestamp, selectedTools: report.tools, standards: report.standards, summary: report.summary, report, evidence: results.evidence }
}

export function generateJSONContent(data: ExportData): string {
  return JSON.stringify(data, null, 2)
}

export function generateCSVContent(data: ExportData): string {
  const rows: string[][] = [['Record type', 'Finding ID', 'Occurrence ID', 'Observation ID', 'Title', 'Outcome', 'Issue type', 'WCAG criteria', 'Sample ID', 'State ID', 'URL', 'Selector', 'Source', 'Engine', 'Rule', 'Scan timestamp', 'Details']]
  const add = (values: string[]) => rows.push(values)
  add(['metadata', '', '', '', '', '', '', '', '', '', data.url, '', '', '', '', data.timestamp, JSON.stringify({ schemaVersion: data.schemaVersion, summary: data.summary, standards: data.standards, runs: data.report.runs, evaluation: data.report.evaluation })])
  for (const sample of data.report.evaluation?.samples ?? []) add(['sample', '', '', '', sample.name, data.report.evaluation!.scannedSampleIds.includes(sample.id) ? 'scanned' : data.report.evaluation!.partiallyScannedSampleIds?.includes(sample.id) ? 'partial' : 'unscanned', '', '', sample.id, sample.state.id, sample.url, '', '', '', '', data.timestamp, JSON.stringify(sample)])
  for (const task of data.report.evaluation?.execution?.tasks ?? []) {
    for (const attempt of task.attempts) add(['engine-attempt', '', '', '', '', attempt.status, '', '', task.sampleId, '', '', '', task.key, task.key === 'pa11y:htmlcs' ? 'htmlcs' : 'axe', '', attempt.completedAt ?? attempt.startedAt ?? data.timestamp, JSON.stringify(attempt)])
  }
  for (const entry of data.report.planning?.coverage.inventory ?? []) add(['inventory', '', '', '', entry.name, entry.sampleIds.length ? 'represented-in-selection' : 'uncovered', entry.kind, '', entry.sampleIds.join('; '), '', '', '', '', '', '', data.timestamp, JSON.stringify(entry)])
  for (const draw of data.report.evaluation?.sampling?.draws ?? []) add(['random-draw', '', '', '', draw.source, draw.coverage, '', '', draw.selected.map(item => item.sampleId).join('; '), '', '', '', '', '', '', draw.timestamp, JSON.stringify(draw)])
  if (data.report.planning) add(['sampling-comparison', '', '', '', '', 'needs-evaluator-review', '', '', '', '', '', '', '', '', '', data.timestamp, JSON.stringify(data.report.planning.comparison)])
  for (const process of data.report.processes ?? []) {
    add(['process', '', '', '', process.name, 'manual-assessment-pending', '', '', '', '', '', '', '', '', '', data.timestamp, JSON.stringify(process)])
    for (const path of process.paths) {
      add(['process-path', '', '', '', path.name, path.kind, '', '', '', '', '', '', '', '', '', data.timestamp, JSON.stringify({ processId: process.id, ...path })])
      for (const [index, step] of path.steps.entries()) add(['process-step', '', '', '', step.name, step.status, '', '', step.sampleId ?? '', step.stateId ?? '', step.url ?? '', '', '', '', '', data.timestamp, JSON.stringify({ processId: process.id, pathId: path.id, position: index + 1, ...step })])
    }
  }
  for (const assessment of data.report.manual?.records ?? []) add(['manual-assessment', '', '', assessment.observationIds.join('; '), '', assessment.outcome, '', assessment.criterionId, assessment.sampleId, assessment.stateId, '', '', assessment.reviewer, '', '', assessment.reviewedAt, JSON.stringify(assessment)])
  if (data.report.manual) add(['manual-coverage', '', '', '', '', '', '', '', '', '', '', '', '', '', '', data.timestamp, JSON.stringify({ expected: data.report.manual.expected, counts: data.report.manual.counts, stale: data.report.manual.stale })])
  const evaluationReview = data.report.evaluationReview
  if (evaluationReview) {
    add(['workflow-summary', '', '', '', '', evaluationReview.status, '', '', '', '', '', '', '', '', '', data.timestamp, JSON.stringify({ notes: evaluationReview.notes, limitations: evaluationReview.limitations })])
    for (const stage of evaluationReview.stages) add(['workflow-stage', '', '', '', stage.key, stage.status, '', '', '', '', '', '', stage.review?.reviewer ?? '', '', '', stage.review?.reviewedAt ?? data.timestamp, JSON.stringify(stage)])
    for (const item of evaluationReview.unresolved) add(['unresolved-work', item.findingIds.join('; '), '', '', item.code, item.severity, '', item.criterionIds.join('; '), item.sampleIds.join('; '), '', '', '', '', '', '', data.timestamp, JSON.stringify(item)])
    for (const criterion of evaluationReview.criteria) {
      add(['criterion', '', '', '', criterion.title, criterion.outcome, '', criterion.id, '', '', criterion.url, '', '', '', '', data.timestamp, JSON.stringify({ level: criterion.level, sampleCount: criterion.samples.length })])
      for (const sample of criterion.samples) add(['criterion-sample', sample.findingIds.join('; '), sample.occurrenceIds.join('; '), '', sample.sampleName, sample.outcome, '', criterion.id, sample.sampleId, sample.stateId, sample.url, '', '', '', '', data.timestamp, JSON.stringify(sample)])
    }
    for (const item of evaluationReview.issueTypes) add(['issue-type', item.findingIds.join('; '), item.occurrenceIds.join('; '), '', '', '', item.issueType, item.criteria.join('; '), item.sampleIds.join('; '), '', '', '', '', '', '', data.timestamp, JSON.stringify(item)])
  }
  const occurrenceOf = new Map<string, { findingId: string, occurrenceId: string, sampleId: string, stateId: string }>()
  for (const finding of data.report.findings) {
    add(['finding', finding.id, '', '', finding.title, finding.outcome, finding.issueType, finding.criteria.join('; '), '', '', '', '', finding.sources.join('; '), finding.engines.join('; '), '', data.timestamp, JSON.stringify({ occurrences: finding.occurrences.length, affectedSamples: finding.affectedSamples })])
    for (const occurrence of finding.occurrences) {
      add(['occurrence', finding.id, occurrence.id, '', '', finding.outcome, finding.issueType, '', occurrence.sampleId, occurrence.stateId, occurrence.url, occurrence.selector, '', '', '', data.timestamp, occurrence.state])
      for (const observation of occurrence.observations) occurrenceOf.set(observation.id, { findingId: finding.id, occurrenceId: occurrence.id, sampleId: occurrence.sampleId, stateId: occurrence.stateId })
    }
  }
  const runs = new Map(data.evidence.runs.map(run => [run.id, run]))
  for (const observation of data.evidence.observations) {
    const run = runs.get(observation.runId)!
    const member = occurrenceOf.get(observation.id)
    add(['observation', member?.findingId ?? '', member?.occurrenceId ?? '', observation.id, observation.title, observation.outcome, '', '', run.sampleId, run.stateId, run.resolvedUrl, formatLocator(observation.element), formatSource(run), run.engine, observation.ruleId, run.completedAt, JSON.stringify(observation.evidence)])
  }
  for (const review of data.report.reviews) add(['review', review.findingIds.join('; '), review.occurrenceIds.join('; '), review.observations.map(item => item.id).join('; '), review.reason, review.resolved ? 'reviewed' : 'pending', '', '', '', '', '', '', '', '', '', data.timestamp, JSON.stringify(review)])
  for (const decision of data.report.decisions) add(['decision', '', decision.occurrenceIds.join('; '), '', decision.reason, decision.action, '', '', '', '', '', '', '', '', '', decision.timestamp, JSON.stringify(decision)])
  return rows.map(row => row.map((cell) => {
    // Quoting alone does not prevent spreadsheet formula execution.
    const value = /^[\t\r\n ]*[=+\-@]/.test(cell) ? '\'' + cell : cell
    return '"' + value.replace(/"/g, '""') + '"'
  }).join(',')).join('\n')
}

export function downloadFile(content: string | ArrayBuffer, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function generateFilename(format: 'json' | 'csv' | 'pdf', timestamp: string): string {
  return 'accessibility-report-' + new Date(timestamp).toISOString().slice(0, 10) + '.' + format
}

export function exportAccessibilityReport(format: 'json' | 'csv', results: DeepReadonly<AccessibilityCheckResults>): void {
  const data = prepareExportData(results)
  downloadFile(format === 'json' ? generateJSONContent(data) : generateCSVContent(data), generateFilename(format, results.timestamp), format === 'json' ? 'application/json' : 'text/csv;charset=utf-8')
}

export async function generatePDFReport(results: DeepReadonly<AccessibilityCheckResults>): Promise<void> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const response = await fetch('/api/generate-pdf', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ results, timeZone }),
  })
  if (!response.ok) throw new Error('PDF generation failed')
  const buffer = await response.arrayBuffer()
  if (!buffer.byteLength) throw new Error('Received empty PDF buffer')
  downloadFile(buffer, generateFilename('pdf', results.timestamp), 'application/pdf')
}
