import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'
import { parse } from 'parse5'
import type { DefaultTreeAdapterMap } from 'parse5'
import type { CandidateInspection } from '~~/shared/types/candidateInspection'
import { INSPECTION_BYTES, INSPECTION_DURATIONS, INSPECTION_MAX_REDIRECTS } from '~~/shared/types/candidateInspection'
import { resolvePublicHost } from './scanNetworkService'

export interface InspectionOptions { url: string, durationMs: number, byteLimit: number }
export function validateInspectionRequest(input: unknown): InspectionOptions {
  const value = input as Partial<InspectionOptions> | null
  if (!value || typeof value.url !== 'string' || value.url.length > 4000 || !INSPECTION_DURATIONS.includes(value.durationMs as 5000) || !INSPECTION_BYTES.includes(value.byteLimit as 131072)) throw new Error('Invalid inspection limits or URL')
  const url = new URL(value.url)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) URL without credentials')
  return { url: url.href, durationMs: value.durationMs!, byteLimit: value.byteLimit! }
}
export async function readInspectionPage(options: InspectionOptions, signal: AbortSignal, resolveHost = resolvePublicHost): Promise<{ html: string, finalUrl: string, contentType: string, bytes: number }> {
  const origin = new URL(options.url).origin
  let current = new URL(options.url)
  for (let redirects = 0; redirects <= INSPECTION_MAX_REDIRECTS; redirects++) {
    signal.throwIfAborted()
    // Connect directly to the checked IP; TLS still verifies the original hostname.
    const address = await resolveHost(current.hostname)
    signal.throwIfAborted()
    const result = await new Promise<{ location?: string, body?: Buffer, contentType?: string }>((resolve, reject) => {
      const request = (current.protocol === 'https:' ? https : http).request({
        hostname: address, port: current.port || (current.protocol === 'https:' ? 443 : 80),
        servername: isIP(current.hostname) ? undefined : current.hostname, method: 'GET', path: current.pathname + current.search,
        headers: { 'Host': current.host, 'Accept': 'text/html', 'Accept-Encoding': 'identity', 'User-Agent': 'WCAGger-static-inspector/1' },
        agent: false, signal, maxHeaderSize: 16384,
      }, (response) => {
        const stop = (error: Error) => {
          reject(error)
          response.destroy()
          request.destroy()
        }
        response.on('error', reject)
        if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
          const location = response.headers.location
          if (!location) return stop(new Error('Redirect has no location'))
          resolve({ location })
          response.destroy()
          request.destroy()
          return
        }
        const contentType = response.headers['content-type'] ?? ''
        if ((response.statusCode ?? 0) < 200 || (response.statusCode ?? 0) >= 300) return stop(new Error('The page returned HTTP ' + response.statusCode))
        if (!/^text\/html(?:;|$)/i.test(contentType)) return stop(new Error('Only HTML pages can be inspected'))
        if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') return stop(new Error('Compressed responses are not supported for bounded inspection'))
        if (Number(response.headers['content-length']) > options.byteLimit) return stop(new Error('The HTML body exceeds the chosen byte limit'))
        const chunks: Buffer[] = []
        let bytes = 0
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length
          if (bytes > options.byteLimit) return stop(new Error('The HTML body exceeds the chosen byte limit'))
          chunks.push(chunk)
        })
        response.once('end', () => resolve({ body: Buffer.concat(chunks), contentType }))
        response.once('aborted', () => reject(new Error('The HTML response was interrupted')))
      })
      request.on('error', reject)
      request.end()
    })
    if (result.location) {
      if (redirects === INSPECTION_MAX_REDIRECTS) throw new Error('The redirect limit was reached')
      const next = new URL(result.location, current)
      if (next.origin !== origin || next.username || next.password || next.href.length > 4000) throw new Error('Redirects must remain on the requested origin')
      current = next
      continue
    }
    const charset = /charset\s*=\s*["']?([^;"'\s]+)/i.exec(result.contentType!)?.[1] ?? 'utf-8'
    return { html: new TextDecoder(charset).decode(result.body!), finalUrl: current.href, contentType: result.contentType!.slice(0, 200), bytes: result.body!.length }
  }
  throw new Error('The redirect limit was reached')
}
export function classifyStaticHtml(html: string): { title: string, suggestedTypes: string[] } {
  const document = parse(html)
  const found = new Set<string>()
  const titleParts: string[] = []
  const stack: { node: DefaultTreeAdapterMap['node'], inTitle: boolean }[] = [{ node: document, inTitle: false }]
  while (stack.length) {
    const { node, inTitle } = stack.pop()!
    if ('tagName' in node) {
      const tag = node.tagName
      if (tag === 'script' || tag === 'style' || tag === 'template') continue
      if (tag === 'form') found.add('Forms')
      if (tag === 'table') found.add('Tables')
      if (tag === 'audio' || tag === 'video') found.add('Audio or video')
      if (tag === 'article') found.add('Articles')
    }
    if (inTitle && 'value' in node) titleParts.push(node.value)
    if ('childNodes' in node) {
      const children = node.childNodes
      for (let index = children.length - 1; index >= 0; index--) stack.push({ node: children[index]!, inTitle: inTitle || ('tagName' in node && node.tagName === 'title') })
    }
  }
  return { title: titleParts.join('').replace(/\s+/g, ' ').trim().slice(0, 200), suggestedTypes: [...found].sort() }
}
// At most two bounded requests run per server process. There is no background queue.
let active = 0
export async function inspectCandidate(input: unknown): Promise<CandidateInspection> {
  const options = validateInspectionRequest(input)
  if (active >= 2) throw new Error('Inspection is busy; try again after the current requests finish')
  active++
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('The inspection duration limit was reached')), options.durationMs)
  try {
    const page = await readInspectionPage(options, controller.signal)
    const classification = classifyStaticHtml(page.html)
    controller.signal.throwIfAborted()
    return { schemaVersion: 1, method: 'static-html-v1', requestedUrl: options.url, finalUrl: page.finalUrl, inspectedAt: new Date().toISOString(), durationLimitMs: options.durationMs, byteLimit: options.byteLimit, bytes: page.bytes, contentType: page.contentType, ...classification }
  } finally {
    clearTimeout(timeout)
    active--
  }
}
