import type { BlueprintMode, BlueprintState } from '../../../shared/blueprint-types'

// Full flow (greenfield / extend) vs the shorter document flow.
const FULL_STEPS = ['Idea', 'Questions', 'Structure', 'PRD', 'Tasks', 'Implement'] as const
const DOC_STEPS = ['Analyze', 'PRD', 'Build'] as const

const FULL_MAP: Record<BlueprintState, { step: number; busy: boolean }> = {
  IDEA: { step: 1, busy: true },
  QUESTIONS: { step: 1, busy: false },
  STRUCTURING: { step: 2, busy: true },
  STRUCTURE_REVIEW: { step: 2, busy: false },
  GENERATING_PRD: { step: 3, busy: true },
  PRD_REVIEW: { step: 3, busy: false },
  DECOMPOSING: { step: 4, busy: true },
  TASK_REVIEW: { step: 4, busy: false },
  IMPLEMENTING: { step: 5, busy: false },
  DONE: { step: 5, busy: false },
  FAILED: { step: 1, busy: false },
}

const DOC_MAP: Record<BlueprintState, { step: number; busy: boolean }> = {
  IDEA: { step: 0, busy: true },
  GENERATING_PRD: { step: 1, busy: true },
  PRD_REVIEW: { step: 1, busy: false },
  DECOMPOSING: { step: 2, busy: true },
  TASK_REVIEW: { step: 2, busy: false },
  IMPLEMENTING: { step: 2, busy: false },
  DONE: { step: 2, busy: false },
  FAILED: { step: 0, busy: false },
  // unused in document mode:
  QUESTIONS: { step: 0, busy: false },
  STRUCTURING: { step: 1, busy: true },
  STRUCTURE_REVIEW: { step: 1, busy: false },
}

export function StepRail({ state, mode }: { state: BlueprintState; mode: BlueprintMode }) {
  const isDoc = mode === 'document'
  const steps = isDoc ? DOC_STEPS : FULL_STEPS
  const { step: current, busy } = (isDoc ? DOC_MAP : FULL_MAP)[state]
  const failed = state === 'FAILED'

  return (
    <div className="flex items-center gap-1.5">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} className="flex items-center gap-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`flex size-5 items-center justify-center rounded-full border font-mono text-[10px] transition-colors duration-300 ${
                  done
                    ? 'border-accent/40 bg-accent/15 text-accent'
                    : active
                      ? failed
                        ? 'border-phase-fail/50 bg-phase-fail/10 text-phase-fail'
                        : 'border-accent bg-accent/10 text-accent'
                      : 'border-edge text-slate-600'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={`font-medium text-[11px] tracking-wide transition-colors duration-300 ${
                  active ? 'text-slate-100' : done ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                {label}
                {active && busy && (
                  <span className="ml-1.5 inline-block size-1 animate-pulse rounded-full bg-accent align-middle" />
                )}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={`h-px w-6 transition-colors duration-300 ${
                  done ? 'bg-accent/40' : 'bg-edge'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
