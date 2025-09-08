export interface ViolationNode {
  target?: string | string[];
  html?: string;
  selector?: string;
  failureSummary?: string;
  any?: any[];
  all?: any[];
  none?: any[];
}

export interface Locale {
  code: string;
  name: string;
  iso?: string;
  file?: string;
}

export interface TestRequest {
  url: string;
  tools: string[];
  standard: string;
  runners?: string[]; // Pa11y runners: 'htmlcs', 'axe'
}

export interface WcagStandard {
  name: string;
  description: string;
  recommendation: string;
}

// Tool-specific processed results (server-side only)
export interface AxeProcessedResults {
  violations: any[];
  incomplete: any[];
  passes: any[];
}
export interface Pa11yProcessedResults {
  errors: any[];
  warnings: any[];
  notices: any[];
}

export interface CombinedResultItem {
  code?: string;
  impact?: string;
  title?: string;
  description?: string;
  helpUrl?: string;
  nodes?: readonly any[];
  selector?: string;
  context?: string;
  tags?: readonly string[];
  source: 'axe' | 'pa11y';
  runner?: string; // Pa11y runner
}

export interface CombinedResults {
  violations: readonly CombinedResultItem[];
  warnings: readonly CombinedResultItem[];
  passed: readonly CombinedResultItem[];
}

export interface AccessibilityCheckResults {
  url: string;
  timestamp: string;
  summary: {
    totalViolations: number;
    totalWarnings: number;
    totalPassed: number;
  };
  combined: CombinedResults;
}

// Export data structure for reports
export interface ExportData {
  url: string;
  timestamp: string;
  selectedTools: string[];
  summary: {
    totalViolations: number;
    totalWarnings: number;
    totalPassed: number;
  };
  combined: {
    violations: readonly CombinedResultItem[];
    warnings: readonly CombinedResultItem[];
    passed: readonly CombinedResultItem[];
  };
}

export interface ApiResponse {
  success: boolean;
  data?: AccessibilityCheckResults;
  error?: string;
  details?: string;
}
