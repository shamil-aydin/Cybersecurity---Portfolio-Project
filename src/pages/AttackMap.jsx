import { useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { ShieldAlert, Crosshair, Radar, RadioTower, Activity } from 'lucide-react'
import { TARGET_COORDS, TARGET_IP } from '../data/mockData'
import { getThreatColor } from '../utils/threatColor'
import { fetchAttackSources } from '../services/wazuhApi'

export default function AttackMap() {
  const globeRef = useRef(null)
  const [autoRotate, setAutoRotate] = useState(true)
  const [heatOverlay, setHeatOverlay] = useState(true)
  const [feed, setFeed] = useState([])
  const [sources, setSources] = useState([])
  const [sourceStatus, setSourceStatus] = useState('mock')

  // ── Live attack feed from Wazuh API ──
  useEffect(() => {
    let cancelled = false

    async function loadSources() {
      const res = await fetchAttackSources().catch(() => ({ source: 'mock', data: [] }))
      if (!cancelled) {
        if (res.data && res.data.length > 0) {
          setSources(res.data)
          setSourceStatus(res.source)
        }
      }
    }

    loadSources()

    // Refresh every 30s
    const interval = setInterval(loadSources, 30000)

    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // ── Arcs from attack sources to local target ──
  const arcs = sources.map((src) => ({
    start: { lat: src.lat, lng: src.lng },
    end: TARGET_COORDS,
    color: getThreatColor(src.intensity * 20),
    endPoints: true,
    dashArray: src.intensity > 0.7 ? [8, 6] : [4, 4],
    arcOffset: 0.1,
  }))

  const handleArcClick = (event) => {
    event.stopPropagation()
    if (event.object && event.object.__globe) {
      const src = sources.find((s) => s.ip === event.object.__globe._attributes.__globe.__globe?.start)
      if (src) setFeed((prev) => [{ ...src, count: src.count + 1 }, ...prev].slice(0, 6))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attack Map</h1>
          <p className="text-sm text-muted-foreground mt-1">Global threat intelligence — live attack visualizations</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
              className="accent-cyber-blue"
            />
            Auto-rotate
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={heatOverlay}
              onChange={(e) => setHeatOverlay(e.target.checked)}
              className="accent-cyber-red"
            />
            Heat overlay
          </label>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden relative">
        <div className="absolute top-4 left-4 z-10 bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RadioTower className="w-3 h-3 text-cyber-red" />
            Local target: <span className="font-mono text-foreground">{TARGET_IP}</span>
          </div>
        </div>

        <Globe
          ref={globeRef}
          backgroundColor="#0a0d14"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          arcTime={2000}
          arcStroke={1.5}
          arcsData={arcs}
          arcColor={(e) => e.color}
          arcAltitude={(e) => e.arcOffset * 0.5 + 0.15}
          showArcs
          showGraticules
          graticuleColor="#1f2937"
          showAtmosphere
          atmosphereColor="#3b82f6"
          atmosphereAltitude={0.25}
          autoRotate={autoRotate}
          autoRotateSpeed={0.5}
          onGlobeClick={() => setFeed((prev) => [{ ...sources[0], count: (sources[0]?.count ?? 0) + 1 }, ...prev].slice(0, 6))}
          width={undefined}
          height={undefined}
          className="h-[520px] w-full"
        />

        {/* Heat overlay markers */}
        {heatOverlay && (
          <div className="absolute inset-0 pointer-events-none">
            {sources.map((src) => (
              <div
                key={src.ip}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: `${8 + src.intensity * 20}px`,
                  height: `${8 + src.intensity * 20}px`,
                  left: `${(src.lng + 180) / 360 * 100}%`,
                  top: `${(90 - src.lat) / 180 * 100}%`,
                  background: `radial-gradient(circle, ${getThreatColor(src.intensity * 20, 0.4)} 0%, transparent 70%)`,
                  opacity: 0.7,
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        )}

        <div className="absolute bottom-4 left-4 z-10 bg-card/90 backdrop-blur border border-border rounded-lg p-3 text-xs w-72">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3.5 h-3.5 text-cyber-red" />
            <span className="font-semibold text-foreground">Live Attack Feed</span>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {feed.map((src, idx) => (
              <div key={`${src.ip}-${idx}`} className="flex items-center justify-between gap-2">
                <span className="font-mono text-muted-foreground truncate">{src.ip}</span>
                <span className="text-xs font-medium" style={{ color: getThreatColor(src.intensity * 20) }}>
                  {src.count} attacks
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Source statistics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sources.slice(0, 4).map((src) => (
          <div key={src.ip} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-sm text-foreground">{src.ip}</div>
                <div className="text-xs text-muted-foreground mt-1">{src.country} · {src.count} attacks</div>
              </div>
              <ShieldAlert className="w-5 h-5" style={{ color: getThreatColor(src.intensity * 20) }} />
            </div>
            <div className="mt-3 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${src.intensity * 100}%`, backgroundColor: getThreatColor(src.intensity * 20) }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
