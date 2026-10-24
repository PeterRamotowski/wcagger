import { evaluationJobs } from '~~/server/services/evaluationJobService'

export default defineEventHandler(async (event) => {
  try {
    return await evaluationJobs.create(await readBody(event))
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Invalid evaluation job' })
  }
})
