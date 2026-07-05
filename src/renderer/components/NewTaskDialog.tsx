import { useEffect, useState } from 'react'
import type { AgentInfo } from '../../shared/types'
import { useAppStore } from '../stores/appStore'
import { ModelField } from './ModelField'

export function NewTaskDialog({ onClose }: { onClose: () => void }) {
  const createTask = useAppStore((s) => s.createTask)
  const [title, setTitle] = useState('')
  const [intent, setIntent] = useState('')
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [agentId, setAgentId] = useState('claude-code')
  const [model, setModel] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    window.founcode.invoke('agent:listInstalled', undefined).then((list) => {
      setAgents(list)
      const preferred = list.find((a) => a.id === 'claude-code' && a.installed) ?? list[0]
      if (preferred) setAgentId(preferred.id)
    })
    window.founcode.invoke('settings:get', undefined).then((s) => setModel(s.defaultModel))
  }, [])

  const canSubmit = title.trim() && intent.trim() && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    await createTask({ title: title.trim(), intent: intent.trim(), agentId, model })
    setSubmitting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px]">
      <div className="rise-in w-[540px] rounded-xl border border-edge bg-surface-raised p-6 shadow-2xl shadow-black/60">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-semibold text-lg text-slate-100 tracking-tight">New Task</h2>
          <span className="font-mono text-[10px] text-slate-600 uppercase tracking-widest">
            plan first — no code without approval
          </span>
        </div>

        <label className="field-label" htmlFor="task-title">
          Title
        </label>
        <input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add dark mode to settings page"
          className="input-field mb-4"
        />

        <label className="field-label" htmlFor="task-intent">
          Intent — what do you want, in plain language
        </label>
        <textarea
          id="task-intent"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={5}
          placeholder="Users should be able to toggle dark mode from the settings page. Persist the choice and apply it app-wide on startup."
          className="input-field mb-4 resize-none"
        />

        <label className="field-label" htmlFor="task-agent">
          Agent &amp; model
        </label>
        <div className="mb-6 grid grid-cols-2 gap-2">
          <select
            id="task-agent"
            value={agentId}
            onChange={(e) => {
              setAgentId(e.target.value)
              setModel('') // model formats differ per agent
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
          <ModelField agentId={agentId} value={model} onChange={setModel} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost border-transparent">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!canSubmit} className="btn-primary">
            {submitting ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
