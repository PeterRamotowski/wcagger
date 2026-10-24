import { describe, expect, it } from 'vitest'
import http from 'node:http'
import { AccessibilityCheckService } from '../server/services/accessibilityCheckService'
import { createBrowser } from '../server/utils/browserConfig'
import { createScanNetwork } from '../server/services/scanNetworkService'

describe('Chromium redirect network policy', () => {
  it('blocks a redirect to loopback without contacting the private target', async () => {
    let hits = 0
    const target = http.createServer((_request, response) => {
      hits++
      response.end('This private server must not be reached')
    })
    await new Promise<void>(resolve => target.listen(0, '127.0.0.1', resolve))
    const address = target.address()
    if (!address || typeof address === 'string')
      throw new Error('Missing test port')
    const service = new AccessibilityCheckService(async (config) => {
      const browser = await createBrowser(config)
      const original = browser.newPage.bind(browser)
      browser.newPage = async () => {
        const page = await original()
        await page.setRequestInterception(true)
        page.on('request', (request) => {
          if (request.url() === 'http://public.example/')
            void request.respond({ status: 302, headers: { location: 'http://127.0.0.1:' + address.port + '/' } })
          else
            void request.continue()
        })
        return page
      }
      return browser
    }, undefined, undefined, undefined, async () => {
      const boundary = await createScanNetwork()
      // The public response is provided locally above; no external DNS is needed.
      boundary.assertTarget = async () => {
      }
      return boundary
    })
    try {
      await expect(service.run({ url: 'http://public.example/', tools: ['axe'], standard: 'WCAG21AA' })).rejects.toThrow(/blocked|ERR_TUNNEL|ERR_FAILED/)
      expect(hits).toBe(0)
    } finally {
      await new Promise<void>(resolve => target.close(() => resolve()))
    }
  }, 15000)
})
