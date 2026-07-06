import { useState } from 'react'
import { NewBlueprintDialog } from '../components/blueprint/NewBlueprintDialog'
import { useAppStore } from '../stores/appStore'

// All registered projects — click through to a project's board.
export function ProjectsPage() {
  const projects = useAppStore((s) => s.projects)
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const addProject = useAppStore((s) => s.addProject)
  const [showIdea, setShowIdea] = useState(false)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-edge border-b px-6 py-4">
        <h1 className="font-semibold text-[15px] text-slate-100">Projects</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowIdea(true)}
            className="btn-ghost border-accent/30 text-accent hover:border-accent/50 hover:bg-accent/5"
          >
            ✦ New from Idea
          </button>
          <button type="button" onClick={addProject} className="btn-primary">
            + Add project
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-6">
        {projects.length === 0 && (
          <div className="mt-16 text-center">
            <p className="font-medium text-slate-300">No projects yet</p>
            <p className="mt-1 text-slate-500 text-sm">
              Add an existing git repository, or start a brand-new one from an idea.
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void setActiveProject(p.id)}
              className="w-full rounded-lg border border-edge bg-surface px-4 py-3 text-left transition-colors hover:border-edge-2"
            >
              <div className="font-medium text-[13.5px] text-slate-200">{p.name}</div>
              <div className="mt-1 font-mono text-[10px] text-slate-600">{p.path}</div>
            </button>
          ))}
        </div>
      </div>

      {showIdea && <NewBlueprintDialog onClose={() => setShowIdea(false)} />}
    </div>
  )
}
