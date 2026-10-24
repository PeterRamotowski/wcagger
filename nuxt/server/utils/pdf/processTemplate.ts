import type { GroupedReport } from '~~/shared/types/report'

export function generateProcessesHTML(report: GroupedReport, t: (key: string) => string, e: (value: unknown) => string): string {
  if (!report.evaluation) return ''
  const field = (key: string, value: unknown) => '<p><strong>' + t(key) + ':</strong> ' + e(value || '—') + '</p>'
  const gaps = (items: readonly string[]) => items.map(gap => '<p class="note">' + t('process_gap_' + gap) + '</p>').join('')
  const number = (key: string, index: number) => t(key).replace('{index}', String(index + 1))
  return '<h2>' + t('process_title') + '</h2><p class="note">' + t('process_report_help') + '</p>'
    + (report.processes?.length
      ? report.processes.map((process, index) => '<h3>' + e(process.name || number('process_number', index)) + '</h3>'
        + (['startingPoint', 'prerequisites', 'role'] as const).map(key => field('process_' + key, process[key])).join('')
        + '<p>' + t('process_gap_count').replace('{count}', String(process.gapCount)) + '</p>' + gaps(process.gaps)
        + process.paths.map((path, index) => '<h4>' + e(path.name || number('process_path_number', index)) + ' | ' + t('process_' + path.kind) + '</h4>'
          + (path.condition ? field('process_condition', path.condition) : '') + gaps(path.gaps)
          + path.steps.map((step, index) => '<div class="process-step"><h5>' + number('process_step_number', index) + ': ' + e(step.name) + '</h5>'
            + (['action', 'prerequisites', 'expectedState'] as const).map(key => field('process_step_' + key, step[key])).join('')
            + field('process_role', step.role || process.role) + field('process_state_kind', t('process_state_' + step.stateKind))
            + field('process_sample', step.sampleName || step.url) + (step.sampleName ? '<p>' + e(step.url) + '</p>' : '')
            + field('process_sample_state', step.sampleState) + field('process_reference', (step.sampleId || '—') + ' / ' + (step.stateId || '—'))
            + '<p>' + t('process_status_' + step.status) + '</p>' + gaps(step.gaps) + '</div>').join('')).join('')).join('')
      : '<p>' + t('process_none') + '</p>')
}
