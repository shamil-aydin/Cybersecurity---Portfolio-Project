// ── Wazuh Manager API Service ────────────────────────────────────────────────
// Provides live data fetching from Wazuh Manager with graceful fallback to mock data.

import {
  incidents as mockIncidents,
  categories,
  incidentStatuses,
  hourlyThreatEvents,
  overviewStats,
  recentAlerts,
  logEntries,
  logLevels,
  logSources,
} from '../data/mockData'

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  serverIp: '10.0.2.8',
  apiPort: 55000,
  username: 'wazuh',
  password: 'wazuh',
}

// NOTE: serverIp/apiPort are informational. The real target of every request is
// the Vite proxy (WAZUH_URL in vite.config.js / .env.local).
function getSettings() {
  try {
    const saved = localStorage.getItem('soc-settings')
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

// Must exceed vite.config.js's CONNECT_TIMEOUT_MS + HANDSHAKE_TIMEOUT_MS so a
// cold (non-keep-alive) connection has time to finish before the UI aborts.
const TIMEOUT_MS = 30000

function withTimeout() {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), TIMEOUT_MS)
  return controller.signal
}

// ── Error classification ─────────────────────────────────────────────────────
// kind: unreachable | tls | proxy | credentials | timeout | endpoint | server | network

export class WazuhError extends Error {
  constructor(kind, { status = null, code = null, detail = '' } = {}) {
    super(`${kind}${status ? ` ${status}` : ''}${code ? ` ${code}` : ''}`)
    this.name = 'WazuhError'
    this.kind = kind
    this.status = status
    this.code = code
    this.detail = detail
  }
}

const UNREACHABLE_CODES = new Set([
  'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE',
])

/** Turn a non-2xx response from the Vite proxy / Wazuh into a WazuhError. Shared by
 *  the Manager (/api) and Indexer (/indexer-api) services. */
export function classifyResponse(resp) {
  const status = resp.status
  const code = resp.headers.get('x-sentrivue-proxy-error')
  const stage = resp.headers.get('x-sentrivue-proxy-stage')
  // TCP connected but the TLS handshake failed/stalled: the server IS reachable
  if (code && stage === 'tls') return new WazuhError('tls', { status, code })
  if (code && UNREACHABLE_CODES.has(code)) return new WazuhError('unreachable', { status, code })
  if (status === 502 || status === 503 || status === 504) return new WazuhError('proxy', { status, code })
  if (status === 401 || status === 403) return new WazuhError('credentials', { status })
  if (status === 404) return new WazuhError('endpoint', { status })
  return new WazuhError('server', { status })
}

/** Human-readable text for a WazuhError (used by every page and Settings). */
export function describeError(err) {
  const status = err?.status ? ` (${err.status})` : ''
  switch (err?.kind) {
    case 'unreachable':
      return { title: 'Wazuh Manager unreachable — check IP/network', detail: err.code ? `proxy reported ${err.code}` : '' }
    case 'tls':
      return { title: 'TLS handshake with Wazuh failed — see dev server console', detail: err.code ? `proxy reported ${err.code}` : '' }
    case 'proxy':
      return {
        title: `Proxy error — check server configuration${status}`,
        detail: err.code ? `proxy reported ${err.code}` : 'the dev proxy returned a gateway error',
      }
    case 'credentials':
      return { title: 'Invalid credentials — check username and password', detail: err.status ? `HTTP ${err.status}` : '' }
    case 'timeout':
      return { title: 'Request timed out, retrying...', detail: `no answer within ${TIMEOUT_MS / 1000}s` }
    case 'endpoint':
      return { title: 'Endpoint not available on this Wazuh API', detail: 'HTTP 404' }
    case 'network':
      return { title: 'Dev server not responding — is npm run dev running?', detail: err.detail || '' }
    case 'server':
      return { title: `Server error${status}`, detail: err.detail || '' }
    default:
      return { title: 'Unknown connection error', detail: err?.message || '' }
  }
}

/** fetch + timeout + classification. Retries once on timeout. Shared by the Manager
 *  (/api) and Indexer (/indexer-api) services, so both surface the same error kinds. */
export async function rawFetch(url, init = {}, retried = false) {
  let resp
  try {
    resp = await fetch(url, { ...init, signal: withTimeout() })
  } catch (e) {
    if (e?.name === 'AbortError') {
      if (!retried) return rawFetch(url, init, true)
      throw new WazuhError('timeout')
    }
    throw new WazuhError('network', { detail: e?.message })
  }
  if (!resp.ok) throw classifyResponse(resp)
  return resp
}

const call = (endpoint, init) => rawFetch(`/api${endpoint}`, init)

// ── Token handling ───────────────────────────────────────────────────────────

