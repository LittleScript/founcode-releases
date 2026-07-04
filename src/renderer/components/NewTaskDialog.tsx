import { useEffect, useState } from 'react'
import type { AgentInfo } from '../../shared/types'
import { useAppStore } from '../stores/appStore'

export function NewTaskDialog({ onClose }: { onClose: () => void }) {
  const createTask = useAppStore((s) => s.createTask)
  const [title, setTitle] = useState('')
  const [intent, setIntent] = useState('')
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [agentId, setAgentId] = useState('claude-code')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    window.founcode.invoke('agent:listInstalled', undefined).then((list) => {
      setAgents(list)
      const preferred = list.find((a) => a.id === 'claude-code' && a.installed) ?? list[0]
      if (preferred) setAgentId(preferred.id)
    })
  }, [])

  const canSubmit = title.trim() && intent.trim() && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    await createTask({ title: title.trim(), intent: intent.trim(), agentId })
    setSubmitting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[520px] rounded-xl border border-edge bg-surface-raised p-6 shadow-2xl">
        <h2 className="mb-4 font-semibold text-lg text-slate-100">New Task</h2>

        <label className="mb-1 block text-slate-400 text-sm" htmlFor="task-title">
          Title
        </label>
        <input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add dark mode to settings page"
          className="mb-4 w-full rounded-md border border-edge bg-surface px-3 py-2 text-slate-100 text-sm outline-none focus:border-accent-dim"
        />

        <label className="mb-1 block text-slate-400 text-sm" htmlFor="task-intent">
          Intent — describe what you want in natural language
        </label>
        <textarea
          id="task-intent"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={5}
          placeholder="Users should be able to toggle dark mode from the settings page. Persist the choice and apply it app-wide on startup."
          className="mb-2 w-full resize-none rounded-md border border-edge bg-surface px-3 py-2 text-slate-100 text-sm outline-none focus:border-accent-dim"
        />
        <label className="mb-1 block text-slate-400 text-sm" htmlFor="task-agent">
          Agent
        </label>
        <select
          id="task-agent"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="mb-2 w-full rounded-md border border-edge bg-surface px-3 py-2 text-slate-100 text-sm outline-none focus:border-accent-dim"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id} disabled={!a.installed}>
              {a.displayName}
              {a.version ? ` (${a.version.split(' ')[0]})` : ''}
              {a.installed ? '' : ' — not installed'}
            </option>
          ))}
        </select>
        <p className="mb-4 text-slate-500 text-xs">
          The agent will produce a plan for your review before touching any code.
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-slate-400 text-sm hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-md bg-accent-dim px-4 py-2 font-medium text-sm text-surface hover:bg-accent disabled:opacity-40"
          >
            {submitting ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
