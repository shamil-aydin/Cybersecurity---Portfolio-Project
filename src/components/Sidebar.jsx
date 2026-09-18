import { Link } from 'react-router-dom'
import { Activity, ChevronRight, Clock, LogOut, Map, Menu, Settings, ShieldAlert, Terminal } from 'lucide-react'

export function Sidebar() {
  const navItems = [
    { to: '/', icon: Activity, label: 'Overview', color: 'text-cyber-blue' },
    { to: '/incidents', icon: ShieldAlert, label: 'Incidents', color: 'text-cyber-amber' },
    { to: '/attack-map', icon: Map, label: 'Attack Map', color: 'text-cyber-red' },
    { to: '/logs', icon: Terminal, label: 'Logs', color: 'text-cyber-blue' },
    { to: '/settings', icon: Settings, label: 'Settings', color: 'text-cyber-blue' },
  ]

  return (
    <nav className="w-64 bg-card border border-border h-screen p-4 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-cyber-blue flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Virtual SOC</h2>
          <p className="text-xs text-muted-foreground">Security Operations</p>
        </div>
      </div>

      <ul className="flex-1 flex flex-col gap-1">
        {navItems.map(({ to, icon: Icon, label, color }) => (
          <li key={to}>
            <Link to={to} className="group flex items-center gap-3 rounded-lg p-2.5 hover:bg-cyber-blue/10 active:bg-cyber-blue/20 transition-colors">
              <Icon className={`w-4 h-4 ${color} group-hover:text-cyber-blue transition-colors`} />
              <span className="hidden md:inline text-sm text-muted-foreground group-hover:text-foreground">{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center gap-3">
        <LogOut className="w-4 h-4 text-muted-foreground" />
        <span className="hidden md:inline text-xs text-muted-foreground">Sign out</span>
      </div>
    </nav>
  )
}
