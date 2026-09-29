// Sentrivue severity scale: 0 (stable, blue) -> 20 (critical, red).
// Continuous HSL interpolation, no discrete steps. The hue travels
// blue -> violet -> crimson -> red so it never crosses green/amber,
// which keeps the UI accent colour distinct from severity.

export const SEVERITY_MAX = 20

const HUE_START = 215
const HUE_END = 358
const SAT_START = 85
const SAT_END = 92
const LIGHT_START = 60
const LIGHT_END = 54

export function clampSeverity(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return 0
  return Math.min(Math.max(n, 0), SEVERITY_MAX)
}

export function getSeverityColor(value, alpha) {
  const t = clampSeverity(value) / SEVERITY_MAX
  const h = (HUE_START + (HUE_END - HUE_START) * t).toFixed(1)
  const s = (SAT_START + (SAT_END - SAT_START) * t).toFixed(1)
  const l = (LIGHT_START + (LIGHT_END - LIGHT_START) * t).toFixed(1)
  // Legacy comma syntax on purpose: canvas/WebGL colour parsers (three-globe) reject the space form
  return alpha === undefined
    ? `hsl(${h}, ${s}%, ${l}%)`
    : `hsla(${h}, ${s}%, ${l}%, ${Number(alpha).toFixed(3)})`
}

export function getSeverityLabel(value) {
  const v = clampSeverity(value)
  if (v < 6) return 'STABLE'
  if (v < 11) return 'WATCH'
  if (v < 16) return 'ELEVATED'
  return 'CRITICAL'
}
