import { useState } from 'react'
import type { Blueprint } from '../../../shared/blueprint-types'
import type { Task } from '../../../shared/types'
import { useAppStore } from '../../stores/appStore'
import { blueprintActions } from '../../stores/blueprintStore'

export function TasksStep({ blueprint, tasks }: { blueprint: Blueprint; tasks: Task[] }) {
  const goBoard = useAppStore((s) => s.goBoard)
  const [mode, setMode] = useState<'manual' | 'auto'>(blueprint.advanceMode)
  const [busy, setBusy] = useState(false)

  async function start() {
    setBusy(true)
    await blueprintActions.setAdvanceMode(blueprint.id, mode)
    // Implementation feeding is wired in B4; for now, tasks are queued
    // in Backlog and the user works them from the board.
    goBoard()
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-6 py-8">
      <div className="mb-5">
        <h2 className="font-semibold text-lg text-slate-100">Task plan</h2>
        <p className="mt-1 text-slate-500 text-sm">
          {tasks.length} tasks, in build order. Each runs through Plan → Execute → Verify, reading
          the PRD first.
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {tasks.map((t, i) => (
          <div
            key={t.id}
            className="rise-in flex items-start gap-3 rounded-lg border border-edge bg-surface-raised/60 p-3"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-edge font-mono text-[11px] text-slate-500">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[13px] text-slate-100">{t.title}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[12px] text-slate-500 leading-relaxed">
                {t.intent}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-edge bg-surface-raised/40 p-4">
        <p className="field-label mb-2">Advance mode</p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {(['manual', 'auto'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg border p-2.5 text-left transition-colors ${
                mode === m ? 'border-accent/50 bg-accent/5' : 'border-edge hover:border-edge-2'
              }`}
            >
              <div className="font-medium text-slate-200 text-[13px]">
                {m === 'manual' ? 'One at a time' : 'Auto-advance'}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {m === 'manual'
                  ? 'Start each task yourself — full control'
                  : 'Next task starts automatically when one merges'}
              </div>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={start}
          disabled={busy || tasks.length === 0}
          className="btn-primary w-full justify-center py-2"
        >
          {busy ? 'Starting…' : 'Start Implementation →'}
        </button>
      </div>
    </div>
  )
}
