import { useState, useEffect } from 'react'
import { Save, CheckCircle, XCircle, RefreshCw, Database, Server, Key, Shield } from 'lucide-react'

const DEFAULT_SETTINGS = {
  serverIp: '192.168.1.109',
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
      if (parsed.username === 'wazuh-admin' || parsed.username === 'admin') {
        parsed.username = 'wazuh'
        localStorage.setItem('soc-settings', JSON.stringify(parsed))
      }
      if (parsed.password !== 'wazuh') {
        parsed.password = 'wazuh'
        localStorage.setItem('soc-settings', JSON.stringify(parsed))
      }
      return parsed
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  })

  const [status, setStatus] = useState('unknown') // 'ok' | 'error' | 'unknown'
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
    setStatus('unknown')
    setLastChecked(new Date())

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const credentials = btoa(`${settings.username}:${settings.password}`)
      const resp = await fetch('/api/', {
        method: 'GET',
        signal: controller.signal,
        headers: { Authorization: `Basic ${credentials}` },
      })
      clearTimeout(timeout)

      if (resp.ok) {
        setStatus('ok')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Wazuh Manager connection and dashboard preferences</p>
      </div>

      {/* Wazuh Manager Connection */}
      <section className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-cyber-blue/10 flex items-center justify-center">
            <Server className="w-5 h-5 text-cyber-blue" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Wazuh Manager</h2>
            <p className="text-xs text-muted-foreground">Connection settings for Wazuh API</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Server IP Address</label>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={settings.serverIp}
                onChange={(e) => handleChange('serverIp', e.target.value)}
                className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-cyber-blue"
                placeholder="192.168.1.109"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">API Port</label>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <input
                type="number"
                value={settings.apiPort}
                onChange={(e) => handleChange('apiPort', Number(e.target.value))}
                className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-cyber-blue"
                placeholder="55000"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Username</label>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={settings.username}
                onChange={(e) => handleChange('username', e.target.value)}
                className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyber-blue"
                placeholder="wazuh"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
            <input
              type="password"
              value={settings.password}
              onChange={(e) => handleChange('password', e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyber-blue"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Health Check</h3>
          <div className="flex items-center gap-4">
            <button
              onClick={checkHealth}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-cyber-blue/10 text-cyber-blue hover:bg-cyber-blue/20 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Check API Status
            </button>

            <span className={`inline-flex items-center gap-1.5 text-sm ${
              status === 'ok' ? 'text-green-400' : status === 'error' ? 'text-cyber-red' : 'text-muted-foreground'
            }`}>
              {status === 'ok' && <CheckCircle className="w-4 h-4" />}
              {status === 'error' && <XCircle className="w-4 h-4" />}
              {status === 'unknown' && <RefreshCw className="w-4 h-4 animate-spin" />}
              {status === 'ok' && 'API reachable'}
              {status === 'error' && 'Connection failed'}
              {status === 'unknown' && 'Not checked'}
            </span>

            {lastChecked && (
              <span className="text-xs text-muted-foreground">
                Last checked: {lastChecked.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-cyber-amber/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-cyber-amber" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Preferences</h2>
            <p className="text-xs text-muted-foreground">Dashboard behavior and alert settings</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-foreground">Auto Mitigation</div>
              <div className="text-xs text-muted-foreground">Automatically block confirmed threats</div>
            </div>
            <button
              onClick={() => handleChange('autoMitigation', !settings.autoMitigation)}
              className={`w-11 h-6 rounded-full transition-colors ${
                settings.autoMitigation ? 'bg-cyber-blue' : 'bg-border'
              }`}
              role="switch"
              aria-checked={settings.autoMitigation}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  settings.autoMitigation ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-foreground">Alert Notifications</div>
              <div className="text-xs text-muted-foreground">Show real-time notifications for critical events</div>
            </div>
            <button
              onClick={() => handleChange('alertNotifications', !settings.alertNotifications)}
              className={`w-11 h-6 rounded-full transition-colors ${
                settings.alertNotifications ? 'bg-cyber-blue' : 'bg-border'
              }`}
              role="switch"
              aria-checked={settings.alertNotifications}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
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
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-cyber-blue text-white hover:bg-cyber-blue/80 transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
        {saved && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Saved to local storage</span>}
      </div>
    </div>
  )
}
