import { evaluationJobs } from '~~/server/services/evaluationJobService'
import { validateScanEvidence, reviewGrouping } from '~~/server/services/groupingReviewService'

export default defineEventHandler(async (event) => {
  try {
    const input = await readBody(event)
    const data = reviewGrouping(input)
    const evidence = validateScanEvidence(input.evidence)
    const jobId = evidence.evaluation?.execution?.jobId
    if (jobId) await evaluationJobs.review(jobId, evidence.runs.map(run => run.id), data.decisions)
    return { success: true, data }
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Invalid grouping request' })
  }
})
