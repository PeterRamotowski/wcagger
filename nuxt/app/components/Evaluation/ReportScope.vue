<script setup lang="ts">
import { computed } from 'vue'
import type { DeepReadonly } from 'vue'
import { buildGroupedReport } from '~~/shared/utils/reportPresentation'
import type { AccessibilityCheckResults } from '~~/shared/types/accessibility'

const props = defineProps<{ results: DeepReadonly<AccessibilityCheckResults> }>()
const report = computed(() => buildGroupedReport(props.results))
const evaluation = computed(() => props.results.evidence.evaluation!)
</script>

<template>
  <section class="mb-6 space-y-3 rounded-xl border border-indigo-200 bg-white p-6">
    <h2 class="text-xl font-bold">
      {{ evaluation.name || $t('eval_title') }}
    </h2>
    <p
      v-if="evaluation.scope.description"
      class="whitespace-pre-wrap break-words text-sm"
    >
      {{ evaluation.scope.description }}
    </p>
    <p
      v-if="evaluation.execution"
      class="rounded bg-amber-50 p-3 text-sm font-medium"
    >
      {{ $t('batch_status_' + evaluation.execution.status) }}
    </p>
    <p
      v-if="evaluation.partiallyScannedSampleIds?.length"
      class="text-sm"
    >
      {{ $t('batch_partial_samples', { count: evaluation.partiallyScannedSampleIds.length }) }}
    </p>
    <p class="text-sm">
      {{ $t('eval_scan_coverage', { scanned: evaluation.scannedSampleIds.length, total: evaluation.samples.length }) }}
    </p>
    <p class="text-sm text-gray-600">
      {{ $t('eval_snapshot_help') }}
    </p>
    <EvaluationReviewReport :report="report" />
    <details
      v-if="evaluation.execution"
      class="rounded border border-gray-200 p-3"
    >
      <summary class="cursor-pointer font-medium">
        {{ $t('batch_engine_details') }}
      </summary>
      <p class="mt-3 text-sm">
        {{ $t('tools_used') }}: {{ evaluation.execution.tools.join(', ') }} · {{ evaluation.execution.runners.join(', ') }}
      </p>
      <section
        v-for="task in evaluation.execution.tasks"
        :key="task.sampleId + ':' + task.key"
        class="mt-3 space-y-2 rounded border p-3 text-sm"
      >
        <h3 class="font-semibold">
          {{ evaluation.samples.find(sample => sample.id === task.sampleId)?.name || evaluation.samples.find(sample => sample.id === task.sampleId)?.url || task.sampleId }} · {{ task.key }}
        </h3>
        <div
          v-for="(attempt, index) in task.attempts"
          :key="attempt.id"
          class="space-y-1"
        >
          <p>{{ $t('batch_attempt') }} {{ index + 1 }}: {{ $t('batch_work_' + attempt.status) }}</p><p>{{ attempt.startedAt || '—' }} / {{ attempt.completedAt || '—' }}</p><p
            v-if="attempt.error"
            class="whitespace-pre-wrap"
          >
            {{ attempt.error }}
          </p>
        </div>
      </section>
    </details>
    <EvaluationPlanningReport :report="report" />
    <EvaluationProcessReport :report="report" />
    <EvaluationAssessmentReport :report="report" />
    <details>
      <summary class="cursor-pointer font-medium">
        {{ $t('eval_sample_inventory') }}
      </summary>
      <ul class="mt-3 space-y-3">
        <li
          v-for="sample in evaluation.samples"
          :key="sample.id"
          class="break-words rounded border border-gray-200 p-3 text-sm"
        >
          <p class="font-semibold">
            {{ sample.name || sample.url }}
          </p>
          <p class="break-all">
            {{ sample.url }}
          </p>
          <p>{{ $t('planning_selection_kind') }}: {{ $t(sample.selection?.kind === 'random' ? 'planning_random' : 'planning_structured') }}</p>
          <p>{{ $t('planning_selection_source') }}: {{ sample.selection?.source || '—' }}</p>
          <p>{{ $t('planning_selection_method') }}: {{ sample.selection?.method || '—' }}</p>
          <p>{{ $t('planning_sample_links') }}: {{ evaluation.inventory?.filter(entry => sample.inventoryIds?.includes(entry.id)).map(entry => entry.name).join(', ') || '—' }}</p>
          <p>{{ $t('eval_types') }}: {{ sample.typeTags.join(', ') || '—' }}</p>
          <p>{{ $t('eval_selection_reason') }}: {{ sample.selectionReason || '—' }}</p>
          <p>{{ $t('eval_state') }}: {{ sample.state.description }}</p>
          <p>{{ $t(evaluation.scannedSampleIds.includes(sample.id) ? 'eval_status_scanned' : evaluation.partiallyScannedSampleIds?.includes(sample.id) ? 'eval_status_partial' : sample.preparation === 'manual' ? 'eval_status_manual' : 'eval_status_unscanned') }}</p>
        </li>
      </ul>
    </details>
  </section>
</template>
