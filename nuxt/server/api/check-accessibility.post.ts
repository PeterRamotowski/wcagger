import { AccessibilityCheckService } from '~~/server/services/accessibilityCheckService';
import { AccessibilityRequestValidator } from '~~/server/services/accessibilityRequestValidator';
import { handleError } from '~~/server/utils/errorHandler';
import type { TestRequest, ApiResponse } from '~~/shared/types/accessibility';

const requestValidator = new AccessibilityRequestValidator();
const accessibilityCheckService = new AccessibilityCheckService();

export default defineEventHandler(async (event) => {
  setHeader(event, 'Access-Control-Allow-Origin', '*');
  setHeader(event, 'Access-Control-Allow-Methods', 'POST');
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type');

  try {
    const body = await readBody<TestRequest>(event);
    const request = requestValidator.validate(body);
    const results = await accessibilityCheckService.run(request);

    const response: ApiResponse = {
      success: true,
      data: results
    };

    return response;

  } catch (error: unknown) {
    return handleError(error);
  }
});
