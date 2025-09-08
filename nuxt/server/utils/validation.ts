import validator from 'validator';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateAccessibilityRequest = (body: any): ValidationResult => {
  const { url, tools, standard } = body;

  if (!tools || tools.length === 0 || !standard) {
    return {
      isValid: false,
      error: 'Missing required parameters'
    };
  }

  if (!url) {
    return {
      isValid: false,
      error: 'URL is required'
    };
  }

  if (!validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true })) {
    return {
      isValid: false,
      error: 'Please provide a valid URL with http:// or https://'
    };
  }

  return { isValid: true };
};

export const validateTools = (tools: string[]): ValidationResult => {
  const validTools = ['axe', 'pa11y'];
  const invalidTools = tools.filter(tool => !validTools.includes(tool));
  
  if (invalidTools.length > 0) {
    return {
      isValid: false,
      error: `Invalid tools: ${invalidTools.join(', ')}. Valid tools are: ${validTools.join(', ')}`
    };
  }
  
  return { isValid: true };
};

export const validateStandard = (standard: string): ValidationResult => {
  const validStandards = [
    'WCAG20A', 'WCAG20AA', 'WCAG20AAA',
    'WCAG21A', 'WCAG21AA', 'WCAG21AAA',
    'WCAG22A', 'WCAG22AA', 'WCAG22AAA'
  ];
  
  if (!validStandards.includes(standard)) {
    return {
      isValid: false,
      error: `Invalid standard: ${standard}. Valid standards are: ${validStandards.join(', ')}`
    };
  }
  
  return { isValid: true };
};

export const validateRunners = (runners: string[]): ValidationResult => {
  const validRunners = ['htmlcs', 'axe'];
  const invalidRunners = runners.filter(runner => !validRunners.includes(runner));
  
  if (invalidRunners.length > 0) {
    return {
      isValid: false,
      error: `Invalid runners: ${invalidRunners.join(', ')}. Valid runners are: ${validRunners.join(', ')}`
    };
  }
  
  return { isValid: true };
};
