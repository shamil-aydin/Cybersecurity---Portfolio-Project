// Diagnoses HOW Node can (or cannot) talk to the Wazuh Manager API. Run it on the machine that runs
// `npm run dev`:   npm run check:wazuh-tls        (or: node scripts/wazuh-tls-check.mjs https://10.0.2.8:55000)
//
// For each TLS variant it reports, per phase, how long TCP connect and the TLS handshake took and
// what the server answered. Any HTTP status (even 401) means the TLS layer worked.
// Development tool only: certificate verification is disabled on purpose (self-signed Wazuh cert).

import fs from 'node:fs'
import https from 'node:https'
import { constants } from 'node:crypto'

function targetUrl() {
  if (process.argv[2]) return process.argv[2]
  if (process.env.WAZUH_URL) return process.env.WAZUH_URL
  try {
    const m = fs.readFileSync('.env.local', 'utf8').match(/^\s*WAZUH_URL\s*=\s*(\S+)/m)
    if (m) return m[1].replace(/^["']|["']$/g, '')
  } catch { /* no .env.local */ }
  return 'https://10.0.2.8:55000'
}

const LEGACY = constants.SSL_OP_LEGACY_SERVER_CONNECT
const VARIANTS = [
  ['A  Node defaults', {}],
  ['B  + LEGACY_SERVER_CONNECT (proxy setting)', { secureOptions: LEGACY }],
  ['C  B + TLS 1.2 only', { secureOptions: LEGACY, minVersion: 'TLSv1.2', maxVersion: 'TLSv1.2' }],
  ['D  B + ciphers DEFAULT@SECLEVEL=0', { secureOptions: LEGACY, ciphers: 'DEFAULT@SECLEVEL=0' }],
]
const TIMEOUT_MS = 20000

function probe(url, agentOptions) {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const ms = () => `${Math.round(performance.now() - t0)}ms`
    const phases = []
    const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: false, ...agentOptions })
    let settled = false
    const done = (outcome) => {
      if (settled) return
      settled = true
      agent.destroy()
      resolve(`${phases.join(' > ') || 'no phase reached'} => ${outcome} (${ms()})`)
    }
    const req = https.get(url, { agent, timeout: TIMEOUT_MS }, (res) => {
      phases.push(`response ${ms()}`)
      res.resume()
      done(`HTTP ${res.statusCode} ${res.headers.server ? `(${res.headers.server})` : ''}`.trim())
    })
    req.on('socket', (socket) => {
      phases.push('socket')
      socket.once('connect', () => phases.push(`TCP ${ms()}`))
      socket.once('secureConnect', () => phases.push(`TLS ${socket.getProtocol()} ${ms()}`))
    })
    req.on('timeout', () => {
      req.destroy()
      done(`STALLED >${TIMEOUT_MS / 1000}s after: ${phases.at(-1) || 'nothing'}`)
    })
    req.on('error', (e) => done(`ERROR ${e.code || e.name}: ${e.message}`))
  })
}

const url = targetUrl()
console.log(`Target: ${url}   Node ${process.version}   OpenSSL ${process.versions.openssl}`)
console.log(`OPENSSL_CONF=${process.env.OPENSSL_CONF || '(unset)'}  NODE_OPTIONS=${process.env.NODE_OPTIONS || '(unset)'}\n`)
for (const [name, opts] of VARIANTS) {
  console.log(name.padEnd(44), await probe(url, opts))
}
console.log('\nAny "HTTP xxx" line = TLS worked for that variant (401 is expected without a token).')
