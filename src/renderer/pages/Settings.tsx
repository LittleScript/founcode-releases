import { useEffect, useState } from 'react'
import type { LicenseState } from '../../shared/license-types'
import type { AppSettings } from '../../shared/settings-types'
import { SKILLS } from '../../shared/skills-types'
import type { AgentInfo } from '../../shared/types'
import { ModelField } from '../components/ModelField'
import { useAppStore } from '../stores/appStore'

// Per-agent setup guidance — auth always lives in the CLI, not Founcode.
const AGENT_SETUP = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    install: 'npm install -g @anthropic-ai/claude-code',
    login: 'claude  (browser login — Pro/Max plan or Anthropic API key)',
    auth: 'Anthropic account',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    install: 'npm install -g opencode-ai',
    login: 'opencode auth login  (pick a provider, paste its API key)',
    auth: '75+ providers / API keys',
  },
  {
    id: 'codex',
    name: 'Codex (OpenAI)',
    install: 'npm install -g @openai/codex',
    login: 'codex  (sign in with your ChatGPT plan, or API key)',
    auth: 'ChatGPT account',
  },
  {
    id: 'antigravity',
    name: 'Antigravity (Google)',
    install: 'iwr -useb https://antigravity.dev/install.ps1 | iex',
    login: 'av  (Google account login)',
    auth: 'Google account',
  },
  {
    // DeepSeek is a MODEL provider, not a CLI — OpenCode is its
    // connector. The key lives in OpenCode's own config.
    id: 'deepseek',
    name: 'DeepSeek (via OpenCode)',
    install: 'npm install -g opencode-ai  (skip if OpenCode is installed)',
    login: 'opencode auth login → pick DeepSeek → paste the API key from platform.deepseek.com',
    auth: 'DeepSeek API key',
    detectAs: 'opencode',
  },
]

export function Settings() {
  const goSkills = useAppStore((s) => s.goSkills)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [detecting, setDetecting] = useState(false)
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
    if (next.theme) document.documentElement.dataset.theme = next.theme
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function redetect() {
    setDetecting(true)
    try {
      setAgents(await window.founcode.invoke('agent:listInstalled', undefined))
    } finally {
      setDetecting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center gap-4 border-edge border-b px-6 py-4">
        <button
          type="button"
          onClick={() => useAppStore.getState().goChat(null)}
          className="rounded-md border border-edge px-2.5 py-1 text-[12px] text-slate-300 transition-colors hover:border-edge-2 hover:bg-surface-hover"
        >
          ← Back
        </button>
        <h1 className="font-semibold text-slate-100">Settings</h1>
        {saved && <span className="font-mono text-[11px] text-accent">saved ✓</span>}
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-8">
        {!settings ? (
          <p className="font-mono text-slate-600 text-sm">loading…</p>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Agent setup guide */}
            <section>
              <div className="mb-1 flex items-center gap-3">
                <h2 className="font-medium text-slate-100 text-sm">Agents</h2>
                <button
                  type="button"
                  onClick={() => void redetect()}
                  disabled={detecting}
                  className="flex items-center gap-1.5 rounded border border-edge px-2 py-0.5 font-mono text-[10px] text-slate-400 transition-colors hover:border-edge-2 hover:text-slate-200 disabled:opacity-70"
                >
                  <span className={detecting ? 'inline-block animate-spin' : ''}>↻</span>
                  {detecting ? 'detecting…' : 're-detect'}
                </button>
              </div>
              <p className="mb-3 text-slate-500 text-xs">
                Founcode orchestrates agent CLIs you install and log into yourself — your
                subscriptions and API keys stay in each CLI, never in Founcode.
              </p>
              <div className="grid gap-2">
                {AGENT_SETUP.map((guide) => {
                  const detected = agents.find(
                    (a) => a.id === ((guide as { detectAs?: string }).detectAs ?? guide.id),
                  )
                  return (
                    <div key={guide.id} className="rounded-lg border border-edge p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200 text-sm">{guide.name}</span>
                        {detected?.installed ? (
                          <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">
                            installed{detected.version ? ` · ${detected.version}` : ''}
                          </span>
                        ) : (
                          <span className="rounded-full border border-edge px-2 py-0.5 font-mono text-[10px] text-slate-500">
                            not detected
                          </span>
                        )}
                        <span className="ml-auto text-[11px] text-slate-500">{guide.auth}</span>
                      </div>
                      {!detected?.installed && (
                        <div className="mt-2 space-y-1 font-mono text-[11px] text-slate-400">
                          <div>
                            <span className="text-slate-600">install: </span>
                            {guide.install}
                          </div>
                          <div>
                            <span className="text-slate-600">login: </span>
                            {guide.login}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Theme */}
            <section>
              <h2 className="mb-1 font-medium text-slate-100 text-sm">Theme</h2>
              <p className="mb-3 text-slate-500 text-xs">
                Applies instantly, saved for next launch.
              </p>
              <div className="grid max-w-sm grid-cols-2 gap-2">
                {(
                  [
                    ['dark', 'Dark', 'Mission Control — graphite & phosphor'],
                    ['light', 'Light', 'Paper white, same green accent'],
                  ] as const
                ).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => void patch({ theme: value })}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      settings.theme === value
                        ? 'border-accent/50 bg-accent/5'
                        : 'border-edge hover:border-edge-2'
                    }`}
                  >
                    <div className="font-medium text-slate-200 text-sm">{label}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Built-in skills — full browser lives in its own tab */}
            <section>
              <h2 className="mb-1 font-medium text-slate-100 text-sm">Skills</h2>
              <p className="mb-2 text-slate-500 text-xs">
                {SKILLS.length} built-in working methods — per task or via <code>/slash</code> in
                chat.
              </p>
              <button type="button" onClick={goSkills} className="btn-ghost">
                Open Skills &amp; Tools →
              </button>
            </section>

            {/* Default agent */}
            <section>
              <h2 className="mb-1 font-medium text-slate-100 text-sm">Default agent</h2>
              <p className="mb-3 text-slate-500 text-xs">
                Pre-selected when you create a new task or blueprint.
              </p>
              <select
                value={settings.defaultAgentId}
                onChange={(e) =>
                  // Model formats differ per agent — never carry one across.
                  patch({ defaultAgentId: e.target.value, defaultModel: '' })
                }
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

            {/* Default model — follows the default agent's own catalog */}
            <section>
              <h2 className="mb-1 font-medium text-slate-100 text-sm">Default model</h2>
              <p className="mb-3 text-slate-500 text-xs">
                The catalog follows the default agent above — each agent only ever shows its own
                models. Empty = the agent CLI's configured default. Can be overridden per
                task/blueprint.
              </p>
              <div className="max-w-lg">
                <ModelField
                  agentId={settings.defaultAgentId}
                  value={settings.defaultModel}
                  onChange={(v) => patch({ defaultModel: v })}
                />
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
