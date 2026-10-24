<script setup lang="ts">
import { ref } from 'vue'
import type { SavedEvaluationSummary } from '~~/shared/types/savedEvaluation'
import { MAX_WORKSPACE_BYTES } from '~~/shared/utils/savedEvaluation'

defineProps<{ entries: SavedEvaluationSummary[], busy: boolean, dirty: boolean, error: string | null, status: string, pending: boolean, history: { scans: number, reports: number, assessments: number } }>()
const emit = defineEmits<{ refresh: [], save: [], open: [id: string], remove: [id: string], backup: [], import: [text: string], discard: [] }>()
const fileError = ref(false)
const readFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileError.value = false
  try {
    if (file.size > MAX_WORKSPACE_BYTES) throw new Error('File is too large')
    emit('import', await file.text())
  } catch {
    fileError.value = true
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <section
    class="mb-6 min-w-0 space-y-3 rounded-xl border border-gray-200 bg-white p-4 md:p-6"
    data-saved-progress
  >
    <h2 class="text-xl font-bold">
      {{ $t('saved_title') }}
    </h2>
    <p class="text-sm text-gray-600">
      {{ $t('saved_storage_help') }}
    </p>
    <p class="text-sm text-gray-600">
      {{ $t('saved_private_help') }}
    </p>
    <p
      class="text-sm"
      role="status"
    >
      {{ $t(dirty ? 'saved_dirty' : 'saved_clean') }}
    </p>
    <p
      v-if="pending"
      class="text-sm text-amber-800"
    >
      {{ $t('manual_draft_help') }}
    </p>
    <details>
      <summary class="cursor-pointer text-sm font-medium">
        {{ $t('saved_history') }}
      </summary><p class="mt-2 text-sm">
        {{ $t('saved_history_help') }}
      </p><p class="mt-2 text-sm">
        {{ $t('saved_history_counts', history) }}
      </p>
    </details>
    <fieldset
      :disabled="busy"
      class="min-w-0 space-y-3"
    >
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          :disabled="pending"
          class="rounded bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
          @click="emit('save')"
        >
          {{ $t('saved_save') }}
        </button>
        <button
          type="button"
          :disabled="pending"
          class="rounded border px-4 py-2 text-sm disabled:opacity-50"
          @click="emit('backup')"
        >
          {{ $t('saved_backup') }}
        </button>
        <button
          type="button"
          class="rounded border px-4 py-2 text-sm"
          @click="emit('discard')"
        >
          {{ $t(dirty || pending ? 'saved_discard' : 'saved_new') }}
        </button>
      </div>
      <label class="block text-sm font-medium">{{ $t('saved_import') }}<input
        type="file"
        accept="application/json,.json"
        :disabled="dirty || pending"
        class="mt-1 block w-full min-w-0 text-sm disabled:opacity-50"
        @change="readFile"
      ></label>
      <p
        v-if="dirty || pending"
        class="text-sm text-gray-600"
      >
        {{ $t('saved_switch_help') }}
      </p>
      <button
        type="button"
        class="rounded border px-3 py-2 text-sm"
        @click="emit('refresh')"
      >
        {{ $t('saved_refresh') }}
      </button>
      <ul class="space-y-3">
        <li
          v-for="entry in entries"
          :key="entry.id"
          :data-saved-id="entry.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 p-3 text-sm [overflow-wrap:anywhere]"
        >
          <div class="min-w-0">
            <p class="font-semibold">
              {{ entry.name || $t('eval_title') }}
            </p><p>{{ entry.savedAt }} · {{ $t('saved_revision', { revision: entry.revision, samples: entry.samples }) }}</p>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="dirty || pending"
              class="rounded border px-3 py-2 disabled:opacity-50"
              :aria-label="$t('saved_open_label', { name: entry.name || $t('eval_title') })"
              @click="emit('open', entry.id)"
            >
              {{ $t('saved_open') }}
            </button><button
              type="button"
              class="rounded border px-3 py-2"
              :aria-label="$t('saved_remove_label', { name: entry.name || $t('eval_title') })"
              @click="emit('remove', entry.id)"
            >
              {{ $t('saved_remove') }}
            </button>
          </div>
        </li>
      </ul>
      <p
        v-if="!entries.length"
        class="text-sm"
      >
        {{ $t('saved_none') }}
      </p>
    </fieldset>
    <p
      v-if="error || fileError"
      role="alert"
      class="text-sm text-red-800"
    >
      {{ error || $t('saved_file_error') }}
    </p>
    <p
      v-if="status"
      role="status"
      class="text-sm text-green-900"
    >
      {{ $t('saved_status_' + status) }}
    </p>
  </section>
</template>
