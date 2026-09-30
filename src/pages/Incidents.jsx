import { useState, useEffect, useMemo } from 'react'
import { Search, SlidersHorizontal, X, ShieldAlert, ChevronRight, RefreshCw, User } from 'lucide-react'
import { categories, incidentStatuses } from '../data/mockData'
import { getSeverityColor } from '../utils/severity'
import { fetchIncidentsFromIndexer } from '../services/wazuhIndexer'
import ConnectionNotice from '../components/ConnectionNotice'
import SeverityMark from '../components/SeverityMark'

const STATUS_STYLES = {
  active: 'bg-accent text-bg border-accent',
  open: 'bg-accent text-bg border-accent',
  investigating: 'text-accent border-accent',
  mitigated: 'text-muted border-line',
  resolved: 'text-muted border-line',
}

function StatusTag({ status }) {
  const style = STATUS_STYLES[status] || 'text-muted border-line'
  return (
    <span className={`inline-block border px-1.5 py-0.5 text-[10px] uppercase tracking-widest ${style}`}>
      {status || 'unknown'}
    </span>
  )
}

function SeverityBar({ score, large }) {
  return (
    <div className={`flex items-center gap-2 ${large ? 'flex-col items-start' : ''}`}>
      <div className={`h-2 bg-line ${large ? 'w-32' : 'w-20'}`}>
        <div
          className="h-2 transition-all duration-300"
          style={{ width: `${(score / 20) * 100}%`, backgroundColor: getSeverityColor(score) }}
        />
      </div>
      <span className="font-mono text-xs font-medium" style={{ color: getSeverityColor(score) }}>
        {score}/20
      </span>
    </div>
  )
}

