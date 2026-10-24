<script setup lang="ts">
import { computed } from 'vue'
import type { Evaluation, EvaluationProcess, ProcessPath, ProcessStep } from '~~/shared/types/evaluation'
import { newEvaluationSample, newRecordId, MAX_EVALUATION_SAMPLES } from '~~/shared/utils/evaluation'
import { MAX_PROCESSES, MAX_PROCESS_PATHS, MAX_PROCESS_STEPS, MAX_TOTAL_PROCESS_STEPS, PROCESS_STATE_KINDS, processCoverage } from '~~/shared/utils/processes'

const props = defineProps<{ modelValue: Evaluation }>()
const emit = defineEmits<{ 'update:modelValue': [value: Evaluation] }>()
const processes = computed(() => props.modelValue.processes ?? [])
const coverage = computed(() => processCoverage(props.modelValue))
const totalSteps = computed(() => processes.value.reduce((total, process) => total + process.paths.reduce((total, path) => total + path.steps.length, 0), 0))
const update = (value: EvaluationProcess[]) => emit('update:modelValue', { ...props.modelValue, processes: value })
const patch = (id: string, value: Partial<EvaluationProcess>) => update(processes.value.map(process => process.id === id ? { ...process, ...value } : process))
const patchPath = (process: EvaluationProcess, id: string, value: Partial<ProcessPath>) => patch(process.id, { paths: process.paths.map(path => path.id === id ? { ...path, ...value } : path) })
const patchStep = (process: EvaluationProcess, path: ProcessPath, id: string, value: Partial<ProcessStep>) => patchPath(process, path.id, { steps: path.steps.map(step => step.id === id ? { ...step, ...value } : step) })
const text = (event: Event) => (event.target as HTMLInputElement).value
const newPath = (kind: ProcessPath['kind']): ProcessPath => ({ id: newRecordId(), name: '', kind, condition: '', steps: [] })
const addProcess = () => update([...processes.value, { id: newRecordId(), name: '', startingPoint: '', prerequisites: '', role: '', paths: [newPath('default')] }])
const addStep = (process: EvaluationProcess, path: ProcessPath) => patchPath(process, path.id, { steps: [...path.steps, { id: newRecordId(), name: '', sampleId: null, stateId: null, stateKind: 'initial', action: '', prerequisites: '', role: '', expectedState: '' }] })
const link = (process: EvaluationProcess, path: ProcessPath, step: ProcessStep, id: string) => {
  const sample = props.modelValue.samples.find(sample => sample.id === id)
  patchStep(process, path, step.id, { sampleId: sample?.id ?? null, stateId: sample?.state.id ?? null })
}
const move = (process: EvaluationProcess, path: ProcessPath, index: number, direction: number) => {
  const steps = [...path.steps]
  const step = steps.splice(index, 1)[0]!
  steps.splice(index + direction, 0, step)
  patchPath(process, path.id, { steps })
}
const createSample = (process: EvaluationProcess, path: ProcessPath, step: ProcessStep) => {
  const source = props.modelValue.samples.find(sample => sample.id === step.sampleId)
  const sample = newEvaluationSample(source?.url ?? '')
  sample.name = step.name
  sample.preparation = step.stateKind === 'initial' ? 'initial-page' : 'manual'
  sample.state.description = step.expectedState.trim() || step.name.trim() || 'Process state'
  const next = processes.value.map(item => item.id === process.id ? { ...item, paths: item.paths.map(item => item.id === path.id ? { ...item, steps: item.steps.map(item => item.id === step.id ? { ...item, sampleId: sample.id, stateId: sample.state.id } : item) } : item) } : item)
  emit('update:modelValue', { ...props.modelValue, samples: [...props.modelValue.samples, sample], processes: next })
}
</script>

