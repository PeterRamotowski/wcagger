import type { GroupedReport } from '~~/shared/types/report'

export function generatePlanningHTML(report: GroupedReport, t: (key: string) => string, e: (value: unknown) => string): string {
  const evaluation = report.evaluation
  const planning = report.planning
  if (!evaluation || !planning) return ''
  const coverage = planning.coverage
  const interpolate = (key: string, values: Record<string, number>) => Object.entries(values).reduce((text, [name, value]) => text.replace('{' + name + '}', String(value)), t(key))
  const scope = ['productName', 'productUrl', 'evaluator', 'commissioner', 'startDate', 'endDate', 'boundaries', 'supportBaseline'] as const
  const metadata = '<h2>' + t('planning_scope') + '</h2>' + scope.map(key => '<h3>' + t('planning_' + key) + '</h3><p>' + e(evaluation.scope[key] || '—') + '</p>').join('')
    + '<h3>' + t('planning_languages') + '</h3><p>' + e(evaluation.scope.languages?.join(', ') || '—') + '</p>'
  const inventory = '<h2>' + t('planning_coverage_title') + '</h2><p>' + t('planning_inventory_help') + '</p>'
    + (coverage.inventory.length ? coverage.inventory.map(entry => '<div class="observation"><h3>' + e(entry.name) + ' | ' + t('planning_kind_' + entry.kind) + '</h3><p>' + e(entry.description) + '</p><p>' + interpolate('planning_selected_links', { count: entry.sampleIds.length }) + ' | ' + interpolate('planning_scanned_links', { count: entry.scannedSampleIds.length }) + '</p>' + (!entry.sampleIds.length ? '<p>' + t('planning_uncovered') + '</p>' : '') + '</div>').join('') : '<p>' + t('planning_no_inventory') + '</p>')
  const plan = evaluation.sampling
  const sampling = '<h2>' + t('planning_sampling') + '</h2><p>' + interpolate('planning_random_counts', { structured: coverage.structured, random: coverage.countedRandom, required: coverage.requiredRandom, missing: coverage.missingRandom }) + '</p><p>' + t('planning_random_help') + '</p>'
    + (coverage.missingRandom ? '<p class="note">' + t('planning_random_gap') + '</p>' : '')
    + (coverage.excludedRandomIds.length ? '<p class="note">' + t('planning_invalid_random') + '</p>' : '')
    + '<p>' + t('planning_pool_coverage') + ': ' + t('planning_coverage_' + (plan?.coverage ?? 'unknown')) + '</p>'
    + (plan?.coverage !== 'whole-scope' ? '<p class="note">' + t('planning_incomplete_pool') + '</p>' : '')
    + (['source', 'rationale', 'coverageNotes', 'exhaustionReason', 'comparisonNotes'] as const).map(key => '<h3>' + t('planning_' + key) + '</h3><p>' + e(plan?.[key] || '—') + '</p>').join('')
    + (plan?.draws ?? []).map(draw => '<div class="observation"><h3>' + t('planning_draw_history') + ' | ' + e(draw.timestamp) + '</h3><p>' + e(draw.source) + ' | ' + e(draw.method) + '</p><p>' + t('planning_pool_coverage') + ': ' + t('planning_coverage_' + draw.coverage) + ' | ' + e(draw.coverageNotes) + '</p><p>' + interpolate('planning_draw_size', { selected: draw.selected.length, requested: draw.requestedCount, eligible: draw.eligibleCount }) + '</p>' + draw.selected.map(chosen => '<p>' + e(draw.pool.find(candidate => candidate.id === chosen.candidateId)?.url) + '</p>').join('') + '</div>').join('')
  const inspections = (plan?.candidates ?? []).filter(candidate => candidate.inspection).map((candidate) => {
    const record = candidate.inspection!
    return '<div class="observation"><h3>' + t('inspection_captured') + ' | ' + e(candidate.name || candidate.url) + '</h3><p>' + e(candidate.id) + ' | ' + e(record.method) + ' | ' + e(record.inspectedAt) + '</p><p>' + e(record.requestedUrl) + ' → ' + e(record.finalUrl) + '</p><p>' + record.bytes + ' bytes | ' + record.durationLimitMs + ' ms | ' + record.byteLimit + ' bytes</p><p>' + t('inspection_suggested') + ': ' + e(record.suggestedTypes.join(', ') || '—') + '</p><p>' + t('eval_types') + ': ' + e(candidate.typeTags?.join(', ') || '—') + '</p><p class="note">' + t('inspection_record_help') + '</p></div>'
  }).join('')
  const comparison = '<h2>' + t('planning_compare') + '</h2><p class="note">' + t('planning_compare_help') + '</p>'
    + (planning.comparison.randomOnlyIssues.length || planning.comparison.randomOnlyContentTypes.length ? '<p>' + t('planning_expand_hint') + '</p><p>' + t('planning_new_types') + ': ' + e(planning.comparison.randomOnlyContentTypes.join(', ') || '—') + '</p><p>' + t('planning_new_issues') + ': ' + e(planning.comparison.randomOnlyIssues.join(', ') || '—') + '</p>' : '')
    + (['structured', 'random'] as const).map(kind => '<h3>' + t('planning_' + kind) + '</h3>' + (planning.comparison[kind].length ? planning.comparison[kind].map(finding => '<div class="observation"><h4>' + e(finding.title) + '</h4><p>' + e(finding.issueType) + ' | ' + t('group_outcome_' + finding.outcome) + ' | ' + t('group_occurrences') + ': ' + finding.occurrenceIds.length + '</p></div>').join('') : '<p>' + t('planning_no_observed_findings') + '</p>')).join('')
  return metadata + inventory + sampling + inspections + comparison
}
