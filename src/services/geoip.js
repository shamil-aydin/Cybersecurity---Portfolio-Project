// IP geolocation for the Attack Map.
// Primary: ipwho.is (free, HTTPS, CORS, no key). Secondary: ip-api.com (free tier
// is HTTP-only, so it is only used when the app itself is served over HTTP).
// Results are cached in memory and localStorage; offline, a small built-in table
// keeps the sample IPs on the map.

import { attackSources, TARGET_COORDS } from '../data/mockData'

const CACHE_KEY = 'sentrivue-geo-cache'
const TIMEOUT_MS = 5000

const OFFLINE_TABLE = Object.fromEntries(
  attackSources.map((s) => [s.ip, { ip: s.ip, country: s.country, countryCode: s.country, lat: s.lat, lng: s.lng }]),
)

const memory = new Map()
const inflight = new Map()

function loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    for (const [ip, geo] of Object.entries(raw)) memory.set(ip, geo)
  } catch { /* ignore */ }
}
loadCache()

function persist() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(memory)))
  } catch { /* ignore */ }
}

export function isPublicIp(ip) {
  if (!ip || typeof ip !== 'string') return false
  const v = ip.trim()
  if (v.includes(':')) return !/^(::1?|fc|fd|fe80)/i.test(v)
  const m = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  if (m.slice(1).some((o) => Number(o) > 255)) return false
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  return true
}

// RFC1918 private ranges + IPv4/IPv6 localhost. Narrower than isPublicIp's
// exclusion list (which also covers link-local, CGNAT, multicast, etc.) —
// this is specifically "an address a real geolocation service will never
// resolve because it isn't routable on the public internet, and it's one of
// our own private test IPs".
export function isPrivateIP(ip) {
  if (!ip || typeof ip !== 'string') return false
  const v = ip.trim()
  if (v === '::1') return true
  const m = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const o = m.slice(1).map(Number)
  if (o.some((n) => n > 255)) return false
  const [a, b] = o
  if (a === 127) return true
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

// Demo/presentation fallback for private source IPs (e.g. an all-private
// VirtualBox NAT test lab): a real geolocation service will never place them
// anywhere, which would leave the Attack Map permanently empty in that
// environment. This is NOT a fix for a geolocation bug — private IPs
// genuinely have no real-world geography — it's a deterministic, clearly
// flagged (isSimulatedLocation) stand-in so demos/tests still show activity
// on the globe.
const DEMO_LOCATIONS = [
  { country: 'Russia', countryCode: 'RU', city: 'Moscow', lat: 55.7558, lng: 37.6173 },
  { country: 'China', countryCode: 'CN', city: 'Beijing', lat: 39.9042, lng: 116.4074 },
  { country: 'Nigeria', countryCode: 'NG', city: 'Lagos', lat: 6.5244, lng: 3.3792 },
  { country: 'Brazil', countryCode: 'BR', city: 'São Paulo', lat: -23.5505, lng: -46.6333 },
  { country: 'Iran', countryCode: 'IR', city: 'Tehran', lat: 35.6892, lng: 51.389 },
]

function hashIp(ip) {
  let h = 0
  for (let i = 0; i < ip.length; i++) h = (h * 31 + ip.charCodeAt(i)) >>> 0
  return h
}

function demoLocationFor(ip) {
  const loc = DEMO_LOCATIONS[hashIp(ip) % DEMO_LOCATIONS.length]
  return {
    ip,
    country: loc.country,
    countryCode: loc.countryCode,
    city: loc.city,
    lat: loc.lat,
    lng: loc.lng,
    isSimulatedLocation: true,
  }
}

async function getJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(url, { signal: controller.signal })
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function lookup(ip) {
  const a = await getJson(`https://ipwho.is/${encodeURIComponent(ip)}`)
  if (a?.success && Number.isFinite(a.latitude)) {
    return { ip, country: a.country, countryCode: a.country_code, city: a.city, lat: a.latitude, lng: a.longitude }
  }
  if (window.location.protocol === 'http:') {
    const b = await getJson(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,city,lat,lon`)
    if (b?.status === 'success') {
      return { ip, country: b.country, countryCode: b.countryCode, city: b.city, lat: b.lat, lng: b.lon }
    }
  }
  return null
}

/**
 * Resolve an IP to { ip, country, countryCode, lat, lng }, or null if unknown.
 * Private (RFC1918/localhost) IPs get a flagged demo location instead of a
 * real lookup — see isPrivateIP / demoLocationFor above.
 */
export async function geolocate(ip) {
  if (isPrivateIP(ip)) return demoLocationFor(ip)
  if (!isPublicIp(ip)) return null
  if (memory.has(ip)) return memory.get(ip)
  if (inflight.has(ip)) return inflight.get(ip)

  const job = lookup(ip)
    .then((geo) => {
      const result = geo || OFFLINE_TABLE[ip] || null
      if (geo) {
        memory.set(ip, geo)
        persist()
      }
      return result
    })
    .finally(() => inflight.delete(ip))
  inflight.set(ip, job)
  return job
}

let operator = null

/** Location of the operator (the machine viewing the dashboard), used as the attack target. */
export async function getTargetLocation() {
  if (operator) return operator
  const a = await getJson('https://ipwho.is/')
  operator =
    a?.success && Number.isFinite(a.latitude)
      ? { lat: a.latitude, lng: a.longitude, label: [a.city, a.country].filter(Boolean).join(', ') }
      : { ...TARGET_COORDS, label: 'Target' }
  return operator
}
