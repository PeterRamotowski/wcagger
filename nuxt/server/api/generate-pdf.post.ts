import { generateAccessibilityPDF } from '~~/server/utils/pdf/pdfGenerator';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    if (!body.results || !body.selectedTools || !body.wcagLevel) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field/s'
      });
    }

    const timeZone = typeof body.timeZone === 'string' ? body.timeZone : undefined;

    const pdfBuffer = await generateAccessibilityPDF({
      event,
      results: body.results,
      selectedTools: body.selectedTools,
      wcagLevel: body.wcagLevel,
      selectedStandardInfo: body.selectedStandardInfo,
      timeZone
    });

    setHeader(event, 'Content-Type', 'application/pdf');
    setHeader(event, 'Content-Disposition', `attachment; filename="accessibility-report-${new Date().toISOString().split('T')[0]}.pdf"`);

    const buffer = Buffer.from(pdfBuffer);
    return buffer;
  }
  catch (error) {
    console.error('Error generating PDF:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate PDF report'
    });
  }
});
