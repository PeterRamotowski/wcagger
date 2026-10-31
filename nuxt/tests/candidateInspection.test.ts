import { afterEach, describe, expect, it } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { classifyStaticHtml, inspectCandidate, readInspectionPage, validateInspectionRequest } from '../server/services/candidateInspectionService'
import { newEvaluation, newRecordId, validateEvaluation } from '../shared/utils/evaluation'
import { normalizeCandidateInspection } from '../shared/utils/candidateInspection'
import { selectRandomSamples } from '../server/services/evaluationSamplingService'
import { readonly } from 'vue'
import { parse as parseCSV } from 'csv-parse/sync'
import { emptyEvaluationReport } from '../shared/utils/manualAssessments'
import { prepareExportData, generateCSVContent, generateJSONContent } from '../app/utils/exportReport'
import { generatePlanningHTML } from '../server/utils/pdf/planningTemplate'
import { escapeReportHTML } from '../server/utils/pdf/groupedReportTemplate'
import en from '../i18n/locales/en.json'
import { savedFixture } from './fixtures/savedEvaluation'
import { validateSavedEvaluation } from '../shared/utils/savedEvaluation'

const servers: http.Server[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve) => {
    server.closeAllConnections()
    server.close(() => resolve())
  })))
})
async function fixture(handler: http.RequestListener) {
  const server = http.createServer(handler)
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return 'http://inspection.test:' + (server.address() as AddressInfo).port
}
const inspection = () => ({ schemaVersion: 1 as const, method: 'static-html-v1' as const, requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/', inspectedAt: '2026-10-24T10:00:00Z', durationLimitMs: 10000, byteLimit: 262144, bytes: 100, contentType: 'text/html', title: 'Example', suggestedTypes: ['Forms'] })
describe('bounded static candidate inspection', () => {
  it('validates limits and public targets without permitting credentials or alternate protocols', async () => {
    for (const input of [{ url: 'file:///etc/passwd', durationMs: 5000, byteLimit: 131072 }, { url: 'https://u:p@example.com/', durationMs: 5000, byteLimit: 131072 }, { url: 'https://example.com/', durationMs: 99999, byteLimit: 131072 }, { url: 'https://example.com/', durationMs: 5000, byteLimit: 99999999 }]) expect(() => validateInspectionRequest(input)).toThrow()
    await expect(inspectCandidate({ url: 'http://127.0.0.1/', durationMs: 5000, byteLimit: 131072 })).rejects.toThrow('private')
  })
  it('extracts static content features, excluding scripts and templates instead of inferring a page archetype', () => {
    const result = classifyStaticHtml('<title>Example &amp; title</title><article><form></form><table></table><video src="https://external.test/video"></video></article><script>fetch("https://external.test"); "<form>"</script><template><audio></audio></template>')
    expect(result).toEqual({ title: 'Example & title', suggestedTypes: ['Articles', 'Audio or video', 'Forms', 'Tables'] })
    expect(classifyStaticHtml('<script>"<form>"</script><template><table></table></template>').suggestedTypes).toEqual([])
  })
  it('reads only the selected document and same-origin redirects using a checked address', async () => {
    const paths: string[] = []
    const origin = await fixture((request, response) => {
      paths.push(request.url!)
      expect(request.headers.cookie).toBeUndefined()
      if (request.url === '/start') response.writeHead(302, { location: '/page?x=1' }).end()
      else response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<title>Page</title><img src="/image"><a href="/another">Next</a><script src="/code"></script>')
    })
    const hosts: string[] = []
    const page = await readInspectionPage({ url: origin + '/start#fragment', durationMs: 5000, byteLimit: 131072 }, AbortSignal.timeout(1000), async (host) => {
      hosts.push(host)
      return '127.0.0.1'
    })
    expect(page.finalUrl).toBe(origin + '/page?x=1')
    expect(paths).toEqual(['/start', '/page?x=1'])
    expect(hosts).toEqual(['inspection.test', 'inspection.test'])
    expect(page.bytes).toBe(Buffer.byteLength(page.html))
  })
  it('refuses cross-origin redirects and stops redirect loops without following links', async () => {
    let count = 0
    const origin = await fixture((request, response) => {
      count++
      response.writeHead(302, { location: request.url === '/cross' ? 'http://127.0.0.1/private' : '/loop' }).end()
    })
    const read = (path: string) => readInspectionPage({ url: origin + path, durationMs: 5000, byteLimit: 131072 }, AbortSignal.timeout(1000), async () => '127.0.0.1')
    await expect(read('/cross')).rejects.toThrow('origin')
    expect(count).toBe(1)
    await expect(read('/loop')).rejects.toThrow('redirect limit')
    expect(count).toBe(5)
  })
  it('rejects oversized bodies both with and without a content-length header', async () => {
    const origin = await fixture((request, response) => {
      response.writeHead(200, { 'content-type': 'text/html', ...(request.url === '/header' && { 'content-length': '200000' }) })
      response.end('x'.repeat(140000))
    })
    for (const path of ['/header', '/stream']) await expect(readInspectionPage({ url: origin + path, durationMs: 5000, byteLimit: 131072 }, AbortSignal.timeout(1000), async () => '127.0.0.1')).rejects.toThrow('byte limit')
  })
  it('aborts slow responses and refuses non-HTML, failed and compressed responses', async () => {
    const origin = await fixture((request, response) => {
      if (request.url === '/slow') return
      if (request.url === '/pdf') response.writeHead(200, { 'content-type': 'application/pdf' }).end('pdf')
      else if (request.url === '/failed') response.writeHead(503).end('Unavailable')
      else response.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }).end('data')
    })
    const read = (path: string, timeout = 1000) => readInspectionPage({ url: origin + path, durationMs: 5000, byteLimit: 131072 }, AbortSignal.timeout(timeout), async () => '127.0.0.1')
    await expect(read('/slow', 30)).rejects.toThrow()
    await expect(read('/pdf')).rejects.toThrow('Only HTML')
    await expect(read('/failed')).rejects.toThrow('503')
    await expect(read('/compressed')).rejects.toThrow('Compressed')
  })
  it('exports captured inspection provenance separately from findings, with escaped labels', () => {
    const evaluation = newEvaluationFixture()
    evaluation.sampling!.candidates[0] = { ...evaluation.sampling!.candidates[0]!, name: '<img src=x>', typeTags: ['Reviewed form'], inspection: inspection() }
    const result = emptyEvaluationReport(evaluation)
    const data = prepareExportData(readonly(result))
    const exported = JSON.parse(generateJSONContent(data))
    expect(exported.evidence.evaluation.sampling.candidates[0].inspection).toEqual(inspection())
    const rows = parseCSV(generateCSVContent(data), { columns: true }) as Record<string, string>[]
    expect(rows.filter(row => row['Record type'] === 'candidate-inspection')).toHaveLength(1)
    expect(rows.filter(row => row['Record type'] === 'finding')).toHaveLength(0)
    const html = generatePlanningHTML(data.report, key => (en as Record<string, string>)[key] ?? key, escapeReportHTML)
    expect(html).toContain('&lt;img src=x&gt;')
    expect(html).toContain('Reviewed form')
    expect(html).toContain('static-html-v1')
    expect(html).not.toContain('<img src=x>')
  })
  it('keeps accepted labels separate from captured suggestions through normalization, draws and saving', () => {
    const value = newEvaluation()
    value.samples[0]!.url = 'https://example.com/structured'
    value.sampling!.source = 'Reviewed inventory'
    value.sampling!.candidates = [{ id: newRecordId(), url: 'https://example.com/', name: 'Reviewed name', stateDescription: 'Initial page state', preparation: 'initial-page', typeTags: ['Contact form'], inspection: inspection() }]
    const selected = selectRandomSamples(value, () => 0)
    expect(selected.samples[1]!.typeTags).toEqual(['Contact form'])
    expect(selected.sampling!.draws[0]!.pool[0]!.inspection!.suggestedTypes).toEqual(['Forms'])
    const workspace = savedFixture()
    workspace.evaluation = selected
    const reopened = validateSavedEvaluation(workspace)
    expect(reopened.evaluation.sampling!.candidates[0]!.inspection).toEqual(inspection())
    expect(validateEvaluation(newEvaluationFixture()).sampling!.candidates[0]).not.toHaveProperty('inspection')
    expect(() => normalizeCandidateInspection({ ...inspection(), bytes: 999999 })).toThrow()
    expect(() => normalizeCandidateInspection({ ...inspection(), finalUrl: 'https://another.test/' })).toThrow()
    expect(() => normalizeCandidateInspection({ ...inspection(), schemaVersion: 2 })).toThrow()
  })
})
function newEvaluationFixture() {
  const value = newEvaluation()
  value.samples[0]!.url = 'https://example.com/'
  value.sampling!.candidates = [{ id: 'legacy', url: 'https://example.com/', name: '', stateDescription: 'Initial page state', preparation: 'initial-page' }]
  return value
}
