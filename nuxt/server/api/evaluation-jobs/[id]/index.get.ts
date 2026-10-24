import { evaluationJobs } from '~~/server/services/evaluationJobService'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  try {
    return await evaluationJobs.get(getRouterParam(event, 'id') ?? '')
  } catch (error) {
    throw createError({ statusCode: error instanceof Error && error.message.includes('not found or expired') ? 404 : 500, statusMessage: error instanceof Error ? error.message : 'Evaluation job unavailable' })
  }
})
