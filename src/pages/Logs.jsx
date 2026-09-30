import { useState, useEffect, useMemo } from 'react'
import { Search, FileJson, FileSpreadsheet, Filter } from 'lucide-react'
import { logEntries, logLevels, logSources } from '../data/mockData'
import { fetchLogsFromIndexer } from '../services/wazuhIndexer'
import ConnectionNotice from '../components/ConnectionNotice'

export default function Logs() {
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // Live Wazuh API logs state
  const [apiLogs, setApiLogs] = useState([])
  const [apiSource, setApiSource] = useState('mock')
  const [apiError, setApiError] = useState(null)
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadLogs() {
      setLoadingLogs(true)

      const res = await fetchLogsFromIndexer().catch(() => ({ source: 'mock', data: logEntries, error: null }))

      if (!cancelled) {
        setApiError(res.error ?? null)
        if (res.source === 'wazuh') {
          // Connected: show real data even when it's an empty array — that's a
          // legitimate "no log events yet" state, not a reason to substitute mock data.
          setApiSource('wazuh')
          setApiLogs(res.data || [])
        } else {
          setApiLogs(logEntries)
          setApiSource('mock')
        }
        setLoadingLogs(false)
      }
    }

    loadLogs()

    // Refresh every 60s
    const interval = setInterval(loadLogs, 60000)

    return () => { cancelled = true; clearInterval(interval) }
  }, [reloadKey])

  const filteredLogs = useMemo(() => {
    const logs = loadingLogs ? [] : apiLogs
    return logs.filter((entry) => {
      const matchesSearch =
        search === '' ||
        entry.message.toLowerCase().includes(search.toLowerCase()) ||
        entry.source.toLowerCase().includes(search.toLowerCase()) ||
        entry.id.toString().includes(search)

      const matchesLevel = levelFilter === 'all' || entry.level === levelFilter
      const matchesSource = sourceFilter === 'all' || entry.source === sourceFilter

      return matchesSearch && matchesLevel && matchesSource
    })
  }, [search, levelFilter, sourceFilter, apiLogs, loadingLogs])

  function exportJSON() {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `soc-logs-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportCSV() {
    const headers = ['ID', 'Timestamp', 'Level', 'Source', 'Message', 'Rule ID']
    const rows = filteredLogs.map((e) => [
      e.id,
      e.timestamp,
      e.level,
      e.source,
      `"${e.message}"`,
      e.ruleId ?? '',
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `soc-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 px-8 pt-8 md:px-12 md:pt-12">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-accent">// logs</p>
        <h1 className="mt-2 font-display text-2xl font-bold uppercase text-ink sm:text-3xl">Security logs</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          Raw security event stream — search, filter, and export
          {apiSource === 'wazuh' && (
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-accent">
              <span aria-hidden="true" className="h-1.5 w-1.5 bg-accent" />
              live
            </span>
          )}
          {apiSource === 'mock' && (
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted">
              <span aria-hidden="true" className="h-1.5 w-1.5 border border-muted" />
              mock · sample data
            </span>
          )}
        </p>
      </div>

      <ConnectionNotice source={apiSource} error={apiError} onRetry={() => setReloadKey((k) => k + 1)} />

      {/* Toolbar */}
      <div className="border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search logs by message, source, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-line bg-bg py-2 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
          >
            <option value="all">All Levels</option>
            {logLevels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
          >
            <option value="all">All Sources</option>
            {logSources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 border px-3 py-2 text-xs uppercase tracking-widest transition-colors ${
              showFilters ? 'border-accent text-accent' : 'border-line text-muted hover:text-ink'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>

          <span className="ml-auto text-xs uppercase tracking-widest text-muted">{filteredLogs.length} events</span>

          <div className="flex gap-2">
            <button
              onClick={exportJSON}
              className="flex items-center gap-1.5 border border-line px-3 py-2 text-xs uppercase tracking-widest text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <FileJson className="h-3.5 w-3.5" />
              JSON
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 border border-line px-3 py-2 text-xs uppercase tracking-widest text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Log Table */}
      <div className="border border-line bg-panel overflow-hidden">
        <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
          {loadingLogs ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm text-muted">
                <span className="caret text-accent">connecting to wazuh</span>
              </p>
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-panel">
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-widest text-muted">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Rule ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-sm text-muted">
                    {apiSource === 'wazuh' && apiLogs.length === 0
                      ? 'No log events yet — connected to Wazuh, nothing reported so far.'
                      : 'No log events match your filters.'}
                  </td>
                </tr>
              )}
              {filteredLogs.map((entry) => (
                <tr key={entry.id} className="border-b border-line/50 transition-colors hover:bg-bg">
                  <td className="px-4 py-3 font-mono text-xs text-muted">#{entry.id}</td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <LevelBadge level={entry.level} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{entry.source}</td>
                  <td className="max-w-sm truncate px-4 py-3 text-ink">{entry.message}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{entry.ruleId || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  )
}

const LEVEL_STYLES = {
  DEBUG: 'text-muted border-line',
  INFO: 'text-accent border-accent',
  WARNING: 'text-accent border-accent',
  ERROR: 'text-cyber-red border-cyber-red',
  CRITICAL: 'bg-cyber-red text-bg border-cyber-red',
}

function LevelBadge({ level }) {
  const style = LEVEL_STYLES[level] || 'text-muted border-line'
  return (
    <span className={`inline-block border px-1.5 py-0.5 text-[10px] uppercase tracking-widest ${style}`}>
      {level}
    </span>
  )
}
