// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { CandidateImportError, MAX_IMPORT_BYTES, parseCandidateImport, reviewCandidateImport } from '../app/utils/candidateImport'
import type { CandidateImportFormat } from '../app/utils/candidateImport'
import { validateEvaluation, newEvaluation } from '../shared/utils/evaluation'

const parse = (value: unknown) => parseCandidateImport(JSON.stringify(value), 'json')
function rejects(input: string, format: CandidateImportFormat, code: string) {
  try {
    parseCandidateImport(input, format)
    throw new Error('Expected import rejection')
  } catch (error) {
    expect(error).toBeInstanceOf(CandidateImportError)
    expect((error as CandidateImportError).code).toBe(code)
  }
}
describe('local candidate inventory imports', () => {
  it('reads sitemap page locations without importing image or language alternatives', () => {
    const rows = parseCandidateImport('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"><url><loc>https://example.com/a?x=1&amp;y=2#main</loc><image:image><image:loc>https://example.com/photo.jpg</image:loc></image:image></url></urlset>', 'sitemap')
    expect(rows).toEqual([{ url: 'https://example.com/a?x=1&y=2#main', name: '', stateDescription: 'Initial page state', preparation: 'initial-page', selected: true }])
  })
  it('refuses indexes, XML declarations, unexpected roots and missing page locations', () => {
    rejects('<sitemapindex><sitemap><loc>https://example.com/map.xml</loc></sitemap></sitemapindex>', 'sitemap', 'sitemap-index')
    rejects('<!DOCTYPE urlset [<!ENTITY x SYSTEM "https://example.com/secret">]><urlset/>', 'sitemap', 'xml-declaration')
    rejects('<html><loc>https://example.com</loc></html>', 'sitemap', 'format')
    rejects('<urlset><url/></urlset>', 'sitemap', 'format')
  })
  it('parses CSV quoting, UTF-8 BOM, embedded newlines and explicit manual states', () => {
    const rows = parseCandidateImport('\uFEFFurl,name,stateDescription,preparation,ignored\r\nhttps://example.com/form,"Form, ""send""","Error\nstate",manual,unused', 'csv')
    expect(rows[0]).toMatchObject({ name: 'Form, "send"', stateDescription: 'Error\nstate', preparation: 'manual' })
    const evaluation = newEvaluation()
    evaluation.samples[0]!.url = 'https://example.com/'
    evaluation.sampling!.candidates = rows.map((row, index) => ({ ...row, id: 'import-' + index, preparation: row.preparation as 'manual' }))
    expect(validateEvaluation(evaluation).sampling!.candidates[0]!.stateDescription).toBe('Error\nstate')
  })
  it('rejects malformed CSV and JSON structures atomically', () => {
    rejects('address\nhttps://example.com', 'csv', 'format')
    rejects('url,url\nhttps://example.com,https://example.com', 'csv', 'format')
    rejects('url,name\nhttps://example.com,"unclosed', 'csv', 'format')
    rejects('url,name\nhttps://example.com,"closed"suffix', 'csv', 'format')
    rejects('url,name\nhttps://example.com', 'csv', 'format')
    rejects('{}', 'json', 'format')
    rejects('[{"url":123}]', 'json', 'format')
    rejects('["https://example.com"]', 'json', 'format')
  })
  it('enforces byte and record bounds before applying any import', () => {
    rejects('a'.repeat(MAX_IMPORT_BYTES + 1), 'csv', 'size')
    rejects('ą'.repeat(MAX_IMPORT_BYTES / 2 + 1), 'json', 'size')
    rejects(JSON.stringify(Array.from({ length: 501 }, () => ({ url: 'https://example.com/' }))), 'json', 'count')
    rejects('url\n' + Array.from({ length: 501 }, () => 'https://example.com/').join('\n'), 'csv', 'count')
    expect(parse(Array.from({ length: 500 }, (_, index) => ({ url: 'https://example.com/' + index })))).toHaveLength(500)
  })
  it('shows invalid and duplicate rows but retains intentional state, query and fragment differences', () => {
    const rows = parse([
      { url: 'https://example.com' }, { url: 'https://example.com/' },
      { url: 'https://example.com/?a=1#view' }, { url: 'https://example.com/', stateDescription: 'Dialog open', preparation: 'manual' },
      { url: 'javascript:alert(1)' }, { url: 'https://user:pass@example.com' }, { url: '/relative' }, { url: 'https://example.com/', stateDescription: '' },
    ])
    expect(reviewCandidateImport(rows, []).map(row => row.status)).toEqual(['ready', 'duplicate', 'ready', 'ready', 'invalid', 'invalid', 'invalid', 'invalid'])
    const existing = [{ id: 'existing', ...rows[0]!, preparation: 'initial-page' as const }]
    expect(reviewCandidateImport(rows, existing)[0]!.status).toBe('duplicate')
    rows[0]!.selected = false
    expect(reviewCandidateImport(rows, [])[1]!.status).toBe('ready')
  })
})
