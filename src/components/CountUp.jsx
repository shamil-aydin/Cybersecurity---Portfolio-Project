import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

const defaultFormat = (n) => Math.round(n).toLocaleString()

// Counts up by writing straight to the DOM node, so it never re-renders React.
export default function CountUp({ value, duration = 1.4, format = defaultFormat, className, style }) {
  const ref = useRef(null)
  const current = useRef(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.textContent = format(value)
      current.current = value
      return
    }
    const controls = animate(current.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        current.current = v
        el.textContent = format(v)
      },
    })
    return () => controls.stop()
  }, [value, duration, format, reduce])

  return (
    <span ref={ref} className={className} style={style}>
      {format(0)}
    </span>
  )
}
