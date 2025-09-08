<script setup lang="ts">
interface Props {
  node: ViolationNode
  violation: CombinedResultItem
  showDetails?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showDetails: true
})

const emit = defineEmits<{
  showDetails: [violation: CombinedResultItem, node: ViolationNode]
}>()

const getNodeSelector = (node: ViolationNode): string => {
  if (node.target) {
    return Array.isArray(node.target) ? node.target.join(', ') : node.target
  }
  return node.selector || $t('unknown_selector')
}

const getNodeHtml = (node: ViolationNode): string => {
  if (node.html) {
    return node.html.length > 200 ? node.html.substring(0, 200) + '...' : node.html
  }
  return $t('no_html_context')
}

const handleShowDetails = () => {
  emit('showDetails', props.violation, props.node)
}
</script>

<template>
  <div class="bg-white border border-gray-200 rounded p-3">
    <div class="flex items-center justify-between mb-2">
      <code class="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded break-all md:break-normal">
        {{ getNodeSelector(node) }}
      </code>
      <button
        v-if="showDetails"
        @click="handleShowDetails"
        class="text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
      >
        {{ $t('details') }}
      </button>
    </div>
    <div class="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded break-all md:break-normal max-h-32 overflow-hidden">
      {{ getNodeHtml(node) }}
    </div>
  </div>
</template>
