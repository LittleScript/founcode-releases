import { useState } from 'react'
import type { Task, TaskState } from '../../shared/types'
import { NewTaskDialog } from '../components/NewTaskDialog'
import { STATE_LABELS } from '../components/StateBadge'
import { useAppStore } from '../stores/appStore'

// DISCARDED tasks are intentionally hidden from the board.
const BOARD_STATES: TaskState[] = [
  'BACKLOG',
  'PLANNING',
  'AWAITING_APPROVAL',
  'EXECUTING',
  'VERIFYING',
  'REVIEW',
  'DONE',
  'FAILED',
]

function TaskCard({ task }: { task: Task }) {
  const openTask = useAppStore((s) => s.openTask)
  return (
    <button
      type="button"
      onClick={() => openTask(task.id)}
      className="w-full rounded-md border border-edge bg-surface px-3 py-2.5 text-left hover:border-accent-dim"
    >
      <div className="mb-1 font-medium text-slate-200 text-sm">{task.title}</div>
      <div className="line-clamp-2 text-slate-500 text-xs">{task.intent}</div>
    </button>
  )
}

export function Board() {
  const tasks = useAppStore((s) => s.tasks)
  const [showNewTask, setShowNewTask] = useState(false)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-edge px-6 py-4">
        <h1 className="font-semibold text-slate-100">Task Board</h1>
        <button
          type="button"
          onClick={() => setShowNewTask(true)}
          className="rounded-md bg-accent-dim px-3 py-1.5 font-medium text-sm text-surface hover:bg-accent"
        >
          + New Task
        </button>
      </header>

      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {BOARD_STATES.map((state) => {
          const columnTasks = tasks.filter((t) => t.state === state)
          return (
            <section
              key={state}
              className="flex w-64 shrink-0 flex-col rounded-lg border border-edge bg-surface-raised"
            >
              <h2 className="flex items-center justify-between px-3 py-2.5 font-medium text-slate-400 text-xs uppercase tracking-wide">
                {STATE_LABELS[state]}
                {columnTasks.length > 0 && (
                  <span className="rounded-full bg-surface-hover px-1.5 text-slate-400">
                    {columnTasks.length}
                  </span>
                )}
              </h2>
              <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
                {columnTasks.length === 0 ? (
                  <span className="text-slate-600 text-sm">No tasks</span>
                ) : (
                  columnTasks.map((task) => <TaskCard key={task.id} task={task} />)
                )}
              </div>
            </section>
          )
        })}
      </div>

      {showNewTask && <NewTaskDialog onClose={() => setShowNewTask(false)} />}
    </div>
  )
}