<template>
  <details
    class="min-w-0 rounded border border-gray-200 p-3"
    data-process-editor
  >
    <summary class="cursor-pointer font-medium">
      {{ $t('process_title') }}
    </summary>
    <div class="mt-4 space-y-4 [overflow-wrap:anywhere]">
      <p class="text-sm text-gray-600">
        {{ $t('process_help') }}
      </p>
      <p class="text-sm text-gray-600">
        {{ $t('process_secrets') }}
      </p>
      <p class="text-sm">
        {{ $t('process_limits', { processes: MAX_PROCESSES, paths: MAX_PROCESS_PATHS, steps: MAX_PROCESS_STEPS, total: MAX_TOTAL_PROCESS_STEPS }) }}
      </p>
      <section
        v-for="(process, processIndex) in processes"
        :key="process.id"
        :data-process-id="process.id"
        class="min-w-0 space-y-3 rounded border border-gray-300 p-3"
      >
        <h3 class="font-semibold">
          {{ $t('process_number', { index: processIndex + 1 }) }}
        </h3>
        <label
          v-for="key in ['name', 'startingPoint', 'prerequisites', 'role'] as const"
          :key="key"
          class="block text-sm font-medium"
        >{{ $t('process_' + key) }}<textarea
          :value="process[key]"
          :maxlength="key === 'name' || key === 'role' ? 200 : 2000"
          rows="2"
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          @input="patch(process.id, { [key]: text($event) })"
        /></label>
        <p
          class="text-sm text-amber-800"
          role="status"
        >
          {{ $t('process_gap_count', { count: coverage[processIndex]?.gapCount }) }}
        </p>
        <p
          v-for="gap in coverage[processIndex]?.gaps"
          :key="gap"
          class="text-sm text-amber-800"
        >
          {{ $t('process_gap_' + gap) }}
        </p>
        <section
          v-for="(path, pathIndex) in process.paths"
          :key="path.id"
          :data-path-id="path.id"
          class="min-w-0 space-y-3 rounded border border-gray-200 p-3"
        >
          <h4 class="font-semibold">
            {{ $t('process_path_number', { index: pathIndex + 1 }) }} · {{ $t('process_' + path.kind) }}
          </h4>
          <label class="block text-sm font-medium">{{ $t('process_path_name') }}<input
            :value="path.name"
            maxlength="200"
            class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            @input="patchPath(process, path.id, { name: text($event) })"
          ></label>
          <label
            v-if="path.kind === 'critical-branch'"
            class="block text-sm font-medium"
          >{{ $t('process_condition') }}<textarea
            :value="path.condition"
            maxlength="2000"
            rows="2"
            class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            @input="patchPath(process, path.id, { condition: text($event) })"
          /></label>
          <p
            v-for="gap in coverage[processIndex]?.paths[pathIndex]?.gaps"
            :key="gap"
            class="text-sm text-amber-800"
          >
            {{ $t('process_gap_' + gap) }}
          </p>
          <ol class="space-y-3">
            <li
              v-for="(step, stepIndex) in path.steps"
              :key="step.id"
              :data-step-id="step.id"
              class="min-w-0 space-y-3 rounded border border-gray-200 p-3"
            >
              <h5 class="font-semibold">
                {{ $t('process_step_number', { index: stepIndex + 1 }) }}
              </h5>
              <label
                v-for="key in ['name', 'action', 'prerequisites', 'role', 'expectedState'] as const"
                :key="key"
                class="block text-sm font-medium"
              >{{ $t('process_step_' + key) }}<textarea
                :value="step[key]"
                :maxlength="key === 'name' || key === 'role' ? 200 : 2000"
                rows="2"
                class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                @input="patchStep(process, path, step.id, { [key]: text($event) })"
              /></label>
              <label class="block text-sm font-medium">{{ $t('process_state_kind') }}<select
                :value="step.stateKind"
                class="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                @change="patchStep(process, path, step.id, { stateKind: text($event) as ProcessStep['stateKind'] })"
              ><option
                v-for="kind in PROCESS_STATE_KINDS"
                :key="kind"
                :value="kind"
              >{{ $t('process_state_' + kind) }}</option></select></label>
              <label class="block text-sm font-medium">{{ $t('process_sample') }}<select
                :value="step.sampleId || ''"
                class="mt-1 block w-full min-w-0 rounded border border-gray-300 px-3 py-2"
                @change="link(process, path, step, text($event))"
              ><option value="">{{ $t('process_unlinked') }}</option><option
                v-if="step.sampleId && !modelValue.samples.some(sample => sample.id === step.sampleId)"
                :value="step.sampleId"
              >{{ $t('process_deleted_sample') }}</option><option
                v-for="(sample, index) in modelValue.samples"
                :key="sample.id"
                :value="sample.id"
              >{{ index + 1 }}. {{ sample.name || sample.url || $t('planning_unnamed') }} · {{ sample.state.description }}</option></select></label>
              <p
                v-for="gap in coverage[processIndex]?.paths[pathIndex]?.steps[stepIndex]?.gaps"
                :key="gap"
                class="text-sm text-amber-800"
              >
                {{ $t('process_gap_' + gap) }}
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  :disabled="modelValue.samples.length >= MAX_EVALUATION_SAMPLES"
                  class="rounded border px-3 py-2 text-sm disabled:opacity-50"
                  @click="createSample(process, path, step)"
                >
                  {{ $t('process_create_sample') }}
                </button>
                <button
                  type="button"
                  :disabled="stepIndex === 0"
                  :aria-label="$t('process_move_up_label', { index: stepIndex + 1 })"
                  class="rounded border px-3 py-2 text-sm disabled:opacity-50"
                  @click="move(process, path, stepIndex, -1)"
                >
                  {{ $t('process_move_up') }}
                </button>
                <button
                  type="button"
                  :disabled="stepIndex === path.steps.length - 1"
                  :aria-label="$t('process_move_down_label', { index: stepIndex + 1 })"
                  class="rounded border px-3 py-2 text-sm disabled:opacity-50"
                  @click="move(process, path, stepIndex, 1)"
                >
                  {{ $t('process_move_down') }}
                </button>
                <button
                  type="button"
                  class="rounded border px-3 py-2 text-sm"
                  @click="patchPath(process, path.id, { steps: path.steps.filter(item => item.id !== step.id) })"
                >
                  {{ $t('process_remove_step') }}
                </button>
              </div>
            </li>
          </ol>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :disabled="path.steps.length >= MAX_PROCESS_STEPS || totalSteps >= MAX_TOTAL_PROCESS_STEPS"
              class="rounded border px-3 py-2 text-sm disabled:opacity-50"
              @click="addStep(process, path)"
            >
              {{ $t('process_add_step') }}
            </button>
            <button
              type="button"
              class="rounded border px-3 py-2 text-sm"
              @click="patch(process.id, { paths: process.paths.filter(item => item.id !== path.id) })"
            >
              {{ $t('process_remove_path') }}
            </button>
          </div>
        </section>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="kind in ['default', 'critical-branch'] as const"
            :key="kind"
            type="button"
            :disabled="process.paths.length >= MAX_PROCESS_PATHS || (kind === 'default' && process.paths.some(path => path.kind === 'default'))"
            class="rounded border px-3 py-2 text-sm disabled:opacity-50"
            @click="patch(process.id, { paths: [...process.paths, newPath(kind)] })"
          >
            {{ $t('process_add_' + kind) }}
          </button>
          <button
            type="button"
            class="rounded border px-3 py-2 text-sm"
            @click="update(processes.filter(item => item.id !== process.id))"
          >
            {{ $t('process_remove') }}
          </button>
        </div>
      </section>
      <button
        type="button"
        :disabled="processes.length >= MAX_PROCESSES"
        class="rounded border border-gray-400 px-4 py-2 text-sm disabled:opacity-50"
        @click="addProcess"
      >
        {{ $t('process_add') }}
      </button>
    </div>
  </details>
</template>
