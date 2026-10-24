import { afterEach, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import net from 'node:net'
import { lookup } from 'node:dns/promises'
import { assertPublicUrl, createScanNetwork, isPublicAddress, resolvePublicHost } from '../server/services/scanNetworkService'

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))
afterEach(() => vi.mocked(lookup).mockReset())
describe('scan network boundary', () => {
  it('rejects private, link-local, mapped, reserved and transition addresses', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '::1', '::', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1', '2002:7f00:1::', '2001:20::1'])
      expect(isPublicAddress(address), address).toBe(false)
    for (const address of ['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888'])
      expect(isPublicAddress(address), address).toBe(true)
  })
  it('checks every DNS answer and rejects credentials and non-web protocols', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }] as never)
    await expect(resolvePublicHost('mixed.example')).rejects.toThrow('private')
    for (const url of ['file:///etc/passwd', 'http://user:secret@example.com/', 'http://2130706433/'])
      await expect(assertPublicUrl(url)).rejects.toThrow()
  })
  it('blocks HTTP redirects or subresources that resolve to a private address after initial validation', async () => {
    vi.mocked(lookup).mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }] as never).mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }] as never)
    const boundary = await createScanNetwork()
    try {
      await boundary.assertTarget('http://rebound.example/')
      const port = Number(boundary.args[0]!.split(':').pop())
      const status = await new Promise<number>((resolve, reject) => {
        const request = http.get({ host: '127.0.0.1', port, path: 'http://rebound.example/', headers: { host: 'rebound.example' } }, (response) => {
          response.resume()
          resolve(response.statusCode!)
        })
        request.on('error', reject)
      })
      expect(status).toBe(403)
      expect(() => boundary.assertHealthy!()).toThrow('blocked')
    } finally {
      await boundary.close()
    }
  })
  it('blocks HTTPS CONNECT to loopback before any connection to the target', async () => {
    const boundary = await createScanNetwork()
    try {
      const port = Number(boundary.args[0]!.split(':').pop())
      const response = await new Promise<string>((resolve, reject) => {
        const socket = net.connect(port, '127.0.0.1', () => socket.write('CONNECT 127.0.0.1:1 HTTP/1.1\r\nHost: 127.0.0.1:1\r\n\r\n'))
        let text = ''
        socket.on('data', (chunk) => {
          text += chunk
        })
        socket.on('end', () => resolve(text))
        socket.on('error', reject)
      })
      expect(response).toContain('403 Forbidden')
    } finally {
      await boundary.close()
    }
  })
})
