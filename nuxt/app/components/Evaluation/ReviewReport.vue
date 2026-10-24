<script setup lang="ts">
import type { GroupedReport } from '~~/shared/types/report'
import type { UnresolvedWork } from '~~/shared/types/evaluationReport'

defineProps<{ report: GroupedReport }>()
const details = (item: UnresolvedWork, report: GroupedReport, t: (key: string) => string) => item.details.map(value => item.code === 'scope-details' ? t(value === 'description' ? 'eval_scope' : 'planning_' + value) : item.code === 'inventory-kinds' ? t('planning_kind_' + value) : item.code === 'inventory-coverage' ? report.evaluation?.inventory?.find(entry => entry.id === value)?.name || value : item.code === 'earlier-stages' ? t('wf_stage_' + value) : value).join(', ')
</script>

<template>
  <div
    v-if="report.evaluationReview"
    class="space-y-4 [overflow-wrap:anywhere]"
    data-evaluation-review
  >
    <h3 class="text-lg font-bold">
      {{ $t('wf_title') }}
    </h3>
    <p
      class="rounded bg-slate-100 p-3 font-medium"
      role="status"
    >
      {{ $t('wf_overall_' + report.evaluationReview.status) }}
    </p>
    <p class="text-sm text-gray-600">
      {{ $t('wf_progress_help') }}
    </p>
    <p
      v-for="code in report.evaluationReview.limitations"
      :key="code"
      class="text-sm text-gray-600"
    >
      {{ $t('wf_limit_' + code) }}
    </p>
    <p
      v-for="key in ['conclusion', 'limitations'] as const"
      :key="key"
      class="whitespace-pre-wrap text-sm"
    >
      <strong>{{ $t('wf_note_' + key) }}:</strong> {{ report.evaluationReview.notes[key] || '—' }}
    </p>
    <details class="rounded border border-gray-200 p-3">
      <summary class="cursor-pointer font-medium">
        {{ $t('wf_stages') }}
      </summary>
      <p
        v-for="key in ['additionalRequirements', 'explorationNotes', 'processNotes', 'conformanceNotes'] as const"
        :key="key"
        class="mt-3 whitespace-pre-wrap text-sm"
      >
        <strong>{{ $t('wf_note_' + key) }}:</strong> {{ report.evaluationReview.notes[key] || '—' }}
      </p>
      <section
        v-for="stage in report.evaluationReview.stages"
        :key="stage.key"
        class="mt-3 space-y-2 rounded border p-3 text-sm"
        :data-workflow-stage="stage.key"
      >
        <h4 class="font-semibold">
          {{ $t('wf_stage_' + stage.key) }}
        </h4><p>{{ $t('wf_status_' + stage.status) }} · {{ $t('wf_gap_count', { count: stage.unresolvedIds.length }) }}</p>
        <p
          v-if="stage.stale"
          class="text-amber-900"
        >
          {{ $t('wf_review_stale') }}
        </p>
        <template v-if="stage.review">
          <p>{{ stage.review.reviewer }} · {{ stage.review.reviewedAt }}</p><p class="whitespace-pre-wrap">
            {{ stage.review.notes }}
          </p>
        </template>
      </section>
    </details>
    <details class="rounded border border-gray-200 p-3">
      <summary class="cursor-pointer font-medium">
        {{ $t('wf_unresolved') }} ({{ report.evaluationReview.unresolved.length }})
      </summary>
      <p class="mt-3 text-sm text-gray-600">
        {{ $t('wf_unresolved_help') }}
      </p>
      <p
        v-if="!report.evaluationReview.unresolved.length"
        class="mt-3 text-sm"
      >
        {{ $t('wf_no_unresolved') }}
      </p>
      <article
        v-for="item in report.evaluationReview.unresolved"
        :key="item.id"
        class="mt-3 space-y-2 rounded border p-3 text-sm"
        :data-work-code="item.code"
      >
        <h4 class="font-semibold">
          {{ $t('wf_work_' + item.code) }}
        </h4><p>{{ $t('wf_stage_' + item.stage) }} · {{ $t('wf_severity_' + item.severity) }} · {{ item.count }}</p>
        <p v-if="item.sampleIds.length">
          {{ $t('process_sample') }}: {{ item.sampleIds.map(id => report.evaluation?.samples.find(sample => sample.id === id)?.name || report.evaluation?.samples.find(sample => sample.id === id)?.url || id).join(', ') }}
        </p>
        <p v-if="item.criterionIds.length">
          WCAG: {{ item.criterionIds.join(', ') }}
        </p>
        <p v-if="item.details.length">
          {{ details(item, report, $t) }}
        </p>
        <p v-if="item.findingIds.length">
          {{ $t('wf_finding_reference') }}: {{ item.findingIds.join(', ') }}
        </p>
      </article>
    </details>
    <details
      class="rounded border border-gray-200 p-3"
      data-criterion-index
    >
      <summary class="cursor-pointer font-medium">
        {{ $t('wf_criteria') }}
      </summary>
      <p class="mt-3 text-sm text-gray-600">
        {{ $t('wf_criteria_help') }}
      </p>
      <details
        v-for="criterion in report.evaluationReview.criteria"
        :key="criterion.id"
        class="mt-3 rounded border p-3"
        :data-criterion-id="criterion.id"
      >
        <summary class="cursor-pointer text-sm font-medium">
          <span lang="en">{{ criterion.id }} {{ criterion.title }} ({{ criterion.level }})</span> · {{ $t('manual_outcome_' + criterion.outcome) }}
        </summary>
        <ul class="mt-3 space-y-3 text-sm">
          <li
            v-for="sample in criterion.samples"
            :key="sample.sampleId"
            class="space-y-2 rounded border p-3"
            :data-criterion-sample-id="sample.sampleId"
          >
            <p class="font-semibold">
              {{ sample.sampleName }}
            </p><p>{{ sample.url }}</p><p>{{ sample.state }}</p>
            <p>{{ $t('wf_current_outcome') }}: {{ $t('manual_outcome_' + sample.outcome) }}</p>
            <p v-if="sample.recordedOutcome">
              {{ $t('wf_recorded_outcome') }}: {{ $t('manual_outcome_' + sample.recordedOutcome) }}
            </p>
            <p
              v-if="sample.stale"
              class="text-amber-900"
            >
              {{ $t('manual_stale') }}
            </p>
            <p
              v-if="sample.conflict"
              class="text-amber-900"
            >
              {{ $t(sample.reconciled ? 'wf_conflict_explained' : 'wf_conflict_open') }}
            </p>
            <p>{{ $t('wf_automated_outcomes') }}: {{ sample.automatedOutcomes.map(outcome => $t('group_outcome_' + outcome)).join(', ') || '—' }}</p>
            <p>{{ $t('wf_finding_reference') }}: {{ sample.findingIds.join(', ') || '—' }}</p>
            <p>{{ $t('wf_occurrence_reference') }}: {{ sample.occurrenceIds.join(', ') || '—' }}</p>
            <p>{{ $t('wf_assessment_reference') }}: {{ sample.assessmentId || '—' }}</p>
          </li>
        </ul>
      </details>
    </details>
    <details
      class="rounded border border-gray-200 p-3"
      data-issue-type-index
    >
      <summary class="cursor-pointer font-medium">
        {{ $t('wf_issue_types') }}
      </summary>
      <p class="mt-3 text-sm text-gray-600">
        {{ $t('wf_index_help') }}
      </p>
      <p
        v-if="!report.evaluationReview.issueTypes.length"
        class="mt-3 text-sm"
      >
        {{ $t('group_no_findings') }}
      </p>
      <section
        v-for="item in report.evaluationReview.issueTypes"
        :key="item.issueType"
        class="mt-3 space-y-2 rounded border p-3 text-sm"
      >
        <h4 class="font-semibold">
          {{ item.issueType }}
        </h4><p>{{ $t('group_unique_findings') }}: {{ item.findingIds.length }} · {{ $t('group_occurrences') }}: {{ item.occurrenceIds.length }} · {{ $t('group_sampled_pages') }}: {{ item.sampleIds.length }}</p><p>WCAG: {{ item.criteria.join(', ') || '—' }}</p><p>{{ $t('wf_finding_reference') }}: {{ item.findingIds.join(', ') }}</p>
      </section>
    </details>
  </div>
</template>
