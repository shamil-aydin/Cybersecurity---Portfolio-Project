import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { getSeverityColor, getSeverityLabel, SEVERITY_MAX } from '../utils/severity'
import { resetConnectionCache } from '../services/wazuhApi'
import { fetchAlertsFromIndexer, fetchOverviewStatsFromIndexer, fetchHourlyThreatEventsFromIndexer } from '../services/wazuhIndexer'
import BootLoader from '../components/BootLoader'
import CountUp from '../components/CountUp'
import Sparkline from '../components/Sparkline'
import SeverityMark from '../components/SeverityMark'
import ThreatTimeline from '../components/ThreatTimeline'
import ConnectionNotice from '../components/ConnectionNotice'

const MIN_BOOT_MS = 1400
const TOP_N = 5

// Index = mean severity of the strongest alerts, on the shared 0-20 scale.
function computeThreatIndex(alerts) {
  const top = alerts
    .map((a) => Number(a.severity) || 0)
    .sort((a, b) => b - a)
    .slice(0, TOP_N)
  if (!top.length) return 0
  return Math.round(top.reduce((s, v) => s + v, 0) / top.length)
}

const fmtIndex = (n) => String(Math.round(n)).padStart(2, '0')

function Eyebrow({ children }) {
  return <p className="text-xs uppercase tracking-[0.25em] text-accent">{children}</p>
}

function SeverityGauge({ value }) {
  const reduce = useReducedMotion()
  const ticks = SEVERITY_MAX + 1
  return (
    <div
      role="meter"
      aria-label="Threat index"
      aria-valuemin={0}
      aria-valuemax={SEVERITY_MAX}
      aria-valuenow={value}
      className="mt-8"
    >
      <div className="flex h-10 items-end gap-[3px] sm:gap-1">
        {Array.from({ length: ticks }, (_, i) => {
          const lit = i <= value
          return (
            <motion.span
              key={i}
              className="flex-1"
              style={{ background: getSeverityColor(i), transformOrigin: 'bottom' }}
              initial={{ scaleY: 0.15, opacity: 0.25 }}
              animate={{ scaleY: lit ? 1 : 0.35, opacity: lit ? 1 : 0.28, height: '100%' }}
              transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : i * 0.035, ease: [0.16, 1, 0.3, 1] }}
            />
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted">
        <span>00 stable</span>
        <span>10</span>
        <span>20 critical</span>
      </div>
    </div>
  )
}

function LedgerRow({ label, children, spark, sparkColor, index }) {
  return (
    <motion.div
      className="group flex items-end gap-3 py-4 transition-colors hover:bg-panel/70"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4 + index * 0.1, duration: 0.4 }}
    >
      <span className="shrink-0 text-xs uppercase tracking-widest text-muted transition-colors group-hover:text-ink">{label}</span>
      <span aria-hidden="true" className="mb-1.5 min-w-4 flex-1 border-b border-dotted border-line" />
      {spark && <span className="mb-1 hidden shrink-0 sm:block">{<Sparkline data={spark} color={sparkColor} />}</span>}
      <span className="shrink-0 font-display text-3xl font-bold leading-none tabular-nums text-ink sm:text-4xl">{children}</span>
    </motion.div>
  )
}

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

const FILTERS = ['all', 'active', 'investigating', 'mitigated']

