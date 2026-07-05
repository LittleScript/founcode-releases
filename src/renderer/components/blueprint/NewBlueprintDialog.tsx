import { useEffect, useState } from 'react'
import type { BlueprintMode } from '../../../shared/blueprint-types'
import { MODEL_OPTIONS } from '../../../shared/settings-types'
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
  const [model, setModel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Where to build: a brand-new greenfield repo, or the current project.
  const [projectMode, setProjectMode] = useState<'new' | 'current'>('new')
  const [newName, setNewName] = useState('')
  const [parentDir, setParentDir] = useState<string | null>(null)
  // For an existing project: extend toward a goal, or document the code.
  const [brownfield, setBrownfield] = useState<'extend' | 'document'>('extend')

  useEffect(() => {
    window.founcode.invoke('agent:listInstalled', undefined).then((list) => {
      setAgents(list)
      const preferred = list.find((a) => a.id === 'claude-code' && a.installed) ?? list[0]
      if (preferred) setAgentId(preferred.id)
    })
    window.founcode.invoke('settings:get', undefined).then((s) => setModel(s.defaultModel))
  }, [])

  const mode: BlueprintMode = projectMode === 'new' ? 'greenfield' : brownfield
  const ideaOptional = mode === 'document' // documenting needs no goal
  const ideaOk = ideaOptional || idea.trim().length > 12
  const projectReady =
    projectMode === 'current' ? !!activeProjectId : !!newName.trim() && !!parentDir
  const canSubmit = ideaOk && projectReady && !submitting

  const ideaLabel =
    mode === 'greenfield'
      ? 'Your idea'
      : mode === 'extend'
        ? 'Your goal — what to add or finish'
        : 'Note (optional) — anything to focus on'
  const ideaPlaceholder =
    mode === 'greenfield'
      ? 'I want to build…'
      : mode === 'extend'
        ? 'Add an admin dashboard with payment confirmation…'
        : 'Leave empty to just document what exists.'

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
        const list = await window.founcode.invoke('project:list', undefined)
        useAppStore.setState({ projects: list, activeProjectId: project.id })
      }
      if (!projectId) throw new Error('No project selected')

      const title =
        idea.trim().split(/[.\n]/)[0]?.slice(0, 60) ||
        (mode === 'document' ? `Document ${activeProject?.name ?? 'project'}` : 'Untitled')
      const bp = await window.founcode.invoke('blueprint:create', {
        projectId,
        title,
        idea: idea.trim(),
        mode,
        techPref:
          techMode === 'manual' && stack.trim()
            ? { mode: 'manual', stack: stack.trim() }
            : { mode: 'auto' },
        agentId,
        model,
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
      <div className="rise-in max-h-[90vh] w-[600px] overflow-y-auto rounded-xl border border-edge bg-surface-raised p-6 shadow-2xl shadow-black/60">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-accent">✦</span>
          <h2 className="font-semibold text-lg text-slate-100 tracking-tight">
            Start from an idea
          </h2>
        </div>
        <p className="mb-5 text-slate-500 text-sm">
          Describe what you want to build — plainly. Founcode turns it into a PRD and a task plan.
        </p>

        {/* Where to build — chosen first so the rest can adapt */}
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
            <div className="mt-0.5 text-[11px] text-slate-500">Existing code</div>
          </button>
        </div>

        {projectMode === 'new' && (
          <div className="mb-4 flex gap-2">
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

        {/* Brownfield: what to do with the existing project */}
        {projectMode === 'current' && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            {(
              [
                ['extend', 'Extend toward a goal', 'Analyze the code, plan the remaining work'],
                ['document', 'Document the code', 'Reverse-engineer a PRD from what exists'],
              ] as const
            ).map(([m, title, desc]) => (
              <button
                key={m}
                type="button"
                onClick={() => setBrownfield(m)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  brownfield === m
                    ? 'border-accent/50 bg-accent/5'
                    : 'border-edge hover:border-edge-2'
                }`}
              >
                <div className="font-medium text-slate-200 text-sm">{title}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{desc}</div>
              </button>
            ))}
          </div>
        )}

        <label className="field-label" htmlFor="bp-idea">
          {ideaLabel}
        </label>
        <textarea
          id="bp-idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={mode === 'document' ? 2 : 4}
          placeholder={ideaPlaceholder}
          className="input-field mb-2 resize-none"
        />
        {mode === 'greenfield' && (
          <div className="mb-4 flex flex-wrap gap-1.5">
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
        )}
        <div className="mb-4" />

        {/* Tech preference only matters when building something new */}
        {mode !== 'document' && (
          <>
            <div className="field-label">Tech preference</div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(['auto', 'manual'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTechMode(m)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    techMode === m
                      ? 'border-accent/50 bg-accent/5'
                      : 'border-edge hover:border-edge-2'
                  }`}
                >
                  <div className="font-medium text-slate-200 text-sm">
                    {m === 'auto' ? 'Let AI decide' : 'I’ll choose'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {m === 'auto'
                      ? mode === 'extend'
                        ? 'Match the existing stack'
                        : 'Recommend the best stack'
                      : 'Specify the stack to use'}
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
          </>
        )}

        <label className="field-label" htmlFor="bp-agent">
          Agent &amp; model
        </label>
        <div className="mb-6 grid grid-cols-2 gap-2">
          <select
            id="bp-agent"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="input-field"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.installed}>
                {a.displayName}
                {a.installed ? '' : ' — not installed'}
              </option>
            ))}
          </select>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="input-field"
            title="Model"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost border-transparent">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!canSubmit} className="btn-primary">
            {submitting
              ? 'Creating…'
              : mode === 'document'
                ? 'Generate PRD →'
                : 'Generate Blueprint →'}
          </button>
        </div>
      </div>
    </div>
  )
}
