import { useState, useEffect, useMemo } from 'react'
import { Search, SlidersHorizontal, X, ShieldAlert, ChevronRight, RefreshCw, User, Wifi, WifiOff } from 'lucide-react'
import { categories, incidentStatuses } from '../data/mockData'
import { getThreatColor } from '../utils/threatColor'
import { fetchIncidents } from '../services/wazuhApi'

export default function Incidents() {
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState([0, 20])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [apiSource, setApiSource] = useState('mock')
  const [incidents, setIncidents] = useState([])
  const [loadingIncidents, setLoadingIncidents] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadIncidents() {
      setLoadingIncidents(true)

      const res = await fetchIncidents().catch(() => ({ source: 'mock', data: [] }))

      if (!cancelled) {
        if (res.source === 'wazuh') setApiSource('wazuh')
        if (res.data && res.data.length > 0) {
          setIncidents(res.data)
        } else {
          // Fallback to mock data
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
  }, [])

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
  }, [search, severityFilter, categoryFilter, statusFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Incident Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Track, investigate, and resolve security incidents
          {apiSource === 'wazuh' && <span className="ml-2 px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">LIVE</span>}
          {apiSource === 'mock' && <span className="ml-2 px-2 py-0.5 bg-cyber-amber/10 text-cyber-amber rounded text-xs">MOCK</span>}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by ID, title, or agent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyber-blue"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-xs">Severity:</span>
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
              className="w-20 accent-cyber-blue"
              title="Min severity"
            />
            <span className="text-xs text-muted-foreground font-mono">{severityFilter[0]}–{severityFilter[1]}</span>
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
            className="bg-bg border border-border text-sm text-foreground rounded-lg px-3 py-2 focus:outline-none focus:border-cyber-blue"
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
            className="bg-bg border border-border text-sm text-foreground rounded-lg px-3 py-2 focus:outline-none focus:border-cyber-blue"
          >
            <option value="all">All Status</option>
            {incidentStatuses.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>

          <span className="text-xs text-muted-foreground ml-auto">{filteredIncidents.length} incidents</span>
        </div>
      </div>

      {/* Incident List */}
      <div className="space-y-3">
        {loadingIncidents ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="animate-spin w-8 h-8 border-2 border-cyber-blue border-t-transparent rounded-full mx-auto mb-3" />
            <p>Connecting to Wazuh Manager...</p>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No incidents match your filters.</p>
          </div>
        ) : (
          filteredIncidents.map((incident) => (
            <button
              key={incident.id}
              onClick={() => setSelectedIncident(incident)}
              className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-cyber-blue/30 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: getThreatColor(incident.severity, 0.125) }}>
                  <ShieldAlert className="w-5 h-5" style={{ color: getThreatColor(incident.severity) }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{incident.id}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-border text-muted-foreground">{incident.category}</span>
                  </div>
                  <div className="font-semibold text-foreground truncate group-hover:text-cyber-blue transition-colors">
                    {incident.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {incident.agent}</span>
                    <span className="font-mono">Rule: {incident.ruleId}</span>
                  </div>
                </div>

                <SeverityBar score={incident.severity} />
                <StatusBadge status={incident.status} />
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-cyber-blue transition-colors" />
              </div>
            </button>
          ))
        )}
      </div>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedIncident(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: getThreatColor(selectedIncident.severity, 0.125) }}>
                  <ShieldAlert className="w-5 h-5" style={{ color: getThreatColor(selectedIncident.severity) }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{selectedIncident.title}</h2>
                  <div className="text-xs text-muted-foreground font-mono">{selectedIncident.id} · Rule {selectedIncident.ruleId}</div>
                </div>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="p-2 hover:bg-border rounded-lg transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <SeverityBar score={selectedIncident.severity} large />

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Category</div>
                  <div className="text-sm font-medium text-foreground">{selectedIncident.category}</div>
                </div>
                <div className="bg-bg rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Status</div>
                  <StatusBadge status={selectedIncident.status} />
                </div>
                <div className="bg-bg rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Source IP</div>
                  <div className="text-sm font-mono text-foreground">{selectedIncident.sourceIp}</div>
                </div>
                <div className="bg-bg rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Agent</div>
                  <div className="text-sm font-medium text-foreground flex items-center gap-1"><User className="w-3 h-3" /> {selectedIncident.agent}</div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Description</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedIncident.description}</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Mitigation Suggestions</h4>
                <p className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                  <RefreshCw className="w-4 h-4 shrink-0 text-cyber-amber" />
                  {selectedIncident.mitigation}
                </p>
              </div>

              <div className="text-xs text-muted-foreground pt-4 border-t border-border">
                Detected at {new Date(selectedIncident.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SeverityBar({ score, large }) {
  return (
    <div className={`flex items-center gap-2 ${large ? 'flex-col items-start' : ''}`}>
      <div className={`bg-border rounded-full overflow-hidden ${large ? 'w-32' : 'w-20'}`}>
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{ width: `${(score / 20) * 100}%`, backgroundColor: getThreatColor(score) }}
        />
      </div>
      <span className="text-xs font-mono font-medium" style={{ color: getThreatColor(score) }}>
        {score}/20
      </span>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    open: { bg: 'bg-cyber-red/10', text: 'text-cyber-red', dot: 'bg-cyber-red' },
    active: { bg: 'bg-cyber-red/10', text: 'text-cyber-red', dot: 'bg-cyber-red' },
    investigating: { bg: 'bg-cyber-amber/10', text: 'text-cyber-amber', dot: 'bg-cyber-amber' },
    mitigated: { bg: 'bg-cyber-blue/10', text: 'text-cyber-blue', dot: 'bg-cyber-blue' },
    resolved: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400' },
  }
  const s = styles[status] ?? styles.open
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
