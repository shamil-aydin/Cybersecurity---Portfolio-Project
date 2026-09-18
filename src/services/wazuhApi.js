// ── Wazuh Manager API Service ────────────────────────────────────────────────
// Provides live data fetching from Wazuh Manager with graceful fallback to mock data.

import {
  incidents as mockIncidents,
  categories,
  incidentStatuses,
  hourlyThreatEvents,
  overviewStats,
  recentAlerts,
  attackSources,
  logEntries,
  logLevels,
  logSources,
} from '../data/mockData'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSettings() {
  try {
    const saved = localStorage.getItem('soc-settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.username === 'wazuh-admin' || parsed.username === 'admin') {
        parsed.username = 'wazuh'
        localStorage.setItem('soc-settings', JSON.stringify(parsed))
      }
      if (parsed.password !== 'wazuh') {
        parsed.password = 'wazuh'
        localStorage.setItem('soc-settings', JSON.stringify(parsed))
      }
      return parsed
    }
  } catch { /* ignore */ }
  return {
    serverIp: '192.168.1.109',
    apiPort: 55000,
    username: 'wazuh',
    password: 'wazuh',
  }
}

const TIMEOUT_MS = 8000

function withTimeout(signal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  signal?.addEventListener('abort', () => clearTimeout(timer))
  return controller.signal
}

/**
 * Attempt to authenticate with Wazuh and return a session token.
 * Returns null on any failure (CORS, SSL, timeout, wrong creds).
 */
async function getToken() {
  const settings = getSettings()
  const url = '/api/security/user/authenticate';
  // Basic Auth header
  const credentials = btoa(`${settings.username}:${settings.password}`)

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
      signal: withTimeout(),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return data?.data?.token ?? null
  } catch {
    return null
  }
}

/**
 * Generic fetch wrapper: tries the Wazuh API, falls back to mock data.
 * @param {string} endpoint - API path (e.g. /security/alerts)
 * @param {Function} mockFn - function returning mock data
 * @param {Function} transformFn - optional (rawData) => mappedData
 */
async function fetchWithFallback(endpoint, mockFn, transformFn) {
  const settings = getSettings()
  const url = `/api${endpoint}`;
  try {
    const token = await getToken()
    if (!token) throw new Error('Authentication failed')

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: withTimeout(),
    })

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    const data = await resp.json()
    const result = transformFn ? transformFn(data) : data
    return { data: result, source: 'wazuh' }
  } catch {
    // Fallback to mock data on any error (CORS, SSL, timeout, auth fail)
    const mockData = mockFn ? mockFn() : null
    return { data: mockData, source: 'mock' }
  }
}

// ── Wazuh → App Field Mapping ────────────────────────────────────────────────
// Wazuh alert fields:
//   alert.id, alert.timestamp, alert.rule.id, alert.rule.description,
//   alert.rule.level, alert.agent.name, alert.data.srcip, alert.data.srcuser,
//   alert.data.dstip, alert.data.dstuser, alert.status, alert.full_log, etc.

function mapWazuhAlert(a) {
  const rule = a?.rule || {}
  const agent = a?.agent || {}
  const data = a?.data || {}
  return {
    id: a?.id ?? a?.alert?.id ?? 'UNKNOWN',
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
    sourceIp: data?.srcip || data?.srcip || '0.0.0.0',
    timestamp: a?.timestamp || new Date().toISOString(),
    raw: a,
  }
}

function mapWazuhLog(l) {
  const rule = l?.rule || {}
  const agent = l?.agent || {}
  const data = l?.data || {}
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
      return alerts.map(mapWazuhAlert)
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

export async function fetchIncidents() {
  return fetchWithFallback(
    '/security/alerts?limit=100&offset=0&groups=rule,agent',
    () => incidents,
    (data) => {
      const alerts = data?.data?.alerts || data?.alerts || []
      // Group alerts by rule id to form incidents
      const grouped = new Map()
      for (const a of alerts) {
        const rid = a?.rule?.id?.toString() || 'unknown'
        if (!grouped.has(rid)) {
          grouped.set(rid, { ...mapWazuhAlert(a), count: 1 })
        } else {
          grouped.get(rid).count++
          // Take the highest severity
          if (a?.rule?.level > grouped.get(rid).severity / 2) {
            grouped.set(rid, { ...grouped.get(rid), severity: Math.min(20, a.rule.level * 2) })
          }
        }
      }
      return Array.from(grouped.values()).sort((a, b) => b.severity - a.severity)
    }
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

export async function fetchHourlyThreatEvents() {
  return fetchWithFallback(
    '/security/alerts?limit=5000&offset=0',
    () => hourlyThreatEvents,
    (data) => {
      const alerts = data?.data?.alerts || data?.alerts || []
      // Aggregate alerts by hour
      const hourMap = new Map()
      for (const a of alerts) {
        const h = a?.timestamp?.slice(11, 16) || '00:00' // HH:MM
        if (!hourMap.has(h)) hourMap.set(h, { hour: h, events: 0, blocked: 0 })
        hourMap.get(h).events++
        if ((a?.rule?.level ?? 0) >= 8) hourMap.get(h).blocked++
      }
      return Array.from(hourMap.values()).sort((a, b) => a.hour.localeCompare(b.hour))
    }
  )
}

export async function fetchAttackSources() {
  return fetchWithFallback(
    '/security/alerts?limit=1000&offset=0&fields=data.srcip',
    () => attackSources,
    (data) => {
      const alerts = data?.data?.alerts || data?.alerts || []
      const ipMap = new Map()
      for (const a of alerts) {
        const ip = a?.data?.srcip
        if (!ip) continue
        if (!ipMap.has(ip)) {
          ipMap.set(ip, { ip, country: 'Unknown', lat: 0, lng: 0, intensity: 0.3, count: 0 })
        }
        ipMap.get(ip).count++
      }
      // Normalize intensity based on max count
      const maxCount = Math.max(...Array.from(ipMap.values()).map((v) => v.count), 1)
      for (const entry of ipMap.values()) {
        entry.intensity = Math.min(1, entry.count / maxCount)
      }
      return Array.from(ipMap.values()).sort((a, b) => b.count - a.count).slice(0, 11)
    }
  )
}

// ── Re-export filter constants ───────────────────────────────────────────────
export { categories, incidentStatuses, logLevels, logSources }
