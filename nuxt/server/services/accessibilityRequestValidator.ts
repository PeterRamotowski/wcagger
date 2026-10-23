import { AccessibilityTestError } from '~~/server/utils/errorHandler';
import {
  validateAccessibilityRequest,
  validateRunners,
  validateStandard,
  validateTools
} from '~~/server/utils/validation';
import type { TestRequest } from '~~/shared/types/accessibility';

type AccessibilityRequestBody = Partial<TestRequest> & {
  url?: string;
  tools?: string[];
  standard?: string;
  runners?: string[];
};

const DEFAULT_PA11Y_RUNNERS = ['htmlcs', 'axe'];

export class AccessibilityRequestValidator {
  validate(request: unknown): TestRequest {
    const body = request as AccessibilityRequestBody;
    const normalizedUrl = typeof body.url === 'string' ? body.url.trim() : '';
    const normalizedRequest = {
      ...body,
      url: normalizedUrl
    };

    const requestValidation = validateAccessibilityRequest(normalizedRequest);
    if (!requestValidation.isValid) {
      throw new AccessibilityTestError(requestValidation.error!, 400);
    }

    const validatedRequest = normalizedRequest as TestRequest;
    const { tools, standard } = validatedRequest;
    const hasPa11y = tools.includes('pa11y');
    const normalizedRunners = hasPa11y
      ? (validatedRequest.runners && validatedRequest.runners.length > 0
        ? validatedRequest.runners
        : DEFAULT_PA11Y_RUNNERS)
      : validatedRequest.runners;

    const toolsValidation = validateTools(tools);
    if (!toolsValidation.isValid) {
      throw new AccessibilityTestError(toolsValidation.error!, 400);
    }

    const standardValidation = validateStandard(standard);
    if (!standardValidation.isValid) {
      throw new AccessibilityTestError(standardValidation.error!, 400);
    }

    if (hasPa11y && normalizedRunners) {
      const runnersValidation = validateRunners(normalizedRunners);
      if (!runnersValidation.isValid) {
        throw new AccessibilityTestError(runnersValidation.error!, 400);
      }
    }

    return {
      url: normalizedUrl,
      tools,
      standard,
      runners: normalizedRunners
    };
  }
}