<script setup lang="ts">
import { QuestionMarkCircleIcon } from '@heroicons/vue/24/outline';

interface Props {
  violation: CombinedResultItem
  type: 'violation' | 'warning'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  showDetails: [violation: CombinedResultItem, node: ViolationNode]
}>()

const getViolationNodes = (violation: CombinedResultItem): readonly ViolationNode[] => {
  if (violation.nodes) {
    return violation.nodes as readonly ViolationNode[]
  }
  // For Pa11y style results
  return violation.selector ? [{ target: [violation.selector], html: violation.context }] : []
}

const getCardClasses = () => {
  return props.type === 'violation' 
    ? 'border border-red-200 rounded-lg p-4 bg-red-50'
    : 'border border-yellow-200 rounded-lg p-4 bg-yellow-50'
}

const getBadgeClasses = () => {
  return props.type === 'violation'
    ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800'
    : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800'
}

const getBadgeText = () => {
  return props.type === 'violation' 
    ? (props.violation.impact || 'error')
    : 'warning'
}

const handleShowDetails = (violation: CombinedResultItem, node: ViolationNode) => {
  emit('showDetails', violation, node)
}
</script>

<template>
  <div :class="getCardClasses()">
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <div class="flex items-center flex-wrap mb-2" :class="type === 'warning' ? 'space-x-2' : ''">
          <span :class="getBadgeClasses()">
            {{ getBadgeText() }}
          </span>
          <ReportAccessibilitySourceBadge 
            :source="violation.source" 
            :runner="violation.runner" 
          />
          <span class="text-xs bg-gray-200 text-gray-400 font-medium ml-1 px-2.5 py-0.5 rounded-full break-all">
            {{ violation.code }}
          </span>

          <!-- Help Link for violations -->
          <div v-if="violation.helpUrl && type === 'violation'" class="ml-auto">
            <a
              :href="violation.helpUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
            >
              <QuestionMarkCircleIcon class="w-4 h-4 mr-1" />
              {{ $t('help') }}
            </a>
          </div>
        </div>

        <h5 class="font-medium text-gray-900 mb-2 break-all md:break-normal">
          {{ violation.title }}
        </h5>

        <p v-if="type === 'violation' && violation.description" class="text-sm text-gray-600 mb-3">
          {{ violation.description }}
        </p>

        <!-- Element Information -->
        <div v-if="getViolationNodes(violation).length > 0">
          <p class="text-sm font-medium text-gray-700">
            {{ $t('affected_elements') }} ({{ getViolationNodes(violation).length }}):
          </p>
          <div class="my-2 max-h-48 overflow-y-auto">
            <ReportAccessibilityViolationNode
              v-for="(node, nodeIndex) in getViolationNodes(violation).slice(0, 3)"
              :key="nodeIndex"
              :node="node"
              :violation="violation"
              :show-details="type === 'violation'"
              @show-details="handleShowDetails"
            />
          </div>
          <div v-if="getViolationNodes(violation).length > 3" class="text-sm text-gray-500">
            {{ $t('more_elements', { count: getViolationNodes(violation).length - 3 }) }}
          </div>
        </div>
      </div>

      <!-- Help Link for warnings -->
      <div v-if="violation.helpUrl && type === 'warning'" class="ml-4">
        <a
          :href="violation.helpUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
        >
          <QuestionMarkCircleIcon class="w-4 h-4 mr-1" />
          {{ $t('help') }}
        </a>
      </div>
    </div>
  </div>
</template>
