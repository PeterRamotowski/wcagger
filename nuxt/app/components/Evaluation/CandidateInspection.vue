<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SamplingCandidate } from '~~/shared/types/evaluation'
import type { CandidateInspection } from '~~/shared/types/candidateInspection'
import { INSPECTION_BYTES, INSPECTION_DURATIONS } from '~~/shared/types/candidateInspection'
import { normalizeCandidateInspection, normalizeCandidateTypes } from '~~/shared/utils/candidateInspection'
import { parseTypeTags } from '~~/shared/utils/evaluation'

const props = defineProps<{ candidates: SamplingCandidate[], busy: boolean }>()
const emit = defineEmits<{ apply: [value: { id: string, name: string, typeTags: string[], inspection: CandidateInspection }] }>()
const selected = ref('')
const durationMs = ref(10000)
const byteLimit = ref(262144)
const running = ref(false)
const result = ref<CandidateInspection | null>(null)
const name = ref('')
const types = ref('')
const confirmed = ref(false)
const error = ref('')
const applied = ref(false)
const candidate = computed(() => props.candidates.find(row => row.id === selected.value))
const context = computed(() => JSON.stringify(candidate.value ?? null))
const validTypes = computed(() => {
  try {
    return normalizeCandidateTypes(parseTypeTags(types.value))
  } catch {
    return null
  }
})
watch(context, () => {
  result.value = null
  confirmed.value = false
  error.value = ''
})
watch(selected, () => {
  applied.value = false
})
watch([name, types], () => {
  confirmed.value = false
})
async function inspect() {
  if (!candidate.value || candidate.value.preparation !== 'initial-page' || running.value || props.busy) return
  const basis = context.value
  running.value = true
  error.value = ''
  result.value = null
  applied.value = false
  try {
    const response = normalizeCandidateInspection(await $fetch('/api/candidate-inspection', { method: 'POST', body: { url: candidate.value.url, durationMs: durationMs.value, byteLimit: byteLimit.value } }))
    if (context.value !== basis) return
    if (response.requestedUrl !== new URL(candidate.value!.url).href) throw new Error('Inspection response does not match the candidate URL')
    result.value = response
    name.value = candidate.value?.name || response.title
    types.value = [...new Set([...(candidate.value?.typeTags ?? []), ...response.suggestedTypes])].join(', ')
  } catch (failure) {
    if (context.value !== basis) return
    const cause = failure as { data?: { statusMessage?: string }, message?: string }
    error.value = cause.data?.statusMessage ?? cause.message ?? 'Inspection failed'
  } finally { running.value = false }
}
function apply() {
  if (!candidate.value || !result.value || !confirmed.value || !validTypes.value || name.value.length > 200 || props.busy || running.value) return
  emit('apply', { id: candidate.value.id, name: name.value.trim(), typeTags: validTypes.value, inspection: result.value })
  result.value = null
  confirmed.value = false
  applied.value = true
}
</script>

<template>
  <details
    class="rounded border border-gray-200 p-3"
    data-candidate-inspection
  >
    <summary class="cursor-pointer font-medium">
      {{ $t('inspection_title') }}
    </summary>
    <fieldset
      :disabled="busy || running"
      class="mt-3 min-w-0 space-y-3"
    >
      <p class="text-sm text-gray-600">
        {{ $t('inspection_help') }}
      </p>
      <label class="block text-sm font-medium">{{ $t('inspection_candidate') }}<select
        v-model="selected"
        class="mt-1 block w-full min-w-0 rounded border px-3 py-2"
      >
        <option value="">{{ $t('inspection_choose') }}</option>
        <option
          v-for="row in candidates"
          :key="row.id"
          :value="row.id"
        >{{ row.name || row.url }}</option>
      </select></label>
      <p
        v-if="candidate"
        class="break-all text-sm"
      >
        {{ candidate.url }}
      </p>
      <label class="block text-sm font-medium">{{ $t('inspection_duration') }}<select
        v-model.number="durationMs"
        class="mt-1 block w-full rounded border px-3 py-2"
      ><option
        v-for="limit in INSPECTION_DURATIONS"
        :key="limit"
        :value="limit"
      >{{ limit / 1000 }} s</option></select></label>
      <label class="block text-sm font-medium">{{ $t('inspection_bytes') }}<select
        v-model.number="byteLimit"
        class="mt-1 block w-full rounded border px-3 py-2"
      ><option
        v-for="limit in INSPECTION_BYTES"
        :key="limit"
        :value="limit"
      >{{ limit / 1024 }} KiB</option></select></label>
      <p class="text-sm text-gray-600">
        {{ $t('inspection_bounds') }}
      </p>
      <p
        v-if="candidate?.preparation === 'manual'"
        class="text-sm text-amber-800"
      >
        {{ $t('inspection_manual') }}
      </p>
      <button
        type="button"
        :disabled="!candidate || candidate.preparation !== 'initial-page'"
        class="rounded border px-3 py-2 text-sm disabled:opacity-50"
        data-inspection-run
        @click="inspect"
      >
        {{ $t('inspection_run') }}
      </button>
      <p
        v-if="error"
        role="alert"
        class="break-words text-sm text-red-800"
      >
        {{ error }}
      </p>
      <div
        v-if="result"
        class="space-y-3 rounded border p-3"
        data-inspection-preview
      >
        <p class="break-all text-sm">
          {{ $t('inspection_captured') }}: {{ result.inspectedAt }} · {{ result.finalUrl }} · {{ result.bytes }} bytes
        </p>
        <p class="text-sm">
          {{ $t('inspection_suggested') }}: {{ result.suggestedTypes.join(', ') || $t('inspection_none') }}
        </p>
        <label class="block text-sm font-medium">{{ $t('planning_candidate_name') }}<input
          v-model="name"
          maxlength="200"
          class="mt-1 block w-full rounded border px-3 py-2"
        ></label>
        <label class="block text-sm font-medium">{{ $t('eval_types') }}<input
          v-model="types"
          maxlength="2100"
          class="mt-1 block w-full rounded border px-3 py-2"
        ></label>
        <p class="text-sm text-gray-600">
          {{ $t('inspection_review_help') }}
        </p>
        <label class="flex items-start gap-2 text-sm"><input
          v-model="confirmed"
          type="checkbox"
          class="mt-1"
          data-inspection-confirm
        >{{ $t('inspection_confirm') }}</label>
        <button
          type="button"
          :disabled="!confirmed || !validTypes || name.length > 200"
          class="rounded bg-indigo-700 px-4 py-2 text-sm text-white disabled:opacity-50"
          data-inspection-apply
          @click="apply"
        >
          {{ $t('inspection_apply') }}
        </button>
      </div>
    </fieldset>
    <p
      v-if="running"
      role="status"
      class="mt-3 text-sm"
    >
      {{ $t('inspection_running') }}
    </p>
    <p
      v-if="applied"
      role="status"
      class="mt-3 text-sm"
    >
      {{ $t('inspection_applied') }}
    </p>
  </details>
</template>
