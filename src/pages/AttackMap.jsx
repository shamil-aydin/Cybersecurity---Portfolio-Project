import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { MeshPhongMaterial } from 'three'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Pause, Play, X } from 'lucide-react'
import { getSeverityColor, getSeverityLabel } from '../utils/severity'
import { useAttackStream } from '../hooks/useAttackStream'
import { resetConnectionCache } from '../services/wazuhApi'
import BootLoader from '../components/BootLoader'
import ConnectionNotice from '../components/ConnectionNotice'
import CountUp from '../components/CountUp'
import SeverityMark from '../components/SeverityMark'

const LAND_URL =
  'https://cdn.jsdelivr.net/gh/vasturiano/react-globe.gl@master/example/datasets/ne_110m_admin_0_countries.geojson'
const DRAW_MS = 1600
const IMPACT_MS = 3200
const COMET_COLOR = '#fff3cf'
const bootLines = ['acquiring target position', 'resolving attacker geolocation', 'plotting routes']

// ── helpers ─────────────────────────────────────────────────────────────────

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const fmtTime = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '--:--:--' : `${d.toISOString().slice(11, 19)}Z`
}

const SIM_COLOR = '#e0a54c'

function tooltipHtml(e) {
  const color = getSeverityColor(e.severity)
  return `<div style="font:12px 'IBM Plex Mono',monospace;background:#1a1815;border:1px solid #3a3630;border-top:2px solid ${color};padding:8px 10px;color:#e8e2d0;line-height:1.55;min-width:150px">
    <div style="font-weight:600">${esc(e.country)}${e.isSimulatedLocation ? ` <span style="color:${SIM_COLOR}">· SIMULATED</span>` : ''}</div>
    <div style="color:#948c7c">${esc(e.ip)}</div>
    <div>${esc(e.type)}</div>
    <div style="color:${color};font-weight:600">SEV ${String(Math.round(e.severity)).padStart(2, '0')}/20 · ${getSeverityLabel(e.severity)}</div>
  </div>`
}

// Arc objects must keep a stable identity or three-globe would redraw them.
const arcCache = new WeakMap()
function arcFor(event, kind, target) {
  let entry = arcCache.get(event)
  if (!entry) arcCache.set(event, (entry = {}))
  const cur = entry[kind]
  if (cur && cur.endLat === target.lat && cur.endLng === target.lng) return cur
  return (entry[kind] = {
    kind,
    ev: event,
    startLat: event.lat,
    startLng: event.lng,
    endLat: target.lat,
    endLng: target.lng,
    color: kind === 'base' ? getSeverityColor(event.severity) : COMET_COLOR,
  })
}