function AlertFeed({ alerts }) {
  const [filter, setFilter] = useState('all')
  const visible = useMemo(
    () =>
      alerts
        .filter((a) => filter === 'all' || a.status === filter)
        .sort((a, b) => b.severity - a.severity)
        .slice(0, 8),
    [alerts, filter],
  )

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-3">
        <div className="lg:sticky lg:top-20">
          <Eyebrow>// 03 signals</Eyebrow>
          <h2 className="mt-2 font-display text-2xl font-bold uppercase leading-tight">Highest severity right now</h2>
          <div role="group" aria-label="Filter alerts by status" className="mt-5 flex flex-wrap gap-2 lg:flex-col lg:items-start lg:gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`px-1 py-1 text-xs uppercase tracking-widest transition-all ${
                  filter === f ? 'text-accent' : 'text-muted hover:translate-x-1 hover:text-ink'
                }`}
              >
                <span aria-hidden="true">{filter === f ? '[x] ' : '[ ] '}</span>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ol className="lg:col-span-9 border-t border-line">
        {visible.length === 0 && <li className="py-10 text-sm text-muted">no alerts match this filter</li>}
        {visible.map((a, i) => {
          const color = getSeverityColor(a.severity)
          return (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="group relative flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line py-4 pl-4 transition-all hover:bg-panel hover:pl-6 focus-within:bg-panel"
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-50 transition-transform group-hover:scale-y-100"
                style={{ background: color }}
              />
              <SeverityMark value={a.severity} />
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate text-sm font-semibold text-ink">{a.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {a.id} · rule {a.ruleId} · {a.sourceIp || a.source || 'n/a'}
                </p>
              </div>
              <StatusTag status={a.status} />
              <time className="w-14 text-right text-xs tabular-nums text-muted" dateTime={a.timestamp}>
                {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}

export default function Overview() {
  const [alerts, setAlerts] = useState([])
  const [stats, setStats] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [ready, setReady] = useState(false)
  const [source, setSource] = useState('mock')
  const [error, setError] = useState(null)
  const [syncedAt, setSyncedAt] = useState(null)

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const bootStart = Date.now()

    async function loadData(first) {
      const [statsRes, alertsRes, timelineRes] = await Promise.all([
        fetchOverviewStatsFromIndexer().catch(() => null),
        fetchAlertsFromIndexer().catch(() => null),
        fetchHourlyThreatEventsFromIndexer().catch(() => null),
      ])
      if (cancelled) return
      if (statsRes) {
        setStats(statsRes.data)
        setSource(statsRes.source)
      }
      setError([statsRes, alertsRes, timelineRes].find((r) => r?.error)?.error ?? null)
      if (alertsRes) setAlerts(alertsRes.data)
      if (timelineRes) setTimeline(timelineRes.data)
      setSyncedAt(new Date())
      if (first) {
        const wait = Math.max(0, MIN_BOOT_MS - (Date.now() - bootStart))
        setTimeout(() => !cancelled && setReady(true), wait)
      }
    }

    loadData(true)
    const interval = setInterval(() => loadData(false), 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [reloadKey])

  const index = useMemo(() => computeThreatIndex(alerts), [alerts])
  const color = getSeverityColor(index)
  const s = stats || { totalAlerts: 0, highSeverity: 0, activeAgents: 0, meanTimeToDetect: 'n/a' }
  const eventsSeries = useMemo(() => timeline.map((t) => t.events), [timeline])
  const highSeries = useMemo(() => timeline.map((t) => t.blocked), [timeline])

  if (!ready) return <BootLoader />

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-8 md:px-8 md:pt-12">
      {/* 01 — Threat index hero + ledger (asymmetric 7/5 split) */}
      <ConnectionNotice
        source={source}
        error={error}
        onRetry={() => {
          resetConnectionCache()
          setReloadKey((k) => k + 1)
        }} className="mb-8" />
      <section aria-labelledby="hero-title" className="grid gap-10 lg:grid-cols-12 lg:gap-0">
        <div className="lg:col-span-7 lg:pr-12">
          <Eyebrow>// 01 overview</Eyebrow>
          <h1 id="hero-title" className="mt-3 font-display text-sm font-medium uppercase tracking-[0.3em] text-muted">
            Threat index
          </h1>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6">
            <CountUp
              value={index}
              format={fmtIndex}
              duration={1.6}
              className="font-display text-[clamp(7rem,22vw,15rem)] font-bold leading-[0.85] tabular-nums transition-colors"
              style={{ color }}
            />
            <div>
              <p className="text-lg font-semibold tracking-[0.2em]" style={{ color }}>
                {getSeverityLabel(index)}
              </p>
              <p className="text-xs text-muted">/ {SEVERITY_MAX} scale</p>
            </div>
          </div>
          <SeverityGauge value={index} />
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted">
            Mean severity of the {TOP_N} strongest active detections across your Wazuh estate, on a continuous 0 to 20 scale.
          </p>
        </div>

        <div className="border-line lg:col-span-5 lg:border-l lg:pl-10">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="uppercase tracking-[0.25em]">Ledger</span>
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-2 w-2 ${source === 'wazuh' ? 'bg-accent' : 'border border-muted'}`}
              />
              {source === 'wazuh' ? 'LIVE · wazuh' : 'MOCK · sample data'}
            </span>
          </div>
          <div className="mt-2 divide-y divide-line border-y border-line">
            <LedgerRow index={0} label="Total alerts" spark={eventsSeries} sparkColor="var(--color-accent)">
              <CountUp value={s.totalAlerts} />
            </LedgerRow>
            <LedgerRow index={1} label="High severity" spark={highSeries} sparkColor={getSeverityColor(14)}>
              <CountUp value={s.highSeverity} />
            </LedgerRow>
            <LedgerRow index={2} label="Active agents">
              <CountUp value={s.activeAgents} />
            </LedgerRow>
            <LedgerRow index={3} label="Mean time to detect">
              <span className="text-2xl sm:text-3xl">{s.meanTimeToDetect}</span>
            </LedgerRow>
          </div>
          {syncedAt && (
            <p className="mt-3 text-[11px] text-muted">
              synced {syncedAt.toISOString().slice(11, 19)}Z · refresh every 30s
            </p>
          )}
        </div>
      </section>

      {/* 02 — Timeline */}
      <section aria-labelledby="timeline-title" className="mt-16 border-t-2 border-ink pt-6 md:mt-24">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <Eyebrow>// 02 timeline</Eyebrow>
            <h2 id="timeline-title" className="mt-2 font-display text-2xl font-bold uppercase">
              Detections by hour
            </h2>
          </div>
          <p className="text-xs text-muted">hover or use ← → to inspect</p>
        </div>
        <ThreatTimeline data={timeline} />
      </section>

      {/* 03 — Feed */}
      <section aria-label="Highest severity alerts" className="mt-16 border-t-2 border-ink pt-6 md:mt-24">
        <AlertFeed alerts={alerts} />
      </section>
    </div>
  )
}
