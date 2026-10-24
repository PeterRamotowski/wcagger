import type { SamplingCandidate } from '~~/shared/types/evaluation'
import { validSampleUrl } from '~~/shared/utils/evaluation'
import { MAX_CANDIDATES, sampleLocationKey } from '~~/shared/utils/sampling'

export const MAX_IMPORT_BYTES = 1024 * 1024
export type CandidateImportFormat = 'sitemap' | 'csv' | 'json'
export interface CandidateImportRow {
  url: string
  name: string
  stateDescription: string
  preparation: string
  selected: boolean
}
export type CandidateImportErrorCode = 'size' | 'count' | 'format' | 'sitemap-index' | 'xml-declaration'
export class CandidateImportError extends Error {
  constructor(public code: CandidateImportErrorCode) {
    super(code)
  }
}
function fail(code: CandidateImportErrorCode): never {
  throw new CandidateImportError(code)
}
const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'
function sitemapRows(input: string): Record<string, string>[] {
  // Reject declarations before parsing; never resolve entities or follow index URLs.
  if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(input)) fail('xml-declaration')
  const doc = new DOMParser().parseFromString(input, 'application/xml')
  const root = doc.documentElement
  if (!root || doc.getElementsByTagName('parsererror').length) fail('format')
  if (root.localName === 'sitemapindex') fail('sitemap-index')
  if (root.localName !== 'urlset' || (root.namespaceURI && root.namespaceURI !== namespace)) fail('format')
  const entries = Array.from(root.children).filter(child => child.localName === 'url' && child.namespaceURI === root.namespaceURI)
  if (!entries.length || entries.length > MAX_CANDIDATES) fail(entries.length ? 'count' : 'format')
  return entries.map((entry) => {
    const locations = Array.from(entry.children).filter(child => child.localName === 'loc' && child.namespaceURI === root.namespaceURI)
    if (locations.length !== 1 || locations[0]!.children.length) fail('format')
    return { url: locations[0]!.textContent ?? '' }
  })
}
function csvRows(input: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let closed = false
  const finishCell = () => {
    row.push(cell)
    cell = ''
    closed = false
  }
  const finishRow = () => {
    finishCell()
    if (row.some(value => value.trim())) rows.push(row)
    row = []
    if (rows.length > MAX_CANDIDATES + 1) fail('count')
  }
  for (let index = 0; index < input.length; index++) {
    const character = input[index]!
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          cell += '"'
          index++
        } else {
          quoted = false
          closed = true
        }
      } else cell += character
    } else if (character === ',') finishCell()
    else if (character === '\n' || character === '\r') {
      finishRow()
      if (character === '\r' && input[index + 1] === '\n') index++
    } else if (character === '"') {
      if (cell || closed) fail('format')
      quoted = true
    } else {
      if (closed) fail('format')
      cell += character
    }
  }
  if (quoted) fail('format')
  finishRow()
  const headers = rows.shift()?.map(value => value.trim()) ?? []
  if (!headers.includes('url') || new Set(headers).size !== headers.length) fail('format')
  return rows.map((values) => {
    if (values.length !== headers.length) fail('format')
    return Object.fromEntries(headers.map((key, index) => [key, values[index]!]))
  })
}
export function parseCandidateImport(input: string, format: CandidateImportFormat): CandidateImportRow[] {
  if (input.length > MAX_IMPORT_BYTES || new TextEncoder().encode(input).length > MAX_IMPORT_BYTES) fail('size')
  const text = input.replace(/^\uFEFF/, '').trim()
  let values: unknown
  try {
    values = format === 'sitemap' ? sitemapRows(text) : format === 'csv' ? csvRows(text) : JSON.parse(text)
  } catch (error) {
    if (error instanceof CandidateImportError) throw error
    return fail('format')
  }
  if (!Array.isArray(values) || !values.length) fail('format')
  if (values.length > MAX_CANDIDATES) fail('count')
  return values.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('format')
    const row = value as Record<string, unknown>
    const field = (key: string, fallback = '') => {
      if (row[key] === undefined) return fallback
      if (typeof row[key] !== 'string') return fail('format')
      return row[key].trim()
    }
    return { url: field('url'), name: field('name'), stateDescription: field('stateDescription', 'Initial page state'), preparation: field('preparation', 'initial-page'), selected: true }
  })
}
export function reviewCandidateImport(rows: CandidateImportRow[], existing: readonly SamplingCandidate[]) {
  const seen = new Set(existing.map(sampleLocationKey))
  return rows.map((row) => {
    const valid = validSampleUrl(row.url.trim()) && row.url.trim().length <= 4000 && row.name.trim().length <= 200
      && !!row.stateDescription.trim() && row.stateDescription.trim().length <= 2000 && ['initial-page', 'manual'].includes(row.preparation)
    let status: 'ready' | 'invalid' | 'duplicate' | 'excluded' = 'excluded'
    if (row.selected) {
      const key = sampleLocationKey(row)
      status = !valid ? 'invalid' : seen.has(key) ? 'duplicate' : 'ready'
      if (valid) seen.add(key)
    }
    return { ...row, status }
  })
}
