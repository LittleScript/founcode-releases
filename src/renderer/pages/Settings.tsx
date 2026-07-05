import { useEffect, useState } from 'react'
import { type AppSettings, MODEL_OPTIONS } from '../../shared/settings-types'
import type { AgentInfo } from '../../shared/types'
import { useAppStore } from '../stores/appStore'

export function Settings() {
  const goBoard = useAppStore((s) => s.goBoard)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.founcode.invoke('settings:get', undefined).then(setSettings)
    window.founcode.invoke('agent:listInstalled', undefined).then(setAgents)
  }, [])

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

            {/* Placeholder for what's coming in Phase 6 */}
            <section className="rounded-lg border border-edge border-dashed p-4">
              <h2 className="font-medium text-slate-400 text-sm">Coming in this phase</h2>
              <ul className="mt-2 space-y-1 text-slate-600 text-xs">
                <li>· License key (Founcode Pro) — unlimited projects & parallel tasks</li>
                <li>· Theme options</li>
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
