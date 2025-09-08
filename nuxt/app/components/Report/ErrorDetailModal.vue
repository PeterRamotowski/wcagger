<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue'
import {
  ExclamationTriangleIcon,
  XMarkIcon,
  QuestionMarkCircleIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/vue/24/outline'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  error: {
    type: Object,
    default: null
  }
})

defineEmits(['close'])

const getErrorTitle = () => {
  if (!props.error) return $t('error_details')
  return props.error.violation?.title || $t('accessibility_issue_details')
}

const getElementSelector = () => {
  if (!props.error?.node) return $t('not_available')
  if (props.error.node.target) {
    return Array.isArray(props.error.node.target) ? props.error.node.target.join(', ') : props.error.node.target
  }
  return props.error.node.selector || $t('unknown_selector')
}

const formatHtml = (html: string | undefined) => {
  if (!html) return $t('no_html_available')
  // Pretty print HTML with basic indentation
  return html.replace(/></g, '>\n<').replace(/^\s+|\s+$/g, '')
}

const hasChecksDetails = () => {
  if (!props.error?.node) return false
  return (props.error.node.any && props.error.node.any.length > 0) ||
         (props.error.node.all && props.error.node.all.length > 0) ||
         (props.error.node.none && props.error.node.none.length > 0)
}
</script>

<template>
  <TransitionRoot :show="isOpen" as="template">
    <Dialog as="div" class="relative z-50" @close="$emit('close')">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel class="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
              <div class="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                <button
                  type="button"
                  class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  @click="$emit('close')"
                >
                  <span class="sr-only">{{ $t('close') }}</span>
                  <XMarkIcon class="h-6 w-6" aria-hidden="true" />
                </button>
              </div>

              <div v-if="error">
                <div class="sm:flex sm:items-start">
                  <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <div class="sm:flex sm:items-center">
                      <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                        <ExclamationTriangleIcon class="h-6 w-6 text-red-600" aria-hidden="true" />
                      </div>
                      <DialogTitle as="h3" class="ml-3 mr-8 text-lg font-medium leading-6 text-gray-900">
                        {{ getErrorTitle() }}
                      </DialogTitle>
                    </div>
                    <div class="mt-4 space-y-4">
                      <!-- Error Summary -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <div class="flex items-center space-x-2 mb-2">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {{ error.violation?.impact || $t('error') }}
                          </span>
                          <ReportAccessibilitySourceBadge 
                            :source="error.violation.source" 
                            :runner="error.violation.runner" 
                          />
                          <span class="text-xs bg-gray-200 text-gray-400 font-medium ml-1 px-2.5 py-0.5 rounded-full break-all">
                            {{ error.violation?.code }}
                          </span>
                        </div>
                        <p class="text-sm text-gray-700 mb-3">
                          {{ error.violation?.title }}
                        </p>
                        <div v-if="error.violation?.description" class="text-sm text-gray-600">
                          <strong>{{ $t('description') }}:</strong> {{ error.violation.description }}
                        </div>
                      </div>

                      <!-- Element Details -->
                      <div v-if="error.node" class="space-y-3">
                        <h4 class="font-medium text-gray-900">{{ $t('affected_element') }}</h4>

                        <!-- Element Selector -->
                        <div class="bg-blue-50 rounded-lg p-3">
                          <p class="text-sm font-medium text-gray-700 mb-1">{{ $t('css_selector') }}</p>
                          <code class="text-sm font-mono text-wrap text-blue-700 bg-white px-2 py-1 rounded border">
                            {{ getElementSelector() }}
                          </code>
                        </div>

                        <!-- Element HTML -->
                        <div v-if="error.node.html" class="bg-gray-50 rounded-lg p-3">
                          <p class="text-sm font-medium text-gray-700 mb-2">{{ $t('html_context') }}</p>
                          <pre class="text-xs font-mono text-wrap text-gray-600 bg-white p-3 rounded border overflow-x-auto">{{ formatHtml(error.node.html) }}</pre>
                        </div>

                        <!-- Failure Summary -->
                        <div v-if="error.node.failureSummary" class="bg-red-50 rounded-lg p-3">
                          <p class="text-sm font-medium text-red-800 mb-1">{{ $t('issue_summary') }}</p>
                          <p class="text-sm text-red-700">{{ error.node.failureSummary }}</p>
                        </div>

                        <!-- Technical Details -->
                        <div v-if="hasChecksDetails()" class="space-y-2">
                          <h5 class="text-sm font-medium text-gray-900">{{ $t('technical_details') }}</h5>

                          <!-- Failed Checks -->
                          <div v-if="error.node.any && error.node.any.length > 0" class="bg-red-50 rounded p-2">
                            <p class="text-xs font-medium text-red-800 mb-1">{{ $t('failed_checks') }}</p>
                            <ul class="text-xs text-red-700 space-y-1">
                              <li v-for="check in error.node.any" :key="check.id" class="flex items-start">
                                <span class="w-1 h-1 bg-red-500 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                                <span>{{ check.message }}</span>
                              </li>
                            </ul>
                          </div>

                          <!-- Required Checks -->
                          <div v-if="error.node.all && error.node.all.length > 0" class="bg-yellow-50 rounded p-2">
                            <p class="text-xs font-medium text-yellow-800 mb-1">{{ $t('required_checks') }}</p>
                            <ul class="text-xs text-yellow-700 space-y-1">
                              <li v-for="check in error.node.all" :key="check.id" class="flex items-start">
                                <span class="w-1 h-1 bg-yellow-500 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                                <span>{{ check.message }}</span>
                              </li>
                            </ul>
                          </div>
                        </div>

                        <!-- WCAG Guidelines -->
                        <div v-if="error.violation?.tags" class="bg-green-50 rounded-lg p-3">
                          <p class="text-sm font-medium text-green-800 mb-2">{{ $t('wcag_guidelines') }}</p>
                          <div class="flex flex-wrap gap-1">
                            <span
                              v-for="tag in error.violation.tags"
                              :key="tag"
                              class="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded"
                            >
                              {{ tag.toUpperCase() }}
                            </span>
                          </div>
                        </div>
                      </div>

                      <!-- Help Link -->
                      <div v-if="error.violation?.helpUrl" class="pt-3 border-t border-gray-200">
                        <a
                          :href="error.violation.helpUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                        >
                          <QuestionMarkCircleIcon class="w-4 h-4 mr-1" />
                          {{ $t('learn_more_about_rule') }}
                          <ArrowTopRightOnSquareIcon class="w-4 h-4 ml-1" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                    @click="$emit('close')"
                  >
                    {{ $t('close') }}
                  </button>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
