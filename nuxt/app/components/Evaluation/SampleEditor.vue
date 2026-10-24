<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Evaluation } from '~~/shared/types/evaluation'
import { duplicateSampleIds, MAX_EVALUATION_SAMPLES, newEvaluationSample, parseBulkUrls, parseTypeTags, validSampleUrl } from '~~/shared/utils/evaluation'

const props = defineProps<{ modelValue: Evaluation, busy: boolean, busySampleId: string | null, statuses: Record<string, string>, sampleErrors: Record<string, string>, error: string | null, canBuild: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: Evaluation], 'scan': [id: string], 'build': [], 'batch': [], 'draw': [] }>()
const bulk = ref('')
const bulkError = ref(false)
const duplicates = computed(() => new Set(duplicateSampleIds(props.modelValue.samples)))
const update = (value: Partial<Evaluation>) => emit('update:modelValue', { ...props.modelValue, ...value })
const patch = (id: string, value: Partial<Evaluation['samples'][number]>) => update({ samples: props.modelValue.samples.map(sample => sample.id === id ? { ...sample, ...value } : sample) })
const add = () => {
  if (props.modelValue.samples.length < MAX_EVALUATION_SAMPLES) update({ samples: [...props.modelValue.samples, newEvaluationSample()] })
}
const paste = () => {
  const urls = parseBulkUrls(bulk.value)
  const existing = props.modelValue.samples.filter(sample => sample.url.trim() || sample.name.trim() || sample.typeTags.length || sample.selectionReason.trim() || sample.preparation !== 'initial-page' || sample.state.description !== 'Initial page state' || sample.inventoryIds?.length || sample.selection?.kind === 'random' || sample.selection?.source || sample.selection?.method)
  if (!urls.length || urls.some(url => !validSampleUrl(url)) || existing.length + urls.length > MAX_EVALUATION_SAMPLES) {
    bulkError.value = true
    return
  }
  update({ samples: [...existing, ...urls.map(url => newEvaluationSample(url))] })
  bulk.value = ''
  bulkError.value = false
}
const inputValue = (event: Event) => (event.target as HTMLInputElement).value
</script>

