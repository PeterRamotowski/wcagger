<script setup lang="ts">
import type { GroupedReport } from '~~/shared/types/report'

defineProps<{ report: GroupedReport }>()
</script>

<template>
  <details
    class="mt-4 min-w-0 rounded border border-gray-200 p-3 [overflow-wrap:anywhere]"
    data-process-report
  >
    <summary class="cursor-pointer font-medium">
      {{ $t('process_title') }}
    </summary>
    <p class="mt-3 text-sm text-gray-600">
      {{ $t('process_report_help') }}
    </p>
    <p
      v-if="!report.processes?.length"
      class="mt-3 text-sm text-amber-800"
    >
      {{ $t('process_none') }}
    </p>
    <section
      v-for="(process, processIndex) in report.processes"
      :key="process.id"
      class="mt-4 space-y-3 rounded border border-gray-300 p-3 text-sm"
    >
      <h3 class="font-semibold">
        {{ process.name || $t('process_number', { index: processIndex + 1 }) }}
      </h3>
      <p
        v-for="key in ['startingPoint', 'prerequisites', 'role'] as const"
        :key="key"
        class="whitespace-pre-wrap"
      >
        <strong>{{ $t('process_' + key) }}:</strong> {{ process[key] || '—' }}
      </p>
      <p>{{ $t('process_gap_count', { count: process.gapCount }) }}</p>
      <p
        v-for="gap in process.gaps"
        :key="gap"
        class="text-amber-800"
      >
        {{ $t('process_gap_' + gap) }}
      </p>
      <section
        v-for="(path, pathIndex) in process.paths"
        :key="path.id"
        class="space-y-3 border-t border-gray-200 pt-3"
      >
        <h4 class="font-semibold">
          {{ path.name || $t('process_path_number', { index: pathIndex + 1 }) }} · {{ $t('process_' + path.kind) }}
        </h4>
        <p
          v-if="path.condition"
          class="whitespace-pre-wrap"
        >
          {{ $t('process_condition') }}: {{ path.condition }}
        </p>
        <p
          v-for="gap in path.gaps"
          :key="gap"
          class="text-amber-800"
        >
          {{ $t('process_gap_' + gap) }}
        </p>
        <ol class="space-y-3">
          <li
            v-for="(step, stepIndex) in path.steps"
            :key="step.id"
            class="space-y-2 rounded border border-gray-200 p-3"
          >
            <h5 class="font-semibold">
              {{ $t('process_step_number', { index: stepIndex + 1 }) }}: {{ step.name }}
            </h5>
            <p
              v-for="key in ['action', 'prerequisites', 'expectedState'] as const"
              :key="key"
              class="whitespace-pre-wrap"
            >
              <strong>{{ $t('process_step_' + key) }}:</strong> {{ step[key] || '—' }}
            </p>
            <p>{{ $t('process_role') }}: {{ step.role || process.role || '—' }}</p>
            <p>{{ $t('process_state_kind') }}: {{ $t('process_state_' + step.stateKind) }}</p>
            <p>{{ $t('process_sample') }}: {{ step.sampleName || step.url || '—' }}</p>
            <p v-if="step.sampleName">
              {{ step.url }}
            </p>
            <p>{{ $t('process_sample_state') }}: {{ step.sampleState || '—' }}</p>
            <p>{{ $t('process_reference') }}: {{ step.sampleId || '—' }} / {{ step.stateId || '—' }}</p>
            <p>{{ $t('process_status_' + step.status) }}</p>
            <p
              v-for="gap in step.gaps"
              :key="gap"
              class="text-amber-800"
            >
              {{ $t('process_gap_' + gap) }}
            </p>
          </li>
        </ol>
      </section>
    </section>
  </details>
</template>
