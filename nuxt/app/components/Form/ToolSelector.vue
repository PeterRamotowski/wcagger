<script setup lang="ts">
interface Props {
  modelValue: string[];
  selectedRunners: string[];
  disabled?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: string[]): void;
  (e: 'update:selectedRunners', value: string[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
});

const emit = defineEmits<Emits>();

const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const localRunners = computed({
  get: () => props.selectedRunners,
  set: (value) => emit('update:selectedRunners', value)
});

const isPa11ySelected = computed(() => localValue.value.includes('pa11y'));
</script>

<template>
  <div class="text-left">
  <label class="block text-sm font-medium text-gray-700 mb-3">{{ $t('select_accessibility_tools') }}</label>
    <div class="space-y-3">
      <div class="flex items-center">
        <input
          id="tool-axe"
          v-model="localValue"
          value="axe"
          type="checkbox"
          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          :disabled="disabled"
        />
        <label for="tool-axe" class="ml-3 block text-sm font-medium text-gray-700">
          Axe-core
        </label>
      </div>
      <div class="flex items-center">
        <input
          id="tool-pa11y"
          v-model="localValue"
          value="pa11y"
          type="checkbox"
          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          :disabled="disabled"
        />
        <label for="tool-pa11y" class="ml-3 block text-sm font-medium text-gray-700">
          Pa11y
        </label>
      </div>
      <div v-if="isPa11ySelected" class="ml-6 space-y-2">
        <label class="block text-sm font-medium text-gray-700">{{ $t('select_pa11y_runners') }}</label>
        <div class="space-y-2">
          <div class="flex items-center">
            <input
              id="runner-htmlcs"
              v-model="localRunners"
              value="htmlcs"
              type="checkbox"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              :disabled="disabled"
            />
            <label for="runner-htmlcs" class="ml-3 block text-sm font-medium text-gray-700">
              HTML CodeSniffer
            </label>
          </div>
          <div class="flex items-center">
            <input
              id="runner-axe"
              v-model="localRunners"
              value="axe"
              type="checkbox"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              :disabled="disabled"
            />
            <label for="runner-axe" class="ml-3 block text-sm font-medium text-gray-700">
              Axe-core
            </label>
          </div>
        </div>
      </div>
      <div class="text-xs text-gray-500 mt-2">
        {{ $t('select_tools_description') }}
      </div>
    </div>
  </div>
</template>
