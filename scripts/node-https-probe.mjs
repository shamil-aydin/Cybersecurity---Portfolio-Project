// Standalone probe: talks to the Wazuh Manager with Node's own tls/https modules only
// (no Vite, no proxy, no curl). Usage:  node scripts/node-https-probe.mjs [https://10.0.2.8:55000]
// Development tool: certificate verification is disabled on purpose (self-signed cert).

import tls from 'node:tls'
import https from 'node:https'
import os from 'node:os'
import { constants } from 'node:crypto'

const url = new URL(process.argv[2] || 'https://10.0.2.8:55000')
const port = Number(url.port || 443)
const TIMEOUT_MS = 15000

console.log(`Node ${process.version} | OpenSSL ${process.versions.openssl} | ${os.hostname()} ${process.platform}`)
console.log(`Local IPv4: ${Object.values(os.networkInterfaces()).flat().filter((i) => i.family === 'IPv4' && !i.internal).map((i) => i.address).join(', ')}`)
console.log(`Target: ${url.hostname}:${port}   tls.DEFAULT_MIN_VERSION=${tls.DEFAULT_MIN_VERSION} MAX=${tls.DEFAULT_MAX_VERSION}`)
console.log(`OPENSSL_CONF=${process.env.OPENSSL_CONF || '(unset)'} NODE_OPTIONS=${process.env.NODE_OPTIONS || '(unset)'}\n`)

const t0 = performance.now()
const at = () => `+${String(Math.round(performance.now() - t0)).padStart(5)}ms`
const log = (label, msg = '') => console.log(`${at()}  ${label.padEnd(18)} ${msg}`)

// 1) Raw TLS handshake (what happens before any HTTP)
function rawTls(name, extra) {
  return new Promise((resolve) => {
    log(`[${name}]`, 'tls.connect ...')
    const socket = tls.connect({ host: url.hostname, port, rejectUnauthorized: false, ...extra })
    const timer = setTimeout(() => {
      log(`[${name}]`, `STALLED for ${TIMEOUT_MS / 1000}s (phase: ${socket.connecting ? 'TCP connect' : 'TLS handshake'})`)
      socket.destroy()
      resolve()
    }, TIMEOUT_MS)
    socket.on('lookup', (err, addr) => log(`[${name}] lookup`, err ? String(err) : addr))
    socket.on('connect', () => log(`[${name}] TCP connected`, `local ${socket.localAddress}:${socket.localPort} -> ${socket.remoteAddress}:${socket.remotePort}`))
    socket.on('secureConnect', () => {
      const c = socket.getCipher()
      log(`[${name}] TLS OK`, `${socket.getProtocol()} ${c?.name} authorized=${socket.authorized}`)
      clearTimeout(timer)
      socket.end()
      resolve()
    })
    socket.on('error', (e) => {
      log(`[${name}] ERROR`, `${e.code || e.name}: ${e.message}`)
      clearTimeout(timer)
      resolve()
    })
  })
}

// 2) Real HTTPS request with Node's https module
function httpsGet(name, agentOptions) {
  return new Promise((resolve) => {
    const agent = new https.Agent({ rejectUnauthorized: false, ...agentOptions })
    const req = https.get({ host: url.hostname, port, path: '/', agent, timeout: TIMEOUT_MS }, (res) => {
      log(`[${name}] RESPONSE`, `HTTP ${res.statusCode} server=${res.headers.server || '-'}`)
      let body = ''
      res.on('data', (d) => (body += d))
      res.on('end', () => {
        log(`[${name}] body`, body.slice(0, 120).replace(/\s+/g, ' '))
        agent.destroy()
        resolve()
      })
    })
    req.on('timeout', () => {
      log(`[${name}] TIMEOUT`, `no response within ${TIMEOUT_MS / 1000}s`)
      req.destroy()
    })
    req.on('error', (e) => {
      log(`[${name}] ERROR`, `${e.code || e.name}: ${e.message}`)
      agent.destroy()
      resolve()
    })
  })
}

console.log('--- 1) raw TLS handshake')
await rawTls('default', {})
await rawTls('legacy-connect', { secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT })
console.log('\n--- 2) https.get(/) (HTTP 401 = success: TLS + HTTP worked)')
await httpsGet('default', {})
await httpsGet('legacy-connect', { secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT })
console.log('\ndone')
