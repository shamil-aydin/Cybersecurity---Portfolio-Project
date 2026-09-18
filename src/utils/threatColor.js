const BLUE = [59, 130, 246]
const AMBER = [245, 158, 11]
const RED = [239, 68, 68]

function lerp(a, b, t) {
  return a + (b - a) * t
}

function mixColors(start, end, t) {
  return start.map((channel, index) => Math.round(lerp(channel, end[index], t)))
}

function toRgbString(rgb, alpha) {
  if (alpha !== undefined) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]} / ${alpha})`
  }
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

export function getThreatColor(score, alpha) {
  const clampedScore = Math.min(Math.max(score, 0), 20)

  if (clampedScore <= 6) {
    return toRgbString(BLUE, alpha)
  }

  if (clampedScore <= 13) {
    const t = (clampedScore - 6) / 7
    return toRgbString(mixColors(BLUE, AMBER, t), alpha)
  }

  const t = (clampedScore - 13) / 7
  return toRgbString(mixColors(AMBER, RED, t), alpha)
}

// Alias for backward compatibility
export { getThreatColor as getThreatColorRgb }