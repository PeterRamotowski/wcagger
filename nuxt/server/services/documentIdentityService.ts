/// <reference lib="dom" />
import { createHash } from 'node:crypto'
import type { Page } from 'puppeteer'
import type { EngineEvidence, ScanObservation } from '~~/shared/types/scanEvidence'

export interface ScanPageContext {
  page: Page
  documentId: string
}

// This function is serialized into the page. Keep it self-contained.
export function inspectDocument(documentId: string, locators: NonNullable<ScanObservation['element']>['locator'][] = []) {
  const stateKey = '__wcaggerDocumentIdentity_' + documentId
  type State = { document: Document, sessionId: string, id: string, nextId: number, elements: WeakMap<Element, string> }
  const store = window as unknown as Record<string, State | undefined>
  let state = store[stateKey]
  if (!state || state.document !== document || state.sessionId !== documentId) {
    state = { document, sessionId: documentId, id: documentId + ':' + Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join(''), nextId: 0, elements: new WeakMap() }
    store[stateKey] = state
  }
  const activeState = state
  const elementId = (element: Element): string => {
    let id = activeState.elements.get(element)
    if (!id) {
      id = String(++activeState.nextId)
      activeState.elements.set(element, id)
    }
    return id
  }
  const styles = ['display', 'visibility', 'opacity', 'color', 'background-color', 'background-image', 'font-size', 'font-weight', 'direction', 'writing-mode', 'content']
  let visited = 0
  const snapshot = (entry: Node, descend = true): unknown => {
    if (++visited > 20000) throw new Error('Document identity capture limit reached')
    if (entry.nodeType === Node.TEXT_NODE) return entry.textContent
    if (entry.nodeType !== Node.ELEMENT_NODE) return null
    const node = entry as Element
    // Scanner script injection must not create a false change in page state.
    if (node.tagName === 'SCRIPT') return null
    const view = node.ownerDocument.defaultView
    const style = view?.getComputedStyle(node)
    const form = node as HTMLInputElement
    const rect = node.getBoundingClientRect()
    return [
      elementId(node),
      node.tagName,
      Array.from(node.attributes, attr => [attr.name, attr.value]).sort(([a], [b]) => (a ?? '').localeCompare(b ?? '')),
      descend ? Array.from(node.childNodes, child => snapshot(child)).filter(value => value !== null) : null,
      descend && node.shadowRoot ? Array.from(node.shadowRoot.childNodes, child => snapshot(child)) : null,
      descend && node.tagName === 'IFRAME' ? frameSnapshot(node as HTMLIFrameElement) : null,
      [form.value, form.checked, (node as HTMLOptionElement).selected],
      styles.map(property => style?.getPropertyValue(property)),
      [rect.x, rect.y, rect.width, rect.height],
    ]
  }
  const frameSnapshot = (frame: HTMLIFrameElement): unknown => {
    try {
      return frame.contentDocument?.documentElement ? snapshot(frame.contentDocument.documentElement) : ['unavailable-frame']
    } catch { return ['unavailable-frame'] }
  }
  const resolve = (locator: NonNullable<ScanObservation['element']>['locator']): Element | null => {
    const target = locator.kind === 'css-selector' ? [locator.selector] : locator.target
    let root: Document | ShadowRoot = document
    let element: Element | null = null
    for (let index = 0; index < target.length; index++) {
      const part = target[index]!
      const selectors = typeof part === 'string' ? [part] : part
      for (let shadowIndex = 0; shadowIndex < selectors.length; shadowIndex++) {
        const matches: NodeListOf<Element> = root.querySelectorAll(selectors[shadowIndex]!)
        if (matches.length !== 1) return null
        element = matches[0]!
        if (shadowIndex < selectors.length - 1) {
          if (!element.shadowRoot) return null
          root = element.shadowRoot
        }
      }
      if (index < target.length - 1) {
        const frame = element as HTMLIFrameElement | null
        if (frame?.tagName !== 'IFRAME' || !frame.contentDocument) return null
        root = frame.contentDocument
      }
    }
    return element
  }
  const identities = locators.map((locator) => {
    try {
      const element = resolve(locator)
      if (!element) return undefined
      const id = elementId(element)
      visited = 0
      return { documentId: activeState.id, elementId: id, signature: JSON.stringify(snapshot(element, false)) }
    } catch { return undefined }
  })
  visited = 0
  return {
    documentId: activeState.id,
    environment: { viewport: { width: innerWidth, height: innerHeight }, userAgent: navigator.userAgent },
    state: JSON.stringify([activeState.id, location.href, innerWidth, innerHeight, devicePixelRatio, snapshot(document.documentElement)]),
    identities,
  }
}

export async function captureDocument(context: ScanPageContext): Promise<string | undefined> {
  try {
    const result = await context.page.evaluate(inspectDocument, context.documentId, [])
    return createHash('sha256').update(result.state).digest('hex')
  } catch { return undefined }
}

export async function attachDocumentIdentity(evidence: EngineEvidence, context: ScanPageContext, before?: string): Promise<EngineEvidence> {
  const targets = evidence.observations.filter(observation => observation.element)
  try {
    const result = await context.page.evaluate(inspectDocument, context.documentId, targets.map(item => item.element!.locator))
    const fingerprint = createHash('sha256').update(result.state).digest('hex')
    const identities = new Map(targets.map((item, index) => [item.id, result.identities[index]]))
    return {
      runs: evidence.runs.map(run => ({ ...run, configuration: { ...run.configuration, ...result.environment }, capture: { documentId: result.documentId, fingerprint, stable: before !== undefined && before === fingerprint } })),
      observations: evidence.observations.map(item => ({
        ...item,
        element: item.element
          ? {
              ...item.element,
              documentId: result.documentId,
              identity: identities.get(item.id) ? { ...identities.get(item.id)!, signature: createHash('sha256').update(identities.get(item.id)!.signature).digest('hex') } : undefined,
            }
          : undefined,
      })),
    }
  } catch {
    // Identity capture is optional; its failure must never erase successful scan evidence.
    return { ...evidence, runs: evidence.runs.map(run => ({ ...run, capture: { documentId: context.documentId, stable: false } })) }
  }
}