let tokenCache = { value: null, error: null, until: 0 }
let tokenInflight = null

async function requestToken(creds) {
  const { username, password } = creds || getSettings()
  const resp = await call('/security/user/authenticate', {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${username}:${password}`)}` },
  })
  const data = await resp.json().catch(() => null)
  const token = data?.data?.token
  if (!token) throw new WazuhError('server', { detail: 'authenticate returned no token' })
  return token
}

/**
 * Return a session token or throw a WazuhError. Concurrent callers share one
 * request; a success is cached for 10 min, a failure for 15 s.
 */
async function getToken() {
  if (Date.now() < tokenCache.until) {
    if (tokenCache.error) throw tokenCache.error
    return tokenCache.value
  }
  if (!tokenInflight) {
    tokenInflight = requestToken()
      .then((token) => {
        tokenCache = { value: token, error: null, until: Date.now() + 10 * 60_000 }
        return token
      })
      .catch((error) => {
        tokenCache = { value: null, error, until: Date.now() + 15_000 }
        throw error
      })
      .finally(() => { tokenInflight = null })
  }
  return tokenInflight
}

const invalidateToken = () => { tokenCache = { value: null, error: null, until: 0 } }

/** Forget cached tokens/failures, e.g. after the user changed settings or pressed Retry. */
export function resetConnectionCache() {
  invalidateToken()
}

/**
 * Settings: "Check API Status". Uses the credentials currently in the form,
 * bypasses caches, and reports a classified result.
 */
export async function checkConnection(creds) {
  const started = performance.now()
  try {
    const token = await requestToken(creds)
    const resp = await call('/', { headers: { Authorization: `Bearer ${token}` } })
    const info = await resp.json().catch(() => null)
    return { ok: true, latencyMs: Math.round(performance.now() - started), version: info?.data?.api_version ?? null }
  } catch (error) {
    const err = error instanceof WazuhError ? error : new WazuhError('network', { detail: error?.message })
    return { ok: false, error: err, ...describeError(err) }
  }
}

/**
 * Generic fetch wrapper: tries the Wazuh API, falls back to mock data and says why.
 * @returns {{data, source: 'wazuh'|'mock', error: WazuhError|null}}
 */
async function fetchWithFallback(endpoint, mockFn, transformFn, retriedAuth = false) {
  try {
    const token = await getToken()
    let resp
    try {
      resp = await call(endpoint, { headers: { Authorization: `Bearer ${token}` } })
    } catch (e) {
      // Expired token: get a fresh one once
      if (e?.kind === 'credentials' && !retriedAuth) {
        invalidateToken()
        return fetchWithFallback(endpoint, mockFn, transformFn, true)
      }
      throw e
    }
    const data = await resp.json()
    const result = transformFn ? transformFn(data) : data
    return { data: result, source: 'wazuh', error: null }
  } catch (e) {
    const error = e instanceof WazuhError ? e : new WazuhError('server', { detail: e?.message })
    console.warn(`[wazuh] ${endpoint} -> ${error.kind}${error.status ? ` ${error.status}` : ''}${error.code ? ` ${error.code}` : ''}`)
    const mockData = mockFn ? structuredClone(mockFn()) : null
    return { data: mockData, source: 'mock', error }
  }
}

// ── Wazuh → App Field Mapping ────────────────────────────────────────────────
// Wazuh alert fields:
//   alert.id, alert.timestamp, alert.rule.id, alert.rule.description,
//   alert.rule.level, alert.agent.name, alert.data.srcip, alert.data.srcuser,
//   alert.data.dstip, alert.data.dstuser, alert.status, alert.full_log, etc.

export function mapWazuhAlert(a, index = 0) {
  const rule = a?.rule || {}
  const agent = a?.agent || {}
  const data = a?.data || {}
  return {
    id: a?.id ?? a?.alert?.id ?? `ALT-${a?.timestamp ?? 'na'}-${index}`,
    title: rule?.description
      ? rule.description.length > 80
        ? rule.description.slice(0, 80) + '…'
        : rule.description
      : a?.full_log || 'Unmapped alert',
    severity: Math.min(20, Math.max(0, (rule?.level ?? 0) * 2)), // Wazuh 0-12 → 0-20 scale
    category: a?.rule?.groups?.[0] || a?.decoder?.name || 'General',
    status: a?.status === 'pending' ? 'open' : a?.status || 'investigating',
    agent: agent?.name || data?.srcip || 'unknown',
    ruleId: rule?.id?.toString() || '-',
    description: rule?.description || a?.full_log || '',
    // srcip/src_ip covers network decoders (sshd, etc). Windows Security-Auditing
    // events (e.g. rule 60122, EventID 4625 logon failures) don't set those — the
    // source address is nested at data.win.eventdata.ipAddress instead. Leave it
    // unset (not a fake '0.0.0.0') when truly absent, so host-only events (registry
    // changes, DB engine, license activation, ...) aren't miscounted as alerts with
    // an unresolvable IP on the Attack Map — they never had a source IP at all.
    sourceIp: data?.srcip || data?.src_ip || data?.win?.eventdata?.ipAddress || null,
    timestamp: a?.timestamp || new Date().toISOString(),
    raw: a,
  }
}

