import { selectRandomSamples } from '~~/server/services/evaluationSamplingService'

export default defineEventHandler(async (event) => {
  try {
    return selectRandomSamples(await readBody(event))
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Invalid sampling request' })
  }
})
