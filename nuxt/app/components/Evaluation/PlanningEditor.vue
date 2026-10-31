<script setup lang="ts">
import { computed, ref } from 'vue'
import CandidateImport from './CandidateImport.vue'
import CandidateInspection from './CandidateInspection.vue'
import type { Evaluation, EvaluationScope, InventoryEntry, SamplingCandidate, SamplingPlan } from '~~/shared/types/evaluation'
import { newRecordId, parseBulkUrls, parseTypeTags, validSampleUrl } from '~~/shared/utils/evaluation'
import { INVENTORY_KINDS, MAX_CANDIDATES, MAX_DRAWS, newSamplingPlan, samplingCoverage } from '~~/shared/utils/sampling'

const props = defineProps<{ modelValue: Evaluation, busy: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: Evaluation], 'draw': [] }>()
const bulk = ref('')
const invalidPool = ref(false)
const inventory = computed(() => props.modelValue.inventory ?? [])
const plan = computed(() => props.modelValue.sampling ?? newSamplingPlan())
const coverage = computed(() => samplingCoverage(props.modelValue))
const update = (value: Partial<Evaluation>) => emit('update:modelValue', { ...props.modelValue, ...value })
const scope = (value: Partial<EvaluationScope>) => update({ scope: { ...props.modelValue.scope, ...value } })
const sampling = (value: Partial<SamplingPlan>) => update({ sampling: { ...plan.value, ...value } })
const patchInventory = (id: string, value: Partial<InventoryEntry>) => update({ inventory: inventory.value.map(entry => entry.id === id ? { ...entry, ...value } : entry) })
const removeInventory = (id: string) => update({ inventory: inventory.value.filter(entry => entry.id !== id), samples: props.modelValue.samples.map(sample => ({ ...sample, inventoryIds: sample.inventoryIds?.filter(key => key !== id) })) })
const patchCandidate = (id: string, value: Partial<SamplingCandidate>) => sampling({ candidates: plan.value.candidates.map(candidate => candidate.id === id ? { ...candidate, ...value } : candidate) })
const addPool = () => {
  const urls = parseBulkUrls(bulk.value)
  if (!urls.length || urls.some(url => !validSampleUrl(url)) || plan.value.candidates.length + urls.length > MAX_CANDIDATES) {
    invalidPool.value = true
    return
  }
  sampling({ candidates: [...plan.value.candidates, ...urls.map(url => ({ id: newRecordId(), url, name: '', stateDescription: 'Initial page state', preparation: 'initial-page' as const }))] })
  invalidPool.value = false
  bulk.value = ''
}
const value = (event: Event) => (event.target as HTMLInputElement).value
</script>

