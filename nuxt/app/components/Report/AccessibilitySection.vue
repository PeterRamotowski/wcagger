<script setup lang="ts">
interface Props {
  title: string
  count: number
  expanded: boolean
  icon: any
  titleColor: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggle: []
  showDetails: [violation: CombinedResultItem, node: ViolationNode]
}>()

const handleToggle = () => {
  emit('toggle')
}

const handleShowDetails = (violation: CombinedResultItem, node: ViolationNode) => {
  emit('showDetails', violation, node)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h4 class="text-lg font-semibold flex items-center" :class="titleColor">
        <component :is="icon" class="w-5 h-5 mr-2" />
        {{ title }} ({{ count }})
      </h4>
      <button
        @click="handleToggle"
        class="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
      >
        {{ expanded ? $t('collapse') : $t('expand') }}
      </button>
    </div>

    <div v-show="expanded">
      <slot @show-details="handleShowDetails" />
    </div>
  </div>
</template>
