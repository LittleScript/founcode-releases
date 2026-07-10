import { useEffect, useState } from 'react'
import type { SkillInfo } from '../../shared/skills-types'
import { SKILLS } from '../../shared/skills-types'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function SkillsPage() {
  const [custom, setCustom] = useState<SkillInfo[]>([])
  const [editing, setEditing] = useState<SkillInfo | null>(null)
  const [draft, setDraft] = useState({ name: '', description: '', prompt: '' })

  useEffect(() => {
    window.founcode
      .invoke('skill:listAll', undefined)
      .then((all) => {
        setCustom(all.filter((s) => !SKILLS.some((b) => b.id === s.id)))
      })
      .catch(console.error)
  }, [])

  function startEdit(skill?: SkillInfo) {
    setEditing(skill ?? null)
    setDraft({
      name: skill?.name ?? '',
      description: skill?.description ?? '',
      prompt: skill?.prompt ?? '',
    })
  }

  async function save() {
    if (!draft.name.trim() || !draft.description.trim()) return
    const skill: SkillInfo = {
      id: editing?.id ?? slugify(draft.name),
      name: draft.name.trim(),
      description: draft.description.trim(),
      prompt: draft.prompt.trim() || undefined,
    }
    const all = await window.founcode.invoke('skill:save', { skill })
    setCustom(all.filter((s) => !SKILLS.some((b) => b.id === s.id)))
    setEditing(null)
  }

  async function del(id: string) {
    const all = await window.founcode.invoke('skill:delete', { id })
    setCustom(all.filter((s) => !SKILLS.some((b) => b.id === s.id)))
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-edge border-b px-6 py-4">
        <h1 className="font-semibold text-[15px] text-slate-100">Skills &amp; Tools</h1>
        <span className="font-mono text-[10px] text-slate-600">
          {SKILLS.length} built-in{/* + {custom.length} custom */}
        </span>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-6 py-6">
        <p className="mb-5 max-w-2xl text-slate-500 text-sm leading-relaxed">
          Skills are working methods the agent applies — injected into its prompts. Use them{' '}
          <b className="text-slate-300">per task</b> or <b className="text-slate-300">in chat</b>{' '}
          with a slash command.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {[...SKILLS, ...custom].map((s) => (
            <div
              key={s.id}
              className="group rounded-xl border border-edge bg-surface p-4 transition-colors hover:border-edge-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-[14px] text-slate-100">{s.name}</span>
                <code className="shrink-0 rounded bg-accent-ghost px-1.5 py-0.5 font-mono text-[11px] text-accent">
                  /{s.id}
                </code>
              </div>
              <p className="mt-1.5 text-[12px] text-slate-500 leading-relaxed">{s.description}</p>
              {s.prompt && (
                <p className="mt-1 font-mono text-[10px] text-slate-600 truncate">
                  prompt: {s.prompt.slice(0, 60)}…
                </p>
              )}
              {!SKILLS.some((b) => b.id === s.id) && (
                <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    className="btn-ghost !py-0.5 !px-2 text-[10px]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => del(s.id)}
                    className="btn-danger !py-0.5 !px-2 text-[10px]"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Custom skill editor */}
        <div className="mt-6 rounded-xl border border-edge p-4">
          {editing === null ? (
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium text-[13px] text-slate-300">Custom skills</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Write your own prompt packs. Use the same /slash in chat or pick for a task.
                </p>
              </div>
              <button type="button" onClick={() => startEdit()} className="btn-primary">
                + New skill
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <h2 className="font-medium text-[13px] text-slate-300">
                {editing?.id ? `Edit "${editing.name}"` : 'New skill'}
              </h2>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Skill name (e.g. Code Review)"
                className="input-field text-sm"
              />
              <input
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Short description (shown in pickers)"
                className="input-field text-sm"
              />
              <textarea
                value={draft.prompt}
                onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                rows={4}
                placeholder="The prompt body — injected into plan + execute phases. Use markdown."
                className="input-field resize-none text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={!draft.name.trim() || !draft.description.trim()}
                  className="btn-primary"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="btn-ghost border-transparent"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
