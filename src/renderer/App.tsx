import { useEffect, useState } from 'react'
import type { AppInfo } from '../shared/types'
import { BlueprintStudio } from './pages/BlueprintStudio'
import { Board } from './pages/Board'
import { Onboarding } from './pages/Onboarding'
import { TaskDetail } from './pages/TaskDetail'
import { useAppStore } from './stores/appStore'
import { useBlueprintStore } from './stores/blueprintStore'
import { useLogStore } from './stores/logStore'

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
      <div className="relative flex size-8 items-center justify-center rounded-md border border-accent/30 bg-accent-ghost">
        <span className="font-mono font-semibold text-accent text-sm">F/</span>
      </div>
      <div className="leading-tight">
        <div className="font-semibold text-[15px] text-slate-100 tracking-tight">Founcode</div>
        <div className="font-mono text-[9px] text-slate-600 uppercase tracking-[0.2em]">
          plan · exec · verify
        </div>
      </div>
    </div>
  )
}

function Sidebar({ info }: { info: AppInfo | null }) {
  const projects = useAppStore((s) => s.projects)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const addProject = useAppStore((s) => s.addProject)
  const tasks = useAppStore((s) => s.tasks)

  const liveCount = tasks.filter((t) =>
    ['PLANNING', 'EXECUTING', 'VERIFYING'].includes(t.state),
  ).length

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-edge bg-surface-raised/60">
      <Wordmark />

      <div className="field-label px-4 pt-3">Projects</div>
      <nav className="flex flex-col gap-0.5 px-2">
        {projects.map((p) => {
          const active = p.id === activeProjectId
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveProject(p.id)}
              title={p.path}
              className={`group relative truncate rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 ${
                active
                  ? 'bg-surface-hover text-slate-100'
                  : 'text-slate-400 hover:bg-surface-hover/60 hover:text-slate-200'
              }`}
            >
              {active && (
                <span className="absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-full bg-accent" />
              )}
              <span className="pl-1.5">{p.name}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={addProject}
          className="rounded-md px-3 py-2 text-left text-slate-600 text-sm transition-colors duration-150 hover:bg-surface-hover/60 hover:text-slate-300"
        >
          <span className="pl-1.5">+ Add project</span>
        </button>
      </nav>

      <div className="mt-auto border-t border-edge px-4 py-3">
        {liveCount > 0 && (
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] text-accent">
            <span className="live-dot size-1.5 rounded-full bg-accent" />
            {liveCount} agent{liveCount > 1 ? 's' : ''} running
          </div>
        )}
        <div className="font-mono text-[10px] text-slate-600">
          v{info?.version ?? '·'} — schema v{info?.schemaVersion ?? '·'}
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
    <div className="rise-in fixed right-4 bottom-4 z-50 flex max-w-md items-start gap-3 rounded-lg border border-red-900/70 bg-surface-raised px-4 py-3 shadow-black/50 shadow-xl">
      <span className="mt-0.5 font-mono text-red-400 text-xs">✕</span>
      <p className="text-red-300 text-sm leading-snug">{error}</p>
      <button
        type="button"
        onClick={clearError}
        className="ml-1 text-slate-600 text-xs transition-colors hover:text-slate-300"
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
    const offState = window.founcode.on('task:stateChanged', () => {
      refreshTasks()
    })
    // Single global subscription: streaming logs survive tab switches.
    const offEvents = window.founcode.on('task:event', ({ taskId, event }) => {
      useLogStore.getState().append(taskId, event)
    })
    // Blueprint streaming + state, keyed the same way (blueprintId).
    const offBpEvents = window.founcode.on('blueprint:event', ({ blueprintId, event }) => {
      useLogStore.getState().append(blueprintId, event)
    })
    const offBpState = window.founcode.on('blueprint:stateChanged', () => {
      useBlueprintStore.getState().refresh()
      refreshTasks()
    })
    return () => {
      offState()
      offEvents()
      offBpEvents()
      offBpState()
    }
  }, [init, refreshTasks])

  // Blueprint Studio is a focused full-screen wizard — no sidebar.
  if (projects.length > 0 && view.name === 'blueprint') {
    return (
      <div className="flex h-screen">
        <BlueprintStudio blueprintId={view.blueprintId} />
        <ErrorToast />
      </div>
    )
  }

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
