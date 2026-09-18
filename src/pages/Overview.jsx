import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import { Activity, AlertTriangle, ShieldCheck, Clock, ArrowUpRight, ShieldAlert } from 'lucide-react'
import { getThreatColor } from '../utils/threatColor'
import { fetchAlerts, fetchOverviewStats, fetchHourlyThreatEvents } from '../services/wazuhApi'

function StatCard({ icon: Icon, label, value, trend, color, accent, loading }) {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm animate-pulse">
        <div className="h-4 bg-border/50 rounded w-24 mb-3" />
        <div className="h-8 bg-border/50 rounded w-16 mb-2" />
        <div className="h-3 bg-border/50 rounded w-20" />
      </div>
    )
  }
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon className="w-4 h-4" style={{ color }} />
            {label}
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
          <div className="mt-1 text-xs" style={{ color: accent }}>
            {trend}
          </div>
        </div>
        <ArrowUpRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </div>
  )
}

function ThreatTimeline({ data, loading }) {
  const [range, setRange] = useState('24h')

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Threat Events Timeline</h3>
          <p className="text-sm text-muted-foreground mt-1">Hourly detection volume across monitored assets</p>
        </div>
        <div className="flex gap-2">
          {['24h', '7d', '30d'].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                range === r
                  ? 'bg-cyber-blue/20 text-cyber-blue'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-cyber-blue border-t-transparent rounded-full" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="eventsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="blockedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="hour" stroke="#6b7280" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend iconType="circle" iconSize={8} />
              <Area
                type="monotone"
                dataKey="events"
                name="Events"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#eventsFill)"
              />
              <Area
                type="monotone"
                dataKey="blocked"
                name="Blocked"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#blockedFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function AlertsTable({ alerts, loading }) {
  const [filter, setFilter] = useState('all')

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'all') return true
    return alert.status === filter
  })

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="h-5 bg-border/50 rounded w-48 mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-border/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recent High-Severity Alerts</h3>
          <p className="text-sm text-muted-foreground mt-1">Critical and high-priority detections from the last hour</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-bg border border-border text-xs text-muted-foreground rounded-md px-3 py-1.5 focus:outline-none focus:border-cyber-blue"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="investigating">Investigating</option>
          <option value="mitigated">Mitigated</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="pb-3 font-medium">Alert ID</th>
              <th className="pb-3 font-medium">Title</th>
              <th className="pb-3 font-medium">Source</th>
              <th className="pb-3 font-medium">Severity</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.map((alert) => (
              <tr key={alert.id} className="border-b border-border/50 hover:bg-cyber-blue/5 transition-colors">
                <td className="py-4 pr-4 text-cyber-blue font-mono text-xs">{alert.id}</td>
                <td className="py-4 pr-4">
                  <div className="font-medium text-foreground">{alert.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Rule ID: {alert.ruleId}</div>
                </td>
                <td className="py-4 pr-4 text-muted-foreground">{alert.sourceIp || alert.source || '-'}</td>
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(alert.severity / 20) * 100}%`, backgroundColor: getThreatColor(alert.severity) }}
                      />
                    </div>
                    <span className="text-xs font-medium" style={{ color: getThreatColor(alert.severity) }}>
                      {alert.severity}
                    </span>
                  </div>
                </td>
                <td className="py-4 pr-4">
                  <StatusBadge status={alert.status} />
                </td>
                <td className="py-4 text-muted-foreground text-xs">
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    active: { bg: 'bg-cyber-red/10', text: 'text-cyber-red', dot: 'bg-cyber-red' },
    investigating: { bg: 'bg-cyber-amber/10', text: 'text-cyber-amber', dot: 'bg-cyber-amber' },
    mitigated: { bg: 'bg-cyber-blue/10', text: 'text-cyber-blue', dot: 'bg-cyber-blue' },
  }

  const style = styles[status]

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function Overview() {
  const [alerts, setAlerts] = useState([])
  const [stats, setStats] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('mock')

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)

      const [statsRes, alertsRes, timelineRes] = await Promise.all([
        fetchOverviewStats().catch(() => null),
        fetchAlerts().catch(() => null),
        fetchHourlyThreatEvents().catch(() => null),
      ])

      if (!cancelled) {
        if (statsRes) { setStats(statsRes.data); setSource(statsRes.source) }
        if (alertsRes) setAlerts(alertsRes.data)
        if (timelineRes) setTimeline(timelineRes.data)
        setLoading(false)
      }
    }

    loadData()

    // Refresh every 30s
    const interval = setInterval(loadData, 30000)

    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const displayStats = stats || { totalAlerts: 0, highSeverity: 0, activeAgents: 0, meanTimeToDetect: 'N/A' }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Security Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time posture across your monitored infrastructure
          {source === 'wazuh' && <span className="ml-2 px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">LIVE</span>}
          {source === 'mock' && <span className="ml-2 px-2 py-0.5 bg-cyber-amber/10 text-cyber-amber rounded text-xs">MOCK</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Total Alerts" value={displayStats.totalAlerts.toLocaleString()} trend="+12.4% vs yesterday" color="#3b82f6" accent="#3b82f6" loading={loading} />
        <StatCard icon={AlertTriangle} label="High Severity Incidents" value={displayStats.highSeverity} trend="+3 new this hour" color="#ef4444" accent="#ef4444" loading={loading} />
        <StatCard icon={ShieldCheck} label="Active Agents" value={displayStats.activeAgents} trend="98.2% online" color="#3b82f6" accent="#3b82f6" loading={loading} />
        <StatCard icon={Clock} label="Mean Time to Detect" value={displayStats.meanTimeToDetect} trend="-18% improvement" color="#f59e0b" accent="#f59e0b" loading={loading} />
      </div>

      <ThreatTimeline data={timeline} loading={loading} />

      <AlertsTable alerts={alerts} loading={loading} />
    </div>
  )
}
