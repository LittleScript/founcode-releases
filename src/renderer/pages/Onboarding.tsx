import { useState } from 'react'
import logoUrl from '../assets/logo.png'
import wordmarkUrl from '../assets/wordmark.png'
import { NewBlueprintDialog } from '../components/blueprint/NewBlueprintDialog'
import { useAppStore } from '../stores/appStore'

const PHASES = [
  {
    key: 'P',
    color: 'text-phase-plan border-phase-plan/30',
    title: 'Plan',
    desc: 'The agent analyzes your repo read-only and drafts a reviewable plan. Nothing is written until you approve.',
  },
  {
    key: 'E',
    color: 'text-phase-exec border-phase-exec/30',
    title: 'Execute',
    desc: 'Work happens in an isolated git worktree on a dedicated branch. Your checkout is never touched.',
  },
  {
    key: 'V',
    color: 'text-phase-verify border-phase-verify/30',
    title: 'Verify',
    desc: 'A fresh agent judges the diff against the plan and runs your tests before anything reaches you.',
  },
]

export function Onboarding() {
  const addProject = useAppStore((s) => s.addProject)
  const [showIdea, setShowIdea] = useState(false)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 p-8">
      <div className="rise-in flex flex-col items-center gap-4 text-center">
        <img src={logoUrl} alt="" className="size-16 rounded-xl" />
        <img src={wordmarkUrl} alt="Founcode" className="h-7 w-auto" />
        <div>
          <h1 className="font-semibold text-2xl text-slate-100 tracking-tight">
            Trust what your agents ship.
          </h1>
          <p className="mt-2 max-w-md text-slate-400 text-sm leading-relaxed">
            Founcode turns AI coding agents into a disciplined pipeline — every task is planned,
            executed in isolation, and independently verified before it reaches your branch.
          </p>
        </div>
      </div>

      <div className="grid max-w-2xl grid-cols-3 gap-3">
        {PHASES.map((phase, i) => (
          <div
            key={phase.key}
            className="rise-in panel p-4"
            style={{ animationDelay: `${120 + i * 90}ms` }}
          >
            <span
              className={`inline-flex size-7 items-center justify-center rounded-md border font-mono text-sm ${phase.color}`}
            >
              {phase.key}
            </span>
            <h3 className="mt-3 mb-1 font-medium text-slate-200 text-sm">{phase.title}</h3>
            <p className="text-slate-500 text-xs leading-relaxed">{phase.desc}</p>
          </div>
        ))}
      </div>

      <div className="rise-in flex flex-col items-center gap-3" style={{ animationDelay: '420ms' }}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowIdea(true)}
            className="btn-primary px-6 py-2.5"
          >
            ✦ Start from an idea
          </button>
          <button type="button" onClick={addProject} className="btn-ghost px-6 py-2.5">
            Add existing project
          </button>
        </div>
        <p className="font-mono text-[11px] text-slate-600">
          from a plain idea, or a local git folder you already have
        </p>
      </div>

      {showIdea && <NewBlueprintDialog onClose={() => setShowIdea(false)} />}
    </div>
  )
}
