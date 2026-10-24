<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SamplingCandidate } from '~~/shared/types/evaluation'
import { newRecordId } from '~~/shared/utils/evaluation'
import { MAX_CANDIDATES } from '~~/shared/utils/sampling'
import { CandidateImportError, MAX_IMPORT_BYTES, parseCandidateImport, reviewCandidateImport } from '~~/app/utils/candidateImport'
import type { CandidateImportFormat, CandidateImportRow } from '~~/app/utils/candidateImport'

const props = defineProps<{ candidates: SamplingCandidate[], source: string, busy: boolean }>()
const emit = defineEmits<{ import: [value: { candidates: SamplingCandidate[], source: string }] }>()
const format = ref<CandidateImportFormat>('sitemap')
const input = ref('')
const importSource = ref('')
const rows = ref<CandidateImportRow[]>([])
const error = ref('')
const reading = ref(false)
const confirmed = ref(false)
const imported = ref(0)
const review = computed(() => reviewCandidateImport(rows.value, props.candidates))
const accepted = computed(() => review.value.filter(row => row.status === 'ready'))
const remaining = computed(() => MAX_CANDIDATES - props.candidates.length)
const canImport = computed(() => !props.busy && !reading.value && confirmed.value && importSource.value.trim().length > 0 && importSource.value.trim().length <= 2000 && accepted.value.length > 0 && accepted.value.length <= remaining.value)
watch([rows, importSource, () => props.candidates], () => {
  confirmed.value = false
}, { deep: true })
watch([input, format], () => {
  rows.value = []
  error.value = ''
  imported.value = 0
}, { flush: 'sync' })
function preview() {
  error.value = ''
  imported.value = 0
  rows.value = []
  try {
    rows.value = parseCandidateImport(input.value, format.value)
    if (!importSource.value.trim()) importSource.value = props.source
  } catch (failure) {
    error.value = failure instanceof CandidateImportError ? failure.code : 'format'
  }
}
async function readFile(event: Event) {
  const control = event.target as HTMLInputElement
  const file = control.files?.[0]
  if (!file) return
  rows.value = []
  input.value = ''
  imported.value = 0
  error.value = ''
  reading.value = true
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new CandidateImportError('size')
    input.value = await file.text()
    importSource.value = props.source || file.name.slice(0, 2000)
  } catch (failure) {
    error.value = failure instanceof CandidateImportError ? failure.code : 'read'
  } finally {
    reading.value = false
    control.value = ''
  }
}
function add() {
  if (!canImport.value) return
  const candidates: SamplingCandidate[] = accepted.value.map(row => ({
    id: newRecordId(), url: row.url.trim(), name: row.name.trim(), stateDescription: row.stateDescription.trim(), preparation: row.preparation as SamplingCandidate['preparation'],
  }))
  emit('import', { candidates, source: importSource.value.trim() })
  rows.value = []
  input.value = ''
  confirmed.value = false
  imported.value = candidates.length
}
</script>

<template>
  <details
    class="rounded border border-gray-200 p-3"
    data-candidate-import
  >
    <summary class="cursor-pointer font-medium">
      {{ $t('discovery_import_title') }}
    </summary>
    <fieldset
      :disabled="busy || reading"
      class="mt-3 min-w-0 space-y-3 disabled:opacity-60"
    >
      <p class="text-sm text-gray-600">
        {{ $t('discovery_import_help') }}
      </p>
      <label class="block text-sm font-medium">{{ $t('discovery_format') }}<select
        v-model="format"
        class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
      >
        <option value="sitemap">{{ $t('discovery_sitemap') }}</option>
        <option value="csv">{{ $t('discovery_csv') }}</option>
        <option value="json">{{ $t('discovery_json') }}</option>
      </select></label>
      <p class="text-sm text-gray-600">
        {{ $t('discovery_format_help_' + format) }}
      </p>
      <label class="block text-sm font-medium">{{ $t('discovery_file') }}<input
        type="file"
        accept=".xml,.csv,.json,text/xml,application/xml,text/csv,application/json"
        class="mt-1 block w-full text-sm"
        @change="readFile"
      ></label>
      <label class="block text-sm font-medium">{{ $t('discovery_paste') }}<textarea
        v-model="input"
        rows="5"
        class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
      /></label>
      <button
        type="button"
        :disabled="!input.trim()"
        class="rounded border border-gray-400 px-3 py-2 text-sm disabled:opacity-50"
        @click="preview"
      >
        {{ $t('discovery_preview') }}
      </button>
      <p
        v-if="error"
        role="alert"
        class="text-sm text-red-800"
      >
        {{ $t('discovery_error_' + error.replaceAll('-', '_')) }}
      </p>
      <template v-if="rows.length">
        <p
          role="status"
          class="text-sm"
          data-import-counts
        >
          {{ $t('discovery_counts', { ready: accepted.length, invalid: review.filter(row => row.status === 'invalid').length, duplicate: review.filter(row => row.status === 'duplicate').length, excluded: review.filter(row => row.status === 'excluded').length }) }}
        </p>
        <p class="text-sm text-gray-600">
          {{ $t('discovery_preview_help') }}
        </p>
        <div class="max-h-96 space-y-2 overflow-y-auto rounded border p-2">
          <details
            v-for="(row, index) in rows"
            :key="index"
            class="rounded border p-3"
            data-import-row
          >
            <summary class="cursor-pointer break-all text-sm">
              {{ index + 1 }}. {{ row.name || row.url || '—' }} · {{ $t('discovery_status_' + review[index]!.status) }}
            </summary>
            <div class="mt-3 space-y-3">
              <label class="flex items-center gap-2 text-sm"><input
                v-model="row.selected"
                type="checkbox"
              >{{ $t('discovery_include') }}</label>
              <label
                v-for="key in ['url', 'name', 'stateDescription'] as const"
                :key="key"
                class="block text-sm font-medium"
              >{{ $t('planning_candidate_' + key) }}<input
                v-model="row[key]"
                :maxlength="key === 'url' ? 4000 : key === 'name' ? 200 : 2000"
                class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              ></label>
              <label class="block text-sm font-medium">{{ $t('eval_preparation') }}<select
                v-model="row.preparation"
                class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              ><option value="initial-page">{{ $t('eval_initial') }}</option><option value="manual">{{ $t('eval_manual') }}</option></select></label>
            </div>
          </details>
        </div>
        <label class="block text-sm font-medium">{{ $t('planning_source') }}<textarea
          v-model="importSource"
          rows="2"
          maxlength="2000"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        /></label>
        <p class="text-sm text-gray-600">
          {{ $t('discovery_source_help') }}
        </p>
        <p
          v-if="accepted.length > remaining"
          role="alert"
          class="text-sm text-red-800"
        >
          {{ $t('discovery_capacity', { remaining }) }}
        </p>
        <label class="flex items-start gap-2 text-sm"><input
          v-model="confirmed"
          type="checkbox"
          class="mt-1"
          data-import-confirm
        >{{ $t('discovery_confirm') }}</label>
        <button
          type="button"
          :disabled="!canImport"
          class="rounded bg-indigo-700 px-4 py-2 text-sm text-white disabled:opacity-50"
          data-import-apply
          @click="add"
        >
          {{ $t('discovery_apply', { count: accepted.length }) }}
        </button>
      </template>
    </fieldset>
    <p
      v-if="reading"
      role="status"
      class="mt-3 text-sm"
    >
      {{ $t('discovery_reading') }}
    </p>
    <p
      v-if="imported"
      role="status"
      class="mt-3 text-sm"
    >
      {{ $t('discovery_imported', { count: imported }) }}
    </p>
  </details>
</template>
