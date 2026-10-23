import { describe, expect, it } from 'vitest'
import { parse } from 'csv-parse/sync'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { prepareExportData, generateJSONContent, generateCSVContent } from '../app/utils/exportReport'
import { generateGroupedReportHTML } from '../server/utils/pdf/groupedReportTemplate'
import { reportFixture } from './fixtures/groupedReport'

function event(locale = 'en') {
  const request = new IncomingMessage(new Socket())
  request.headers.cookie = 'i18n_detected=' + locale
  return createEvent(request, new ServerResponse(request))
}

describe('report exports', () => {
  it('exports captured metadata and complete original evidence in versioned JSON', () => {
    const scan = reportFixture()
    const data = JSON.parse(generateJSONContent(prepareExportData(scan)))
    expect(data.schemaVersion).toBe(2)
    expect(data.url).toBe('https://example.test/start')
    expect(data.timestamp).toBe('2026-10-23T10:00:00.000Z')
    expect(data.selectedTools).toEqual(['axe', 'pa11y'])
    expect(data.standards).toEqual(['WCAG22AA'])
    expect(data.evidence).toEqual(JSON.parse(JSON.stringify(scan.evidence)))
    expect(data.summary.uniqueFindings).toBe(data.report.findings.length)
  })

  it('uses separate CSV record types so tool observations do not inflate finding counts', () => {
    const data = prepareExportData(reportFixture())
    const rows = parse(generateCSVContent(data), { columns: true }) as Record<string, string>[]
    const findings = rows.filter(row => row['Record type'] === 'finding')
    const observations = rows.filter(row => row['Record type'] === 'observation')
    expect(findings).toHaveLength(3)
    expect(observations).toHaveLength(8)
    expect(rows.filter(row => row['Record type'] === 'occurrence')).toHaveLength(3)
    const metadata = JSON.parse(rows[0]!.Details!)
    expect(metadata.summary).toEqual(data.summary)
    const button = findings.find(row => row['Issue type'] === 'axe:button-name')!
    expect(observations.filter(row => row['Finding ID'] === button['Finding ID'])).toHaveLength(2)
  })

  it('round-trips quotes, commas and newlines while neutralizing spreadsheet formulas', () => {
    const scan = reportFixture()
    scan.evidence.observations[0]!.title = '=SUM(1,2)\n"quoted"'
    const rows = parse(generateCSVContent(prepareExportData(scan)), { columns: true }) as Record<string, string>[]
    expect(rows.find(row => row['Observation ID'] === scan.evidence.observations[0]!.id)?.Title).toBe('\'=SUM(1,2)\n"quoted"')
  })

  it('renders every grouped finding and source in PDF HTML with matching counts', () => {
    const data = prepareExportData(reportFixture())
    const html = generateGroupedReportHTML(event(), data.report, 'Europe/Warsaw')
    for (const finding of data.report.findings) expect(html).toContain(finding.title)
    expect(html).toContain('<span class="number">3</span>Unique findings')
    expect(html).toContain('Pa11y / Axe')
    expect(html).toContain('Pa11y / HTMLCS')
    expect(html).toContain('2026')
    expect(html).not.toContain('more_warnings')
  })

  it('escapes untrusted titles, URLs, selectors and HTML in PDF markup', () => {
    const scan = reportFixture()
    scan.url = '<script>alert("url")</script>'
    for (const item of scan.evidence.observations) {
      item.title = '<script>alert("title")</script>'
      if (item.element) item.element.html = '<img src=x onerror="alert(1)">'
    }
    const html = generateGroupedReportHTML(event(), prepareExportData(scan).report)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
  })

  it.each([['pl', 'Unikalne ustalenia'], ['nl', 'Unieke bevindingen']])('localizes grouped PDF labels for %s', (locale, label) => {
    expect(generateGroupedReportHTML(event(locale), prepareExportData(reportFixture()).report)).toContain(label)
  })
})
