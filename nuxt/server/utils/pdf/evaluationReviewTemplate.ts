import type { GroupedReport } from '~~/shared/types/report'

export function generateEvaluationReviewHTML(report: GroupedReport, t: (key: string) => string, e: (value: unknown) => string, section: 'overview' | 'indexes' = 'overview'): string {
  const review = report.evaluationReview
  if (!review) return ''
  const field = (key: string, value: unknown) => '<p><strong>' + t(key) + ':</strong> ' + e(value || '—') + '</p>'
  const details = (item: typeof review.unresolved[number]) => item.details.map(value => item.code === 'scope-details' ? t(value === 'description' ? 'eval_scope' : 'planning_' + value) : item.code === 'inventory-kinds' ? t('planning_kind_' + value) : item.code === 'inventory-coverage' ? e(report.evaluation?.inventory?.find(entry => entry.id === value)?.name || value) : item.code === 'earlier-stages' ? t('wf_stage_' + value) : e(value)).join(', ')
  const summary = '<h2>' + t('wf_title') + '</h2><p class="note">' + t('wf_overall_' + review.status) + '</p><p>' + t('wf_progress_help') + '</p>'
    + review.limitations.map(code => '<p>' + t('wf_limit_' + code) + '</p>').join('')
    + (['conclusion', 'limitations', 'additionalRequirements', 'explorationNotes', 'processNotes', 'conformanceNotes'] as const).map(key => field('wf_note_' + key, review.notes[key])).join('')
    + '<h2>' + t('wf_stages') + '</h2>' + review.stages.map(stage => '<section class="process-step"><h3>' + t('wf_stage_' + stage.key) + '</h3><p>' + t('wf_status_' + stage.status) + ' | ' + t('wf_gap_count').replace('{count}', String(stage.unresolvedIds.length)) + '</p>'
      + (stage.stale ? '<p>' + t('wf_review_stale') + '</p>' : '') + (stage.review ? '<p>' + e(stage.review.reviewer) + ' | ' + e(stage.review.reviewedAt) + '</p><p>' + e(stage.review.notes) + '</p>' : '') + '</section>').join('')
  const unresolved = '<h2>' + t('wf_unresolved') + '</h2><p>' + t('wf_unresolved_help') + '</p>' + (review.unresolved.length
    ? review.unresolved.map(item => '<section class="process-step"><h3>' + t('wf_work_' + item.code) + '</h3><p>' + t('wf_stage_' + item.stage) + ' | ' + t('wf_severity_' + item.severity) + ' | ' + item.count + '</p>'
      + (item.sampleIds.length ? field('process_sample', item.sampleIds.map(id => report.evaluation?.samples.find(sample => sample.id === id)?.name || report.evaluation?.samples.find(sample => sample.id === id)?.url || id).join(', ')) : '')
      + (item.criterionIds.length ? '<p>WCAG: ' + e(item.criterionIds.join(', ')) + '</p>' : '') + (item.details.length ? '<p>' + details(item) + '</p>' : '') + (item.findingIds.length ? field('wf_finding_reference', item.findingIds.join(', ')) : '') + '</section>').join('')
    : '<p>' + t('wf_no_unresolved') + '</p>')
  const criteria = '<h2>' + t('wf_criteria') + '</h2><p class="note">' + t('wf_criteria_help') + '</p>' + review.criteria.map(criterion => '<h3>' + e(criterion.id + ' ' + criterion.title + ' (' + criterion.level + ')') + ' | ' + t('manual_outcome_' + criterion.outcome) + '</h3>'
    + criterion.samples.map(sample => '<section class="process-step"><h4>' + e(sample.sampleName) + '</h4><p>' + e(sample.url) + '</p><p>' + e(sample.state) + '</p><p>' + t('wf_current_outcome') + ': ' + t('manual_outcome_' + sample.outcome) + (sample.recordedOutcome ? ' | ' + t('wf_recorded_outcome') + ': ' + t('manual_outcome_' + sample.recordedOutcome) : '') + '</p>'
      + (sample.stale ? '<p>' + t('manual_stale') + '</p>' : '') + (sample.conflict ? '<p>' + t(sample.reconciled ? 'wf_conflict_explained' : 'wf_conflict_open') + '</p>' : '')
      + '<p>' + t('wf_automated_outcomes') + ': ' + (sample.automatedOutcomes.map(outcome => t('group_outcome_' + outcome)).join(', ') || '—') + '</p>'
      + field('wf_finding_reference', sample.findingIds.join(', ')) + field('wf_occurrence_reference', sample.occurrenceIds.join(', ')) + field('wf_assessment_reference', sample.assessmentId) + '</section>').join('')).join('')
  const index = '<h2>' + t('wf_issue_types') + '</h2><p>' + t('wf_index_help') + '</p>' + review.issueTypes.map(item => '<section class="process-step"><h3>' + e(item.issueType) + '</h3><p>' + t('group_unique_findings') + ': ' + item.findingIds.length + ' | ' + t('group_occurrences') + ': ' + item.occurrenceIds.length + ' | ' + t('group_sampled_pages') + ': ' + item.sampleIds.length + '</p><p>WCAG: ' + e(item.criteria.join(', ') || '—') + '</p>' + field('wf_finding_reference', item.findingIds.join(', ')) + '</section>').join('')
  return section === 'overview' ? summary + unresolved : index + criteria
}
