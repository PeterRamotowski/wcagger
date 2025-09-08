<script setup lang="ts">
import { InformationCircleIcon } from '@heroicons/vue/24/outline'
</script>

<template>
  <div class="text-center py-8">
    <InformationCircleIcon class="mx-auto h-12 w-12 text-gray-400" />
  <h3 class="mt-2 text-sm font-medium text-gray-900">{{ $t('no_issues_found') }}</h3>
  <p class="mt-1 text-sm text-gray-500">{{ $t('combined_analysis_no_issues') }}</p>
  </div>
</template>
