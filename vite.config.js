import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import https from 'node:https'
import { Buffer } from 'node:buffer'
import { constants as cryptoConstants } from 'node:crypto'
import { defineConfig, loadEnv } from 'vite'

// The Wazuh Manager address is resolved by THIS process (the machine that runs
// `npm run dev`), not by the browser. Override it in .env.local:
//   WAZUH_URL=https://10.0.2.8:55000
const DEFAULT_WAZUH_URL = 'https://10.0.2.8:55000'
const DEFAULT_INDEXER_URL = 'https://10.0.2.8:9200'
const CONNECT_TIMEOUT_MS = 20000 // TCP connect phase only
const HANDSHAKE_TIMEOUT_MS = 15000 // TLS handshake phase only

// DEVELOPMENT ONLY. Agent used for every request to the Wazuh Manager:
//  - rejectUnauthorized:false  Wazuh ships a self-signed certificate
//  - SSL_OP_LEGACY_SERVER_CONNECT  OpenSSL 3 (Node) refuses servers without RFC 5746 secure
//    renegotiation; curl allows it, Node does not unless this flag is set
//  - keepAlive  reuse the (slow, renegotiating) TLS session instead of redoing it per request
const wazuhAgent = new https.Agent({
  rejectUnauthorized: false,
  secureOptions: cryptoConstants.SSL_OP_LEGACY_SERVER_CONNECT,
  keepAlive: true,
})

// The Wazuh Indexer (OpenSearch) is a separate service on its own port. It ships its
// own self-signed certificate but does plain modern TLS — no legacy renegotiation.
const indexerAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
})

// Which phase of the upstream connection each in-flight request is in: tcp -> tls -> http
const stages = new WeakMap()

// Phase-aware timeouts, so the error says WHERE the connection stalls:
//   tcp  no TCP connection within CONNECT_TIMEOUT_MS   -> ETIMEDOUT (host/route/firewall)
//   tls  TCP is up but the TLS handshake never ends    -> TLS_HANDSHAKE_TIMEOUT
//   http a server that connects and answers slowly is left to the client-side timeout
// (Vite's proxy emits 'proxyReq' from inside the request's own 'socket' event and passes the socket.)
function attachPhaseTimeouts(proxy, target) {
  proxy.on('proxyReq', (proxyReq, req, _res, _options, socket) => {
    if (!socket) return
    const fail = (code, message) => proxyReq.destroy(Object.assign(new Error(message), { code }))
    if (socket.readyState === 'open') {
      stages.set(req, 'http') // reused keep-alive socket: TCP and TLS already done
      return
    }
    stages.set(req, 'tcp')
    const tcpTimer = setTimeout(() => fail('ETIMEDOUT', `no TCP connection to ${target} within ${CONNECT_TIMEOUT_MS}ms`), CONNECT_TIMEOUT_MS)
    let tlsTimer
    socket.once('connect', () => {
      clearTimeout(tcpTimer)
      stages.set(req, 'tls')
      tlsTimer = setTimeout(() => fail('TLS_HANDSHAKE_TIMEOUT', `TCP connected but TLS handshake with ${target} did not finish in ${HANDSHAKE_TIMEOUT_MS}ms`), HANDSHAKE_TIMEOUT_MS)
    })
    socket.once('secureConnect', () => {
      clearTimeout(tlsTimer)
      stages.set(req, 'http')
    })
    socket.once('close', () => {
      clearTimeout(tcpTimer)
      clearTimeout(tlsTimer)
    })
  })
}

// Tell the app WHY the proxy failed, so the UI can show a specific message
function attachErrorReporter(proxy, target) {
  proxy.on('error', (err, req, res) => {
    const stage = stages.get(req) || 'unknown'
    console.warn(`[proxy] ${target} failed in phase "${stage}": ${err.code || err.name}: ${err.message}`)
    if (!res || res.headersSent || typeof res.writeHead !== 'function') return
    res.writeHead(502, {
      'Content-Type': 'application/json',
      'X-Sentrivue-Proxy-Error': err.code || err.name || 'UNKNOWN',
      'X-Sentrivue-Proxy-Stage': stage,
    })
    res.end(JSON.stringify({ proxyError: err.code || err.name, stage, message: err.message, target }))
  })
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const target = env.WAZUH_URL || DEFAULT_WAZUH_URL
  const indexerTarget = env.WAZUH_INDEXER_URL || DEFAULT_INDEXER_URL
  const indexerUser = env.WAZUH_INDEXER_USER || 'admin'
  const indexerPassword = env.WAZUH_INDEXER_PASSWORD || 'admin'
  const indexerAuthHeader = `Basic ${Buffer.from(`${indexerUser}:${indexerPassword}`).toString('base64')}`

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          // Wazuh ships a self-signed certificate. Development only: accept it.
          secure: false,
          agent: wazuhAgent,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            attachPhaseTimeouts(proxy, target)
            attachErrorReporter(proxy, target)
          },
        },
        // Wazuh Indexer (OpenSearch, port 9200). The browser never sees the Indexer
        // credentials: this process injects Basic Auth on every proxied request, so
        // the secret only ever lives in .env.local (git-ignored) on the dev machine.
        '/indexer-api': {
          target: indexerTarget,
          changeOrigin: true,
          secure: false,
          agent: indexerAgent,
          rewrite: (path) => path.replace(/^\/indexer-api/, ''),
          configure: (proxy) => {
            attachPhaseTimeouts(proxy, indexerTarget)
            attachErrorReporter(proxy, indexerTarget)
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', indexerAuthHeader)
            })
          },
        },
      },
    },
  }
})
