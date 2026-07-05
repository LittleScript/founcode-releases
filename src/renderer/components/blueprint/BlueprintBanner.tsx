import type { Blueprint } from '../../../shared/blueprint-types'
import type { Task } from '../../../shared/types'

const TERMINAL = ['DONE', 'DISCARDED']
const ACTIVE = ['PLANNING', 'AWAITING_APPROVAL', 'EXECUTING', 'VERIFYING', 'REVIEW']

export function BlueprintBanner({
  blueprint,
  tasks,
  onOpen,
}: {
  blueprint: Blueprint
  tasks: Task[]
  onOpen: () => void
}) {
  const mine = tasks.filter((t) => t.blueprintId === blueprint.id)
  const total = mine.length
  const done = mine.filter((t) => t.state === 'DONE').length
  const inFlight = mine.some((t) => ACTIVE.includes(t.state))
  const nextTask = mine.find((t) => t.state === 'BACKLOG')
  const allDone = total > 0 && mine.every((t) => TERMINAL.includes(t.state))
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  async function startNext() {
    await window.founcode.invoke('blueprint:startNext', { blueprintId: blueprint.id })
  }

  return (
    <div className="mx-4 mt-3 rounded-lg border border-accent/20 bg-accent/[0.04] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-accent">✦</span>
        <button
          type="button"
          onClick={onOpen}
          className="max-w-[280px] truncate font-medium text-slate-100 text-sm hover:text-accent"
          title={blueprint.title}
        >
          {blueprint.title}
        </button>
        <span className="rounded-full border border-edge px-2 py-0.5 font-mono text-[10px] text-slate-500">
          {blueprint.advanceMode === 'auto' ? 'auto-advance' : 'one at a time'}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[11px] text-slate-500">
            {done}/{total} done
          </span>
          {allDone ? (
            <span className="rounded-md bg-accent/10 px-2.5 py-1 font-medium text-[12px] text-accent">
              ✓ Complete
            </span>
          ) : blueprint.advanceMode === 'manual' && !inFlight && nextTask ? (
            <button type="button" onClick={startNext} className="btn-primary py-1">
              ▶ Start next task
            </button>
          ) : inFlight ? (
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-accent">
              <span className="live-dot size-1.5 rounded-full bg-accent" />
              working
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-edge">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