export function mapWazuhLog(l) {
  const rule = l?.rule || {}
  const agent = l?.agent || {}
  // Map Wazuh log levels to app levels
  const wazuhLevel = l?.level ?? 3
  const levelMap = { 0: 'DEBUG', 1: 'DEBUG', 2: 'INFO', 3: 'WARNING', 4: 'ERROR', 5: 'ERROR', 6: 'CRITICAL', 7: 'CRITICAL' }
  return {
    id: l?.id ?? l?.event?.id ?? 0,
    timestamp: l?.timestamp || l?.date || l?.created?.iso || new Date().toISOString(),
    level: levelMap[wazuhLevel] || 'WARNING',
    source: agent?.name || l?.decoder?.name || 'Wazuh',
    message: l?.full_log || l?.summary || l?.description || JSON.stringify(l).slice(0, 500),
    ruleId: rule?.id?.toString() || null,
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function fetchAlerts() {
  return fetchWithFallback(
    '/security/alerts?limit=100&offset=0&sort=+timestamp',
    () => recentAlerts,
    (data) => {
      // Wazuh returns { data: { alerts: [...] }, meta: {...} }
      const alerts = data?.data?.alerts || data?.alerts || []
      return alerts.map((a, i) => mapWazuhAlert(a, i))
    }
  )
}

export async function fetchLogs() {
  return fetchWithFallback(
    '/logcollector?limit=200&offset=0',
    () => logEntries,
    (data) => {
      const logs = data?.data?.logs || data?.logs || data?.data || []
      return logs.map(mapWazuhLog)
    }
  )
}

/** Group raw Wazuh alerts by rule id to form incidents. Shared with the Indexer service. */
export function groupAlertsByRule(alerts) {
  const grouped = new Map()
  alerts.forEach((a, idx) => {
    const rid = a?.rule?.id?.toString() || 'unknown'
    if (!grouped.has(rid)) {
      grouped.set(rid, { ...mapWazuhAlert(a, idx), count: 1 })
    } else {
      grouped.get(rid).count++
      // Take the highest severity
      if (a?.rule?.level > grouped.get(rid).severity / 2) {
        grouped.set(rid, { ...grouped.get(rid), severity: Math.min(20, a.rule.level * 2) })
      }
    }
  })
  return Array.from(grouped.values()).sort((a, b) => b.severity - a.severity)
}

export async function fetchIncidents() {
  return fetchWithFallback(
    '/security/alerts?limit=100&offset=0&groups=rule,agent',
    () => mockIncidents,
    (data) => groupAlertsByRule(data?.data?.alerts || data?.alerts || [])
  )
}

export async function fetchOverviewStats() {
  return fetchWithFallback(
    '/security/alerts/stats',
    () => overviewStats,
    (data) => {
      const alerts = data?.data?.alerts || []
      return {
        totalAlerts: data?.data?.total ?? overviewStats.totalAlerts,
        highSeverity: alerts.filter((a) => (a?.rule?.level ?? 0) >= 8).length,
        activeAgents: data?.data?.agents ?? overviewStats.activeAgents,
        meanTimeToDetect: data?.data?.mttd || overviewStats.meanTimeToDetect,
      }
    }
  )
}

/** Aggregate raw Wazuh alerts into hourly buckets. Shared with the Indexer service. */
export function aggregateAlertsByHour(alerts) {
  const hourMap = new Map()
  for (const a of alerts) {
    const h = a?.timestamp?.slice(11, 16) || '00:00' // HH:MM
    if (!hourMap.has(h)) hourMap.set(h, { hour: h, events: 0, blocked: 0 })
    hourMap.get(h).events++
    if ((a?.rule?.level ?? 0) >= 8) hourMap.get(h).blocked++
  }
  return Array.from(hourMap.values()).sort((a, b) => a.hour.localeCompare(b.hour))
}

export async function fetchHourlyThreatEvents() {
  return fetchWithFallback(
    '/security/alerts?limit=5000&offset=0',
    () => hourlyThreatEvents,
    (data) => aggregateAlertsByHour(data?.data?.alerts || data?.alerts || [])
  )
}


// ── Re-export filter constants ───────────────────────────────────────────────
export { categories, incidentStatuses, logLevels, logSources }
