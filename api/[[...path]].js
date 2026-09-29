// Vercel serverless function — production stand-in for vite.config.js's dev-only
// `/api` proxy to the Wazuh Manager. Only runs when deployed; `npm run dev` never
// touches this file (Vite's own dev proxy handles `/api/*` locally).
//
// Unlike the Indexer function, no auth is injected here: the frontend
// (src/services/wazuhApi.js) sends its own Authorization header (Basic once to
// get a token, then Bearer on every call), exactly as it does against the dev
// proxy — this function just forwards it untouched.
import process from 'node:process'

export default async function handler(req, res) {
  const base = process.env.WAZUH_TUNNEL_URL
  if (!base) {
    res.status(500).json({ error: 'WAZUH_TUNNEL_URL is not configured' })
    return
  }

  const segments = Array.isArray(req.query.path) ? req.query.path : []
  const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  const target = `${base.replace(/\/$/, '')}/${segments.join('/')}${search}`

  const headers = {}
  if (req.headers.authorization) headers.authorization = req.headers.authorization
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']

  const init = { method: req.method, headers }
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length) {
    init.body = JSON.stringify(req.body)
  }

  let upstream
  try {
    upstream = await fetch(target, init)
  } catch (e) {
    res.status(502).json({ error: 'wazuh manager unreachable', detail: e?.message })
    return
  }

  const body = await upstream.text()
  res.status(upstream.status)
  const contentType = upstream.headers.get('content-type')
  if (contentType) res.setHeader('content-type', contentType)
  res.send(body)
}
