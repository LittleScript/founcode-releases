import { useEffect, useState } from 'react'
import type { AgentInfo } from '../../../shared/types'
import { useAppStore } from '../../stores/appStore'

const EXAMPLES = [
  'Aplikasi tracking pengeluaran harian, input lewat WhatsApp, ada dashboard ringkasan bulanan.',
  'Aplikasi booking lapangan padel: customer pilih lapangan & bayar, admin cek slot & konfirmasi.',
]

export function NewBlueprintDialog({ onClose }: { onClose: () => void }) {
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const projects = useAppStore((s) => s.projects)
  const openBlueprint = useAppStore((s) => s.openBlueprint)
  const activeProject = projects.find((p) => p.id === activeProjectId)

  const [idea, setIdea] = useState('')
  const [techMode, setTechMode] = useState<'auto' | 'manual'>('auto')
  const [stack, setStack] = useState('')
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [agentId, setAgentId] = useState('claude-code')
  const [submitting, setSubmitting] = useState(false)
  // Project target: brand-new greenfield repo, or the current project.
  const [projectMode, setProjectMode] = useState<'new' | 'current'>('new')
  const [newName, setNewName] = useState('')
  const [parentDir, setParentDir] = useState<string | null>(null)

  useEffect(() => {
    window.founcode.invoke('agent:listInstalled', undefined).then((list) => {
      setAgents(list)
      const preferred = list.find((a) => a.id === 'claude-code' && a.installed) ?? list[0]
      if (preferred) setAgentId(preferred.id)
    })
  }, [])

  const projectReady =
    projectMode === 'current' ? !!activeProjectId : !!newName.trim() && !!parentDir
  const canSubmit = idea.trim().length > 12 && projectReady && !submitting

  async function pickLocation() {
    const dir = await window.founcode.invoke('dialog:selectFolder', undefined)
    if (dir) setParentDir(dir)
  }

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      let projectId = activeProjectId
      if (projectMode === 'new') {
        const project = await window.founcode.invoke('project:createGreenfield', {
          parentDir: parentDir ?? '',
          name: newName.trim(),
        })
        projectId = project.id
        // Refresh the sidebar project list.
        const list = await window.founcode.invoke('project:list', undefined)
        useAppStore.setState({ projects: list, activeProjectId: project.id })
      }
      if (!projectId) throw new Error('No project selected')

      const title = idea.trim().split(/[.\n]/)[0]?.slice(0, 60) || 'Untitled'
      const bp = await window.founcode.invoke('blueprint:create', {
        projectId,
        title,
        idea: idea.trim(),
        techPref:
          techMode === 'manual' && stack.trim()
            ? { mode: 'manual', stack: stack.trim() }
            : { mode: 'auto' },
        agentId,
      })
      onClose()
      openBlueprint(bp.id)
    } catch (error) {
      useAppStore.setState({ error: (error as Error).message })
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px]">
      <div className="rise-in w-[600px] rounded-xl border border-edge bg-surface-raised p-6 shadow-2xl shadow-black/60">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-accent">✦</span>
          <h2 className="font-semibold text-lg text-slate-100 tracking-tight">
            Start from an idea
          </h2>
        </div>
        <p className="mb-5 text-slate-500 text-sm">
          Describe what you want to build — plainly, no tech jargon needed. Founcode turns it into a
          PRD and a task plan.
        </p>

        <label className="field-label" htmlFor="bp-idea">
          Your idea
        </label>
        <textarea
          id="bp-idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={4}
          placeholder="I want to build…"
          className="input-field mb-2 resize-none"
        />
        <div className="mb-5 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setIdea(ex)}
              className="rounded-full border border-edge px-2.5 py-1 text-left text-[11px] text-slate-500 transition-colors hover:border-edge-2 hover:text-slate-300"
            >
              {ex.slice(0, 42)}…
            </button>
          ))}
        </div>

        <div className="field-label">Tech preference</div>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {(['auto', 'manual'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTechMode(mode)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                techMode === mode
                  ? 'border-accent/50 bg-accent/5'
                  : 'border-edge hover:border-edge-2'
              }`}
            >
              <div className="font-medium text-slate-200 text-sm">
                {mode === 'auto' ? 'Let AI decide' : 'I’ll choose'}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {mode === 'auto' ? 'Recommend the best stack for this' : 'Specify the stack to use'}
              </div>
            </button>
          ))}
        </div>
        {techMode === 'manual' && (
          <input
            value={stack}
            onChange={(e) => setStack(e.target.value)}
            placeholder="e.g. Next.js + Postgres + Tailwind"
            className="input-field mb-4"
          />
        )}

        <label className="field-label" htmlFor="bp-agent">
          Agent
        </label>
        <select
          id="bp-agent"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="input-field mb-4"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id} disabled={!a.installed}>
              {a.displayName}
              {a.installed ? '' : ' — not installed'}
            </option>
          ))}
        </select>

        <div className="field-label">Where to build</div>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setProjectMode('new')}
            className={`rounded-lg border p-3 text-left transition-colors ${
              projectMode === 'new'
                ? 'border-accent/50 bg-accent/5'
                : 'border-edge hover:border-edge-2'
            }`}
          >
            <div className="font-medium text-slate-200 text-sm">New project</div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              Founcode creates a fresh git repo
            </div>
          </button>
          <button
            type="button"
            onClick={() => activeProject && setProjectMode('current')}
            disabled={!activeProject}
            className={`rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              projectMode === 'current'
                ? 'border-accent/50 bg-accent/5'
                : 'border-edge hover:border-edge-2'
            }`}
          >
            <div className="truncate font-medium text-slate-200 text-sm">
              {activeProject?.name ?? 'Current project'}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Add to the open project</div>
          </button>
        </div>
        {projectMode === 'new' && (
          <div className="mb-6 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="project-name"
              className="input-field flex-1"
            />
            <button
              type="button"
              onClick={pickLocation}
              className="btn-ghost shrink-0"
              title={parentDir ?? undefined}
            >
              {parentDir ? '✓ Location' : 'Choose location…'}
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost border-transparent">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!canSubmit} className="btn-primary">
            {submitting ? 'Creating…' : 'Generate Blueprint →'}
          </button>
        </div>
      </div>
    </div>
  )
}