<template>
  <section class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-8">
    <h2 class="text-2xl font-bold text-gray-900">
      {{ $t('eval_title') }}
    </h2>
    <p class="mt-2 text-sm text-gray-600">
      {{ $t('eval_intro') }}
    </p>
    <fieldset
      :disabled="busy"
      class="mt-6 min-w-0 space-y-5"
    >
      <label class="block text-sm font-medium">{{ $t('eval_name') }}<input
        :value="modelValue.name"
        maxlength="200"
        class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        @input="update({ name: inputValue($event) })"
      ></label>
      <label class="block text-sm font-medium">{{ $t('eval_scope') }}<textarea
        :value="modelValue.scope.description"
        maxlength="5000"
        rows="2"
        class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        @input="update({ scope: { ...modelValue.scope, description: inputValue($event) } })"
      /></label>
      <EvaluationPlanningEditor
        :model-value="modelValue"
        :busy="busy"
        @update:model-value="emit('update:modelValue', $event)"
        @draw="emit('draw')"
      />
      <slot />
      <button
        type="button"
        class="rounded bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
        @click="emit('batch')"
      >
        {{ $t('batch_start') }}
      </button>
      <p class="text-sm text-gray-600">
        {{ $t('batch_help') }}
      </p>
      <details class="rounded border border-gray-200 p-3">
        <summary class="cursor-pointer font-medium">
          {{ $t('eval_bulk') }}
        </summary>
        <label class="mt-3 block text-sm">{{ $t('eval_bulk_help') }}<textarea
          v-model="bulk"
          rows="4"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          placeholder="https://example.com/"
        /></label>
        <button
          type="button"
          class="mt-3 rounded border border-gray-400 px-3 py-2 text-sm"
          @click="paste"
        >
          {{ $t('eval_add_urls') }}
        </button>
        <p
          v-if="bulkError"
          role="alert"
          class="mt-2 text-sm text-red-800"
        >
          {{ $t('eval_bulk_error') }}
        </p>
      </details>
      <p class="text-sm text-gray-600">
        {{ $t('eval_sample_limit', { count: modelValue.samples.length, limit: MAX_EVALUATION_SAMPLES }) }}
      </p>
      <div
        v-for="(sample, index) in modelValue.samples"
        :key="sample.id"
        class="space-y-4 rounded-lg border border-gray-300 p-4"
        :data-sample-id="sample.id"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="font-semibold">
            {{ $t('eval_sample') }} {{ index + 1 }}
          </h3>
          <button
            type="button"
            :disabled="modelValue.samples.length === 1"
            class="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
            :aria-label="$t('eval_remove_sample', { index: index + 1 })"
            @click="update({ samples: modelValue.samples.filter(item => item.id !== sample.id) })"
          >
            {{ $t('eval_remove') }}
          </button>
        </div>
        <label class="block text-sm font-medium">{{ $t('website_url') }}<input
          :value="sample.url"
          type="url"
          :disabled="!!sample.selection?.drawId"
          maxlength="4000"
          required
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          placeholder="https://example.com/"
          @input="patch(sample.id, { url: inputValue($event) })"
        ></label>
        <p
          v-if="duplicates.has(sample.id)"
          class="text-sm text-amber-800"
        >
          {{ $t('eval_duplicate') }}
        </p>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="block text-sm font-medium">{{ $t('eval_sample_name') }}<input
            :value="sample.name"
            maxlength="200"
            class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            @input="patch(sample.id, { name: inputValue($event) })"
          ></label>
          <label class="block text-sm font-medium">{{ $t('eval_types') }}<input
            :value="sample.typeTags.join(', ')"
            maxlength="2000"
            class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            :placeholder="$t('eval_types_example')"
            @change="patch(sample.id, { typeTags: parseTypeTags(inputValue($event)) })"
          ></label>
        </div>
        <fieldset class="min-w-0 space-y-2 rounded border border-gray-200 p-3">
          <legend class="px-1 text-sm font-medium">
            {{ $t('planning_sample_links') }}
          </legend>
          <p
            v-if="!modelValue.inventory?.length"
            class="text-sm text-gray-600"
          >
            {{ $t('planning_no_inventory') }}
          </p>
          <label
            v-for="entry in modelValue.inventory"
            :key="entry.id"
            class="flex items-center gap-2 text-sm"
          ><input
            type="checkbox"
            :checked="sample.inventoryIds?.includes(entry.id)"
            @change="patch(sample.id, { inventoryIds: ($event.target as HTMLInputElement).checked ? [...(sample.inventoryIds || []), entry.id] : sample.inventoryIds?.filter(id => id !== entry.id) })"
          >{{ entry.name || $t('planning_unnamed') }}</label>
        </fieldset>
        <label class="block text-sm font-medium">{{ $t('planning_selection_kind') }}<select
          :value="sample.selection?.kind || 'structured'"
          :disabled="!!sample.selection?.drawId"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @change="patch(sample.id, { selection: { source: sample.selection?.source || '', method: sample.selection?.method || '', kind: inputValue($event) as 'structured' | 'random' } })"
        ><option value="structured">{{ $t('planning_structured') }}</option><option value="random">{{ $t('planning_random') }}</option></select></label>
        <label
          v-for="key in ['source', 'method'] as const"
          :key="key"
          class="block text-sm font-medium"
        >{{ $t('planning_selection_' + key) }}<input
          :value="sample.selection?.[key]"
          :disabled="!!sample.selection?.drawId"
          maxlength="2000"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @input="patch(sample.id, { selection: { kind: sample.selection?.kind || 'structured', source: sample.selection?.source || '', method: sample.selection?.method || '', [key]: inputValue($event) } })"
        ></label>
        <p
          v-if="sample.selection?.drawId"
          class="text-sm text-gray-600"
        >
          {{ $t('planning_draw_locked') }}
        </p>
        <label class="block text-sm font-medium">{{ $t('eval_selection_reason') }}<textarea
          :value="sample.selectionReason"
          maxlength="2000"
          rows="2"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @input="patch(sample.id, { selectionReason: inputValue($event) })"
        /></label>
        <label class="block text-sm font-medium">{{ $t('eval_preparation') }}<select
          :disabled="!!sample.selection?.drawId"
          :value="sample.preparation"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @change="patch(sample.id, { preparation: inputValue($event) as 'initial-page' | 'manual' })"
        ><option value="initial-page">{{ $t('eval_initial') }}</option><option value="manual">{{ $t('eval_manual') }}</option></select></label>
        <label class="block text-sm font-medium">{{ $t('eval_state') }}<textarea
          :value="sample.state.description"
          :disabled="!!sample.selection?.drawId"
          maxlength="2000"
          rows="2"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @input="patch(sample.id, { state: { ...sample.state, description: inputValue($event) } })"
        /></label>
        <p
          v-if="sample.preparation === 'manual'"
          class="text-sm text-amber-800"
        >
          {{ $t('eval_manual_help') }}
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            :disabled="!validSampleUrl(sample.url) || sample.preparation === 'manual'"
            class="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50"
            @click="emit('scan', sample.id)"
          >
            {{ busySampleId === sample.id ? $t('analyzing') : $t('eval_scan_sample') }}
          </button>
          <span
            role="status"
            class="text-sm text-gray-600"
          >{{ $t('eval_status_' + (statuses[sample.id] || 'unscanned')) }}</span>
        </div>
        <p
          v-if="sampleErrors[sample.id]"
          role="alert"
          class="break-words text-sm text-red-800"
        >
          {{ sampleErrors[sample.id] }}
        </p>
      </div>
      <button
        type="button"
        :disabled="modelValue.samples.length >= MAX_EVALUATION_SAMPLES"
        class="rounded border border-gray-400 px-4 py-2 text-sm disabled:opacity-50"
        @click="add"
      >
        {{ $t('eval_add_sample') }}
      </button>
      <p class="text-sm text-gray-600">
        {{ $t('eval_build_help') }}
      </p>
      <button
        type="button"
        :disabled="!canBuild"
        class="rounded bg-indigo-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
        @click="emit('build')"
      >
        {{ $t('eval_build_report') }}
      </button>
    </fieldset>
    <p
      v-if="error"
      role="alert"
      class="mt-4 text-sm text-red-800"
    >
      {{ error }}
    </p>
    <p class="mt-4 text-sm text-gray-600">
      {{ $t('eval_session_only') }}
    </p>
  </section>
</template>
