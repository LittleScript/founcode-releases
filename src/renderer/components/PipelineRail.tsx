// The product signature: a compact Plan -> Execute -> Verify rail that
// shows at a glance where a task sits in the pipeline. Active segments
// shimmer; the approval gate between P and E is a visible diamond.

import type { TaskState } from '../../shared/types'

type SegmentState = 'idle' | 'active' | 'done' | 'failed'

interface RailModel {
  plan: SegmentState
  exec: SegmentState
  verify: SegmentState
  gateOpen: boolean // approval gate between plan & execute
}

function model(state: TaskState): RailModel {
  switch (state) {
    case 'BACKLOG':
      return { plan: 'idle', exec: 'idle', verify: 'idle', gateOpen: false }
    case 'PLANNING':
      return { plan: 'active', exec: 'idle', verify: 'idle', gateOpen: false }
    case 'AWAITING_APPROVAL':
      return { plan: 'done', exec: 'idle', verify: 'idle', gateOpen: false }
    case 'EXECUTING':
      return { plan: 'done', exec: 'active', verify: 'idle', gateOpen: true }
    case 'VERIFYING':
      return { plan: 'done', exec: 'done', verify: 'active', gateOpen: true }
    case 'REVIEW':
    case 'DONE':
      return { plan: 'done', exec: 'done', verify: 'done', gateOpen: true }
    case 'FAILED':
      return { plan: 'done', exec: 'failed', verify: 'idle', gateOpen: true }
    case 'DISCARDED':
      return { plan: 'idle', exec: 'idle', verify: 'idle', gateOpen: false }
  }
}

const SEGMENT_COLORS = {
  plan: 'text-phase-plan',
  exec: 'text-phase-exec',
  verify: 'text-phase-verify',
} as const

function Segment({ phase, state }: { phase: keyof typeof SEGMENT_COLORS; state: SegmentState }) {
  const color = state === 'failed' ? 'text-phase-fail' : SEGMENT_COLORS[phase]
  const fill =
    state === 'done' || state === 'failed'
      ? 'bg-current'
      : state === 'active'
        ? 'rail-active'
        : 'bg-edge'
  return <span className={`h-[3px] flex-1 rounded-full ${color} ${fill}`} aria-hidden="true" />
}

export function PipelineRail({ state, labels = false }: { state: TaskState; labels?: boolean }) {
  const m = model(state)
  return (
    <div>
      <div className="flex items-center gap-1">
        <Segment phase="plan" state={m.plan} />
        {/* approval gate */}
        <span
          className={`size-[5px] rotate-45 ${
            m.gateOpen ? 'bg-accent' : 'border border-edge-2 bg-transparent'
          }`}
          title={m.gateOpen ? 'Plan approved' : 'Awaiting plan approval'}
        />
        <Segment phase="exec" state={m.exec} />
        <Segment phase="verify" state={m.verify} />
      </div>
      {labels && (
        <div className="mt-1 flex items-center gap-1 font-mono text-[9px] text-slate-600 uppercase tracking-widest">
          <span className="flex-1">Plan</span>
          <span className="w-[5px]" />
          <span className="flex-1">Execute</span>
          <span className="flex-1 text-right">Verify</span>
        </div>
      )}
    </div>
  )
}
