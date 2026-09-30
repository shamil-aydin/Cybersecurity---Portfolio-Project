import { useState, useEffect } from 'react'
import { Save, CheckCircle, XCircle, RefreshCw, Database, Server, Key, Shield } from 'lucide-react'
import { checkConnection, resetConnectionCache } from '../services/wazuhApi'

const DEFAULT_SETTINGS = {
  serverIp: '10.0.2.8',
  apiPort: 55000,
  username: 'wazuh',
  password: 'wazuh',
  healthCheckInterval: 30,
  autoMitigation: true,
  alertNotifications: true,
}

export default function Settings() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('soc-settings')
      const parsed = saved ? JSON.parse(saved) : { ...DEFAULT_SETTINGS }
      return { ...DEFAULT_SETTINGS, ...parsed }
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  })

  const [status, setStatus] = useState('unknown') // 'ok' | 'error' | 'checking' | 'unknown'
  const [result, setResult] = useState(null)
  const [lastChecked, setLastChecked] = useState(null)
  const [saved, setSaved] = useState(false)

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem('soc-settings', JSON.stringify(settings))
  }, [settings])

  function handleChange(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function handleSave() {
    localStorage.setItem('soc-settings', JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function checkHealth() {
    setStatus('checking')
    setResult(null)
    resetConnectionCache()
    const res = await checkConnection(settings)
    setResult(res)
    setStatus(res.ok ? 'ok' : 'error')
    setLastChecked(new Date())
  }

  return (
    <div className="space-y-6 px-8 pt-8 md:px-12 md:pt-12">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-accent">// settings</p>
        <h1 className="mt-2 font-display text-2xl font-bold uppercase text-ink sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">Wazuh Manager connection and dashboard preferences</p>
      </div>

      {/* Wazuh Manager Connection */}
      <section className="max-w-3xl border border-line bg-panel p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-line text-accent">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold uppercase text-ink">Wazuh Manager</h2>
            <p className="text-xs text-muted">Connection settings for Wazuh API</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-muted">Server IP Address</label>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted" />
              <input
                type="text"
                value={settings.serverIp}
                onChange={(e) => handleChange('serverIp', e.target.value)}
                className="flex-1 border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                placeholder="10.0.2.8"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-muted">API Port</label>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted" />
              <input
                type="number"
                value={settings.apiPort}
                onChange={(e) => handleChange('apiPort', Number(e.target.value))}
                className="flex-1 border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                placeholder="55000"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-muted">Username</label>
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted" />
              <input
                type="text"
                value={settings.username}
                onChange={(e) => handleChange('username', e.target.value)}
                className="flex-1 border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                placeholder="wazuh"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-muted">Password</label>
            <input
              type="password"
              value={settings.password}
              onChange={(e) => handleChange('password', e.target.value)}
              className="w-full border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <h3 className="mb-4 text-[11px] uppercase tracking-widest text-muted">Health check</h3>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={checkHealth}
              className="flex items-center gap-2 border border-line px-4 py-2 text-xs uppercase tracking-widest text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <RefreshCw className="h-4 w-4" />
              Check API Status
            </button>

            <span className={`inline-flex items-center gap-1.5 text-sm ${
              status === 'ok' ? 'text-accent' : status === 'error' ? 'text-cyber-red' : 'text-muted'
            }`}>
              {status === 'ok' && <CheckCircle className="h-4 w-4" />}
              {status === 'error' && <XCircle className="h-4 w-4" />}
              {status === 'checking' && <RefreshCw className="h-4 w-4 animate-spin" />}
              {status === 'ok' && `API reachable · ${result?.latencyMs}ms${result?.version ? ` · v${result.version}` : ''}`}
              {status === 'error' && (result?.title || 'Connection failed')}
              {status === 'checking' && 'Checking...'}
              {status === 'unknown' && 'Not checked'}
              {status === 'error' && result?.detail && <span className="block text-xs opacity-70">{result.detail}</span>}
            </span>

            {lastChecked && (
              <span className="text-xs text-muted">
                Last checked: {lastChecked.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section className="max-w-3xl border border-line bg-panel p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-line text-accent">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold uppercase text-ink">Preferences</h2>
            <p className="text-xs text-muted">Dashboard behavior and alert settings</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-ink">Auto Mitigation</div>
              <div className="text-xs text-muted">Automatically block confirmed threats</div>
            </div>
            <button
              onClick={() => handleChange('autoMitigation', !settings.autoMitigation)}
              className={`h-6 w-11 border border-line transition-colors ${
                settings.autoMitigation ? 'bg-accent' : 'bg-bg'
              }`}
              role="switch"
              aria-checked={settings.autoMitigation}
            >
              <div
                className={`h-4 w-4 bg-ink transition-transform ${
                  settings.autoMitigation ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-ink">Alert Notifications</div>
              <div className="text-xs text-muted">Show real-time notifications for critical events</div>
            </div>
            <button
              onClick={() => handleChange('alertNotifications', !settings.alertNotifications)}
              className={`h-6 w-11 border border-line transition-colors ${
                settings.alertNotifications ? 'bg-accent' : 'bg-bg'
              }`}
              role="switch"
              aria-checked={settings.alertNotifications}
            >
              <div
                className={`h-4 w-4 bg-ink transition-transform ${
                  settings.alertNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 border border-accent bg-accent px-5 py-2.5 text-xs uppercase tracking-widest text-bg transition-colors hover:bg-transparent hover:text-accent"
        >
          <Save className="h-4 w-4" />
          Save Settings
        </button>
        {saved && <span className="flex items-center gap-1 text-xs text-accent"><CheckCircle className="h-3.5 w-3.5" /> Saved to local storage</span>}
      </div>
    </div>
  )
}
