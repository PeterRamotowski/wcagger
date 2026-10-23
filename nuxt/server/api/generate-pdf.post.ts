import { generateAccessibilityPDF } from '~~/server/utils/pdf/pdfGenerator'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body?.results?.evidence?.grouping) throw createError({ statusCode: 400, statusMessage: 'Grouped scan results are required' })
  const buffer = await generateAccessibilityPDF({ event, results: body.results, timeZone: typeof body.timeZone === 'string' ? body.timeZone : undefined })
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', 'attachment; filename="accessibility-report.pdf"')
  return Buffer.from(buffer)
})
