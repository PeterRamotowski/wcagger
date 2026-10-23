<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DeepReadonly } from 'vue'
import type { AccessibilityCheckResults } from '~~/shared/types/accessibility'
import type { FindingGroupingDecision } from '~~/shared/types/scanEvidence'
import type { ReportReview } from '~~/shared/types/report'
import { buildGroupedReport, filterReportFindings } from '~~/shared/utils/reportPresentation'

const props = defineProps<{ results: DeepReadonly<AccessibilityCheckResults>, busy: boolean, error?: string | null }>()
const emit = defineEmits<{ decision: [value: FindingGroupingDecision] }>()
const report = computed(() => buildGroupedReport(props.results))
const view = ref('findings')
const outcome = ref('')
const source = ref('')
const criterion = ref('')
const issueType = ref('')
const selected = ref<string[]>([])
const reviewer = ref('')
const reason = ref('')
const findings = computed(() => filterReportFindings(report.value.findings, { outcome: outcome.value, source: source.value, criterion: criterion.value, issueType: issueType.value }))
const issueTypes = computed(() => [...new Set(report.value.findings.map(item => item.issueType))].sort())
const sources = computed(() => [...new Set(report.value.findings.flatMap(item => item.sources))].sort())
const criteria = computed(() => [...new Set(report.value.findings.flatMap(item => item.criteria))].sort())
const selectedFindings = computed(() => report.value.findings.filter(item => selected.value.includes(item.id)))
const selectedOccurrences = computed(() => selectedFindings.value.flatMap(item => item.occurrences.map(member => member.id)))
const canCombine = computed(() => selectedFindings.value.length > 1 && new Set(selectedFindings.value.map(item => item.issueType)).size === 1 && new Set(selectedFindings.value.map(item => item.outcome)).size === 1)
const ready = computed(() => reviewer.value.trim() && reason.value.trim() && !props.busy)
const pending = computed(() => report.value.reviews.filter(item => !item.resolved))
const groups = computed(() => (view.value === 'elements' ? report.value.elements : report.value.pages).map(group => ({ ...group, findings: findings.value.filter(item => group.findingIds.includes(item.id)) })).filter(group => group.findings.length))
const choose = (id: string, checked: boolean) => {
  selected.value = checked ? [...new Set([...selected.value, id])] : selected.value.filter(item => item !== id)
}
const submit = (action: FindingGroupingDecision['action'], ids = selectedOccurrences.value) => {
  if (!ready.value || !ids.length) return
  emit('decision', { id: globalThis.crypto?.randomUUID?.() ?? 'review-' + Date.now() + '-' + Math.random().toString(36).slice(2), action, occurrenceIds: [...new Set(ids)], reviewer: reviewer.value.trim(), reason: reason.value.trim(), timestamp: new Date().toISOString() })
}
const review = (item: ReportReview, action: FindingGroupingDecision['action']) => submit(action, item.occurrenceIds)
watch(() => props.results.evidence.grouping, () => {
  selected.value = []
  reason.value = ''
})
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <label class="text-sm font-medium">{{ $t('group_view') }}<select
        v-model="view"
        class="mt-1 block w-full rounded border-gray-300"
      ><option value="findings">{{ $t('group_by_problem') }}</option><option value="elements">{{ $t('group_by_element') }}</option><option value="pages">{{ $t('group_by_page') }}</option></select></label>
      <label class="text-sm font-medium">{{ $t('group_outcome') }}<select
        v-model="outcome"
        class="mt-1 block w-full rounded border-gray-300"
      ><option value="">{{ $t('group_all') }}</option><option
        v-for="value in ['violation', 'incomplete', 'warning', 'notice', 'unknown']"
        :key="value"
        :value="value"
      >{{ $t('group_outcome_' + value) }}</option></select></label>
      <label class="text-sm font-medium">{{ $t('group_source') }}<select
        v-model="source"
        class="mt-1 block w-full rounded border-gray-300"
      ><option value="">{{ $t('group_all') }}</option><option
        v-for="value in sources"
        :key="value"
      >{{ value }}</option></select></label>
      <label class="text-sm font-medium">{{ $t('group_criterion') }}<select
        v-model="criterion"
        class="mt-1 block w-full rounded border-gray-300"
      ><option value="">{{ $t('group_all') }}</option><option
        v-for="value in criteria"
        :key="value"
      >{{ value }}</option></select></label>
      <label class="text-sm font-medium">{{ $t('group_issue_type') }}<select
        v-model="issueType"
        class="mt-1 block w-full rounded border-gray-300"
      ><option value="">{{ $t('group_all') }}</option><option
        v-for="value in issueTypes"
        :key="value"
      >{{ value }}</option></select></label>
    </div>
    <p
      class="text-sm text-gray-600"
      aria-live="polite"
    >
      {{ $t('group_showing', { shown: findings.length, total: report.findings.length }) }}. {{ $t('group_exports_all') }}
    </p>
    <details
      v-if="report.findings.length"
      class="rounded-lg border border-gray-200 bg-slate-50 p-4"
      :open="selected.length > 0 || undefined"
    >
      <summary class="cursor-pointer font-semibold">
        {{ $t('group_review_grouping') }} ({{ pending.length }})
      </summary>
      <p class="mt-3 text-sm text-gray-700">
        {{ $t('group_review_help') }}
      </p>
      <fieldset
        :disabled="busy"
        class="mt-3 space-y-3"
      >
        <label class="block text-sm font-medium">{{ $t('group_reviewer') }}<input
          v-model="reviewer"
          type="text"
          class="mt-1 block w-full rounded border-gray-300"
          maxlength="200"
        ></label>
        <label class="block text-sm font-medium">{{ $t('group_reason') }}<textarea
          v-model="reason"
          class="mt-1 block w-full rounded border-gray-300"
          rows="2"
          maxlength="2000"
        /></label>
        <p class="text-sm">
          {{ $t('group_selected', { count: selected.length }) }}
        </p>
        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            :disabled="!ready || !canCombine"
            class="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50"
            @click="submit('combine')"
          >
            {{ $t('group_combine_selected') }}
          </button>
          <button
            type="button"
            :disabled="!ready || !selectedOccurrences.length"
            class="rounded border border-gray-400 px-3 py-2 text-sm disabled:opacity-50"
            @click="submit('separate')"
          >
            {{ $t('group_separate_selected') }}
          </button>
        </div>
        <p class="text-xs text-gray-600">
          {{ $t('group_combine_help') }}
        </p>
        <div
          v-for="item in pending"
          :key="item.id"
          class="space-y-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm"
        >
          <p class="font-medium">
            {{ $t('group_review_' + item.reason.replaceAll('-', '_')) }}
          </p>
          <p
            v-for="observation in item.observations"
            :key="observation.id"
          >
            {{ observation.source }} · {{ observation.ruleId }} · {{ $t('group_outcome_' + observation.outcome) }}<code class="ml-2 break-all">{{ observation.selector }}</code>
          </p>
          <div class="flex flex-wrap gap-3">
            <button
              v-if="item.canCombine"
              type="button"
              :disabled="!ready"
              class="rounded border border-gray-400 bg-white px-3 py-2 disabled:opacity-50"
              @click="review(item, 'combine')"
            >
              {{ $t('group_confirm_same_problem') }}
            </button>
            <button
              type="button"
              :disabled="!ready || !item.occurrenceIds.length"
              class="rounded border border-gray-400 bg-white px-3 py-2 disabled:opacity-50"
              @click="review(item, 'separate')"
            >
              {{ $t('group_keep_separate') }}
            </button>
          </div>
        </div>
      </fieldset>
      <p
        v-if="error"
        role="alert"
        class="mt-3 text-sm text-red-800"
      >
        {{ error }}
      </p>
      <p
        v-if="busy"
        role="status"
        class="mt-3 text-sm"
      >
        {{ $t('group_updating') }}
      </p>
    </details>
    <div
      v-if="view === 'findings'"
      class="space-y-4"
    >
      <ReportGroupedFindingCard
        v-for="finding in findings"
        :key="finding.id"
        :finding="finding"
        :evidence="results.evidence"
        :selected="selected.includes(finding.id)"
        @select="choose"
      />
    </div>
    <div
      v-else
      class="space-y-6"
    >
      <section
        v-for="group in groups"
        :key="group.id"
        class="space-y-3"
      >
        <h4 class="break-all font-semibold text-gray-800">
          {{ group.label || $t('group_unresolved_elements') }}
        </h4>
        <ReportGroupedFindingCard
          v-for="finding in group.findings"
          :key="finding.id"
          :finding="finding"
          :evidence="results.evidence"
          :selected="selected.includes(finding.id)"
          :occurrence-ids="group.occurrenceIds"
          @select="choose"
        />
      </section>
    </div>
    <p
      v-if="!findings.length"
      class="rounded bg-gray-50 p-4 text-sm"
    >
      {{ $t(report.findings.length ? 'group_no_matches' : 'group_no_findings') }}
    </p>
    <details class="rounded border border-gray-200 p-4">
      <summary class="cursor-pointer font-medium">
        {{ $t('group_scan_details') }}
      </summary>
      <p class="mt-2 text-sm">
        {{ $t('group_automated_passes') }}: {{ report.automatedChecks.passedObservations }} · {{ $t('group_inapplicable') }}: {{ report.automatedChecks.inapplicableObservations }}
      </p>
      <p class="mt-2 text-sm text-gray-600">
        {{ $t('group_not_conformance') }}
      </p>
      <div
        v-for="run in report.runs"
        :key="run.id"
        class="mt-3 rounded bg-gray-50 p-3 text-sm"
      >
        <p>{{ run.tool }} / {{ run.engine }} {{ run.engineVersion || '' }} · {{ run.standard }}</p><p>{{ run.startedAt }} - {{ run.completedAt }}</p><pre class="mt-2 whitespace-pre-wrap break-all text-xs">{{ JSON.stringify(run.configuration, null, 2) }}</pre>
      </div>
    </details>
    <details
      v-if="report.decisions.length"
      class="rounded border border-gray-200 p-4"
    >
      <summary class="cursor-pointer font-medium">
        {{ $t('group_decision_history') }} ({{ report.decisions.length }})
      </summary>
      <p
        v-for="decision in report.decisions"
        :key="decision.id"
        class="mt-2 break-words text-sm"
      >
        {{ decision.reviewer }} · {{ decision.timestamp }} · {{ $t('group_action_' + decision.action) }}: {{ decision.reason }}
      </p>
    </details>
  </div>
</template>
