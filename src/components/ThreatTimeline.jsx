import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { getSeverityColor, SEVERITY_MAX } from '../utils/severity'

const M = { top: 14, right: 10, bottom: 26, left: 38 }

function useWidth(ref) {
  const [w, setW] = useState(800)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

// Custom SVG timeline. Bar height = events per hour. Bar colour = load relative
// to the period peak, mapped onto the shared 0-20 severity scale.
export default function ThreatTimeline({ data }) {
  const wrapRef = useRef(null)
  const width = useWidth(wrapRef)
  const height = width < 520 ? 220 : 290
  const [active, setActive] = useState(null)

  const model = useMemo(() => {
    const n = data.length
    const peak = Math.max(...data.map((d) => d.events), 1)
    const innerW = width - M.left - M.right
    const innerH = height - M.top - M.bottom
    const slot = n ? innerW / n : innerW
    const yOf = (v) => M.top + innerH - (v / peak) * innerH
    const bars = data.map((d, i) => {
      const sev = (d.events / peak) * SEVERITY_MAX
      return {
        ...d,
        i,
        sev,
        color: getSeverityColor(sev),
        x: M.left + i * slot + slot * 0.19,
        w: slot * 0.62,
        cx: M.left + i * slot + slot / 2,
        y: yOf(d.events),
        h: M.top + innerH - yOf(d.events),
      }
    })
    const line = bars.map((b, i) => `${i ? 'L' : 'M'}${b.cx.toFixed(1)} ${yOf(b.blocked).toFixed(1)}`).join(' ')
    return { bars, line, peak, innerW, innerH, slot, base: M.top + innerH }
  }, [data, width, height])

  function onPointerMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - M.left
    if (!model.bars.length) return
    setActive(Math.min(model.bars.length - 1, Math.max(0, Math.floor(x / model.slot))))
  }

  function onKeyDown(e) {
    const last = model.bars.length - 1
    if (last < 0) return
    if (e.key === 'ArrowRight') setActive((a) => (a === null ? 0 : Math.min(last, a + 1)))
    else if (e.key === 'ArrowLeft') setActive((a) => (a === null ? last : Math.max(0, a - 1)))
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(last)
    else if (e.key === 'Escape') setActive(null)
    else return
    e.preventDefault()
  }

  const labelEvery = Math.max(1, Math.ceil(model.bars.length / Math.floor(model.innerW / 44)))
  const a = active !== null ? model.bars[active] : null
  const tipLeft = a ? Math.min(Math.max(a.cx, 80), width - 80) : 0

  if (!data.length) {
    return <p className="py-16 text-center text-sm text-muted">no timeline data yet</p>
  }

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative touch-pan-y outline-offset-4"
        tabIndex={0}
        role="group"
        aria-label={`Threat timeline, ${data.length} periods. Use left and right arrow keys to inspect each one.`}
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="block select-none">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = model.base - f * model.innerH
            return (
              <g key={f}>
                <line x1={M.left} x2={width - M.right} y1={y} y2={y} stroke="var(--color-line)" strokeDasharray="2 4" />
                <text x={M.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--color-muted)">
                  {Math.round(model.peak * f)}
                </text>
              </g>
            )
          })}

          {model.bars.map((b) => (
            <motion.rect
              key={b.i}
              x={b.x}
              width={b.w}
              fill={b.color}
              initial={{ y: model.base, height: 0 }}
              animate={{ y: b.y, height: b.h, opacity: active === null || active === b.i ? 1 : 0.38 }}
              transition={{
                y: { duration: 0.6, delay: b.i * 0.02, ease: [0.16, 1, 0.3, 1] },
                height: { duration: 0.6, delay: b.i * 0.02, ease: [0.16, 1, 0.3, 1] },
                opacity: { duration: 0.15 },
              }}
            />
          ))}

          <motion.path
            d={model.line}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, delay: 0.3, ease: 'easeInOut' }}
          />

          {model.bars.map((b) =>
            b.i % labelEvery === 0 ? (
              <text key={b.i} x={b.cx} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
                {b.hour}
              </text>
            ) : null,
          )}

          {a && (
            <g>
              <line x1={a.cx} x2={a.cx} y1={M.top} y2={model.base} stroke="var(--color-accent)" strokeWidth="1" />
              <circle cx={a.cx} cy={model.base - (a.blocked / model.peak) * model.innerH} r="4" fill="var(--color-bg)" stroke="var(--color-ink)" strokeWidth="2" />
            </g>
          )}
        </svg>

        {a && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-2 z-10 w-40 -translate-x-1/2 border border-line bg-panel p-2.5 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
            style={{ left: tipLeft, borderTopColor: a.color, borderTopWidth: 2 }}
          >
            <div className="mb-1.5 text-muted">{a.hour}</div>
            <div className="flex justify-between">
              <span className="text-muted">events</span>
              <span className="font-semibold tabular-nums">{a.events}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">high-sev</span>
              <span className="font-semibold tabular-nums">{a.blocked}</span>
            </div>
            <div className="mt-1.5 flex justify-between border-t border-line pt-1.5">
              <span className="text-muted">load</span>
              <span className="font-semibold tabular-nums" style={{ color: a.color }}>
                {a.sev.toFixed(0).padStart(2, '0')}/20
              </span>
            </div>
          </div>
        )}
        <div className="sr-only-live" aria-live="polite">
          {a ? `${a.hour}: ${a.events} events, ${a.blocked} high severity, load ${a.sev.toFixed(0)} of 20` : ''}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-muted">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-[2px] bg-ink" /> high-severity line
        </span>
        <span className="flex items-center gap-2">
          <span>bar load</span>
          <span className="tabular-nums">00</span>
          <span
            aria-hidden="true"
            className="inline-block h-2 w-28"
            style={{
              background: `linear-gradient(to right, ${Array.from({ length: 11 }, (_, i) => getSeverityColor(i * 2)).join(',')})`,
            }}
          />
          <span className="tabular-nums">20</span>
        </span>
      </div>
    </div>
  )
}
