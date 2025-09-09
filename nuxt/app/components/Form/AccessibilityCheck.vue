<script setup lang="ts">
import { ChevronRightIcon } from '@heroicons/vue/24/outline';

interface Props {
  url: string;
  selectedTools: string[];
  selectedRunners: string[];
  wcagLevel: string;
  isLoading: boolean;
}

interface Emits {
  (e: 'update:url', value: string): void;
  (e: 'update:selectedTools', value: string[]): void;
  (e: 'update:selectedRunners', value: string[]): void;
  (e: 'update:wcagLevel', value: string): void;
  (e: 'submit'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const localUrl = computed({
  get: () => props.url,
  set: (value) => emit('update:url', value)
});

const localSelectedTools = computed({
  get: () => props.selectedTools,
  set: (value) => emit('update:selectedTools', value)
});

const localSelectedRunners = computed({
  get: () => props.selectedRunners,
  set: (value) => emit('update:selectedRunners', value)
});

const localWcagLevel = computed({
  get: () => props.wcagLevel,
  set: (value) => emit('update:wcagLevel', value)
});

const handleSubmit = () => {
  emit('submit');
};
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-8">
    <div class="max-w-2xl mx-auto text-center">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">
        {{ $t('test_website_accessibility') }}
      </h2>
      <p class="text-gray-600 mb-8">
        {{ $t('enter_url_check_wcag') }}
      </p>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <div class="relative">
          <label for="url-input" class="sr-only">{{ $t('website_url') }}</label>
          <input
            id="url-input"
            v-model="localUrl"
            type="url"
            placeholder="https://example.com"
            required
            class="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            :disabled="isLoading"
            aria-describedby="url-help"
          />
          <div id="url-help" class="mt-2 text-sm text-gray-500">
            {{ $t('enter_complete_url') }}
          </div>
        </div>

        <FormToolSelector v-model="localSelectedTools" :selected-runners="localSelectedRunners" @update:selected-runners="localSelectedRunners = $event" :disabled="isLoading" />
        
        <FormWcagLevelSelector v-model="localWcagLevel" :disabled="isLoading" />

        <button
          type="submit"
          :disabled="isLoading || !localUrl.trim() || (!localSelectedTools.includes('axe') && !localSelectedTools.includes('pa11y'))"
          class="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          <span v-if="!isLoading" class="flex items-center justify-center space-x-2">
            <span>{{ $t('start_accessibility_check') }}</span>
            <ChevronRightIcon class="w-5 h-5" />
          </span>
          <span v-else class="flex items-center justify-center space-x-2">
            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>{{ $t('analyzing') }}</span>
          </span>
        </button>
      </form>
    </div>
  </div>
</template>
