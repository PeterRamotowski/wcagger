<script setup lang="ts">
import type { ManualAssessment } from '~~/shared/types/manualAssessment'
import type { AccessibilityCheckResults } from '~~/shared/types/accessibility'
import { newReportingNotes, normalizeReportingNotes } from '~~/shared/utils/reportingNotes'
import { scanMatchesSample, validateEvaluation, newEvaluation } from '~~/shared/utils/evaluation'
import { normalizeAssessments } from '~~/shared/utils/manualAssessments'
import { buildGroupedReport } from '~~/shared/utils/reportPresentation'
import { MAX_REPORT_HISTORY, MAX_ASSESSMENT_HISTORY } from '~~/shared/utils/savedEvaluation'
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

const { isLoading, loadingStep, results, error, checkAccessibility, applyGroupingDecision, isGrouping, groupingError, setResults, resetTest } = useAccessibilityCheck()
const { url, selectedTools, selectedRunners, wcagLevel, handleFormSubmit, exportReport, handlePDFGeneration } = useAccessibilityForm()
const mode = ref('quick')
const { scanHistory, detachBatch, currentRunIds, batchJob, batchReport, batchError, batchMatches, startBatch, retryBatch, refreshBatch, drawSamples, evaluation, scans, busySampleId, busy: evaluationBusy, error: evaluationError, sampleErrors, currentScan, scanSample, buildReport } = useEvaluation()
const assessments = ref<ManualAssessment[]>([])
const assessmentHistory = ref<ManualAssessment[]>([])
const reportHistory = ref<AccessibilityCheckResults[]>([])
const evaluationReport = ref<AccessibilityCheckResults | null>(null)
const reporting = ref(newReportingNotes())
const reviewPending = ref(false)
const manualPending = ref(false)
const pendingEdits = computed(() => manualPending.value || reviewPending.value)
const savedDetached = ref(false)
const workspaceError = ref<string | null>(null)
const saved = useSavedEvaluations(() => ({ evaluation: evaluation.value, reporting: reporting.value, assessments: assessments.value, assessmentHistory: assessmentHistory.value, sampleErrors: sampleErrors.value, scans: scans.value, scanHistory: scanHistory.value, report: evaluationReport.value, reportHistory: reportHistory.value, tools: selectedTools.value, runners: selectedRunners.value }), (value) => {
  detachBatch()
  evaluation.value = value.evaluation
  sampleErrors.value = value.sampleErrors ?? {}
  scans.value = value.scans
  scanHistory.value = value.scanHistory
  reporting.value = normalizeReportingNotes(value.reporting)
  assessments.value = value.assessments
  assessmentHistory.value = value.assessmentHistory
  reportHistory.value = value.reportHistory
  evaluationReport.value = value.report
  selectedTools.value = value.tools
  selectedRunners.value = value.runners
  savedDetached.value = true
  mode.value = 'evaluation'
  resetTest()
  if (value.report) setResults(value.report)
}, () => {
  detachBatch()
  evaluation.value = newEvaluation()
  sampleErrors.value = {}
  scans.value = {}
  scanHistory.value = []
  reporting.value = newReportingNotes()
  reviewPending.value = false
  assessments.value = []
  assessmentHistory.value = []
  reportHistory.value = []
  evaluationReport.value = null
  manualPending.value = false
  workspaceError.value = null
  resetTest()
})
const runIdsBySample = computed(() => Object.fromEntries(evaluation.value.samples.map(sample => [sample.id, currentRunIds(sample.id, selectedTools.value, selectedRunners.value)])))
const assessmentReport = computed(() => evaluationReport.value?.evidence.grouping ? buildGroupedReport(readonly(evaluationReport.value)) : null)
const publishEvaluationReport = (report: AccessibilityCheckResults) => {
  const old = evaluationReport.value
  const signature = (report: AccessibilityCheckResults) => report.evidence.runs.map(run => run.id).sort().join(',')
  if (old && signature(old) !== signature(report)) {
    if (reportHistory.value.length >= MAX_REPORT_HISTORY) {
      workspaceError.value = 'Report history is full. Download a backup and start a new workspace.'
      return
    }
    reportHistory.value.push(JSON.parse(JSON.stringify(old)))
  }
  const next = JSON.parse(JSON.stringify(report)) as AccessibilityCheckResults
  if (next.evidence.evaluation) {
    next.evidence.evaluation.manualAssessments = normalizeAssessments(assessments.value)
    next.evidence.evaluation.reporting = normalizeReportingNotes(reporting.value)
  }
  evaluationReport.value = next
  setResults(next)
}
const historyReady = () => {
  workspaceError.value = null
  if (reportHistory.value.length >= MAX_REPORT_HISTORY) {
    workspaceError.value = 'Report history is full. Download a backup and start a new workspace.'
    return false
  }
  return true
}
const startEvaluationBatch = () => {
  if (historyReady()) void startBatch(selectedTools.value, selectedRunners.value)
}
const startSampleScan = (id: string) => {
  if (historyReady()) void scanSample(id, selectedTools.value, selectedRunners.value)
}
const sampleStatuses = computed(() => Object.fromEntries(evaluation.value.samples.map((sample) => {
  if (batchJob.value && batchMatches(selectedTools.value, selectedRunners.value)) {
    const statuses = batchJob.value.tasks.filter(task => task.sampleId === sample.id).map(task => task.attempts[task.attempts.length - 1]!.status)
    const status = statuses.includes('running') ? 'scanning' : statuses.includes('queued') ? 'queued' : statuses.every(status => status === 'completed') ? 'scanned' : statuses.includes('completed') ? 'partial' : statuses.includes('failed') ? 'failed' : 'manual'
    return [sample.id, status]
  }
  return [sample.id, busySampleId.value === sample.id ? 'scanning' : currentScan(sample, selectedTools.value, selectedRunners.value) ? 'scanned' : scans.value[sample.id]?.status === 'partial' && scanMatchesSample(scans.value[sample.id], sample, evaluation.value.targetStandard, selectedTools.value, selectedRunners.value) ? 'partial' : scans.value[sample.id] ? 'stale' : sampleErrors.value[sample.id] ? 'failed' : sample.preparation === 'manual' ? 'manual' : 'unscanned']
})))
const canBuildEvaluation = computed(() => {
  try {
    validateEvaluation(evaluation.value)
    return true
  } catch { return false }
})
const workflowReviewReady = computed(() => {
  const report = evaluationReport.value
  if (!report?.evidence.evaluation) return false
  try {
    return JSON.stringify(validateEvaluation(evaluation.value)) === JSON.stringify(validateEvaluation(report.evidence.evaluation))
      && JSON.stringify(normalizeAssessments(assessments.value)) === JSON.stringify(normalizeAssessments(report.evidence.evaluation.manualAssessments))
      && JSON.stringify(Object.values(runIdsBySample.value).flat().sort()) === JSON.stringify(report.evidence.runs.map(run => run.id).sort())
  } catch { return false }
})
const buildEvaluationReport = async () => {
  if (!historyReady()) return
  const report = await buildReport(selectedTools.value, selectedRunners.value, evaluationReport.value ? readonly(evaluationReport.value) : null)
  if (report) publishEvaluationReport(report)
}
watch(mode, (value) => {
  resetTest()
  if (value === 'evaluation' && evaluationReport.value) setResults(evaluationReport.value)
}, { flush: 'sync' })
watch(results, (value) => {
  if (value?.evidence.evaluation?.id === evaluation.value.id && toRaw(value) !== toRaw(evaluationReport.value)) evaluationReport.value = JSON.parse(JSON.stringify(value))
})
watch(batchReport, (report) => {
  if (report)
    publishEvaluationReport(report)
})
watch(() => batchJob.value?.id, () => {
  if (!batchJob.value)
    return
  savedDetached.value = false
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
        :disabled="isLoading || evaluationBusy || isGrouping || pendingEdits || saved.busy.value"
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
      <EvaluationSavedProgress
        v-if="mode === 'evaluation'"
        :entries="saved.entries.value"
        :busy="evaluationBusy || isGrouping || saved.busy.value"
        :dirty="saved.dirty.value"
        :error="saved.error.value"
        :status="saved.status.value"
        :pending="pendingEdits"
        :history="{ scans: scanHistory.length, reports: reportHistory.length, assessments: assessmentHistory.length }"
        @refresh="saved.refreshList"
        @save="saved.save"
        @open="saved.load"
        @remove="saved.remove"
        @backup="saved.backup"
        @import="saved.importFile"
        @discard="saved.discard"
      />
      <p
        v-if="workspaceError"
        role="alert"
        class="mb-4 text-sm text-red-800"
      >
        {{ workspaceError }}
      </p>
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
        :busy="evaluationBusy || isGrouping || saved.busy.value || pendingEdits"
        :busy-sample-id="busySampleId"
        :statuses="sampleStatuses"
        :sample-errors="sampleErrors"
        :error="evaluationError"
        :can-build="canBuildEvaluation"
        @scan="startSampleScan"
        @build="buildEvaluationReport"
        @batch="startEvaluationBatch"
        @draw="drawSamples"
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

      <EvaluationAssessmentEditor
        v-if="mode === 'evaluation'"
        :key="evaluation.id"
        v-model="assessments"
        :evaluation="evaluation"
        :run-ids="runIdsBySample"
        :report="assessmentReport"
        :busy="evaluationBusy || isGrouping || saved.busy.value || reviewPending || assessmentHistory.length >= MAX_ASSESSMENT_HISTORY"
        @archive="assessmentHistory.push($event)"
        @pending="manualPending = $event"
      />
      <p
        v-if="assessmentHistory.length >= MAX_ASSESSMENT_HISTORY"
        class="mt-3 text-sm text-amber-800"
      >
        {{ $t('manual_history_full') }}
      </p>

      <EvaluationReportingEditor
        v-if="mode === 'evaluation'"
        :key="evaluation.id"
        v-model="reporting"
        :report="assessmentReport"
        :ready="workflowReviewReady"
        :busy="evaluationBusy || isGrouping || saved.busy.value || manualPending"
        @pending="reviewPending = $event"
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
                @decision="applyGroupingDecision($event, !savedDetached)"
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
