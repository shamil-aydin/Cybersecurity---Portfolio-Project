import { useState } from 'react'
import { getThreatColor } from '../utils/threatColor'
import { Menu } from 'lucide-react'

export function Topbar({ initialScore = 0 }) {
  const [score, setScore] = useState(initialScore)
  const color = getThreatColor(score)

  const threatLevels = [
    { min: 0, max: 6, label: 'Low', color: 'cyber-blue' },
    { min: 7, max: 13, label: 'Medium', color: 'cyber-amber' },
    { min: 14, max: 20, label: 'Critical', color: 'cyber-red' },
  ]

  const level = threatLevels.find(t => score >= t.min && score <= t.max)

  return (
    <header className="bg-card border border-border shadow-sm p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Menu className="w-6 h-6 text-foreground" />
        <span className="text-sm font-semibold text-foreground">Virtual SOC Dashboard</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyber-blue" />
          <span className="text-sm text-muted-foreground">Threat Level</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card">
          <span
            className="w-2 h-2 rounded-full transition-colors ease-in-out duration-200"
            style={{ backgroundColor: color }}
            aria-label={`Threat level: ${level ? level.label : 'Low'} (${score}/20)`}
          />
          <span className="text-xs text-muted-foreground">{score}/20</span>
        </div>
      </div>
    </header>
  )
}
