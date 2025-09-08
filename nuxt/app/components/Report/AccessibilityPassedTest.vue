<script setup lang="ts">
import { CheckCircleIcon } from '@heroicons/vue/24/outline';

interface Props {
  test: CombinedResultItem
}

defineProps<Props>()
</script>

<template>
  <div class="border border-green-200 rounded-lg p-3 bg-green-50">
    <div class="flex items-center space-x-2 mb-1">
      <CheckCircleIcon class="w-4 h-4 text-green-600" />
      <code class="text-xs font-mono bg-green-100 px-2 py-1 rounded text-green-800">
        {{ test.code }}
      </code>
      <ReportAccessibilitySourceBadge 
        :source="test.source" 
        :runner="test.runner"
        class="px-1.5 py-0.5"
      />
    </div>
    <p class="text-sm text-gray-700">{{ test.title }}</p>
    <p v-if="test.description" class="text-xs text-gray-600 mt-1">{{ test.description }}</p>
  </div>
</template>
