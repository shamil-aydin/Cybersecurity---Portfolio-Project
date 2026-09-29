import { getSeverityColor, clampSeverity } from '../utils/severity'

// Severity is encoded in colour (0-20 scale), in shape, and as a number.
// low: circle, mid: triangle, high: diamond, critical: filled diamond.
export default function SeverityMark({ value, size = 28, showValue = true }) {
  const v = clampSeverity(value)
  const color = getSeverityColor(v)
  const r = size / 2
  let shape
  if (v < 6) {
    shape = <circle cx={r} cy={r} r={r - 2} fill="none" stroke={color} strokeWidth="2" />
  } else if (v < 11) {
    shape = (
      <polygon points={`${r},2 ${size - 2},${size - 3} 2,${size - 3}`} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    )
  } else {
    const filled = v >= 16
    shape = (
      <polygon
        points={`${r},1 ${size - 1},${r} ${r},${size - 1} 1,${r}`}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    )
  }

  return (
    <span className="inline-flex items-center gap-2" role="img" aria-label={`Severity ${Math.round(v)} out of 20`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {shape}
      </svg>
      {showValue && (
        <span className="w-6 text-right text-sm font-semibold tabular-nums" style={{ color }}>
          {String(Math.round(v)).padStart(2, '0')}
        </span>
      )}
    </span>
  )
}
