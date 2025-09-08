<script setup lang="ts">
interface Props {
  source: 'axe' | 'pa11y'
  runner?: string
}

const props = defineProps<Props>()

const getBadgeClasses = (source: 'axe' | 'pa11y', runner?: string) => {
  if (source === 'axe') {
    return 'bg-blue-100 text-blue-800 border-blue-200'
  } else {
    // Pa11y with different colors for different runners
    if (runner === 'axe') {
      return 'bg-purple-100 text-purple-800 border-purple-200'
    } else if (runner === 'htmlcs') {
      return 'bg-green-100 text-green-800 border-green-200'
    } else {
      return 'bg-green-100 text-green-800 border-green-200'
    }
  }
}

const getBadgeText = (source: 'axe' | 'pa11y', runner?: string) => {
  if (source === 'axe') {
    return 'AXE'
  } else {
    if (runner === 'axe') {
      return 'PA11Y-AXE'
    } else if (runner === 'htmlcs') {
      return 'PA11Y-HTMLCS'
    } else {
      return 'PA11Y'
    }
  }
}
</script>

<template>
  <span 
    :class="getBadgeClasses(source, runner)" 
    class="inline-flex items-center px-2 py-0.5 ml-1 rounded-full text-xs font-medium border"
  >
    {{ getBadgeText(source, runner) }}
  </span>
</template>
