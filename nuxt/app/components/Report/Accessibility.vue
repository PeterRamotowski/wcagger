<script setup lang="ts">
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  CheckCircleIcon
} from '@heroicons/vue/24/outline';

type SectionKey = 'violations' | 'warnings' | 'passed';

const props = defineProps<{
  violations: CombinedResultItem[]
  warnings: CombinedResultItem[]
  passed: CombinedResultItem[]
}>()

const selectError = inject<(error: { violation: CombinedResultItem; node: ViolationNode; toolName: string }) => void>('selectError')

const expandedSections = ref<Record<SectionKey, boolean>>({
  violations: true,
  warnings: false,
  passed: false
})

const isEmpty = computed(() => {
  return !props.violations?.length &&
         !props.warnings?.length &&
         !props.passed?.length
})

const toggleSection = (section: SectionKey) => {
  expandedSections.value[section] = !expandedSections.value[section]
}

const showErrorDetails = (violation: CombinedResultItem, node: ViolationNode) => {
  if (selectError) {
    selectError({
      violation,
      node,
      toolName: violation.source
    })
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Violations Section -->
    <ReportAccessibilitySection
      v-if="violations && violations.length > 0"
  :title="$t('violations')"
      :count="violations.length"
      :expanded="expandedSections.violations"
      :icon="ExclamationTriangleIcon"
      title-color="text-red-600"
      @toggle="toggleSection('violations')"
      @show-details="showErrorDetails"
    >
      <div class="space-y-4">
        <ReportAccessibilityViolationCard
          v-for="(violation, index) in violations"
          :key="`violation-${index}`"
          :violation="violation"
          type="violation"
          @show-details="showErrorDetails"
        />
      </div>
    </ReportAccessibilitySection>

    <!-- Warnings Section -->
    <ReportAccessibilitySection
      v-if="warnings && warnings.length > 0"
  :title="$t('warnings')"
      :count="warnings.length"
      :expanded="expandedSections.warnings"
      :icon="ExclamationCircleIcon"
      title-color="text-yellow-600"
      @toggle="toggleSection('warnings')"
      @show-details="showErrorDetails"
    >
      <div class="space-y-4">
        <ReportAccessibilityViolationCard
          v-for="(warning, index) in warnings"
          :key="`warning-${index}`"
          :violation="warning"
          type="warning"
          @show-details="showErrorDetails"
        />
      </div>
    </ReportAccessibilitySection>

    <!-- Passed Tests Section -->
    <ReportAccessibilitySection
      v-if="passed && passed.length > 0"
  :title="$t('passed_tests')"
      :count="passed.length"
      :expanded="expandedSections.passed"
      :icon="CheckCircleIcon"
      title-color="text-green-600"
      @toggle="toggleSection('passed')"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <ReportAccessibilityPassedTest
          v-for="(test, index) in passed"
          :key="`passed-${index}`"
          :test="test"
        />
      </div>
    </ReportAccessibilitySection>

    <!-- Empty State -->
    <ReportAccessibilityEmptyState v-if="isEmpty" />
  </div>
</template>
