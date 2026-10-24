<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import type { GroupedReport } from '~~/shared/types/report'
import type { ReportingNotes, WorkflowStageKey } from '~~/shared/types/evaluationReport'
import { WORKFLOW_STAGES, normalizeReportingNotes } from '~~/shared/utils/reportingNotes'
import { buildEvaluationReview, workflowReviewBasis } from '~~/shared/utils/evaluationReporting'

const props = defineProps<{ modelValue: ReportingNotes, report: GroupedReport | null, ready: boolean, busy: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: ReportingNotes], 'pending': [value: boolean] }>()
const stage = ref<WorkflowStageKey>('scope')
const review = computed(() => props.modelValue.reviews.find(item => item.stage === stage.value))
const form = ref({ reviewer: review.value?.reviewer ?? '', notes: review.value?.notes ?? '' })
const baseline = ref(JSON.stringify(form.value))
const pending = computed(() => JSON.stringify(form.value) !== baseline.value)
const projection = computed(() => props.report ? buildEvaluationReview(props.report, props.modelValue) : null)
const error = ref<string | null>(null)
const load = () => {
  form.value = { reviewer: review.value?.reviewer ?? '', notes: review.value?.notes ?? '' }
  baseline.value = JSON.stringify(form.value)
  error.value = null
}
watch(stage, load)
watch(review, () => {
  if (!pending.value) load()
})
watch(pending, value => emit('pending', value), { immediate: true })
onBeforeUnmount(() => emit('pending', false))
const update = (key: keyof Omit<ReportingNotes, 'schemaVersion' | 'reviews'>, event: Event) => emit('update:modelValue', { ...props.modelValue, [key]: (event.target as HTMLTextAreaElement).value })
const record = () => {
  error.value = null
  try {
    if (!props.ready || !props.report) throw new Error('Build a current evaluation report before recording a workflow review')
    const next = normalizeReportingNotes({ ...props.modelValue, reviews: [...props.modelValue.reviews.filter(item => item.stage !== stage.value), { stage: stage.value, reviewer: form.value.reviewer, notes: form.value.notes, reviewedAt: new Date().toISOString(), basis: workflowReviewBasis(stage.value, props.report, props.modelValue) }] })
    emit('update:modelValue', next)
    baseline.value = JSON.stringify(form.value)
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not record workflow review' }
}
</script>

<template>
  <section
    class="mt-6 min-w-0 space-y-3 rounded-xl border border-gray-200 bg-white p-4 md:p-6"
    data-reporting-editor
  >
    <h2 class="text-xl font-bold">
      {{ $t('wf_editor_title') }}
    </h2>
    <p class="text-sm text-gray-600">
      {{ $t('wf_editor_help') }}
    </p>
    <fieldset
      :disabled="busy"
      class="min-w-0 space-y-4"
    >
      <label
        v-for="key in ['additionalRequirements', 'explorationNotes', 'processNotes', 'conformanceNotes', 'conclusion', 'limitations'] as const"
        :key="key"
        class="block text-sm font-medium"
      >{{ $t('wf_note_' + key) }}<textarea
        :value="modelValue[key]"
        maxlength="5000"
        rows="3"
        class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        @input="update(key, $event)"
      /></label>
      <label class="block text-sm font-medium">{{ $t('wf_stage_label') }}<select
        v-model="stage"
        :disabled="pending"
        class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
      ><option
        v-for="key in WORKFLOW_STAGES"
        :key="key"
        :value="key"
      >{{ $t('wf_stage_' + key) }}</option></select></label>
      <p class="text-sm">
        {{ $t('wf_guidance_' + stage) }}
      </p>
      <p
        v-if="projection"
        class="text-sm"
        role="status"
      >
        {{ $t('wf_status_' + projection.stages.find(item => item.key === stage)!.status) }} · {{ $t('wf_gap_count', { count: projection.stages.find(item => item.key === stage)!.unresolvedIds.length }) }}
      </p>
      <label class="block text-sm font-medium">{{ $t('manual_reviewer') }}<input
        v-model="form.reviewer"
        maxlength="200"
        class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
      ></label>
      <label class="block text-sm font-medium">{{ $t('wf_review_notes') }}<textarea
        v-model="form.notes"
        maxlength="5000"
        rows="3"
        class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
      /></label>
      <p
        v-if="!ready"
        class="text-sm text-amber-800"
      >
        {{ $t('wf_build_first') }}
      </p>
      <p
        v-if="error"
        role="alert"
        class="text-sm text-red-800"
      >
        {{ error }}
      </p>
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          :disabled="!ready"
          class="rounded bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
          @click="record"
        >
          {{ $t('wf_record') }}
        </button><button
          type="button"
          :disabled="!pending"
          class="rounded border px-4 py-2 text-sm disabled:opacity-50"
          @click="load"
        >
          {{ $t('wf_cancel') }}
        </button>
      </div>
      <p
        v-if="review"
        class="text-sm"
      >
        {{ $t('manual_recorded_at') }}: {{ review.reviewedAt }}
      </p>
    </fieldset>
  </section>
</template>
