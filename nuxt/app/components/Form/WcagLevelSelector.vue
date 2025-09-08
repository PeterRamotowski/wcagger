<script setup lang="ts">
interface Props {
  modelValue: string;
  disabled?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
});

const emit = defineEmits<Emits>();

const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const selectedStandardInfo = computed(() => {
  return wcagStandards[props.modelValue] || null;
});
</script>

<template>
  <div class="mb-6">
    <label for="wcagLevel" class="block text-sm font-medium text-gray-700 mb-2">
      {{ $t('wcag_standard_level') }}
    </label>
    <select
      id="wcagLevel"
      v-model="localValue"
      class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      :disabled="disabled"
    >
      <optgroup :label="$t('wcag_20_label')">
        <option value="WCAG20A">{{ $t('wcag_20_a') }}</option>
        <option value="WCAG22AA">{{ $t('wcag_22_aa') }}</option>
        <option value="WCAG20AAA">{{ $t('wcag_20_aaa') }}</option>
      </optgroup>
      
      <optgroup :label="$t('wcag_21_label')">
        <option value="WCAG21A">{{ $t('wcag_21_a') }}</option>
        <option value="WCAG21AA">{{ $t('wcag_21_aa') }}</option>
        <option value="WCAG21AAA">{{ $t('wcag_21_aaa') }}</option>
      </optgroup>
      
      <optgroup :label="$t('wcag_22_label')">
        <option value="WCAG22A">{{ $t('wcag_22_a') }}</option>
        <option value="WCAG22AA">{{ $t('wcag_22_aa') }}</option>
        <option value="WCAG22AAA">{{ $t('wcag_22_aaa') }}</option>
      </optgroup>
    </select>

    <div v-if="selectedStandardInfo" class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
      <div class="text-sm text-blue-800">
        <strong>{{ selectedStandardInfo.name }}</strong>
        <p class="mt-1">{{ selectedStandardInfo.description }}</p>
        <p v-if="selectedStandardInfo.recommendation" class="mt-1 font-medium">
          {{ selectedStandardInfo.recommendation }}
        </p>
      </div>
    </div>
  </div>
</template>
