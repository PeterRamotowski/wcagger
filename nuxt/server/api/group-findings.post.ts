import { reviewGrouping } from '~~/server/services/groupingReviewService'

export default defineEventHandler(async (event) => {
  try {
    return { success: true, data: reviewGrouping(await readBody(event)) }
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Invalid grouping request' })
  }
})
