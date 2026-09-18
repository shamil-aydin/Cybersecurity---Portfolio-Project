import { useState, useEffect, useMemo } from 'react'
import { Search, Download, FileJson, FileSpreadsheet, Filter, ChevronDown, Clock } from 'lucide-react'
import { logEntries, logLevels, logSources } from '../data/mockData'
import { fetchLogs } from '../services/wazuhApi'

export default function Logs() {
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // Live Wazuh API logs state
  const [apiLogs, setApiLogs] = useState([])
  const [apiSource, setApiSource] = useState('mock')
  const [loadingLogs, setLoadingLogs] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadLogs() {
      setLoadingLogs(true)

      const res = await fetchLogs().catch(() => ({ source: 'mock', data: logEntries }))

      if (!cancelled) {
        if (res.source === 'wazuh') setApiSource('wazuh')
        if (res.data && res.data.length > 0) {
          setApiLogs(res.data)
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
  }, [])

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
  }, [search, levelFilter, sourceFilter])

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Security Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Raw security event stream — search, filter, and export
          {apiSource === 'wazuh' && <span className="ml-2 px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">LIVE</span>}
          {apiSource === 'mock' && <span className="ml-2 px-2 py-0.5 bg-cyber-amber/10 text-cyber-amber rounded text-xs">MOCK</span>}
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search logs by message, source, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyber-blue"
            />
          </div>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-bg border border-border text-sm text-foreground rounded-lg px-3 py-2 focus:outline-none focus:border-cyber-blue"
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
            className="bg-bg border border-border text-sm text-foreground rounded-lg px-3 py-2 focus:outline-none focus:border-cyber-blue"
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
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              showFilters ? 'bg-cyber-blue/20 text-cyber-blue' : 'bg-bg text-muted-foreground hover:text-foreground'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>

          <span className="text-xs text-muted-foreground ml-auto">{filteredLogs.length} events</span>

          <div className="flex gap-2">
            <button
              onClick={exportJSON}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-cyber-blue/10 text-cyber-blue hover:bg-cyber-blue/20 transition-colors"
            >
              <FileJson className="w-3.5 h-3.5" />
              JSON
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-cyber-amber/10 text-cyber-amber hover:bg-cyber-amber/20 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          {loadingLogs ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-cyber-blue border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Connecting to Wazuh Manager...</p>
              </div>
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-3 px-4 font-medium">ID</th>
                <th className="py-3 px-4 font-medium">Timestamp</th>
                <th className="py-3 px-4 font-medium">Level</th>
                <th className="py-3 px-4 font-medium">Source</th>
                <th className="py-3 px-4 font-medium">Message</th>
                <th className="py-3 px-4 font-medium">Rule ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((entry) => (
                <tr key={entry.id} className="border-b border-border/30 hover:bg-cyber-blue/5 transition-colors">
                  <td className="py-3 px-4 text-muted-foreground font-mono text-xs">#{entry.id}</td>
                  <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-3 px-4">
                    <LevelBadge level={entry.level} />
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{entry.source}</td>
                  <td className="py-3 px-4 text-foreground max-w-sm truncate">{entry.message}</td>
                  <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{entry.ruleId || '—'}</td>
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

function LevelBadge({ level }) {
  const styles = {
    DEBUG: 'text-muted-foreground',
    INFO: 'text-cyber-blue',
    WARNING: 'text-cyber-amber',
    ERROR: 'text-cyber-red',
    CRITICAL: 'text-red-400',
  }

  const dotColors = {
    DEBUG: 'bg-muted-foreground',
    INFO: 'bg-cyber-blue',
    WARNING: 'bg-cyber-amber',
    ERROR: 'bg-cyber-red',
    CRITICAL: 'bg-red-400',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono ${styles[level]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[level]}`} />
      {level}
    </span>
  )
}
