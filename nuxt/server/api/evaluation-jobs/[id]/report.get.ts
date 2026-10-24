import { evaluationJobs } from '~~/server/services/evaluationJobService'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  try {
    return await evaluationJobs.report(getRouterParam(event, 'id') ?? '')
  } catch (error) {
    throw createError({ statusCode: 409, statusMessage: error instanceof Error ? error.message : 'Evaluation job unavailable' })
  }
})
