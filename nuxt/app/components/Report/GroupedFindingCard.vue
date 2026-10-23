<script setup lang="ts">
import { computed } from 'vue'
import type { DeepReadonly } from 'vue'
import type { ReportFinding } from '~~/shared/types/report'
import type { ScanEvidence } from '~~/shared/types/scanEvidence'
import { safeReportLink } from '~~/shared/utils/reportPresentation'

const props = defineProps<{ finding: ReportFinding, evidence: DeepReadonly<ScanEvidence>, selected: boolean, occurrenceIds?: string[] }>()
const emit = defineEmits<{ select: [id: string, checked: boolean] }>()
const occurrences = computed(() => props.finding.occurrences.filter(item => !props.occurrenceIds || props.occurrenceIds.includes(item.id)))
const sources = computed(() => [...new Set(occurrences.value.flatMap(item => item.observations.map(observation => observation.source)))])
const engines = computed(() => new Set(occurrences.value.flatMap(item => item.observations.map(observation => observation.engine)).filter(engine => engine !== 'unknown')).size)
const sampleCount = computed(() => new Set(occurrences.value.map(item => item.sampleId)).size)
const original = (id: string) => JSON.stringify(props.evidence.observations.find(item => item.id === id)?.evidence, null, 2)
</script>

<template>
  <article
    class="rounded-lg border p-4"
    :class="finding.outcome === 'violation' ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-slate-50/40'"
  >
    <div class="flex items-start gap-3">
      <label class="mt-1 flex shrink-0 items-center">
        <input
          type="checkbox"
          :checked="selected"
          class="h-4 w-4 rounded border-gray-400"
          @change="emit('select', finding.id, ($event.target as HTMLInputElement).checked)"
        >
        <span class="sr-only">{{ $t('group_select_finding') }}: {{ finding.title }}</span>
      </label>
      <div class="min-w-0 flex-1">
        <div class="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span class="rounded bg-white px-2 py-1 font-semibold ring-1 ring-gray-300">{{ $t('group_outcome_' + finding.outcome) }}</span>
          <span
            v-for="source in sources"
            :key="source"
            class="rounded bg-blue-100 px-2 py-1 text-blue-900"
          >{{ source }}</span>
          <span class="break-all text-gray-600">{{ finding.issueType }}</span>
        </div>
        <h4 class="font-semibold text-gray-900 break-words">
          {{ finding.title }}
        </h4>
        <p class="mt-2 text-sm text-gray-700">
          {{ $t('group_occurrences') }}: {{ occurrences.length }} · {{ $t('group_sampled_pages') }}: {{ sampleCount }} · {{ $t('group_known_engines') }}: {{ engines }}
        </p>
        <p
          v-if="finding.criteria.length"
          class="mt-1 text-sm text-gray-600"
        >
          WCAG: {{ finding.criteria.join(', ') }}
        </p>
        <details class="mt-3">
          <summary class="cursor-pointer font-medium text-blue-800">
            {{ $t('group_inspect_occurrences') }}
          </summary>
          <div class="mt-3 space-y-4">
            <section
              v-for="occurrence in occurrences"
              :key="occurrence.id"
              class="rounded border border-gray-200 bg-white p-3"
            >
              <p
                v-if="occurrence.sampleName"
                class="mb-1 text-sm font-semibold"
              >
                {{ occurrence.sampleName }}
              </p>
              <p class="break-all text-sm">
                <a
                  v-if="safeReportLink(occurrence.url)"
                  :href="safeReportLink(occurrence.url)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-800 underline"
                >{{ occurrence.url }}</a><span v-else>{{ occurrence.url }}</span>
              </p>
              <p class="mt-1 text-sm text-gray-700">
                {{ $t('group_state') }}: {{ occurrence.state }}
              </p>
              <pre
                v-if="occurrence.selector"
                class="mt-2 whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-xs"
              >{{ occurrence.selector }}</pre>
              <p
                v-else
                class="mt-2 text-sm text-gray-600"
              >
                {{ $t('group_no_locator') }}
              </p>
              <details
                v-for="observation in occurrence.observations"
                :key="observation.id"
                class="mt-3 border-t border-gray-200 pt-2"
              >
                <summary class="cursor-pointer text-sm font-medium [overflow-wrap:anywhere]">
                  {{ observation.source }} · {{ observation.ruleId }} · {{ $t('group_outcome_' + observation.outcome) }}
                </summary>
                <div class="mt-2 space-y-2 text-sm">
                  <p>{{ observation.title }}</p>
                  <p v-if="observation.description">
                    {{ observation.description }}
                  </p>
                  <p>{{ $t('scan_date') }}: {{ observation.completedAt }}</p>
                  <pre
                    v-if="observation.selector"
                    class="whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-xs"
                  >{{ observation.selector }}</pre>
                  <pre
                    v-if="observation.html"
                    class="whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-xs"
                  >{{ observation.html }}</pre>
                  <a
                    v-if="safeReportLink(observation.helpUrl)"
                    :href="safeReportLink(observation.helpUrl)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-blue-800 underline"
                  >{{ $t('help') }}</a>
                  <details>
                    <summary class="cursor-pointer">
                      {{ $t('group_original_evidence') }}
                    </summary><pre class="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-xs">{{ original(observation.id) }}</pre>
                  </details>
                </div>
              </details>
            </section>
          </div>
        </details>
      </div>
    </div>
  </article>
</template>
