import { useState } from 'react'
import type { Task, TaskState } from '../../shared/types'
import { NewTaskDialog } from '../components/NewTaskDialog'
import { PipelineRail } from '../components/PipelineRail'
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

const COLUMN_ACCENT: Record<TaskState, string> = {
  BACKLOG: 'bg-slate-600',
  PLANNING: 'bg-phase-plan',
  AWAITING_APPROVAL: 'bg-amber-400',
  EXECUTING: 'bg-phase-exec',
  VERIFYING: 'bg-phase-verify',
  REVIEW: 'bg-phase-review',
  DONE: 'bg-accent',
  DISCARDED: 'bg-slate-700',
  FAILED: 'bg-phase-fail',
}

const ATTENTION_STATES: TaskState[] = ['AWAITING_APPROVAL', 'REVIEW', 'FAILED']

function TaskCard({ task }: { task: Task }) {
  const openTask = useAppStore((s) => s.openTask)
  const needsYou = ATTENTION_STATES.includes(task.state)
  return (
    <button
      type="button"
      onClick={() => openTask(task.id)}
      className={`group w-full rounded-lg border bg-surface p-3 text-left transition-all duration-150 hover:translate-y-[-1px] hover:border-edge-2 hover:shadow-black/30 hover:shadow-lg ${
        needsYou ? 'border-amber-500/25' : 'border-edge'
      }`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="font-medium text-[13px] text-slate-100 leading-snug">{task.title}</span>
        {needsYou && (
          <span className="shrink-0 rounded-sm bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] text-amber-300 uppercase tracking-wider">
            you
          </span>
        )}
      </div>
      <p className="mb-3 line-clamp-2 text-slate-500 text-xs leading-relaxed">{task.intent}</p>
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-mono text-[10px] text-slate-600">{task.agentId}</span>
        <div className="flex-1">
          <PipelineRail state={task.state} />
        </div>
      </div>
    </button>
  )
}

export function Board() {
  const tasks = useAppStore((s) => s.tasks)
  const projects = useAppStore((s) => s.projects)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const [showNewTask, setShowNewTask] = useState(false)

  const project = projects.find((p) => p.id === activeProjectId)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-edge px-6 py-4">
        <div>
          <h1 className="font-semibold text-[15px] text-slate-100">{project?.name ?? 'Board'}</h1>
          <p className="mt-0.5 font-mono text-[10px] text-slate-600">{project?.path}</p>
        </div>
        <button type="button" onClick={() => setShowNewTask(true)} className="btn-primary">
          + New Task
        </button>
      </header>

      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {BOARD_STATES.map((state, i) => {
          const columnTasks = tasks.filter((t) => t.state === state)
          return (
            <section
              key={state}
              className="rise-in flex w-60 shrink-0 flex-col"
              style={{ animationDelay: `${i * 35}ms` }}
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={`size-1.5 rounded-full ${COLUMN_ACCENT[state]}`} />
                <h2 className="font-medium font-mono text-[11px] text-slate-400 uppercase tracking-widest">
                  {STATE_LABELS[state]}
                </h2>
                {columnTasks.length > 0 && (
                  <span className="ml-auto font-mono text-[10px] text-slate-600">
                    {columnTasks.length}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 rounded-lg border border-edge/50 bg-surface-raised/40 p-2">
                {columnTasks.length === 0 ? (
                  <span className="px-1 py-2 text-center font-mono text-[10px] text-slate-700">
                    —
                  </span>
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
