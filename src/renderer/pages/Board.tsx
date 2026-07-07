import { useEffect, useState } from 'react'
import type { Blueprint } from '../../shared/blueprint-types'
import type { Task, TaskState } from '../../shared/types'
import { BlueprintBanner } from '../components/blueprint/BlueprintBanner'
import { NewBlueprintDialog } from '../components/blueprint/NewBlueprintDialog'
import { NewTaskDialog } from '../components/NewTaskDialog'
import { PipelineRail } from '../components/PipelineRail'
import { StateBadge } from '../components/StateBadge'
import { useAppStore } from '../stores/appStore'
import { NO_LINES, useLogStore } from '../stores/logStore'

// Four groups instead of nine state columns — everything fits without
// horizontal scrolling (QA), and the per-card rail + badge still show
// the exact stage.
const GROUPS: { key: string; title: string; accent: string; states: TaskState[] }[] = [
  { key: 'backlog', title: 'Backlog', accent: 'bg-slate-600', states: ['BACKLOG'] },
  {
    key: 'working',
    title: 'Working',
    accent: 'bg-phase-exec',
    states: ['PLANNING', 'EXECUTING', 'VERIFYING'],
  },
  {
    key: 'needs-you',
    title: 'Needs you',
    accent: 'bg-amber-400',
    states: ['AWAITING_APPROVAL', 'REVIEW', 'FAILED'],
  },
  { key: 'finished', title: 'Finished', accent: 'bg-accent', states: ['DONE', 'DISCARDED'] },
]

const ATTENTION_STATES: TaskState[] = ['AWAITING_APPROVAL', 'REVIEW', 'FAILED']
const RUNNING_STATES: TaskState[] = ['PLANNING', 'EXECUTING', 'VERIFYING']

// Drag-and-drop moves (QA request): dropping a card runs the real
// pipeline action — no shortcuts around the state machine.
//   Backlog card  → Working   = start planning
//   Failed card   → Backlog   = retry (back to backlog)
//   Discarded card→ Backlog   = retry
const DND_MOVES: Record<string, { to: string; run: (taskId: string) => Promise<unknown> }> = {
  BACKLOG: {
    to: 'working',
    run: (taskId) => window.founcode.invoke('task:startPlanning', { taskId }),
  },
  FAILED: { to: 'backlog', run: (taskId) => window.founcode.invoke('task:retry', { taskId }) },
  DISCARDED: { to: 'backlog', run: (taskId) => window.founcode.invoke('task:retry', { taskId }) },
}

// Terminal-style live line: while an agent runs, the card shows what it
// is doing right now (QA: "user harus tau apa yang ai lakukan").
function LiveLine({ taskId }: { taskId: string }) {
  const lines = useLogStore((s) => s.logs[taskId] ?? NO_LINES)
  const last = lines.at(-1)
  if (!last) return null
  // Always a real terminal: solid dark panel + bright text, readable in
  // BOTH themes (QA: grey-on-grey in light mode).
  const tone =
    last.kind === 'error'
      ? 'text-[#f87171]'
      : last.kind === 'done'
        ? 'text-[#94a3b8]'
        : 'text-[#34e8a9]'
  return (
    <div
      className={`mt-2 truncate rounded-md border border-[#1e2734] bg-[#0a0d12] px-2 py-1 font-mono text-[10px] ${tone}`}
    >
      <span className="mr-1 text-[#566274]">❯</span>
      {last.content}
    </div>
  )
}

function TaskCard({
  task,
  onDragState,
}: {
  task: Task
  onDragState: (state: TaskState | null) => void
}) {
  const openTask = useAppStore((s) => s.openTask)
  const needsYou = ATTENTION_STATES.includes(task.state)
  const running = RUNNING_STATES.includes(task.state)
  const draggable = task.state in DND_MOVES
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'text/founcode-task',
          JSON.stringify({ id: task.id, state: task.state }),
        )
        e.dataTransfer.effectAllowed = 'move'
        onDragState(task.state)
      }}
      onDragEnd={() => onDragState(null)}
      title={draggable ? 'Drag to move (Backlog → Working starts planning)' : undefined}
      onClick={() => openTask(task.id)}
      className={`group w-full rounded-lg border bg-surface p-3 text-left transition-all duration-150 hover:translate-y-[-1px] hover:border-edge-2 hover:shadow-black/30 hover:shadow-lg ${
        needsYou ? 'border-amber-500/25' : 'border-edge'
      } ${task.state === 'DISCARDED' ? 'opacity-60' : ''}`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium text-[13px] text-slate-100 leading-snug">
          {task.orderIndex !== null && (
            <span className="shrink-0 rounded-sm border border-accent/30 px-1 font-mono text-[9px] text-accent">
              #{task.orderIndex + 1}
            </span>
          )}
          {task.title}
        </span>
        <StateBadge state={task.state} />
      </div>
      <p className="mb-3 line-clamp-2 text-slate-500 text-xs leading-relaxed">{task.intent}</p>
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-mono text-[10px] text-slate-600">{task.agentId}</span>
        <div className="flex-1">
          <PipelineRail state={task.state} />
        </div>
      </div>
      {running && <LiveLine taskId={task.id} />}
    </button>
  )
}

