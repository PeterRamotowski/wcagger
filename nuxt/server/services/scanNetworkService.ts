import ipaddr from 'ipaddr.js'
import { lookup } from 'node:dns/promises'
import http from 'node:http'
import net, { isIP } from 'node:net'
// Browser traffic goes through this proxy. Connections use the checked IP,
// rather than performing a second DNS lookup in Chromium (DNS rebinding).
export function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === 'unicast'
  } catch {
    return false
  }
}
export async function resolvePublicHost(hostname: string): Promise<string> {
  const host = hostname.replace(/^\[|\]$/g, '')
  let timer: ReturnType<typeof setTimeout> | undefined
  const addresses = isIP(host)
    ? [{ address: host }]
    : await Promise.race([
        lookup(host, { all: true, verbatim: true }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('DNS lookup timed out')), 5000) }),
      ]).finally(() => clearTimeout(timer))
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address)))
    throw new Error('Scanning private or reserved network addresses is not allowed')
  return addresses[0]!.address
}
export async function assertPublicUrl(value: string): Promise<void> {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Use a public HTTP or HTTPS URL without credentials')
  await resolvePublicHost(url.hostname)
}
export interface ScanNetwork {
  args: string[]
  assertTarget: (url: string) => Promise<void>
  assertHealthy?: () => void
  close: () => Promise<void>
}
export async function createScanNetwork(): Promise<ScanNetwork> {
  let blocked = false
  let closed = false
  const sockets = new Set<net.Socket>()
  const track = (socket: net.Socket) => {
    sockets.add(socket)
    socket.on('error', () => { })
    socket.once('close', () => sockets.delete(socket))
    socket.setTimeout(30000, () => socket.destroy())
    return socket
  }
  const proxy = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url!)
      if (url.protocol !== 'http:' || url.username || url.password)
        throw new Error('Blocked proxy target')
      const address = await resolvePublicHost(url.hostname)
      if (closed || response.destroyed)
        return
      const headers = { ...request.headers }
      delete headers['proxy-authorization']
      delete headers['proxy-connection']
      const outgoing = http.request({ hostname: address, port: url.port || 80, path: url.pathname + url.search, method: request.method, headers }, (incoming) => {
        response.writeHead(incoming.statusCode ?? 502, incoming.headers)
        incoming.pipe(response)
      })
      outgoing.on('socket', track)
      outgoing.on('error', () => response.destroy())
      request.on('aborted', () => outgoing.destroy())
      response.on('close', () => outgoing.destroy())
      request.pipe(outgoing)
    } catch {
      blocked = true
      response.writeHead(403).end('Blocked network destination')
    }
  })
  proxy.on('connection', track)
  proxy.on('connect', async (request, socket, head) => {
    try {
      const url = new URL('https://' + request.url)
      if (url.username || url.password || url.pathname !== '/')
        throw new Error('Invalid tunnel target')
      const address = await resolvePublicHost(url.hostname)
      if (socket.destroyed)
        return
      const target = track(net.connect({ host: address, port: Number(url.port || 443) }))
      socket.on('close', () => target.destroy())
      target.on('error', () => socket.destroy())
      target.once('connect', () => {
        if (socket.destroyed) {
          target.destroy()
          return
        }
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head.length)
          target.write(head)
        socket.pipe(target)
        target.pipe(socket)
      })
    } catch {
      blocked = true
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
    }
  })
  await new Promise<void>((resolve, reject) => {
    proxy.once('error', reject)
    proxy.listen(0, '127.0.0.1', resolve)
  })
  const address = proxy.address()
  if (!address || typeof address === 'string')
    throw new Error('Could not start scan network boundary')
  return {
    args: ['--proxy-server=http://127.0.0.1:' + address.port, '--proxy-bypass-list=<-loopback>', '--disable-quic', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
    assertTarget: assertPublicUrl,
    assertHealthy: () => {
      if (blocked)
        throw new Error('The page requested a blocked network destination')
    },
    close: () => new Promise<void>((resolve) => {
      closed = true
      for (const socket of sockets) socket.destroy()
      proxy.close(() => resolve())
    }),
  }
}
