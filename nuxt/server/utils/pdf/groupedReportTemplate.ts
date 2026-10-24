import { generateProcessesHTML } from './processTemplate'
import { generatePlanningHTML } from './planningTemplate'
import { getCookie } from 'h3'
import type { H3Event } from 'h3'
import type { GroupedReport } from '~~/shared/types/report'
import { getTranslatedString } from '~~/server/utils/localeHelper'

export function escapeReportHTML(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[character]!)
}

export function generateGroupedReportHTML(event: H3Event, report: GroupedReport, timeZone = 'UTC'): string {
  const t = (key: string) => escapeReportHTML(getTranslatedString(event, key))
  const e = escapeReportHTML
  const locale = getCookie(event, 'i18n_detected')
  const dateLocale = locale && ['en', 'nl', 'pl'].includes(locale) ? locale : 'en'
  let date: string
  try {
    date = new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'long', timeZone }).format(new Date(report.timestamp))
  } catch {
    date = report.timestamp
  }
  const metrics: [string, number][] = [
    ['group_unique_findings', report.summary.uniqueFindings], ['group_occurrences', report.summary.observedOccurrences],
    ['group_identified_elements', report.summary.affectedElements], ['group_sampled_pages', report.summary.affectedSamples],
  ]
  const findings = report.findings.map(finding => '<section class="finding">'
    + '<div class="finding-lead"><h3>' + e(finding.title) + '</h3><p class="meta">' + e(finding.issueType) + ' | ' + t('group_outcome_' + finding.outcome) + '</p>'
    + '<p>' + t('group_occurrences') + ': ' + finding.occurrences.length + ' | ' + t('group_sampled_pages') + ': ' + finding.affectedSamples + ' | ' + t('group_known_engines') + ': ' + finding.engines.length + '</p>'
    + '<p>' + e(finding.sources.join(' | ')) + (finding.criteria.length ? ' | WCAG: ' + e(finding.criteria.join(', ')) : '') + '</p>'
    + '</div>' + finding.occurrences.map(occurrence => '<div class="occurrence"><div class="occurrence-lead"><h4>' + e(occurrence.sampleName || occurrence.url) + '</h4><p>' + e(occurrence.url) + '</p><p>' + t('group_state') + ': ' + e(occurrence.state) + '</p>'
      + (occurrence.selector ? '<pre>' + e(occurrence.selector) + '</pre>' : '<p>' + t('group_no_locator') + '</p>')
      + '</div>' + occurrence.observations.map(observation => '<div class="observation"><h5>' + e(observation.source) + ' | ' + e(observation.ruleId) + ' | ' + t('group_outcome_' + observation.outcome) + '</h5>'
        + '<p>' + e(observation.title) + '</p>' + (observation.description ? '<p>' + e(observation.description) + '</p>' : '')
        + '<p class="meta">' + e(observation.completedAt) + '</p>'
        + (observation.selector ? '<pre>' + e(observation.selector) + '</pre>' : '')
        + (observation.html ? '<pre>' + e(observation.html) + '</pre>' : '')
        + (observation.helpUrl ? '<p class="meta">' + e(observation.helpUrl) + '</p>' : '') + '</div>').join('') + '</div>').join('') + '</section>').join('')
  const reviews = report.reviews.map(review => '<div class="observation"><h3>' + t('group_review_' + review.reason.replaceAll('-', '_')) + '</h3><p>' + t(review.resolved ? 'group_reviewed' : 'group_pending') + '</p>'
    + review.observations.map(item => '<p>' + e(item.source) + ' | ' + e(item.ruleId) + ' | ' + t('group_outcome_' + item.outcome) + '</p><pre>' + e(item.selector) + '</pre>').join('') + '</div>').join('')
  const history = report.decisions.map(item => '<div class="observation"><h3>' + e(item.reviewer) + ' | ' + t('group_action_' + item.action) + '</h3><p>' + e(item.timestamp) + '</p><p>' + e(item.reason) + '</p><pre>' + e(item.occurrenceIds.join('\n')) + '</pre></div>').join('')
  const configuration = report.runs.map(run => '<div class="observation"><h3>' + e(run.tool) + ' / ' + e(run.engine) + ' ' + e(run.engineVersion) + ' | ' + e(run.standard) + '</h3><p>' + e(run.startedAt) + ' - ' + e(run.completedAt) + '</p><pre>' + e(JSON.stringify(run.configuration, null, 2)) + '</pre></div>').join('')
  const evaluation = report.evaluation
  const inventory = evaluation
    ? '<h2>' + t('eval_sample_inventory') + '</h2><h3>' + e(evaluation.name) + '</h3><p>' + e(evaluation.scope.description) + '</p><p>' + t('eval_scan_coverage').replace('{scanned}', String(evaluation.scannedSampleIds.length)).replace('{total}', String(evaluation.samples.length)) + '</p>'
    + evaluation.samples.map(sample => '<div class="observation"><h3>' + e(sample.name || sample.url) + '</h3><p>' + e(sample.url) + '</p><p>' + t('planning_selection_kind') + ': ' + t(sample.selection?.kind === 'random' ? 'planning_random' : 'planning_structured') + '</p><p>' + t('planning_selection_source') + ': ' + e(sample.selection?.source || '—') + '</p><p>' + t('planning_selection_method') + ': ' + e(sample.selection?.method || '—') + '</p><p>' + t('planning_sample_links') + ': ' + e(evaluation.inventory?.filter(entry => sample.inventoryIds?.includes(entry.id)).map(entry => entry.name).join(', ') || '—') + '</p><p>' + t('eval_types') + ': ' + e(sample.typeTags.join(', ')) + '</p><p>' + t('eval_selection_reason') + ': ' + e(sample.selectionReason) + '</p><p>' + t('eval_state') + ': ' + e(sample.state.description) + '</p><p>' + t(evaluation.scannedSampleIds.includes(sample.id) ? 'eval_status_scanned' : evaluation.partiallyScannedSampleIds?.includes(sample.id) ? 'eval_status_partial' : sample.preparation === 'manual' ? 'eval_status_manual' : 'eval_status_unscanned') + '</p></div>').join('')
    : ''
  const execution = evaluation?.execution
  const attempts = execution
    ? '<h2>' + t('batch_engine_details') + '</h2><p class="note">' + t('batch_status_' + execution.status) + '</p>'
    + execution.tasks.map(task => '<div class="observation"><h3>' + e(evaluation!.samples.find(sample => sample.id === task.sampleId)?.name || evaluation!.samples.find(sample => sample.id === task.sampleId)?.url) + ' | ' + e(task.key) + '</h3>' + task.attempts.map((attempt, index) => '<p>' + t('batch_attempt') + ' ' + (index + 1) + ': ' + t('batch_work_' + attempt.status) + '</p><p>' + e(attempt.completedAt || attempt.startedAt) + '</p>' + (attempt.error ? '<p>' + e(attempt.error) + '</p>' : '')).join('') + '</div>').join('')
    : ''
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + t('wcag_accessibility_report') + '</title><style>'
    + '@page{size:A4}*{box-sizing:border-box}body{font:11px/1.5 Arial,sans-serif;color:#172033;margin:0}h1{font-size:24px;line-height:1.2;margin:0 0 10px}h2{font-size:17px;border-bottom:2px solid #cbd5e1;padding-bottom:5px;margin-top:24px}h3{font-size:13px;margin:12px 0 5px}h4,h5{font-size:11px;margin:8px 0 4px}h1,h2,h3,h4,h5{break-after:avoid}p{margin:5px 0;overflow-wrap:anywhere}.meta{color:#475569;font-size:10px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.metric{padding:10px;background:#eff6ff;border:1px solid #dbeafe;border-radius:6px}.number{display:block;font-size:23px;font-weight:bold}.finding-lead,.occurrence-lead{break-inside:avoid;break-after:avoid}.finding{margin:18px 0;padding-top:5px;border-top:1px solid #94a3b8}.occurrence{margin:10px 0;padding-left:12px;border-left:3px solid #cbd5e1}.observation{margin:10px 0;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;break-inside:avoid}pre{font:9px/1.45 monospace;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-all;margin:6px 0;padding:6px;background:#edf2f7}.note{padding:10px;background:#f1f5f9;border-radius:6px} .process-step{margin:10px 0;padding:8px 10px;border-left:3px solid #cbd5e1;white-space:pre-wrap} .section{break-before:auto}'
    + '</style></head><body><header><h1>' + t('wcag_accessibility_report') + '</h1><p>' + e(report.url) + '</p><p>' + t('scan_date') + ': ' + e(date) + '</p><p>' + t('wcag_standard') + ': ' + e(report.standards.join(', ')) + ' | ' + t('tools_used') + ': ' + e(report.tools.join(', ')) + '</p></header>'
    + '<div class="metrics">' + metrics.map(([key, value]) => '<div class="metric"><span class="number">' + value + '</span>' + t(key) + '</div>').join('') + '</div>'
    + '<p class="meta">' + t('group_raw_observations') + ': ' + report.summary.rawObservations + ' | ' + t('group_unresolved_occurrences') + ': ' + report.summary.unresolvedElementOccurrences + '</p>'
    + '<p class="note">' + t('group_report_note') + ' ' + t('group_not_conformance') + '</p>'
    + (execution ? '<p class="note">' + t('batch_status_' + execution.status) + '</p>' : '')
    + generatePlanningHTML(report, t, e)
    + generateProcessesHTML(report, t, e)
    + inventory
    + attempts
    + '<h2>' + t('group_findings') + '</h2>' + (findings || '<p>' + t('group_no_findings') + '</p>')
    + (reviews ? '<h2>' + t('group_review_grouping') + '</h2>' + reviews : '')
    + (history ? '<h2>' + t('group_decision_history') + '</h2>' + history : '')
    + '<h2>' + t('group_configuration') + '</h2><p>' + t('group_automated_passes') + ': ' + report.automatedChecks.passedObservations + ' | ' + t('group_inapplicable') + ': ' + report.automatedChecks.inapplicableObservations + '</p>' + configuration + '</body></html>'
}
