export function generateJSONContent(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

export function generateCSVContent(data: ExportData): string {
  const csvRows: string[][] = [];
  csvRows.push(['Tool', 'Runner', 'Type', 'Rule', 'Impact', 'Description', 'Element', 'Help URL']);

  if (data.combined && (data.combined.violations.length > 0 || data.combined.warnings.length > 0)) {
    data.combined.violations.forEach(violation => {
      const nodes = violation.nodes || (violation.selector ? [{ target: [violation.selector] }] : [])
      if (nodes.length === 0) {
        csvRows.push([
          violation.source.toUpperCase(),
          violation.runner || '',
          'Violation',
          violation.code || '',
          violation.impact || '',
          violation.title || '',
          violation.description || '',
          violation.helpUrl || ''
        ])
      } else {
        nodes.forEach((node: any) => {
          csvRows.push([
            violation.source.toUpperCase(),
            violation.runner || '',
            'Violation',
            violation.code || '',
            violation.impact || '',
            violation.title || '',
            Array.isArray(node.target) ? node.target.join(', ') : node.target || '',
            violation.helpUrl || ''
          ])
        })
      }
    })

    data.combined.warnings.forEach(warning => {
      const nodes = warning.nodes || (warning.selector ? [{ target: [warning.selector] }] : [])
      if (nodes.length === 0) {
        csvRows.push([
          warning.source.toUpperCase(),
          warning.runner || '',
          'Warning',
          warning.code || '',
          warning.impact || '',
          warning.title || '',
          warning.description || '',
          warning.helpUrl || ''
        ])
      } else {
        nodes.forEach((node: any) => {
          csvRows.push([
            warning.source.toUpperCase(),
            warning.runner || '',
            'Warning',
            warning.code || '',
            warning.impact || '',
            warning.title || '',
            Array.isArray(node.target) ? node.target.join(', ') : node.target || '',
            warning.helpUrl || ''
          ])
        })
      }
    })
  }

  return csvRows.map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n')
}

export function downloadFile(content: string | ArrayBuffer, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = downloadUrl;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object
  URL.revokeObjectURL(downloadUrl);
}

export function generateFilename(format: 'json' | 'csv'): string {
  const date = new Date().toISOString().split('T')[0];
  return `accessibility-report-${date}.${format}`;
}

export function prepareExportData(
  url: string,
  selectedTools: string[],
  results: Readonly<AccessibilityCheckResults>
): ExportData {
  const data: ExportData = {
    url,
    timestamp: new Date().toISOString(),
    selectedTools,
    summary: { ...results.summary },
    combined: results.combined
  }

  return data;
}

export function exportAccessibilityReport(
  format: 'json' | 'csv',
  url: string,
  selectedTools: string[],
  results: Readonly<AccessibilityCheckResults>
): void {
  if (!results) {
    console.warn('No results available for export');
    return;
  }

  const data = prepareExportData(url, selectedTools, results)
  let content: string
  let mimeType: string

  switch (format) {
    case 'json':
      content = generateJSONContent(data);
      mimeType = 'application/json';
      break;
    case 'csv':
      content = generateCSVContent(data);
      mimeType = 'text/csv';
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  const filename = generateFilename(format);
  downloadFile(content, filename, mimeType);
}

export function exportAsJSON(
  url: string,
  selectedTools: string[],
  results: Readonly<AccessibilityCheckResults>
): void {
  exportAccessibilityReport('json', url, selectedTools, results);
}

export function exportAsCSV(
  url: string,
  selectedTools: string[],
  results: Readonly<AccessibilityCheckResults>
): void {
  exportAccessibilityReport('csv', url, selectedTools, results);
}

export async function generatePDFReport(
  results: Readonly<AccessibilityCheckResults>,
  selectedTools: string[],
  wcagLevel: string,
  selectedStandardInfo: any
): Promise<void> {
  if (!results) {
    console.warn('No results available for PDF export');
    return;
  }

  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const response = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        results,
        selectedTools,
        wcagLevel,
        selectedStandardInfo,
        timeZone
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      throw new Error('Received empty PDF buffer');
    }

    const filename = `accessibility-report-${new Date().toISOString().split('T')[0]}.pdf`;
    downloadFile(arrayBuffer, filename, 'application/pdf');
  } catch (error) {
    console.error('Error generating PDF: ', error);
    throw new Error('Error generating PDF report. Please try again.');
  }
}
