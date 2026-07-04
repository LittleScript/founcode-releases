import { useEffect, useState } from 'react'
import type { Artifact, Task } from '../../shared/types'
import { DiffViewer } from '../components/DiffViewer'
import { LogViewer } from '../components/LogViewer'
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
    return <div className="flex flex-1 items-center justify-center text-slate-500">Loading…</div>
  }

  const latest = (kind: Artifact['kind']) =>
    artifacts.filter((a) => a.kind === kind).at(-1)?.content ?? null

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-edge px-6 py-4">
        <button
          type="button"
          onClick={goBoard}
          className="mb-2 text-slate-500 text-xs hover:text-slate-300"
        >
          ← Back to board
        </button>
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-lg text-slate-100">{task.title}</h1>
          <StateBadge state={task.state} />
          <span className="text-slate-600 text-xs">agent: {task.agentId}</span>
          {(ACTIVE_STATES as readonly string[]).includes(task.state) && (
            <button
              type="button"
              onClick={() =>
                window.founcode
                  .invoke('task:cancel', { taskId: task.id })
                  .catch((e) => useAppStore.setState({ error: (e as Error).message }))
              }
              className="ml-auto rounded-md border border-red-900 px-3 py-1 text-red-400 text-xs hover:bg-red-950/40"
            >
              ■ Stop
            </button>
          )}
        </div>
        <p className="mt-1 text-slate-400 text-sm">{task.intent}</p>
      </header>

      <nav className="flex gap-1 border-b border-edge px-6 pt-3">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-t-md px-4 py-2 text-sm ${
              tab === t
                ? 'border border-edge border-b-0 bg-surface-raised text-slate-100'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 'Plan' && <PlanReviewer task={task} planContent={latest('plan')} />}
      {tab === 'Log' && <LogViewer taskId={task.id} storedLog={latest('log')} />}
      {tab === 'Diff' && <DiffViewer diff={latest('diff')} />}
      {tab === 'Verify' && <VerifyReport task={task} reportContent={latest('verify_report')} />}
    </div>
  )
}