// `el` is the element itself (from a callback ref) because the stage only mounts after loading
function useSize(el) {
  const [size, setSize] = useState({ w: 800, h: 560 })
  useEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setSize({ w: Math.max(200, Math.floor(width)), h: Math.max(240, Math.floor(height)) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return size
}

// ── page ────────────────────────────────────────────────────────────────────

export default function AttackMap() {
  const reduce = useReducedMotion()
  const { events, source, error, target, status, replay, unresolved, reload } = useAttackStream()

  const globeRef = useRef(null)
  const [stageEl, setStageEl] = useState(null)
  const size = useSize(stageEl)

  const zoom = size.w < 640 ? 1.7 : 1 // pull the camera back on phones so the whole globe fits
  const [land, setLand] = useState([])
  const [globeReady, setGlobeReady] = useState(false)
  const [rotate, setRotate] = useState(true)
  const [selectedKey, setSelectedKey] = useState(null)
  const [hoverKey, setHoverKey] = useState(null)
  const [cometKeys, setCometKeys] = useState(() => new Set())
  const [impacts, setImpacts] = useState([])

  const handled = useRef(new Set())
  const timers = useRef(new Set())
  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.add(id)
  }, [])

  useEffect(() => {
    const active = timers.current
    return () => active.forEach(clearTimeout)
  }, [])

  // Globe surface: warm near-black sphere, no texture
  const material = useMemo(
    () => new MeshPhongMaterial({ color: '#1c1a16', emissive: '#0c0b09', shininess: 4 }),
    [],
  )

  // Land as hex dots (falls back to a plain graticule globe if the fetch fails)
  useEffect(() => {
    let cancelled = false
    fetch(LAND_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((g) => !cancelled && setLand(g.features || []))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Each new event: draw arc first, then send the comet + impact ring
  useEffect(() => {
    for (const e of events) {
      if (handled.current.has(e.key)) continue
      handled.current.add(e.key)
      later(() => {
        setCometKeys((prev) => new Set(prev).add(e.key))
        setImpacts((prev) => [...prev, { key: e.key, lat: target.lat, lng: target.lng, sev: e.severity }])
      }, reduce ? 0 : DRAW_MS)
      later(() => setImpacts((prev) => prev.filter((i) => i.key !== e.key)), (reduce ? 0 : DRAW_MS) + IMPACT_MS)
    }
  }, [events, target, reduce, later])

  const selected = useMemo(() => events.find((e) => e.key === selectedKey) || null, [events, selectedKey])

  const arcs = useMemo(() => {
    const list = []
    for (const e of events) {
      list.push(arcFor(e, 'base', target))
      if (!reduce && cometKeys.has(e.key)) list.push(arcFor(e, 'comet', target))
    }
    return list
  }, [events, cometKeys, target, reduce])

  const rings = useMemo(
    () => [{ key: 'target', lat: target.lat, lng: target.lng }, ...(reduce ? [] : impacts)],
    [target, impacts, reduce],
  )

  const select = useCallback(
    (e) => {
      setSelectedKey(e ? e.key : null)
      if (e && globeRef.current) {
        globeRef.current.pointOfView({ lat: e.lat, lng: e.lng, altitude: 1.7 * zoom }, reduce ? 0 : 1000)
      }
    },
    [reduce, zoom],
  )

  // Camera + rotation
  useEffect(() => {
    if (!globeReady) return
    globeRef.current.pointOfView({ lat: target.lat, lng: target.lng, altitude: 2.0 * zoom }, 0)
  }, [globeReady, target, zoom])

  useEffect(() => {
    if (!globeReady) return
    const controls = globeRef.current.controls()
    controls.autoRotate = rotate && !selectedKey && !reduce
    controls.autoRotateSpeed = 0.35
  }, [globeReady, rotate, selectedKey, reduce])

  // Stop rendering while the tab is hidden
  useEffect(() => {
    if (!globeReady) return
    const onVis = () => (document.hidden ? globeRef.current?.pauseAnimation() : globeRef.current?.resumeAnimation())
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [globeReady])

  useEffect(() => {
    if (!selectedKey) return
    const onKey = (e) => e.key === 'Escape' && setSelectedKey(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedKey])

  // Accessors: memoised so the globe only updates when they truly change
  const arcStroke = useCallback(
    (d) => (d.kind === 'comet' ? 0.9 : d.ev.key === selectedKey || d.ev.key === hoverKey ? 0.85 : 0.42),
    [selectedKey, hoverKey],
  )
  const arcDashLength = useCallback((d) => (d.kind === 'comet' ? 0.05 : 1e6), [])
  const arcDashGap = useCallback((d) => (d.kind === 'comet' ? 1.5 : 1), [])
  const arcDashInitialGap = useCallback((d) => (d.kind === 'comet' || !reduce ? 1 : 0), [reduce])
  const arcDashAnimateTime = useCallback(
    (d) => (reduce ? 0 : d.kind === 'comet' ? 2200 : DRAW_MS),
    [reduce],
  )

  const countries = useMemo(() => new Set(events.map((e) => e.countryCode || e.country)).size, [events])
  const peak = useMemo(() => events.reduce((m, e) => Math.max(m, e.severity), 0), [events])
  const newest = events[events.length - 1]

  if (status === 'loading') return <BootLoader lines={bootLines} />

  return (
    <div>
      <div className="mx-auto max-w-[1400px] px-4 pt-4 md:px-8">
        <ConnectionNotice
          source={source}
          error={error}
          onRetry={() => {
            resetConnectionCache()
            reload()
          }}
        />
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_23rem]">
        {/* ── Stage ── */}
        <section
          ref={setStageEl}
          aria-label="Attack globe. Decorative view; the intercept list contains the same information."
          className="relative h-[68svh] min-h-[420px] overflow-hidden lg:h-[calc(100svh-3rem-4.5rem)]"
          style={{ background: 'radial-gradient(ellipse at 40% 45%, #1d1a15 0%, #121110 65%)' }}
        >
          <Globe
            ref={globeRef}
            width={size.w}
            height={size.h}
            backgroundColor="rgba(0,0,0,0)"
            rendererConfig={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            onGlobeReady={() => setGlobeReady(true)}
            globeMaterial={material}
            showGraticules
            showAtmosphere
            atmosphereColor="#948c7c"
            atmosphereAltitude={0.16}
            hexPolygonsData={land}
            hexPolygonResolution={3}
            hexPolygonMargin={0.55}
            hexPolygonColor={() => '#6b6455'}
            hexPolygonAltitude={0.002}
            arcsData={arcs}
            arcColor="color"
            arcStroke={arcStroke}
            arcAltitudeAutoScale={0.45}
            arcCurveResolution={64}
            arcDashLength={arcDashLength}
            arcDashGap={arcDashGap}
            arcDashInitialGap={arcDashInitialGap}
            arcDashAnimateTime={arcDashAnimateTime}
            arcsTransitionDuration={reduce ? 0 : 800}
            arcLabel={(d) => tooltipHtml(d.ev)}
            onArcHover={(d) => setHoverKey(d ? d.ev.key : null)}
            onArcClick={(d) => d && select(d.ev)}
            pointsData={events}
            pointLat="lat"
            pointLng="lng"
            pointColor={(e) => getSeverityColor(e.severity)}
            pointAltitude={0.012}
            pointRadius={(e) => 0.28 + Math.min(0.5, Math.log10(e.count + 1) * 0.2)}
            pointLabel={tooltipHtml}
            onPointClick={(e) => e && select(e)}
            ringsData={rings}
            ringColor={(d) => (t) => (d.key === 'target' ? `rgba(255,176,0,${1 - t})` : getSeverityColor(d.sev, 1 - t))}
            ringMaxRadius={(d) => (d.key === 'target' ? 3 : 5)}
            ringPropagationSpeed={2}
            ringRepeatPeriod={(d) => (d.key === 'target' ? 1800 : 0)}
          />

          {/* Hero overlay */}
          <div className="pointer-events-none absolute left-4 top-4 md:left-8 md:top-8">
            <p className="text-xs uppercase tracking-[0.25em] text-accent">// attack map</p>
            <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.75rem)] font-bold uppercase leading-[0.95]">
              Live
              <br />
              intercepts
            </h1>
            <dl className="mt-5 space-y-1 text-xs">
              {[
                ['routes', <CountUp key="r" value={events.length} />],
                ['countries', <CountUp key="c" value={countries} />],
                [
                  'peak sev',
                  <span key="p" style={{ color: getSeverityColor(peak) }}>
                    <CountUp value={peak} format={(n) => String(Math.round(n)).padStart(2, '0')} />
                    /20
                  </span>,
                ],
              ].map(([k, v]) => (
                <div key={k} className="flex w-44 items-end gap-2">
                  <dt className="uppercase tracking-widest text-muted">{k}</dt>
                  <span aria-hidden="true" className="mb-1 flex-1 border-b border-dotted border-line" />
                  <dd className="font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Bottom controls */}
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-3 md:inset-x-8 md:bottom-6">
            <div className="text-[11px] text-muted">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="tabular-nums">00</span>
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-32"
                  style={{
                    background: `linear-gradient(to right, ${Array.from({ length: 11 }, (_, i) => getSeverityColor(i * 2)).join(',')})`,
                  }}
                />
                <span className="tabular-nums">20</span>
                <span>severity</span>
              </div>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="h-2 w-2 bg-accent" />
                target: {target.label}
              </div>
            </div>
            <button
              type="button"
              aria-pressed={rotate}
              onClick={() => setRotate((r) => !r)}
              disabled={reduce}
              className="inline-flex items-center gap-2 border border-line bg-bg/80 px-3 py-2 text-xs uppercase tracking-widest text-ink backdrop-blur-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
            >
              {rotate ? <Pause className="h-3 w-3" aria-hidden="true" /> : <Play className="h-3 w-3" aria-hidden="true" />}
              rotation
            </button>
          </div>

          {events.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="max-w-sm border border-line bg-bg/85 p-4 text-sm text-muted">
                No geolocated attack sources yet.
                {unresolved > 0 && ` ${unresolved} alert(s) had private or unresolvable IPs.`}
              </p>
            </div>
          )}
        </section>

        {/* ── Intercept feed ── */}
        <aside aria-label="Intercept feed" className="overflow-x-clip border-t border-line lg:h-[calc(100svh-3rem-4.5rem)] lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg/95 px-4 py-3 text-xs backdrop-blur-sm">
            <span className="uppercase tracking-[0.25em] text-muted">Intercepts</span>
            <span className="flex items-center gap-2 text-muted">
              <span aria-hidden="true" className={`h-2 w-2 ${replay ? 'border border-muted' : 'bg-accent'}`} />
              {replay ? 'REPLAY · sample' : 'LIVE'}
            </span>
          </div>

          <AnimatePresence initial={false}>
            {selected && (
              <motion.div
                key="detail"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-b border-line bg-panel"
              >
                <div className="p-4" style={{ borderLeft: `3px solid ${getSeverityColor(selected.severity)}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 font-display text-xl font-bold uppercase">
                        {selected.country}
                        {selected.isSimulatedLocation && (
                          <span
                            className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-widest"
                            style={{ color: SIM_COLOR, border: `1px solid ${SIM_COLOR}` }}
                            title="Private source IP — location is a demo stand-in, not a real geolocation"
                          >
                            SIMULATED
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted">{selected.ip}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(null)}
                      aria-label="Close details"
                      className="p-1 text-muted transition-colors hover:text-accent"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <SeverityMark value={selected.severity} size={32} />
                    <span className="text-xs font-semibold tracking-widest" style={{ color: getSeverityColor(selected.severity) }}>
                      {getSeverityLabel(selected.severity)}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">type</dt>
                      <dd className="text-right">{selected.type}</dd>
                    </div>
                    {selected.title && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted">detail</dt>
                        <dd className="text-right">{selected.title}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">events</dt>
                      <dd className="tabular-nums">{selected.count}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">seen</dt>
                      <dd className="tabular-nums">{fmtTime(selected.timestamp)}</dd>
                    </div>
                  </dl>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <ol className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {[...events].reverse().map((e) => (
                <motion.li
                  key={e.key}
                  layout={!reduce}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <button
                    type="button"
                    onClick={() => select(e)}
                    onPointerEnter={() => setHoverKey(e.key)}
                    onPointerLeave={() => setHoverKey(null)}
                    aria-current={selectedKey === e.key}
                    aria-label={`${e.country}${e.isSimulatedLocation ? ' (simulated location)' : ''}, ${e.ip}, ${e.type}, severity ${Math.round(e.severity)} of 20`}
                    className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-all hover:bg-panel hover:pl-6 focus-visible:bg-panel ${
                      selectedKey === e.key ? 'bg-panel' : ''
                    }`}
                  >
                    <SeverityMark value={e.severity} size={22} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-xs font-semibold">
                        <span className="truncate">{e.country}</span>
                        {e.isSimulatedLocation && (
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: SIM_COLOR }}
                            title="Simulated location (private source IP)"
                          />
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {e.ip} · {e.type}
                        {e.isSimulatedLocation && <span style={{ color: SIM_COLOR }}> · SIM</span>}
                      </span>
                    </span>
                    <time className="text-[11px] tabular-nums text-muted" dateTime={e.timestamp}>
                      {fmtTime(e.timestamp).slice(0, 8)}
                    </time>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          {events.length === 0 && <p className="px-4 py-8 text-xs text-muted">waiting for intercepts…</p>}
        </aside>
      </div>

      <div className="sr-only-live" aria-live="polite">
        {newest ? `New intercept from ${newest.country}, severity ${Math.round(newest.severity)} of 20` : ''}
      </div>
    </div>
  )
}
