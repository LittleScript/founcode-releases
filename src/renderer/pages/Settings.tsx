import { useEffect, useState } from 'react'
import type { LicenseState } from '../../shared/license-types'
import { type AppSettings, MODEL_OPTIONS } from '../../shared/settings-types'
import type { AgentInfo } from '../../shared/types'
import { useAppStore } from '../stores/appStore'

export function Settings() {
  const goBoard = useAppStore((s) => s.goBoard)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [saved, setSaved] = useState(false)
  const [license, setLicense] = useState<LicenseState | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [licenseBusy, setLicenseBusy] = useState(false)

  useEffect(() => {
    window.founcode.invoke('settings:get', undefined).then(setSettings)
    window.founcode.invoke('agent:listInstalled', undefined).then(setAgents)
    window.founcode.invoke('license:state', undefined).then(setLicense)
  }, [])

  async function activate() {
    if (!keyInput.trim()) return
    setLicenseBusy(true)
    try {
      const state = await window.founcode.invoke('license:activate', { key: keyInput.trim() })
      setLicense(state)
      setKeyInput('')
    } catch (error) {
      useAppStore.setState({ error: (error as Error).message })
    } finally {
      setLicenseBusy(false)
    }
  }

  async function deactivate() {
    setLicenseBusy(true)
    try {
      setLicense(await window.founcode.invoke('license:deactivate', undefined))
    } finally {
      setLicenseBusy(false)
    }
  }

  async function patch(next: Partial<AppSettings>) {
    const updated = await window.founcode.invoke('settings:set', next)
    setSettings(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center gap-4 border-edge border-b px-6 py-4">
        <button
          type="button"
          onClick={goBoard}
          className="font-mono text-[11px] text-slate-500 transition-colors hover:text-slate-300"
        >
          ← board
        </button>
        <h1 className="font-semibold text-slate-100">Settings</h1>
        {saved && <span className="font-mono text-[11px] text-accent">saved ✓</span>}
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-8">
        {!settings ? (
          <p className="font-mono text-slate-600 text-sm">loading…</p>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Default agent */}
            <section>
              <h2 className="mb-1 font-medium text-slate-100 text-sm">Default agent</h2>
              <p className="mb-3 text-slate-500 text-xs">
                Pre-selected when you create a new task or blueprint.
              </p>
              <select
                value={settings.defaultAgentId}
                onChange={(e) => patch({ defaultAgentId: e.target.value })}
                className="input-field max-w-sm"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id} disabled={!a.installed}>
                    {a.displayName}
                    {a.installed ? '' : ' — not installed'}
                  </option>
                ))}
              </select>
            </section>

            {/* Default model */}
            <section>
              <h2 className="mb-1 font-medium text-slate-100 text-sm">Default model</h2>
              <p className="mb-3 text-slate-500 text-xs">
                Passed to the agent CLI (Claude Code <code className="text-slate-400">--model</code>
                ). Can be overridden per task/blueprint.
              </p>
              <div className="grid max-w-lg grid-cols-2 gap-2">
                {MODEL_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => patch({ defaultModel: m.value })}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      settings.defaultModel === m.value
                        ? 'border-accent/50 bg-accent/5'
                        : 'border-edge hover:border-edge-2'
                    }`}
                  >
                    <div className="font-medium text-slate-200 text-sm">{m.label}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{m.hint}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* License */}
            <section>
              <div className="mb-1 flex items-center gap-2">
                <h2 className="font-medium text-slate-100 text-sm">License</h2>
                <span
                  className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                    license?.tier === 'pro'
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-edge text-slate-400'
                  }`}
                >
                  {license?.tier === 'pro' ? 'Pro' : 'Free'}
                </span>
                {license?.inGrace && (
                  <span className="font-mono text-[10px] text-amber-400">
                    offline — grace period active
                  </span>
                )}
              </div>
              <p className="mb-3 text-slate-500 text-xs">
                Free: 1 project, 1 active task. Pro: unlimited projects, parallel tasks, and
                auto-advance for Blueprints.
              </p>
              {license?.tier === 'pro' ? (
                <div className="flex max-w-md items-center gap-3 rounded-lg border border-edge bg-surface-raised/50 px-3 py-2.5">
                  <span className="font-mono text-[12px] text-slate-400">
                    {license.key ? `${license.key.slice(0, 8)}…${license.key.slice(-4)}` : 'active'}
                  </span>
                  <button
                    type="button"
                    onClick={deactivate}
                    disabled={licenseBusy}
                    className="btn-danger ml-auto"
                  >
                    Deactivate
                  </button>
                </div>
              ) : (
                <div className="flex max-w-md gap-2">
                  <input
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                    className="input-field flex-1 font-mono text-[12px]"
                  />
                  <button
                    type="button"
                    onClick={activate}
                    disabled={!keyInput.trim() || licenseBusy}
                    className="btn-primary shrink-0"
                  >
                    {licenseBusy ? 'Checking…' : 'Activate'}
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
