<script setup lang="ts">
import { computed } from 'vue'
import type { DeepReadonly } from 'vue'
import type { AccessibilityCheckResults } from '~~/shared/types/accessibility'

const props = defineProps<{ results: DeepReadonly<AccessibilityCheckResults> }>()
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
    <p class="text-sm">
      {{ $t('eval_scan_coverage', { scanned: evaluation.scannedSampleIds.length, total: evaluation.samples.length }) }}
    </p>
    <p class="text-sm text-gray-600">
      {{ $t('eval_snapshot_help') }}
    </p>
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
          <p>{{ $t('eval_types') }}: {{ sample.typeTags.join(', ') || '—' }}</p>
          <p>{{ $t('eval_selection_reason') }}: {{ sample.selectionReason || '—' }}</p>
          <p>{{ $t('eval_state') }}: {{ sample.state.description }}</p>
          <p>{{ $t(evaluation.scannedSampleIds.includes(sample.id) ? 'eval_status_scanned' : sample.preparation === 'manual' ? 'eval_status_manual' : 'eval_status_unscanned') }}</p>
        </li>
      </ul>
    </details>
  </section>
</template>
