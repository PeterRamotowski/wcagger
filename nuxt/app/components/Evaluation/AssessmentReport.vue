<script setup lang="ts">
import type { GroupedReport } from '~~/shared/types/report'
import { ASSESSMENT_OUTCOMES } from '~~/shared/utils/manualAssessments'

defineProps<{ report: GroupedReport }>()
</script>

<template>
  <details
    v-if="report.manual"
    class="mt-4 min-w-0 rounded border border-gray-200 p-3 [overflow-wrap:anywhere]"
    data-assessment-report
  >
    <summary class="cursor-pointer font-medium">
      {{ $t('manual_title') }}
    </summary>
    <p class="mt-3 text-sm text-gray-600">
      {{ $t('manual_report_help') }}
    </p>
    <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
      <div
        v-for="outcome in ASSESSMENT_OUTCOMES"
        :key="outcome"
      >
        <dt class="font-medium">
          {{ $t('manual_outcome_' + outcome) }}
        </dt><dd>{{ report.manual.counts[outcome] }}</dd>
      </div>
    </dl>
    <p class="mt-3 text-sm">
      {{ $t('manual_stale_count', { count: report.manual.stale }) }}
    </p>
    <article
      v-for="assessment in report.manual.records"
      :key="assessment.id"
      class="mt-3 space-y-2 rounded border border-gray-200 p-3 text-sm"
    >
      <h3 class="font-semibold">
        {{ report.evaluation?.samples.find(sample => sample.id === assessment.sampleId)?.name || assessment.sampleId }} · {{ assessment.criterionId }}
      </h3>
      <p>{{ $t('manual_outcome') }}: {{ $t('manual_outcome_' + assessment.outcome) }}</p>
      <p
        v-if="assessment.stale || !assessment.inTarget"
        class="text-amber-800"
      >
        {{ $t('manual_stale') }}
      </p>
      <p
        v-for="key in ['reviewer', 'reviewedAt', 'environment', 'justification', 'supportingEvidence', 'reconciliation', 'notes'] as const"
        :key="key"
        class="whitespace-pre-wrap"
      >
        <strong>{{ $t('manual_' + key) }}:</strong> {{ assessment[key] || '—' }}
      </p>
      <p>{{ $t('manual_methods') }}: {{ assessment.methods.map(method => $t('manual_method_' + method)).join(', ') || '—' }}</p>
      <p>{{ $t('manual_evidence_ids') }}: {{ assessment.observationIds.join(', ') || '—' }}</p>
      <p>{{ $t('process_reference') }}: {{ assessment.sampleId }} / {{ assessment.stateId }}</p>
    </article>
  </details>
</template>
