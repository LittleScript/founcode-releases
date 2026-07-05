import { useEffect } from 'react'
import { GeneratingView } from '../components/blueprint/GeneratingView'
import { PrdStep } from '../components/blueprint/PrdStep'
import { QuestionsStep } from '../components/blueprint/QuestionsStep'
import { StepRail } from '../components/blueprint/StepRail'
import { StructureStep } from '../components/blueprint/StructureStep'
import { TasksStep } from '../components/blueprint/TasksStep'
import { useAppStore } from '../stores/appStore'
import { blueprintActions, useBlueprintStore } from '../stores/blueprintStore'

export function BlueprintStudio({ blueprintId }: { blueprintId: string }) {
  const goBoard = useAppStore((s) => s.goBoard)
  const { blueprint, questions, tasks, open } = useBlueprintStore()

  useEffect(() => {
    open(blueprintId)
  }, [blueprintId, open])

  if (!blueprint) {
    return (
      <div className="flex flex-1 items-center justify-center font-mono text-slate-600 text-sm">
        loading blueprint…
      </div>
    )
  }

  const s = blueprint.state

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center gap-4 border-edge border-b px-6 py-3.5">
        <button
          type="button"
          onClick={goBoard}
          className="flex items-center gap-2 font-mono text-[11px] text-slate-500 transition-colors hover:text-slate-300"
        >
          ← board
        </button>
        <div className="h-4 w-px bg-edge" />
        <span
          className="max-w-[220px] truncate font-medium text-slate-200 text-sm"
          title={blueprint.title}
        >
          {blueprint.title}
        </span>
        <div className="ml-auto">
          <StepRail state={s} />
        </div>
      </header>

      {s === 'IDEA' && (
        <GeneratingView blueprintId={blueprintId} label="Thinking of the right questions…" />
      )}
      {s === 'QUESTIONS' && <QuestionsStep blueprintId={blueprintId} questions={questions} />}
      {s === 'STRUCTURING' && (
        <GeneratingView blueprintId={blueprintId} label="Mapping out the features…" />
      )}
      {s === 'STRUCTURE_REVIEW' && blueprint.structure && (
        <StructureStep blueprintId={blueprintId} structure={blueprint.structure} />
      )}
      {s === 'GENERATING_PRD' && (
        <GeneratingView blueprintId={blueprintId} label="Writing the PRD…" />
      )}
      {s === 'PRD_REVIEW' && blueprint.prd && (
        <PrdStep blueprintId={blueprintId} prd={blueprint.prd} />
      )}
      {s === 'DECOMPOSING' && (
        <GeneratingView blueprintId={blueprintId} label="Breaking the PRD into tasks…" />
      )}
      {s === 'TASK_REVIEW' && <TasksStep blueprint={blueprint} tasks={tasks} />}
      {(s === 'IMPLEMENTING' || s === 'DONE') && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
          <div className="flex size-14 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-2xl text-accent">
            ✓
          </div>
          <div className="text-center">
            <p className="font-medium text-slate-100">
              Blueprint ready — {tasks.length} tasks queued
            </p>
            <p className="mt-1 text-slate-500 text-sm">
              Work them from the board. Each task reads the PRD, then plans, executes, and verifies.
            </p>
          </div>
          <button type="button" onClick={goBoard} className="btn-primary px-5">
            Go to Board →
          </button>
        </div>
      )}
      {s === 'FAILED' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
          <p className="max-w-md text-center text-phase-fail text-sm">
            A generation step failed. You can retry from the start of the flow.
          </p>
          <button
            type="button"
            onClick={() => blueprintActions.retry(blueprintId)}
            className="btn-primary"
          >
            ↻ Retry
          </button>
        </div>
      )}
    </div>
  )
}
