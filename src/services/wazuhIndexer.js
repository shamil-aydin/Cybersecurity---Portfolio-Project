// ── Wazuh Indexer (OpenSearch) Service ───────────────────────────────────────
// The Wazuh Manager REST API (wazuhApi.js) does not serve alerts or logs — those
// live in the Indexer, in daily indices matching `wazuh-alerts-*`. This module
// queries them directly with OpenSearch's Query DSL, through the /indexer-api
// proxy route (vite.config.js), which injects Basic Auth server-side so the
// Indexer credentials never reach the browser bundle.

import {
  incidents as mockIncidents,
  hourlyThreatEvents,
  overviewStats,
  recentAlerts,
  logEntries,
} from '../data/mockData'
import {
  WazuhError,
  rawFetch,
  mapWazuhAlert,
  mapWazuhLog,
  groupAlertsByRule,
  aggregateAlertsByHour,
} from './wazuhApi'

const ALERTS_INDEX = 'wazuh-alerts-*'

/** POST to the Indexer's _search API for an index pattern. `ignore_unavailable` +
 *  `allow_no_indices` mean a day with no data yet returns an empty hit set, not a 404. */
async function search(indexPattern, body) {
  const resp = await rawFetch(`/indexer-api/${indexPattern}/_search?ignore_unavailable=true&allow_no_indices=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return resp.json()
}

/**
 * Generic query wrapper: tries the Indexer, falls back to mock data and says why.
 * A successful query that simply finds nothing still reports source: 'wazuh' with
 * empty data — that's a real "no alerts yet" state, not a connection failure.
 * @returns {{data, source: 'wazuh'|'mock', error: WazuhError|null}}
 */
async function queryWithFallback(indexPattern, body, mockFn, transformFn) {
  try {
    const json = await search(indexPattern, body)
    return { data: transformFn(json), source: 'wazuh', error: null }
  } catch (e) {
    const error = e instanceof WazuhError ? e : new WazuhError('server', { detail: e?.message })
    console.warn(`[wazuh-indexer] ${indexPattern} -> ${error.kind}${error.status ? ` ${error.status}` : ''}${error.code ? ` ${error.code}` : ''}`)
    const mockData = mockFn ? structuredClone(mockFn()) : null
    return { data: mockData, source: 'mock', error }
  }
}

const sourcesOf = (json) => (json?.hits?.hits || []).map((h) => h._source)

export async function fetchOverviewStatsFromIndexer() {
  return queryWithFallback(
    ALERTS_INDEX,
    {
      size: 0,
      query: { match_all: {} },
      aggs: {
        high: { filter: { range: { 'rule.level': { gte: 8 } } } },
        agents: { cardinality: { field: 'agent.id' } },
      },
    },
    () => overviewStats,
    (json) => ({
      totalAlerts: json?.hits?.total?.value ?? 0,
      highSeverity: json?.aggregations?.high?.doc_count ?? 0,
      activeAgents: json?.aggregations?.agents?.value ?? 0,
      meanTimeToDetect: overviewStats.meanTimeToDetect,
    })
  )
}

export async function fetchAlertsFromIndexer({ size = 100 } = {}) {
  return queryWithFallback(
    ALERTS_INDEX,
    { size, sort: [{ timestamp: { order: 'desc' } }], query: { match_all: {} } },
    () => recentAlerts,
    (json) => sourcesOf(json).map((a, i) => mapWazuhAlert(a, i))
  )
}

export async function fetchIncidentsFromIndexer() {
  return queryWithFallback(
    ALERTS_INDEX,
    { size: 300, sort: [{ timestamp: { order: 'desc' } }], query: { match_all: {} } },
    () => mockIncidents,
    (json) => groupAlertsByRule(sourcesOf(json))
  )
}

export async function fetchLogsFromIndexer({ size = 200 } = {}) {
  return queryWithFallback(
    ALERTS_INDEX,
    { size, sort: [{ timestamp: { order: 'desc' } }], query: { match_all: {} } },
    () => logEntries,
    (json) => sourcesOf(json).map(mapWazuhLog)
  )
}

export async function fetchHourlyThreatEventsFromIndexer() {
  return queryWithFallback(
    ALERTS_INDEX,
    { size: 5000, sort: [{ timestamp: { order: 'desc' } }], query: { match_all: {} } },
    () => hourlyThreatEvents,
    (json) => aggregateAlertsByHour(sourcesOf(json))
  )
}
