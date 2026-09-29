import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Activity, Map, Settings, ShieldAlert, Terminal } from 'lucide-react'
import Logo from './Logo'

const items = [
  { to: '/', cmd: 'overview', icon: Activity, end: true },
  { to: '/incidents', cmd: 'incidents', icon: ShieldAlert },
  { to: '/attack-map', cmd: 'attack-map', icon: Map },
  { to: '/logs', cmd: 'logs', icon: Terminal },
  { to: '/settings', cmd: 'settings', icon: Settings },
]

function UtcClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="tabular-nums">{now.toISOString().slice(11, 19)}Z</span>
}

export default function CommandNav() {
  return (
    <>
      {/* Desktop / tablet: command line strip */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-6 px-4 md:px-8">
          <NavLink to="/" aria-label="Sentrivue home" className="shrink-0">
            <Logo size={18} />
          </NavLink>

          <nav aria-label="Primary" className="ml-2 hidden items-center gap-1 md:flex">
            {items.map(({ to, cmd, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `group relative px-3 py-1.5 text-xs uppercase tracking-widest transition-colors ${
                    isActive ? 'text-accent' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden="true"
                      className={`mr-1 inline-block transition-transform group-hover:translate-x-0.5 ${
                        isActive ? 'text-accent' : 'text-line group-hover:text-accent'
                      }`}
                    >
                      &gt;
                    </span>
                    {cmd}
                    {isActive && <span aria-hidden="true" className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-accent" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted">
            <span aria-hidden="true" className="h-1.5 w-1.5 bg-accent" />
            <UtcClock />
          </div>
        </div>
      </header>

      {/* Mobile: bottom nav */}
      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-bg/95 backdrop-blur-sm md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {items.map(({ to, cmd, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={cmd}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[10px] uppercase tracking-wider transition-colors ${
                isActive ? 'text-accent' : 'text-muted active:text-ink'
              }`
            }
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {cmd.replace('attack-map', 'map')}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
