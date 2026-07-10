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
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const questions = useBlueprintStore((s) => s.questions)
  const suggestions = useBlueprintStore((s) => s.suggestions)
  const tasks = useBlueprintStore((s) => s.tasks)
  const open = useBlueprintStore((s) => s.open)

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
          <StepRail state={s} mode={blueprint.mode} />
        </div>
      </header>

      {s === 'IDEA' && (
        <GeneratingView
          blueprintId={blueprintId}
          label={
            blueprint.mode === 'document'
              ? 'Reading your codebase…'
              : 'Thinking of the right questions…'
          }
        />
      )}
      {s === 'QUESTIONS' && (
        <QuestionsStep blueprintId={blueprintId} questions={questions} suggestions={suggestions} />
      )}
      {s === 'STRUCTURING' && (
        <GeneratingView blueprintId={blueprintId} label="Mapping out the features…" />
      )}
      {s === 'STRUCTURE_REVIEW' && blueprint.structure && (
        <StructureStep
          blueprintId={blueprintId}
          structure={blueprint.structure}
          projectName={blueprint.title}
        />
      )}
      {s === 'GENERATING_PRD' && (
        <GeneratingView
          blueprintId={blueprintId}
          label={
            blueprint.mode === 'document'
              ? 'Reverse-engineering the PRD from your code…'
              : 'Writing the PRD…'
          }
        />
      )}
      {s === 'PRD_REVIEW' && blueprint.prd && (
        <PrdStep blueprintId={blueprintId} prd={blueprint.prd} mode={blueprint.mode} />
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
            {tasks.length > 0 ? (
              <>
                <p className="font-medium text-slate-100">
                  Blueprint ready — {tasks.length} tasks queued
                </p>
                <p className="mt-1 text-slate-500 text-sm">
                  Work them from the board. Each task reads the PRD, then plans, executes, and
                  verifies.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-slate-100">PRD saved</p>
                <p className="mt-1 text-slate-500 text-sm">
                  Written to <span className="font-mono text-slate-400">.founcode/blueprints/</span>{' '}
                  in your project. Start tasks anytime from the board.
                </p>
              </>
            )}
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
