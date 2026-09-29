import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchIncidentsFromIndexer } from '../services/wazuhIndexer'
import { geolocate, getTargetLocation } from '../services/geoip'
import { TARGET_COORDS } from '../data/mockData'

const POLL_MS = 15000
const QUEUE_REVEAL_MS = 1300
const REPLAY_REVEAL_MS = 2800
const MAX_VISIBLE = 14
const INITIAL_BATCH = 10

/**
 * Turns Wazuh incidents (from the Indexer) into a live stream of geolocated attack
 * events.
 * - New alerts (unseen ids) are queued and revealed one by one so each arc is
 *   drawn on its own.
 * - source 'wazuh' with zero geolocatable events (Indexer connected but no alert
 *   yet carries a public source IP) is a real "waiting for data" state: the pool
 *   stays empty and nothing replays — see the `replay` guard below.
 * - Only when the Indexer itself is unreachable (source 'mock') are the built-in
 *   sample events replayed in a loop so the map stays alive; `replay` is true then.
 */
export function useAttackStream() {
  const [events, setEvents] = useState([])
  const [source, setSource] = useState('mock')
  const [target, setTarget] = useState({ ...TARGET_COORDS, label: 'Target' })
  const [status, setStatus] = useState('loading') // loading | ready
  const [unresolved, setUnresolved] = useState(0)
  const [error, setError] = useState(null)

  const seen = useRef(new Set())
  const queue = useRef([])
  const pool = useRef([])
  const cursor = useRef(0)
  const sourceRef = useRef('mock')
  const lastReveal = useRef(0)
  const alive = useRef(true)

  const load = useCallback(async () => {
    const res = await fetchIncidentsFromIndexer().catch(() => null)
    if (!alive.current) return
    const list = Array.isArray(res?.data) ? res.data : []
    const src = res?.source || 'mock'

    const withIp = list.filter((i) => i && i.sourceIp)
    const geos = await Promise.all(withIp.map((i) => geolocate(i.sourceIp).catch(() => null)))

    if (!alive.current) return

    const resolved = []
    withIp.forEach((inc, idx) => {
      const geo = geos[idx]
      if (!geo) return
      resolved.push({
        id: String(inc.id),
        ip: inc.sourceIp,
        country: geo.country || geo.countryCode || 'Unknown',
        countryCode: geo.countryCode || '',
        lat: geo.lat,
        lng: geo.lng,
        isSimulatedLocation: geo.isSimulatedLocation === true,
        type: inc.category || inc.title || 'Unknown',
        title: inc.title || '',
        severity: Number(inc.severity) || 0,
        timestamp: inc.timestamp,
        count: inc.count || 1,
      })
    })
    resolved.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

    setUnresolved(list.length - resolved.length)
    setSource(src)
    setError(res?.error ?? null)
    sourceRef.current = src
    pool.current = resolved

    const fresh = resolved.filter((e) => !seen.current.has(e.id))
    const firstRun = seen.current.size === 0
    fresh.forEach((e) => seen.current.add(e.id))
    queue.current.push(...(firstRun ? fresh.slice(-INITIAL_BATCH) : fresh))
    setStatus('ready')
  }, [])

  const reveal = useCallback((evt) => {
    const key = `${evt.id}#${Date.now()}`
    setEvents((prev) => [...prev, { ...evt, key, born: Date.now() }].slice(-MAX_VISIBLE))
  }, [])

  useEffect(() => {
    alive.current = true
    getTargetLocation().then((t) => alive.current && setTarget(t))
    const first = setTimeout(load, 0)
    const poll = setInterval(load, POLL_MS)

    const tick = setInterval(() => {
      if (document.hidden) return
      const elapsed = Date.now() - lastReveal.current
      if (queue.current.length && elapsed >= QUEUE_REVEAL_MS) {
        lastReveal.current = Date.now()
        reveal(queue.current.shift())
      } else if (!queue.current.length && sourceRef.current === 'mock' && pool.current.length && elapsed >= REPLAY_REVEAL_MS) {
        lastReveal.current = Date.now()
        const base = pool.current[cursor.current++ % pool.current.length]
        reveal({ ...base, timestamp: new Date().toISOString() })
      }
    }, 300)

    return () => {
      alive.current = false
      clearTimeout(first)
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [load, reveal])

  return { events, source, error, target, status, unresolved, reload: load, replay: source === 'mock' }
}
