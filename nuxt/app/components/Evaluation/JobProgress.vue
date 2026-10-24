<script setup lang="ts">
import { computed } from 'vue'
import type { EvaluationJob } from '~~/shared/types/evaluationJob'

const props = defineProps<{ job: EvaluationJob | null, error: string | null, busy: boolean }>()
const emit = defineEmits<{ retry: [], refresh: [] }>()
const complete = computed(() => props.job?.tasks.filter(task => !['queued', 'running'].includes(task.attempts[task.attempts.length - 1]!.status)).length ?? 0)
const retryable = computed(() => props.job?.tasks.some(task => task.attempts[task.attempts.length - 1]!.status === 'failed' && task.attempts.length < 3))
</script>

<template>
  <section class="mb-5 space-y-3 rounded-xl border border-blue-200 bg-white p-5 [overflow-wrap:anywhere]">
    <h2 class="text-lg font-semibold">
      {{ $t('batch_progress') }}<span v-if="job">: {{ job.evaluation.name || $t('eval_title') }}</span>
    </h2>
    <template v-if="job">
      <p role="status">
        {{ $t('batch_status_' + job.status) }} · {{ complete }} / {{ job.tasks.length }}
      </p>
      <progress
        :value="complete"
        :max="job.tasks.length"
        class="h-3 w-full"
        :aria-label="$t('batch_progress')"
      />
      <p class="text-sm text-gray-600">
        {{ $t('batch_retention') }}
      </p>
      <details>
        <summary class="cursor-pointer font-medium">
          {{ $t('batch_engine_details') }}
        </summary>
        <ul class="mt-3 space-y-3">
          <li
            v-for="task in job.tasks"
            :key="task.sampleId + task.key"
            class="rounded border border-gray-200 p-3 text-sm"
          >
            <p class="font-semibold">
              {{ job.evaluation.samples.find(sample => sample.id === task.sampleId)?.name || job.evaluation.samples.find(sample => sample.id === task.sampleId)?.url }} · {{ task.key === 'axe' ? 'Axe' : task.key === 'pa11y:axe' ? 'Pa11y / Axe' : 'Pa11y / HTMLCS' }}
            </p>
            <p>{{ $t('batch_work_' + task.attempts[task.attempts.length - 1]!.status) }}</p>
            <ol class="mt-2 space-y-2">
              <li
                v-for="(attempt, index) in task.attempts"
                :key="attempt.id"
              >
                {{ $t('batch_attempt') }} {{ index + 1 }}: {{ $t('batch_work_' + attempt.status) }}
                <span v-if="attempt.completedAt"> · {{ attempt.completedAt }}</span>
                <p
                  v-if="attempt.error"
                  class="text-red-800"
                >
                  {{ attempt.error }}
                </p>
              </li>
            </ol>
          </li>
        </ul>
      </details>
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          :disabled="busy || !retryable"
          class="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50"
          @click="emit('retry')"
        >
          {{ $t('batch_retry') }}
        </button>
        <button
          type="button"
          class="rounded border border-gray-400 px-4 py-2 text-sm"
          @click="emit('refresh')"
        >
          {{ $t('batch_refresh') }}
        </button>
      </div>
    </template>
    <p
      v-if="error"
      role="alert"
      class="text-sm text-red-800"
    >
      {{ error }}
    </p>
  </section>
</template>
