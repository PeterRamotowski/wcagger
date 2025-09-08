<script setup lang="ts">
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  CheckCircleIcon
} from '@heroicons/vue/24/outline';

interface Props {
  results: AccessibilityCheckResults;
}

defineProps<Props>();
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div class="flex items-center">
        <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
          <ExclamationTriangleIcon class="w-6 h-6 text-red-600" />
        </div>
        <div class="ml-4">
          <p class="text-2xl font-bold text-gray-900">{{ results.summary.totalViolations }}</p>
          <p class="text-sm text-gray-600">{{ $t('violations_found') }}</p>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div class="flex items-center">
        <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
          <ExclamationCircleIcon class="w-6 h-6 text-yellow-600" />
        </div>
        <div class="ml-4">
          <p class="text-2xl font-bold text-gray-900">{{ results.summary.totalWarnings }}</p>
          <p class="text-sm text-gray-600">{{ $t('warnings') }}</p>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div class="flex items-center">
        <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
          <CheckCircleIcon class="w-6 h-6 text-green-600" />
        </div>
        <div class="ml-4">
          <p class="text-2xl font-bold text-gray-900">{{ results.summary.totalPassed }}</p>
          <p class="text-sm text-gray-600">{{ $t('passed_tests') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
