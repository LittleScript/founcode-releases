import type { TaskState } from '../../shared/types'

const STYLES: Record<TaskState, string> = {
  BACKLOG: 'text-slate-400 border-edge',
  PLANNING: 'text-phase-plan border-phase-plan/30 bg-phase-plan/5',
  AWAITING_APPROVAL: 'text-amber-300 border-amber-500/30 bg-amber-500/5',
  EXECUTING: 'text-phase-exec border-phase-exec/30 bg-phase-exec/5',
  VERIFYING: 'text-phase-verify border-phase-verify/30 bg-phase-verify/5',
  REVIEW: 'text-phase-review border-phase-review/30 bg-phase-review/5',
  DONE: 'text-accent border-accent/30 bg-accent/5',
  DISCARDED: 'text-slate-600 border-edge',
  FAILED: 'text-phase-fail border-phase-fail/30 bg-phase-fail/5',
}

const LABELS: Record<TaskState, string> = {
  BACKLOG: 'Backlog',
  PLANNING: 'Planning',
  AWAITING_APPROVAL: 'Awaiting Approval',
  EXECUTING: 'Executing',
  VERIFYING: 'Verifying',
  REVIEW: 'Review',
  DONE: 'Done',
  DISCARDED: 'Discarded',
  FAILED: 'Failed',
}

const LIVE_STATES: TaskState[] = ['PLANNING', 'EXECUTING', 'VERIFYING']

export function StateBadge({ state }: { state: TaskState }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium font-mono text-[11px] uppercase tracking-wider ${STYLES[state]}`}
    >
      {LIVE_STATES.includes(state) && (
        <span className="live-dot size-1.5 rounded-full bg-current" />
      )}
      {LABELS[state]}
    </span>
  )
}

export const STATE_LABELS = LABELS
