import { combineEvaluationResults } from '~~/server/services/evaluationResultsService'

export default defineEventHandler(async (event) => {
  try {
    return { success: true, data: combineEvaluationResults(await readBody(event)) }
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Invalid evaluation results' })
  }
})
