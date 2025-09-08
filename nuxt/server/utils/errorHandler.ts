export class AccessibilityTestError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: string
  ) {
    super(message);
    this.name = 'AccessibilityTestError';
  }
}

export const handleError = (error: unknown) => {
  console.error('Accessibility check error:', error);

  if (error instanceof AccessibilityTestError) {
    return {
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.details : undefined
    };
  }

  const err = error as Error;
  return {
    success: false,
    error: err.message || 'Failed to perform accessibility check',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  };
};
