import type { TaskState } from '../../shared/types'

const STYLES: Record<TaskState, string> = {
  BACKLOG: 'bg-slate-700 text-slate-300',
  PLANNING: 'bg-sky-900 text-sky-300',
  AWAITING_APPROVAL: 'bg-amber-900 text-amber-300',
  EXECUTING: 'bg-indigo-900 text-indigo-300',
  VERIFYING: 'bg-purple-900 text-purple-300',
  REVIEW: 'bg-teal-900 text-teal-300',
  DONE: 'bg-emerald-900 text-emerald-300',
  DISCARDED: 'bg-slate-800 text-slate-500',
  FAILED: 'bg-red-900 text-red-300',
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

export function StateBadge({ state }: { state: TaskState }) {
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium text-xs ${STYLES[state]}`}>
      {LABELS[state]}
    </span>
  )
}

export const STATE_LABELS = LABELS
