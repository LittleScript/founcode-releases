import { useEffect, useState } from 'react'
import { PERMISSION_LABELS, type PermissionLevel } from '../../shared/settings-types'
import type { AgentInfo } from '../../shared/types'
import { useAppStore } from '../stores/appStore'
import { ModelPicker } from './ModelPicker'

// Start an Agent Terminal for the active project (v1.3 T2).
export function NewTerminalDialog({ onClose }: { onClose: () => void }) {
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const openTerminal = useAppStore((s) => s.openTerminal)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [agentId, setAgentId] = useState('claude-code')
  const [model, setModel] = useState('')
  const [permission, setPermission] = useState<PermissionLevel>('auto')
  const [isolate, setIsolate] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    window.founcode.invoke('agent:listInstalled', undefined).then((list) => {
      setAgents(list)
      const preferred = list.find((a) => a.id === 'claude-code' && a.installed) ?? list[0]
      if (preferred) setAgentId(preferred.id)
    })
  }, [])

  async function start() {
    if (!activeProjectId) return
    setStarting(true)
    try {
      const session = await window.founcode.invoke('terminal:start', {
        projectId: activeProjectId,
        agentId,
        permission,
        model: model || undefined,
        isolate,
      })
      onClose()
      openTerminal(session)
    } catch (error) {
      useAppStore.setState({ error: (error as Error).message })
      setStarting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px]">
      <div className="rise-in w-[540px] rounded-xl border border-edge bg-surface-raised p-6 shadow-2xl shadow-black/60">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-accent">▟</span>
          <h2 className="font-semibold text-lg text-slate-100 tracking-tight">Agent Terminal</h2>
        </div>
        <p className="mb-5 text-slate-500 text-sm">
          Run the agent live in a terminal — it works, asks, and you steer, right here. Runs in the
          project folder.
        </p>

        <label className="field-label" htmlFor="term-agent">
          Agent &amp; model
        </label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <select
            id="term-agent"
            value={agentId}
            onChange={(e) => {
              setAgentId(e.target.value)
              setModel('')
            }}
            className="input-field"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.installed}>
                {a.displayName}
                {a.installed ? '' : ' — not installed'}
              </option>
            ))}
          </select>
          <ModelPicker agentId={agentId} value={model} onChange={setModel} />
        </div>

        <div className="field-label">Permission</div>
        <div className="mb-6 grid grid-cols-3 gap-2">
          {(Object.keys(PERMISSION_LABELS) as PermissionLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setPermission(level)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                permission === level
                  ? level === 'full'
                    ? 'border-phase-fail/50 bg-phase-fail/5'
                    : 'border-accent/50 bg-accent/5'
                  : 'border-edge hover:border-edge-2'
              }`}
            >
              <div
                className={`font-medium text-sm ${
                  permission === level && level === 'full' ? 'text-phase-fail' : 'text-slate-200'
                }`}
              >
                {PERMISSION_LABELS[level].label}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500 leading-snug">
                {PERMISSION_LABELS[level].hint}
              </div>
            </button>
          ))}
        </div>

        <label className="mb-5 flex cursor-pointer items-start gap-2.5 rounded-lg border border-edge p-3">
          <input
            type="checkbox"
            checked={isolate}
            onChange={(e) => setIsolate(e.target.checked)}
            className="mt-0.5 accent-accent"
          />
          <span>
            <span className="font-medium text-slate-200 text-sm">Isolated worktree</span>
            <span className="mt-0.5 block text-[11px] text-slate-500 leading-snug">
              {isolate
                ? 'The agent works in a private copy — review the diff and merge when done. Your checkout stays untouched.'
                : '⚠ Works directly in the repo — edits land immediately, no review gate.'}
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost border-transparent">
            Cancel
          </button>
          <button type="button" onClick={start} disabled={starting} className="btn-primary">
            {starting ? 'Starting…' : '▟ Open Terminal'}
          </button>
        </div>
      </div>
    </div>
  )
}
