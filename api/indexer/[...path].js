// Vercel serverless function — production stand-in for vite.config.js's dev-only
// `/indexer-api` proxy to the Wazuh Indexer (OpenSearch). Only runs when deployed;
// `npm run dev` never touches this file (Vite's own dev proxy handles
// `/indexer-api/*` locally). Reached via the `/indexer-api/:path*` rewrite in
// vercel.json, so the frontend (src/services/wazuhIndexer.js) keeps calling
// `/indexer-api/...` unchanged.
//
// Basic Auth is injected here server-side from env vars, exactly like the dev
// proxy does — the Indexer credentials never reach the browser bundle.
import process from 'node:process'
import { Buffer } from 'node:buffer'

export default async function handler(req, res) {
  const base = process.env.INDEXER_TUNNEL_URL
  if (!base) {
    res.status(500).json({ error: 'INDEXER_TUNNEL_URL is not configured' })
    return
  }

  const segments = Array.isArray(req.query.path) ? req.query.path : []
  const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  const target = `${base.replace(/\/$/, '')}/${segments.join('/')}${search}`

  const user = process.env.WAZUH_INDEXER_USER || 'admin'
  const password = process.env.WAZUH_INDEXER_PASSWORD || 'admin'
  const headers = {
    authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
  }
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']

  const init = { method: req.method, headers }
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length) {
    init.body = JSON.stringify(req.body)
  }

  let upstream
  try {
    upstream = await fetch(target, init)
  } catch (e) {
    res.status(502).json({ error: 'wazuh indexer unreachable', detail: e?.message })
    return
  }

  const body = await upstream.text()
  res.status(upstream.status)
  const contentType = upstream.headers.get('content-type')
  if (contentType) res.setHeader('content-type', contentType)
  res.send(body)
}