export default function Incidents() {
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState([0, 20])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [apiSource, setApiSource] = useState('mock')
  const [apiError, setApiError] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [loadingIncidents, setLoadingIncidents] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadIncidents() {
      setLoadingIncidents(true)

      const res = await fetchIncidentsFromIndexer().catch(() => ({ source: 'mock', data: [], error: null }))

      if (!cancelled) {
        setApiError(res.error ?? null)
        if (res.source === 'wazuh') {
          // Connected: show real data even when it's an empty array — that's a
          // legitimate "no incidents yet" state, not a reason to substitute mock data.
          setApiSource('wazuh')
          setIncidents(res.data || [])
        } else {
          // Indexer unreachable/erroring: fall back to mock data
          const mock = [
            {
              id: 'INC-201',
              title: 'SQL Injection Attack on Web Server',
              severity: 19,
              category: 'Intrusion Attempt',
              status: 'investigating',
              agent: 'SRV-WEB-01',
              ruleId: '950006',
              description: 'Detected SQL injection pattern in POST request to /api/login endpoint. Attacker attempted to extract database credentials using UNION-based injection.',
              mitigation: 'Block source IP at firewall, patch web application parameter sanitization, review database access logs for credential exposure.',
              sourceIp: '45.33.32.156',
              timestamp: '2026-09-11T14:35:00Z',
            },
            {
              id: 'INC-200',
              title: 'Banking Trojan Detected on Endpoint',
              severity: 20,
              category: 'Malware',
              status: 'active',
              agent: 'WIN-FINANCE-04',
              ruleId: '7100',
              description: 'Emotet banking Trojan identified via signature match. Process injection observed into legitimate browser processes.',
              mitigation: 'Isolate host immediately, perform full disk forensics, rotate all financial credentials, review recent banking transactions.',
              sourceIp: '185.220.101.42',
              timestamp: '2026-09-11T14:20:15Z',
            },
            {
              id: 'INC-199',
              title: 'Large Data Exfiltration via DNS Tunneling',
              severity: 17,
              category: 'Data Exfiltration',
              status: 'investigating',
              agent: 'SRV-DC-01',
              ruleId: '20019',
              description: 'Unusual DNS query volumes detected with high-entropy subdomain strings consistent with DNS tunneling exfiltration technique.',
              mitigation: 'Throttle DNS queries from affected host, deploy DNS security policy, inspect data stores accessed prior to exfiltration window.',
              sourceIp: '10.0.0.55',
              timestamp: '2026-09-11T13:55:30Z',
            },
          ]
          setIncidents(mock)
          setApiSource('mock')
        }
        setLoadingIncidents(false)
      }
    }

    loadIncidents()

    // Refresh every 45s
    const interval = setInterval(loadIncidents, 45000)

    return () => { cancelled = true; clearInterval(interval) }
  }, [reloadKey])

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const matchesSearch =
        search === '' ||
        incident.title.toLowerCase().includes(search.toLowerCase()) ||
        incident.id.toLowerCase().includes(search.toLowerCase()) ||
        incident.agent.toLowerCase().includes(search.toLowerCase())

      const matchesSeverity = incident.severity >= severityFilter[0] && incident.severity <= severityFilter[1]
      const matchesCategory = categoryFilter === 'all' || incident.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || incident.status === statusFilter

      return matchesSearch && matchesSeverity && matchesCategory && matchesStatus
    })
  }, [search, severityFilter, categoryFilter, statusFilter, incidents])

  return (
    <div className="space-y-6 px-8 pt-8 md:px-12 md:pt-12">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-accent">// incidents</p>
        <h1 className="mt-2 font-display text-2xl font-bold uppercase text-ink sm:text-3xl">Incident management</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          Track, investigate, and resolve security incidents
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

      {/* Filters */}
      <div className="border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by ID, title, or agent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-line bg-bg py-2 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted">
            <SlidersHorizontal className="h-4 w-4" />
            Severity:
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="20"
              value={severityFilter[0]}
              onChange={(e) => {
                const val = Number(e.target.value)
                setSeverityFilter([Math.min(val, severityFilter[1]), severityFilter[1]])
              }}
              className="w-20 accent-accent"
              title="Min severity"
            />
            <span className="font-mono text-xs text-muted">{severityFilter[0]}–{severityFilter[1]}</span>
            <input
              type="range"
              min="0"
              max="20"
              value={severityFilter[1]}
              onChange={(e) => {
                const val = Number(e.target.value)
                setSeverityFilter([severityFilter[0], Math.max(val, severityFilter[0])])
              }}
              className="w-20 accent-cyber-red"
              title="Max severity"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
          >
            <option value="all">All Status</option>
            {incidentStatuses.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>

          <span className="ml-auto text-xs uppercase tracking-widest text-muted">{filteredIncidents.length} incidents</span>
        </div>
      </div>

      {/* Incident List */}
      <div className="border-t border-line">
        {loadingIncidents ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted">
              <span className="caret text-accent">connecting to wazuh</span>
            </p>
          </div>
        ) : apiSource === 'wazuh' && incidents.length === 0 ? (
          <div className="py-16 text-center text-muted">
            <ShieldAlert className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="text-sm">No incidents yet — connected to Wazuh, nothing reported so far.</p>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="py-16 text-center text-muted">
            <ShieldAlert className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="text-sm">No incidents match your filters.</p>
          </div>
        ) : (
          filteredIncidents.map((incident) => (
            <button
              key={incident.id}
              onClick={() => setSelectedIncident(incident)}
              className="group relative flex w-full flex-wrap items-center gap-x-5 gap-y-2 border-b border-line py-4 pl-4 text-left transition-all hover:bg-panel hover:pl-6 focus-visible:bg-panel"
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-50 transition-transform group-hover:scale-y-100"
                style={{ background: getSeverityColor(incident.severity) }}
              />
              <SeverityMark value={incident.severity} showValue={false} />

              <div className="min-w-0 flex-1 basis-56">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">{incident.id}</span>
                  <span className="border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted">{incident.category}</span>
                </div>
                <div className="truncate font-semibold text-ink transition-colors group-hover:text-accent">
                  {incident.title}
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1"><User className="h-3 w-3" /> {incident.agent}</span>
                  <span className="font-mono">rule {incident.ruleId}</span>
                </div>
              </div>

              <SeverityBar score={incident.severity} />
              <StatusTag status={incident.status} />
              <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
            </button>
          ))
        )}
      </div>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedIncident(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-auto border border-line bg-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line p-6">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center border"
                  style={{ borderColor: getSeverityColor(selectedIncident.severity), color: getSeverityColor(selectedIncident.severity) }}
                >
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold uppercase text-ink">{selectedIncident.title}</h2>
                  <div className="font-mono text-xs text-muted">{selectedIncident.id} · Rule {selectedIncident.ruleId}</div>
                </div>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="p-2 text-muted transition-colors hover:text-accent">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <SeverityBar score={selectedIncident.severity} large />

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-line bg-bg p-3">
                  <div className="text-[11px] uppercase tracking-widest text-muted">Category</div>
                  <div className="mt-1 text-sm text-ink">{selectedIncident.category}</div>
                </div>
                <div className="border border-line bg-bg p-3">
                  <div className="text-[11px] uppercase tracking-widest text-muted">Status</div>
                  <div className="mt-1"><StatusTag status={selectedIncident.status} /></div>
                </div>
                <div className="border border-line bg-bg p-3">
                  <div className="text-[11px] uppercase tracking-widest text-muted">Source IP</div>
                  <div className="mt-1 font-mono text-sm text-ink">{selectedIncident.sourceIp}</div>
                </div>
                <div className="border border-line bg-bg p-3">
                  <div className="text-[11px] uppercase tracking-widest text-muted">Agent</div>
                  <div className="mt-1 flex items-center gap-1 text-sm text-ink"><User className="h-3 w-3" /> {selectedIncident.agent}</div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] uppercase tracking-widest text-muted">Description</h4>
                <p className="mt-2 text-sm leading-relaxed text-ink">{selectedIncident.description}</p>
              </div>

              <div>
                <h4 className="text-[11px] uppercase tracking-widest text-muted">Mitigation suggestions</h4>
                <p className="mt-2 flex gap-2 text-sm leading-relaxed text-ink">
                  <RefreshCw className="h-4 w-4 shrink-0 text-accent" />
                  {selectedIncident.mitigation}
                </p>
              </div>

              <div className="border-t border-line pt-4 text-xs text-muted">
                Detected at {new Date(selectedIncident.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
