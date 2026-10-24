import { evaluationJobs } from '~~/server/services/evaluationJobService'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  try {
    return await evaluationJobs.retry(getRouterParam(event, 'id') ?? '')
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Evaluation job unavailable' })
  }
})
