import { useEffect, useState } from 'react'
import type { Artifact, Task } from '../../shared/types'
import { DiffViewer } from '../components/DiffViewer'
import { LogViewer } from '../components/LogViewer'
import { PipelineRail } from '../components/PipelineRail'
import { PlanReviewer } from '../components/PlanReviewer'
import { StateBadge } from '../components/StateBadge'
import { VerifyReport } from '../components/VerifyReport'
import { useAppStore } from '../stores/appStore'

const ACTIVE_STATES = ['PLANNING', 'EXECUTING', 'VERIFYING'] as const

const TABS = ['Plan', 'Log', 'Diff', 'Verify'] as const
type Tab = (typeof TABS)[number]

export function TaskDetail({ taskId }: { taskId: string }) {
  const goBoard = useAppStore((s) => s.goBoard)
  // The store's task list is kept live via task:stateChanged, so reading
  // from it keeps this page in sync; fetch is only a fallback.
  const storeTask = useAppStore((s) => s.tasks.find((t) => t.id === taskId))
  const [fetchedTask, setFetchedTask] = useState<Task | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [tab, setTab] = useState<Tab>('Plan')

  useEffect(() => {
    if (!storeTask) {
      window.founcode.invoke('task:get', { taskId }).then(setFetchedTask)
    }
  }, [taskId, storeTask])

  const task = storeTask ?? fetchedTask
  const state = task?.state

  useEffect(() => {
    // Refresh artifacts whenever the task changes state (new plan/log).
    if (state) {
      window.founcode.invoke('task:artifacts', { taskId }).then(setArtifacts)
    }
  }, [taskId, state])

  if (!task) {
    return (
      <div className="flex flex-1 items-center justify-center font-mono text-slate-600 text-sm">
        loading…
      </div>
    )
  }

  const latest = (kind: Artifact['kind']) =>
    artifacts.filter((a) => a.kind === kind).at(-1)?.content ?? null

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-edge px-6 pt-4 pb-0">
        <button
          type="button"
          onClick={goBoard}
          className="mb-2 font-mono text-[11px] text-slate-600 transition-colors hover:text-slate-300"
        >
          ← board
        </button>

        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-[17px] text-slate-100 tracking-tight">{task.title}</h1>
          <StateBadge state={task.state} />
          <span className="rounded-sm border border-edge px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
            {task.agentId}
          </span>
          {(ACTIVE_STATES as readonly string[]).includes(task.state) && (
            <button
              type="button"
              onClick={() =>
                window.founcode
                  .invoke('task:cancel', { taskId: task.id })
                  .catch((e) => useAppStore.setState({ error: (e as Error).message }))
              }
              className="btn-danger ml-auto border border-red-900/60"
            >
              ■ Stop
            </button>
          )}
        </div>
        <p className="mt-1.5 max-w-3xl text-slate-400 text-sm leading-relaxed">{task.intent}</p>

        <div className="mt-4 max-w-md">
          <PipelineRail state={task.state} labels />
        </div>

        <nav className="mt-4 flex gap-5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative pb-2.5 font-medium text-[13px] transition-colors duration-150 ${
                tab === t ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t}
              {tab === t && (
                <span className="absolute right-0 bottom-0 left-0 h-[2px] rounded-full bg-accent" />
              )}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'Plan' && <PlanReviewer task={task} planContent={latest('plan')} />}
      {tab === 'Log' && <LogViewer taskId={task.id} storedLog={latest('log')} />}
      {tab === 'Diff' && <DiffViewer diff={latest('diff')} />}
      {tab === 'Verify' && <VerifyReport task={task} reportContent={latest('verify_report')} />}
    </div>
  )
}
