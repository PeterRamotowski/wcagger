import { inspectCandidate } from '~~/server/services/candidateInspectionService'

export default defineEventHandler(async (event) => {
  try {
    return await inspectCandidate(await readBody(event))
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Inspection failed' })
  }
})