<template>
  <div
    class="space-y-5"
    data-planning-editor
  >
    <details class="rounded-lg border border-gray-200 p-4">
      <summary class="cursor-pointer font-semibold">
        {{ $t('planning_scope') }}
      </summary>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label
          v-for="key in ['productName', 'productUrl', 'evaluator', 'commissioner'] as const"
          :key="key"
          class="block text-sm font-medium"
        >{{ $t('planning_' + key) }}<input
          :value="modelValue.scope[key]"
          :type="key === 'productUrl' ? 'url' : 'text'"
          :maxlength="key === 'productUrl' ? 4000 : 200"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @input="scope({ [key]: value($event) })"
        ></label>
        <label
          v-for="key in ['startDate', 'endDate'] as const"
          :key="key"
          class="block text-sm font-medium"
        >{{ $t('planning_' + key) }}<input
          :value="modelValue.scope[key]"
          type="date"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @input="scope({ [key]: value($event) })"
        ></label>
        <label class="block text-sm font-medium sm:col-span-2">{{ $t('planning_languages') }}<input
          :value="modelValue.scope.languages?.join(', ')"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          maxlength="3000"
          @change="scope({ languages: parseTypeTags(value($event)) })"
        ></label>
        <label
          v-for="key in ['boundaries', 'supportBaseline'] as const"
          :key="key"
          class="block text-sm font-medium sm:col-span-2"
        >{{ $t('planning_' + key) }}<textarea
          :value="modelValue.scope[key]"
          rows="3"
          maxlength="5000"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @input="scope({ [key]: value($event) })"
        /></label>
      </div>
      <p class="mt-3 text-sm text-gray-600">
        {{ $t('planning_baseline_help') }}
      </p>
    </details>
    <details class="rounded-lg border border-gray-200 p-4">
      <summary class="cursor-pointer font-semibold">
        {{ $t('planning_inventory') }} ({{ inventory.length }})
      </summary>
      <p class="mt-3 text-sm text-gray-600">
        {{ $t('planning_inventory_help') }}
      </p>
      <div
        v-for="entry in inventory"
        :key="entry.id"
        class="mt-4 space-y-3 rounded border border-gray-200 p-3"
        :data-inventory-id="entry.id"
      >
        <label class="block text-sm font-medium">{{ $t('planning_entry_name') }}<input
          :value="entry.name"
          maxlength="200"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @input="patchInventory(entry.id, { name: value($event) })"
        ></label>
        <label class="block text-sm font-medium">{{ $t('planning_entry_kind') }}<select
          :value="entry.kind"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @change="patchInventory(entry.id, { kind: value($event) as InventoryEntry['kind'] })"
        ><option
          v-for="kind in INVENTORY_KINDS"
          :key="kind"
          :value="kind"
        >{{ $t('planning_kind_' + kind) }}</option></select></label>
        <label class="block text-sm font-medium">{{ $t('planning_entry_description') }}<textarea
          :value="entry.description"
          maxlength="2000"
          rows="2"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @input="patchInventory(entry.id, { description: value($event) })"
        /></label>
        <p
          class="text-sm"
          :class="coverage.uncoveredInventoryIds.includes(entry.id) ? 'text-amber-800' : 'text-gray-600'"
        >
          {{ $t('planning_selected_links', { count: coverage.inventory.find(item => item.id === entry.id)?.sampleIds.length || 0 }) }}
        </p>
        <button
          type="button"
          class="rounded border border-gray-400 px-3 py-2 text-sm"
          @click="removeInventory(entry.id)"
        >
          {{ $t('eval_remove') }}
        </button>
      </div>
      <button
        type="button"
        :disabled="inventory.length >= 100"
        class="mt-3 rounded border border-gray-400 px-3 py-2 text-sm disabled:opacity-50"
        @click="update({ inventory: [...inventory, { id: newRecordId(), kind: 'common-view', name: '', description: '' }] })"
      >
        {{ $t('planning_add_inventory') }}
      </button>
    </details>
    <details class="rounded-lg border border-gray-200 p-4">
      <summary class="cursor-pointer font-semibold">
        {{ $t('planning_sampling') }}
      </summary>
      <div class="mt-4 space-y-4">
        <p class="text-sm text-gray-600">
          {{ $t('planning_random_help') }} <a
            href="https://www.w3.org/TR/wcag-em-2/#step3"
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-800 underline"
          >WCAG-EM</a>
        </p>
        <p
          role="status"
          class="rounded bg-blue-50 p-3 text-sm"
        >
          {{ $t('planning_random_counts', { structured: coverage.structured, random: coverage.countedRandom, required: coverage.requiredRandom, missing: coverage.missingRandom }) }}
        </p>
        <p
          v-if="coverage.excludedRandomIds.length"
          class="text-sm text-amber-800"
        >
          {{ $t('planning_invalid_random') }}
        </p>
        <label
          v-for="key in ['source', 'rationale', 'coverageNotes', 'exhaustionReason', 'comparisonNotes'] as const"
          :key="key"
          class="block text-sm font-medium"
        >{{ $t('planning_' + key) }}<textarea
          :value="plan[key]"
          :maxlength="key === 'source' ? 2000 : 5000"
          rows="2"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @input="sampling({ [key]: value($event) })"
        /></label>
        <label class="block text-sm font-medium">{{ $t('planning_pool_coverage') }}<select
          :value="plan.coverage"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @change="sampling({ coverage: value($event) as SamplingPlan['coverage'] })"
        ><option
          v-for="kind in ['unknown', 'partial', 'whole-scope']"
          :key="kind"
          :value="kind"
        >{{ $t('planning_coverage_' + kind) }}</option></select></label>
        <p
          v-if="plan.coverage !== 'whole-scope'"
          class="text-sm text-amber-800"
        >
          {{ $t('planning_incomplete_pool') }}
        </p>
        <label class="block text-sm font-medium">{{ $t('planning_pool_urls') }}<textarea
          v-model="bulk"
          rows="4"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          placeholder="https://example.com/"
        /></label>
        <button
          type="button"
          class="rounded border border-gray-400 px-3 py-2 text-sm"
          @click="addPool"
        >
          {{ $t('planning_add_candidates') }}
        </button>
        <p
          v-if="invalidPool"
          role="alert"
          class="text-sm text-red-800"
        >
          {{ $t('planning_pool_error', { limit: MAX_CANDIDATES }) }}
        </p>
        <CandidateImport
          :candidates="plan.candidates"
          :source="plan.source"
          :busy="busy"
          @import="sampling({ candidates: [...plan.candidates, ...$event.candidates], source: $event.source, coverage: 'unknown' })"
        />
        <CandidateInspection
          :candidates="plan.candidates"
          :busy="busy"
          @apply="sampling({ candidates: plan.candidates.map(row => row.id === $event.id ? { ...row, ...$event } : row), coverage: 'unknown' })"
        />
        <p class="text-sm">
          {{ $t('planning_eligible', { count: coverage.eligibleCandidates, total: plan.candidates.length }) }}
        </p>
        <details
          v-if="plan.candidates.length"
          class="rounded border border-gray-200 p-3"
        >
          <summary class="cursor-pointer font-medium">
            {{ $t('planning_edit_candidates') }}
          </summary>
          <details
            v-for="candidate in plan.candidates"
            :key="candidate.id"
            class="mt-3 rounded border border-gray-200 p-3"
            :data-candidate-id="candidate.id"
          >
            <summary class="cursor-pointer break-all text-sm">
              {{ candidate.name || candidate.url }}
            </summary>
            <div class="mt-3 space-y-3">
              <label
                v-for="key in ['url', 'name', 'stateDescription'] as const"
                :key="key"
                class="block text-sm font-medium"
              >{{ $t('planning_candidate_' + key) }}<input
                :value="candidate[key]"
                :maxlength="key === 'url' ? 4000 : key === 'name' ? 200 : 2000"
                class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                @input="patchCandidate(candidate.id, { [key]: value($event) })"
              ></label>
              <label class="block text-sm font-medium">{{ $t('eval_types') }}<input
                :value="candidate.typeTags?.join(', ')"
                maxlength="2100"
                class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                @change="patchCandidate(candidate.id, { typeTags: parseTypeTags(value($event)) })"
              ></label>
              <p
                v-if="candidate.inspection"
                class="break-all text-sm text-gray-600"
                data-inspection-record
              >
                {{ $t('inspection_captured') }}: {{ candidate.inspection.inspectedAt }} · {{ candidate.inspection.requestedUrl }} → {{ candidate.inspection.finalUrl }} · {{ candidate.inspection.bytes }} bytes<br>{{ $t('inspection_suggested') }}: {{ candidate.inspection.suggestedTypes.join(', ') || $t('inspection_none') }}<br>{{ $t('inspection_record_help') }}
              </p>
              <label class="block text-sm font-medium">{{ $t('eval_preparation') }}<select
                :value="candidate.preparation"
                class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                @change="patchCandidate(candidate.id, { preparation: value($event) as SamplingCandidate['preparation'] })"
              ><option value="initial-page">{{ $t('eval_initial') }}</option><option value="manual">{{ $t('eval_manual') }}</option></select></label>
              <button
                type="button"
                class="rounded border border-gray-400 px-3 py-2 text-sm"
                @click="sampling({ candidates: plan.candidates.filter(item => item.id !== candidate.id) })"
              >
                {{ $t('eval_remove') }}
              </button>
            </div>
          </details>
        </details>
        <p
          v-if="coverage.missingRandom > coverage.eligibleCandidates"
          class="text-sm text-amber-800"
        >
          {{ $t('planning_pool_shortage') }}
        </p>
        <p
          v-if="coverage.missingRandom > coverage.remainingSlots"
          class="text-sm text-amber-800"
        >
          {{ $t('planning_slot_shortage') }}
        </p>
        <button
          type="button"
          :disabled="busy || !coverage.missingRandom || !coverage.eligibleCandidates || !coverage.remainingSlots || !plan.source.trim() || plan.draws.length >= MAX_DRAWS"
          class="rounded bg-indigo-700 px-4 py-2 text-sm text-white disabled:opacity-50"
          @click="emit('draw')"
        >
          {{ $t('planning_draw') }}
        </button>
        <details
          v-if="plan.draws.length"
          class="rounded border border-gray-200 p-3"
        >
          <summary class="cursor-pointer font-medium">
            {{ $t('planning_draw_history') }} ({{ plan.draws.length }} / {{ MAX_DRAWS }})
          </summary>
          <div
            v-for="draw in plan.draws"
            :key="draw.id"
            class="mt-3 text-sm"
          >
            <p>{{ draw.timestamp }} · {{ draw.source }} · {{ draw.method }}</p>
            <p>{{ $t('planning_draw_size', { selected: draw.selected.length, requested: draw.requestedCount, eligible: draw.eligibleCount }) }}</p>
            <p
              v-for="chosen in draw.selected"
              :key="chosen.sampleId"
              class="break-all"
            >
              {{ draw.pool.find(candidate => candidate.id === chosen.candidateId)?.url }}
            </p>
          </div>
        </details>
      </div>
    </details>
  </div>
</template>
