<script setup lang="ts">
import { computed } from 'vue'
import type { DeepReadonly } from 'vue'
import type { AccessibilityCheckResults } from '~~/shared/types/accessibility'
import { buildGroupedReport } from '~~/shared/utils/reportPresentation'

const props = defineProps<{ results: DeepReadonly<AccessibilityCheckResults> }>()
const report = computed(() => props.results.evidence.grouping ? buildGroupedReport(props.results) : undefined)
const cards = computed(() => report.value
  ? [
      ['group_unique_findings', report.value.summary.uniqueFindings],
      ['group_occurrences', report.value.summary.observedOccurrences],
      ['group_identified_elements', report.value.summary.affectedElements],
      ['group_sampled_pages', report.value.summary.affectedSamples],
    ]
  : [['violations_found', props.results.summary.totalViolations], ['warnings', props.results.summary.totalWarnings], ['passed_tests', props.results.summary.totalPassed]])
</script>

<template>
  <div class="mb-8">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div
        v-for="[label, count] in cards"
        :key="label"
        class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <p class="text-2xl font-bold text-gray-900">
          {{ count }}
        </p><p class="mt-1 text-sm text-gray-600">
          {{ $t(String(label)) }}
        </p>
      </div>
    </div>
    <p
      v-if="report"
      class="mt-3 text-sm text-gray-600"
    >
      {{ $t('group_raw_observations') }}: {{ report.summary.rawObservations }} · {{ $t('group_unresolved_occurrences') }}: {{ report.summary.unresolvedElementOccurrences }}. {{ $t('group_not_conformance') }}
    </p>
  </div>
</template>