export function Board() {
  const tasks = useAppStore((s) => s.tasks)
  const projects = useAppStore((s) => s.projects)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const openBlueprint = useAppStore((s) => s.openBlueprint)
  const refreshTasks = useAppStore((s) => s.refreshTasks)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showNewBlueprint, setShowNewBlueprint] = useState(false)
  const [activeBlueprints, setActiveBlueprints] = useState<Blueprint[]>([])
  // State of the card currently being dragged — highlights valid targets.
  const [dragState, setDragState] = useState<TaskState | null>(null)

  async function dropOn(groupKey: string, e: React.DragEvent) {
    e.preventDefault()
    setDragState(null)
    try {
      const payload = JSON.parse(e.dataTransfer.getData('text/founcode-task')) as {
        id: string
        state: TaskState
      }
      const move = DND_MOVES[payload.state]
      if (!move || move.to !== groupKey) return
      await move.run(payload.id)
      await refreshTasks()
    } catch (error) {
      useAppStore.setState({ error: (error as Error).message })
    }
  }

  const project = projects.find((p) => p.id === activeProjectId)

  // Reload active (implementing) blueprints whenever tasks change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs when tasks change
  useEffect(() => {
    if (!activeProjectId) {
      setActiveBlueprints([])
      return
    }
    window.founcode.invoke('blueprint:list', { projectId: activeProjectId }).then((list) => {
      setActiveBlueprints(list.filter((b) => b.state === 'IMPLEMENTING'))
    })
  }, [activeProjectId, tasks])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-edge px-6 py-4">
        <div>
          <h1 className="font-semibold text-[15px] text-slate-100">{project?.name ?? 'Board'}</h1>
          <p className="mt-0.5 font-mono text-[10px] text-slate-600">{project?.path}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewBlueprint(true)}
            className="btn-ghost border-accent/30 text-accent hover:border-accent/50 hover:bg-accent/5"
          >
            ✦ New from Idea
          </button>
          <button type="button" onClick={() => setShowNewTask(true)} className="btn-primary">
            + New Task
          </button>
        </div>
      </header>

      {activeBlueprints.map((bp) => (
        <BlueprintBanner
          key={bp.id}
          blueprint={bp}
          tasks={tasks}
          onOpen={() => openBlueprint(bp.id)}
        />
      ))}

      <div className="grid flex-1 grid-cols-4 gap-3 overflow-y-auto p-4">
        {GROUPS.map((group, i) => {
          const columnTasks = tasks.filter((t) => group.states.includes(t.state))
          const droppable = dragState !== null && DND_MOVES[dragState]?.to === group.key
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: drop target for the kanban drag
            <section
              key={group.key}
              onDragOver={(e) => {
                if (droppable) e.preventDefault()
              }}
              onDrop={(e) => void dropOn(group.key, e)}
              className={`rise-in flex min-w-0 flex-col ${
                droppable ? 'rounded-lg ring-2 ring-accent/40' : ''
              }`}
              style={{ animationDelay: `${i * 35}ms` }}
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={`size-1.5 rounded-full ${group.accent}`} />
                <h2 className="font-medium font-mono text-[11px] text-slate-400 uppercase tracking-widest">
                  {group.title}
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
                  columnTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onDragState={setDragState} />
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>

      {showNewTask && <NewTaskDialog onClose={() => setShowNewTask(false)} />}
      {showNewBlueprint && <NewBlueprintDialog onClose={() => setShowNewBlueprint(false)} />}
    </div>
  )
}
