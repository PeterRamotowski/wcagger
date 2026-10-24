<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import type { DeepReadonly } from 'vue'
import type { Evaluation } from '~~/shared/types/evaluation'
import type { ManualAssessment } from '~~/shared/types/manualAssessment'
import type { GroupedReport } from '~~/shared/types/report'
import { ASSESSMENT_OUTCOMES, ASSESSMENT_METHODS, assessmentBasis, assessmentIsStale, criteriaForTarget, normalizeAssessments } from '~~/shared/utils/manualAssessments'
import { newRecordId } from '~~/shared/utils/evaluation'

const props = defineProps<{ evaluation: Evaluation, modelValue: ManualAssessment[], runIds: Record<string, string[]>, report?: DeepReadonly<GroupedReport> | null, busy: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: ManualAssessment[]], 'archive': [value: ManualAssessment], 'pending': [value: boolean] }>()
const sampleId = ref(props.evaluation.samples[0]?.id ?? '')
const criterionId = ref('')
const criteria = computed(() => criteriaForTarget(props.evaluation.targetStandard))
const selectedCriterion = computed(() => criteria.value.find(criterion => criterion.id === criterionId.value))
const selectedSample = computed(() => props.evaluation.samples.find(sample => sample.id === sampleId.value))
const existing = computed(() => props.modelValue.find(item => item.sampleId === sampleId.value && item.criterionId === criterionId.value))
const blank = (): ManualAssessment => ({ schemaVersion: 1, id: newRecordId(), sampleId: sampleId.value, stateId: selectedSample.value?.state.id ?? '', criterionId: criterionId.value, outcome: 'not-tested', reconciliation: '', justification: '', reviewer: '', reviewedAt: new Date().toISOString(), environment: '', methods: [], notes: '', supportingEvidence: '', observationIds: [], basis: assessmentBasis(props.evaluation, sampleId.value, props.runIds[sampleId.value] ?? []) })
const form = ref(blank())
const baseline = ref(JSON.stringify(form.value))
const pending = computed(() => JSON.stringify(form.value) !== baseline.value)
const error = ref<string | null>(null)
const stale = computed(() => existing.value && assessmentIsStale(existing.value, props.evaluation, props.runIds[sampleId.value] ?? []))
const links = computed(() => props.report?.findings.filter(finding => finding.criteria.includes(criterionId.value)).flatMap((finding) => {
  const observations = finding.occurrences.filter(occurrence => occurrence.sampleId === sampleId.value && occurrence.stateId === selectedSample.value?.state.id).flatMap(occurrence => occurrence.observations.filter(item => (props.runIds[sampleId.value] ?? []).includes(item.runId)).map(item => item.id))
  return observations.length ? [{ id: finding.id, title: finding.title, observations }] : []
}) ?? [])
watch([sampleId, criterionId], () => {
  form.value = existing.value ? JSON.parse(JSON.stringify(existing.value)) : blank()
  baseline.value = JSON.stringify(form.value)
  error.value = null
})
watch(criteria, (value) => {
  if (!value.some(item => item.id === criterionId.value)) criterionId.value = value[0]?.id ?? ''
}, { immediate: true })
watch(() => props.evaluation.samples.map(sample => sample.id), (ids) => {
  if (!ids.includes(sampleId.value)) sampleId.value = ids[0] ?? ''
})
watch(existing, (value) => {
  if (!pending.value) {
    form.value = value ? JSON.parse(JSON.stringify(value)) : blank()
    baseline.value = JSON.stringify(form.value)
  }
})
watch(pending, value => emit('pending', value), { immediate: true })
onBeforeUnmount(() => emit('pending', false))
const record = () => {
  error.value = null
  try {
    if (!selectedSample.value || !selectedCriterion.value) throw new Error('Choose a sample and an in-target criterion')
    const next = normalizeAssessments([{ ...form.value, stateId: selectedSample.value.state.id, reviewedAt: new Date().toISOString(), basis: assessmentBasis(props.evaluation, sampleId.value, props.runIds[sampleId.value] ?? []) }])[0]!
    if (existing.value) emit('archive', JSON.parse(JSON.stringify(existing.value)))
    emit('update:modelValue', [...props.modelValue.filter(item => item.sampleId !== sampleId.value || item.criterionId !== criterionId.value), next])
    form.value = next
    baseline.value = JSON.stringify(next)
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not record assessment' }
}
const cancel = () => {
  form.value = existing.value ? JSON.parse(JSON.stringify(existing.value)) : blank()
  baseline.value = JSON.stringify(form.value)
}
const toggleLink = (ids: string[], checked: boolean) => {
  form.value.observationIds = checked ? [...new Set([...form.value.observationIds, ...ids])] : form.value.observationIds.filter(id => !ids.includes(id))
}
</script>

<template>
  <section
    class="mt-6 min-w-0 rounded-xl border border-gray-200 bg-white p-4 md:p-6"
    data-assessment-editor
  >
    <h2 class="text-xl font-bold">
      {{ $t('manual_title') }}
    </h2>
    <p class="mt-2 text-sm text-gray-600">
      {{ $t('manual_help') }}
    </p>
    <p class="mt-2 text-sm text-gray-600">
      {{ $t('manual_draft_help') }}
    </p>
    <fieldset
      :disabled="busy"
      class="mt-4 min-w-0 space-y-4"
    >
      <label class="block text-sm font-medium">{{ $t('process_sample') }}<select
        v-model="sampleId"
        :disabled="pending"
        class="mt-1 block w-full min-w-0 rounded border border-gray-300 px-3 py-2"
      ><option
        v-for="sample in evaluation.samples"
        :key="sample.id"
        :value="sample.id"
      >{{ sample.name || sample.url || $t('planning_unnamed') }} · {{ sample.state.description }}</option></select></label>
      <label class="block text-sm font-medium">{{ $t('manual_criterion') }}<select
        v-model="criterionId"
        :disabled="pending"
        class="mt-1 block w-full min-w-0 rounded border border-gray-300 px-3 py-2"
      ><option
        v-for="criterion in criteria"
        :key="criterion.id"
        :value="criterion.id"
        lang="en"
      >{{ criterion.id }} {{ criterion.title }} ({{ criterion.level }})</option></select></label>
      <a
        v-if="selectedCriterion"
        :href="selectedCriterion.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-block text-sm text-blue-800 underline"
      >{{ $t('manual_criterion_source') }}</a>
      <p
        v-if="stale"
        role="status"
        class="rounded bg-amber-50 p-3 text-sm text-amber-900"
      >
        {{ $t('manual_stale') }}
      </p>
      <label class="block text-sm font-medium">{{ $t('manual_outcome') }}<select
        v-model="form.outcome"
        class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
      ><option
        v-for="outcome in ASSESSMENT_OUTCOMES"
        :key="outcome"
        :value="outcome"
      >{{ $t('manual_outcome_' + outcome) }}</option></select></label>
      <label
        v-for="key in ['reviewer', 'environment', 'justification', 'supportingEvidence', 'reconciliation', 'notes'] as const"
        :key="key"
        class="block text-sm font-medium"
      >{{ $t('manual_' + key) }}<textarea
        v-model="form[key]"
        :maxlength="key === 'reviewer' ? 200 : key === 'environment' ? 2000 : 5000"
        rows="2"
        class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
      /></label>
      <fieldset class="space-y-2">
        <legend class="text-sm font-medium">
          {{ $t('manual_methods') }}
        </legend><label
          v-for="method in ASSESSMENT_METHODS"
          :key="method"
          class="flex items-center gap-2 text-sm"
        ><input
          v-model="form.methods"
          type="checkbox"
          :value="method"
        >{{ $t('manual_method_' + method) }}</label>
      </fieldset>
      <fieldset class="space-y-2">
        <legend class="text-sm font-medium">
          {{ $t('manual_links') }}
        </legend><p class="text-sm text-gray-600">
          {{ $t('manual_links_help') }}
        </p><label
          v-for="finding in links"
          :key="finding.id"
          class="flex items-start gap-2 text-sm"
        ><input
          type="checkbox"
          :checked="finding.observations.every(id => form.observationIds.includes(id))"
          @change="toggleLink(finding.observations, ($event.target as HTMLInputElement).checked)"
        >{{ finding.title }}</label><p
          v-if="!links.length"
          class="text-sm"
        >
          {{ $t('manual_no_links') }}
        </p><p class="text-sm">
          {{ $t('manual_link_count', { count: form.observationIds.length }) }}
        </p><button
          type="button"
          class="rounded border px-3 py-2 text-sm"
          @click="form.observationIds = []"
        >
          {{ $t('manual_clear_links') }}
        </button>
      </fieldset>
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
          class="rounded bg-indigo-700 px-4 py-2 font-semibold text-white"
          @click="record"
        >
          {{ $t('manual_record') }}
        </button><button
          type="button"
          :disabled="!pending"
          class="rounded border px-4 py-2 text-sm disabled:opacity-50"
          @click="cancel"
        >
          {{ $t('manual_cancel') }}
        </button>
      </div>
      <p
        v-if="existing"
        class="text-sm"
      >
        {{ $t('manual_recorded_at') }}: {{ existing.reviewedAt }}
      </p>
    </fieldset>
  </section>
</template>
