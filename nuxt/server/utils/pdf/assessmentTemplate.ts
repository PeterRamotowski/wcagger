import type { GroupedReport } from '~~/shared/types/report'
import { ASSESSMENT_OUTCOMES } from '~~/shared/utils/manualAssessments'

export function generateAssessmentsHTML(report: GroupedReport, t: (key: string) => string, e: (value: unknown) => string): string {
  if (!report.manual) return ''
  return '<h2>' + t('manual_title') + '</h2><p class="note">' + t('manual_report_help') + '</p>'
    + ASSESSMENT_OUTCOMES.map(outcome => '<p>' + t('manual_outcome_' + outcome) + ': ' + report.manual!.counts[outcome] + '</p>').join('')
    + '<p>' + t('manual_stale_count').replace('{count}', String(report.manual.stale)) + '</p>'
    + report.manual.records.map(assessment => '<section class="process-step"><h3>' + e(report.evaluation?.samples.find(sample => sample.id === assessment.sampleId)?.name || assessment.sampleId) + ' | ' + e(assessment.criterionId) + '</h3>'
      + '<p>' + t('manual_outcome') + ': ' + t('manual_outcome_' + assessment.outcome) + '</p>'
      + (assessment.stale || !assessment.inTarget ? '<p class="note">' + t('manual_stale') + '</p>' : '')
      + (['reviewer', 'reviewedAt', 'environment', 'justification', 'supportingEvidence', 'reconciliation', 'notes'] as const).map(key => '<p><strong>' + t('manual_' + key) + ':</strong> ' + e(assessment[key] || '—') + '</p>').join('')
      + '<p>' + t('manual_methods') + ': ' + assessment.methods.map(method => t('manual_method_' + method)).join(', ') + '</p>'
      + '<p>' + t('manual_evidence_ids') + ': ' + e(assessment.observationIds.join(', ') || '—') + '</p>'
      + '<p>' + t('process_reference') + ': ' + e(assessment.sampleId) + ' / ' + e(assessment.stateId) + '</p></section>').join('')
}
