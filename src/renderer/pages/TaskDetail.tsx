import { useEffect, useState } from 'react'
import type { Task } from '../../shared/types'
import { StateBadge } from '../components/StateBadge'
import { useAppStore } from '../stores/appStore'

const TABS = ['Plan', 'Log', 'Diff', 'Verify'] as const
type Tab = (typeof TABS)[number]

const TAB_PLACEHOLDERS: Record<Tab, string> = {
  Plan: 'The implementation plan will appear here once planning starts. (Phase 2)',
  Log: 'Live agent output will stream here during planning and execution. (Phase 2)',
  Diff: 'File changes from the isolated worktree will appear here after execution. (Phase 3)',
  Verify: 'The verification report will appear here after the verify phase. (Phase 4)',
}

export function TaskDetail({ taskId }: { taskId: string }) {
  const goBoard = useAppStore((s) => s.goBoard)
  // The store's task list is kept live via task:stateChanged, so reading
  // from it keeps this page in sync; fetch is only a fallback.
  const storeTask = useAppStore((s) => s.tasks.find((t) => t.id === taskId))
  const [fetchedTask, setFetchedTask] = useState<Task | null>(null)
  const [tab, setTab] = useState<Tab>('Plan')

  useEffect(() => {
    if (!storeTask) {
      window.founcode.invoke('task:get', { taskId }).then(setFetchedTask)
    }
  }, [taskId, storeTask])

  const task = storeTask ?? fetchedTask

  if (!task) {
    return <div className="flex flex-1 items-center justify-center text-slate-500">Loading…</div>
  }

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

      <div className="flex flex-1 items-center justify-center p-6 text-slate-600 text-sm">
        {TAB_PLACEHOLDERS[tab]}
      </div>
    </div>
  )
}
