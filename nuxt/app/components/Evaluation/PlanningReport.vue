<script setup lang="ts">
import type { GroupedReport } from '~~/shared/types/report'

defineProps<{ report: GroupedReport }>()
</script>

<template>
  <div
    v-if="report.evaluation && report.planning"
    class="space-y-4 [overflow-wrap:anywhere]"
  >
    <details
      v-if="report.evaluation.sampling?.candidates.some(candidate => candidate.inspection)"
      class="rounded border border-gray-200 p-3"
      data-report-inspections
    >
      <summary class="cursor-pointer font-medium">
        {{ $t('inspection_captured') }}
      </summary>
      <section
        v-for="candidate in report.evaluation.sampling.candidates.filter(candidate => candidate.inspection)"
        :key="candidate.id"
        class="mt-3 space-y-2 rounded border p-3 text-sm"
      >
        <p class="font-medium">
          {{ candidate.name || candidate.url }}
        </p>
        <p>{{ candidate.inspection!.method }} · {{ candidate.inspection!.inspectedAt }} · {{ candidate.inspection!.bytes }} bytes</p>
        <p>{{ candidate.inspection!.requestedUrl }} → {{ candidate.inspection!.finalUrl }}</p>
        <p>{{ $t('inspection_suggested') }}: {{ candidate.inspection!.suggestedTypes.join(', ') || '—' }}</p>
        <p>{{ $t('eval_types') }}: {{ candidate.typeTags?.join(', ') || '—' }}</p>
        <p class="text-gray-600">
          {{ $t('inspection_record_help') }}
        </p>
      </section>
    </details>
    <details class="rounded border border-gray-200 p-3">
      <summary class="cursor-pointer font-medium">
        {{ $t('planning_scope') }}
      </summary>
      <dl class="mt-3 space-y-3 text-sm">
        <div
          v-for="key in ['productName', 'productUrl', 'evaluator', 'commissioner', 'startDate', 'endDate', 'boundaries', 'supportBaseline'] as const"
          :key="key"
        >
          <dt class="font-medium">
            {{ $t('planning_' + key) }}
          </dt><dd class="whitespace-pre-wrap">
            {{ report.evaluation.scope[key] || '—' }}
          </dd>
        </div>
        <div>
          <dt class="font-medium">
            {{ $t('planning_languages') }}
          </dt><dd>{{ report.evaluation.scope.languages?.join(', ') || '—' }}</dd>
        </div>
      </dl>
    </details>
    <details class="rounded border border-gray-200 p-3">
      <summary class="cursor-pointer font-medium">
        {{ $t('planning_coverage_title') }}
      </summary>
      <p class="mt-3 text-sm text-gray-600">
        {{ $t('planning_inventory_help') }}
      </p>
      <p
        v-if="!report.planning.coverage.inventory.length"
        class="mt-3 text-sm text-amber-800"
      >
        {{ $t('planning_no_inventory') }}
      </p>
      <ul class="mt-3 space-y-3">
        <li
          v-for="entry in report.planning.coverage.inventory"
          :key="entry.id"
          class="rounded border border-gray-200 p-3 text-sm"
        >
          <p class="font-semibold">
            {{ entry.name }} · {{ $t('planning_kind_' + entry.kind) }}
          </p>
          <p>{{ entry.description }}</p>
          <p :class="entry.sampleIds.length ? 'text-gray-700' : 'text-amber-800'">
            {{ $t('planning_selected_links', { count: entry.sampleIds.length }) }} · {{ $t('planning_scanned_links', { count: entry.scannedSampleIds.length }) }}
          </p>
          <p v-if="!entry.sampleIds.length">
            {{ $t('planning_uncovered') }}
          </p>
        </li>
      </ul>
    </details>
    <details class="rounded border border-gray-200 p-3">
      <summary class="cursor-pointer font-medium">
        {{ $t('planning_sampling') }}
      </summary>
      <div class="mt-3 space-y-3 text-sm">
        <p>{{ $t('planning_random_counts', { structured: report.planning.coverage.structured, random: report.planning.coverage.countedRandom, required: report.planning.coverage.requiredRandom, missing: report.planning.coverage.missingRandom }) }}</p>
        <p>{{ $t('planning_random_help') }}</p>
        <p
          v-if="report.planning.coverage.missingRandom"
          class="text-amber-800"
        >
          {{ $t('planning_random_gap') }}
        </p>
        <p
          v-if="report.planning.coverage.excludedRandomIds.length"
          class="text-amber-800"
        >
          {{ $t('planning_invalid_random') }}
        </p>
        <p>{{ $t('planning_pool_coverage') }}: {{ $t('planning_coverage_' + (report.evaluation.sampling?.coverage || 'unknown')) }}</p>
        <p
          v-if="report.evaluation.sampling?.coverage !== 'whole-scope'"
          class="text-amber-800"
        >
          {{ $t('planning_incomplete_pool') }}
        </p>
        <p
          v-for="key in ['source', 'rationale', 'coverageNotes', 'exhaustionReason', 'comparisonNotes'] as const"
          :key="key"
          class="whitespace-pre-wrap"
        >
          <strong>{{ $t('planning_' + key) }}:</strong> {{ report.evaluation.sampling?.[key] || '—' }}
        </p>
        <div
          v-for="draw in report.evaluation.sampling?.draws"
          :key="draw.id"
          class="rounded border border-gray-200 p-3"
        >
          <p class="font-semibold">
            {{ $t('planning_draw_history') }} · {{ draw.timestamp }}
          </p>
          <p>{{ draw.source }} · {{ draw.method }}</p>
          <p>{{ $t('planning_pool_coverage') }}: {{ $t('planning_coverage_' + draw.coverage) }} · {{ draw.coverageNotes }}</p>
          <p>{{ $t('planning_draw_size', { selected: draw.selected.length, requested: draw.requestedCount, eligible: draw.eligibleCount }) }}</p>
          <p
            v-for="chosen in draw.selected"
            :key="chosen.sampleId"
          >
            {{ draw.pool.find(candidate => candidate.id === chosen.candidateId)?.url }}
          </p>
        </div>
      </div>
    </details>
    <details class="rounded border border-gray-200 p-3">
      <summary class="cursor-pointer font-medium">
        {{ $t('planning_compare') }}
      </summary>
      <p class="mt-3 text-sm text-gray-600">
        {{ $t('planning_compare_help') }}
      </p>
      <div
        v-if="report.planning.comparison.randomOnlyIssues.length || report.planning.comparison.randomOnlyContentTypes.length"
        class="mt-3 space-y-2 rounded bg-amber-50 p-3 text-sm"
      >
        <p class="font-semibold">
          {{ $t('planning_expand_hint') }}
        </p>
        <p>{{ $t('planning_new_types') }}: {{ report.planning.comparison.randomOnlyContentTypes.join(', ') || '—' }}</p>
        <p>{{ $t('planning_new_issues') }}: {{ report.planning.comparison.randomOnlyIssues.join(', ') || '—' }}</p>
      </div>
      <div class="mt-3 grid gap-4 md:grid-cols-2">
        <section
          v-for="kind in ['structured', 'random'] as const"
          :key="kind"
          class="min-w-0 rounded border border-gray-200 p-3"
        >
          <h3 class="font-semibold">
            {{ $t('planning_' + kind) }}
          </h3>
          <p
            v-if="!report.planning.comparison[kind].length"
            class="mt-2 text-sm"
          >
            {{ $t('planning_no_observed_findings') }}
          </p>
          <ul class="mt-2 space-y-3 text-sm">
            <li
              v-for="finding in report.planning.comparison[kind]"
              :key="finding.id"
            >
              <p class="font-medium">
                {{ finding.title }}
              </p><p>{{ finding.issueType }} · {{ $t('group_outcome_' + finding.outcome) }} · {{ $t('group_occurrences') }}: {{ finding.occurrenceIds.length }}</p>
            </li>
          </ul>
        </section>
      </div>
      <p class="mt-3 whitespace-pre-wrap text-sm">
        {{ $t('planning_comparisonNotes') }}: {{ report.evaluation.sampling?.comparisonNotes || '—' }}
      </p>
    </details>
  </div>
</template>
