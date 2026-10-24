<script setup lang="ts">
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

const { isLoading, loadingStep, results, error, checkAccessibility, applyGroupingDecision, isGrouping, groupingError, setResults, resetTest } = useAccessibilityCheck()
const { url, selectedTools, selectedRunners, wcagLevel, handleFormSubmit, exportReport, handlePDFGeneration } = useAccessibilityForm()
const mode = ref('quick')
const { batchJob, batchReport, batchError, batchBusy, batchMatches, startBatch, retryBatch, refreshBatch, evaluation, scans, busySampleId, busy: evaluationBusy, error: evaluationError, sampleErrors, currentScan, scanSample, buildReport } = useEvaluation()
const sampleStatuses = computed(() => Object.fromEntries(evaluation.value.samples.map((sample) => {
  if (batchJob.value && batchMatches(selectedTools.value, selectedRunners.value)) {
    const statuses = batchJob.value.tasks.filter(task => task.sampleId === sample.id).map(task => task.attempts[task.attempts.length - 1]!.status)
    const status = statuses.includes('running') ? 'scanning' : statuses.includes('queued') ? 'queued' : statuses.every(status => status === 'completed') ? 'scanned' : statuses.includes('completed') ? 'partial' : statuses.includes('failed') ? 'failed' : 'manual'
    return [sample.id, status]
  }
  return [sample.id, busySampleId.value === sample.id ? 'scanning' : currentScan(sample, selectedTools.value, selectedRunners.value) ? 'scanned' : scans.value[sample.id] ? 'stale' : sample.preparation === 'manual' ? 'manual' : 'unscanned']
})))
const canBuildEvaluation = computed(() => Object.values(sampleStatuses.value).includes('scanned') || (!!batchJob.value && !batchBusy.value && batchMatches(selectedTools.value, selectedRunners.value)))
const buildEvaluationReport = async () => {
  const report = await buildReport(selectedTools.value, selectedRunners.value, results.value)
  if (report)
    setResults(report)
}
watch(mode, () => resetTest())
watch(batchReport, (report) => {
  if (report)
    setResults(report)
})
watch(() => batchJob.value?.id, () => {
  if (!batchJob.value)
    return
  selectedTools.value = [...batchJob.value.tools]
  selectedRunners.value = [...batchJob.value.runners]
  mode.value = 'evaluation'
})
useHead({
  title: $t('page_title'),
  meta: [
    { name: 'description', content: $t('page_description') },
  ],
})
interface SelectedError {
  violation: CombinedResultItem
  node: ViolationNode
  toolName: string
}
const selectedError = ref<SelectedError | null>(null)
const onFormSubmit = () => {
  handleFormSubmit((url, tools, standard, runners) => checkAccessibility(url, tools, standard, runners))
}
const onExportReport = (format: 'json' | 'csv') => {
  exportReport(format, results.value)
}
const onPDFGeneration = async () => {
  try {
    await handlePDFGeneration(results.value)
  } catch {
    alert($t('pdf_generation_error'))
  }
}
// Provide error selection method to child components
const selectError = (errorData: SelectedError) => {
  selectedError.value = errorData
}
provide('selectError', selectError)
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
    <header class="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between py-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-bold text-lg">W</span>
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900">
                {{ $t('wcag_checker') }}
              </h1>
              <p class="text-sm text-gray-600">
                {{ $t('accessibility_compliance_audit') }}
              </p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <fieldset
        class="mb-5 flex flex-wrap gap-4"
        :disabled="isLoading || evaluationBusy || isGrouping"
      >
        <legend class="sr-only">
          {{ $t('eval_mode') }}
        </legend>
        <label class="flex items-center gap-2"><input
          v-model="mode"
          type="radio"
          value="quick"
        >{{ $t('eval_quick') }}</label>
        <label class="flex items-center gap-2"><input
          v-model="mode"
          type="radio"
          value="evaluation"
        >{{ $t('eval_title') }}</label>
      </fieldset>
      <EvaluationJobProgress
        v-if="mode === 'evaluation' && (batchJob || batchError)"
        :job="batchJob"
        :error="batchError"
        :busy="evaluationBusy || isGrouping"
        @retry="retryBatch"
        @refresh="refreshBatch"
      />
      <EvaluationSampleEditor
        v-if="mode === 'evaluation'"
        v-model="evaluation"
        :busy="evaluationBusy || isGrouping"
        :busy-sample-id="busySampleId"
        :statuses="sampleStatuses"
        :sample-errors="sampleErrors"
        :error="evaluationError"
        :can-build="canBuildEvaluation"
        @scan="scanSample($event, selectedTools, selectedRunners)"
        @build="buildEvaluationReport"
        @batch="startBatch(selectedTools, selectedRunners)"
      >
        <FormToolSelector
          v-model="selectedTools"
          :selected-runners="selectedRunners"
          :disabled="evaluationBusy || isGrouping"
          @update:selected-runners="selectedRunners = $event"
        />
        <FormWcagLevelSelector
          v-model="evaluation.targetStandard"
          :disabled="evaluationBusy || isGrouping"
        />
      </EvaluationSampleEditor>
      <FormAccessibilityCheck
        v-else
        v-model:url="url"
        v-model:selected-tools="selectedTools"
        v-model:selected-runners="selectedRunners"
        v-model:wcag-level="wcagLevel"
        :is-loading="isLoading"
        @submit="onFormSubmit"
      />

      <LoadingIndicator
        v-if="isLoading"
        :step="loadingStep"
      />

      <!-- Results Section -->
      <div
        v-if="results && !isLoading"
        class="mt-8"
      >
        <EvaluationReportScope
          v-if="results.evidence.evaluation"
          :results="results"
        />
        <ReportAccessibilitySummary :results="results" />

        <div class="space-y-8">
          <div class="bg-white rounded-xl shadow-sm border border-gray-200">
            <div class="px-6 py-4 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900 flex items-center">
                <span class="w-2 h-2 bg-purple-500 rounded-full mr-3" />
                {{ $t('accessibility_results') }}
                <span class="ml-2 text-sm text-gray-500 font-normal">
                  ({{ [...new Set(results.evidence.runs.map(run => run.tool))].map(tool => tool.charAt(0).toUpperCase() + tool.slice(1)).join(' + ') }})
                </span>
              </h3>
              <p class="text-sm text-gray-600 mt-1">
                {{ $t('combined_results_description') }}
              </p>
            </div>
            <div class="p-6">
              <ReportGroupedAccessibility
                v-if="results.evidence.grouping"
                :results="results"
                :busy="isGrouping || evaluationBusy"
                :error="groupingError"
                @decision="applyGroupingDecision"
              />
              <ReportAccessibility
                v-else
                :violations="results.combined.violations"
                :warnings="results.combined.warnings"
                :passed="results.combined.passed"
              />
            </div>
          </div>

          <ExportReportSection
            @export="onExportReport"
            @generate-pdf="onPDFGeneration"
          />
        </div>
      </div>

      <!-- Error Message -->
      <div
        v-if="error && !isLoading"
        class="mb-8"
      >
        <div class="bg-red-50 border border-red-200 rounded-xl p-6">
          <div class="flex items-center">
            <ExclamationTriangleIcon class="w-6 h-6 text-red-600 mr-3" />
            <div>
              <h3 class="text-lg font-semibold text-red-800">
                {{ $t('error') }}
              </h3>
              <p class="text-red-700">
                {{ error }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="bg-white border-t border-gray-200 mt-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="text-center text-gray-600">
          <p>&copy; {{ new Date().getFullYear() }} {{ $t('footer_text') }}</p>
        </div>
      </div>
    </footer>

    <ReportErrorDetailModal
      :is-open="selectedError !== null"
      :error="selectedError || undefined"
      @close="selectedError = null"
    />
  </div>
</template>
