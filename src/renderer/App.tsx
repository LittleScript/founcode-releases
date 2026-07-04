import { useEffect, useState } from 'react'
import type { AppInfo } from '../shared/types'
import { Board } from './pages/Board'
import { Onboarding } from './pages/Onboarding'
import { TaskDetail } from './pages/TaskDetail'
import { useAppStore } from './stores/appStore'

function Sidebar({ info }: { info: AppInfo | null }) {
  const projects = useAppStore((s) => s.projects)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const addProject = useAppStore((s) => s.addProject)

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-edge bg-surface-raised">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-accent-dim font-bold text-surface">
          F
        </div>
        <span className="font-semibold text-lg tracking-tight">Founcode</span>
      </div>

      <div className="px-4 pb-1 text-slate-500 text-xs uppercase tracking-wide">Projects</div>
      <nav className="flex flex-col gap-1 px-2">
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveProject(p.id)}
            title={p.path}
            className={`truncate rounded-md px-3 py-2 text-left text-sm ${
              p.id === activeProjectId
                ? 'bg-surface-hover text-slate-100'
                : 'text-slate-400 hover:bg-surface-hover'
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          type="button"
          onClick={addProject}
          className="rounded-md px-3 py-2 text-left text-slate-500 text-sm hover:bg-surface-hover hover:text-slate-300"
        >
          + Add project
        </button>
      </nav>

      <div className="mt-auto px-4 py-3 text-slate-500 text-xs">
        <div>
          v{info?.version ?? '…'} · schema v{info?.schemaVersion ?? '…'}
        </div>
      </div>
    </aside>
  )
}

function ErrorToast() {
  const error = useAppStore((s) => s.error)
  const clearError = useAppStore((s) => s.clearError)
  if (!error) return null
  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-w-md items-start gap-3 rounded-lg border border-red-900 bg-surface-raised px-4 py-3 shadow-xl">
      <p className="text-red-300 text-sm">{error}</p>
      <button
        type="button"
        onClick={clearError}
        className="text-slate-500 text-xs hover:text-slate-300"
      >
        ✕
      </button>
    </div>
  )
}

export default function App() {
  const view = useAppStore((s) => s.view)
  const projects = useAppStore((s) => s.projects)
  const init = useAppStore((s) => s.init)
  const refreshTasks = useAppStore((s) => s.refreshTasks)
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    init()
    window.founcode.invoke('app:info', undefined).then(setInfo).catch(console.error)
    // Keep the board live: any state change in main refreshes the task list.
    return window.founcode.on('task:stateChanged', () => {
      refreshTasks()
    })
  }, [init, refreshTasks])

  return (
    <div className="flex h-screen">
      <Sidebar info={info} />
      {projects.length === 0 ? (
        <Onboarding />
      ) : view.name === 'task' ? (
        <TaskDetail taskId={view.taskId} />
      ) : (
        <Board />
      )}
      <ErrorToast />
    </div>
  )
}
