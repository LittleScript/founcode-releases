import { useAppStore } from '../stores/appStore'

export function Onboarding() {
  const addProject = useAppStore((s) => s.addProject)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-accent-dim font-bold text-3xl text-surface">
        F
      </div>
      <div className="max-w-md text-center">
        <h1 className="mb-2 font-semibold text-2xl text-slate-100">Welcome to Founcode</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Orchestrate your AI coding agents with a disciplined workflow: every task starts with a
          reviewable <span className="text-slate-200">plan</span>, executes in an isolated{' '}
          <span className="text-slate-200">worktree</span>, and ends with independent{' '}
          <span className="text-slate-200">verification</span>.
        </p>
      </div>
      <button
        type="button"
        onClick={addProject}
        className="rounded-lg bg-accent-dim px-5 py-2.5 font-medium text-sm text-surface hover:bg-accent"
      >
        Add your first project
      </button>
      <p className="text-slate-600 text-xs">Pick a local folder that is a git repository.</p>
    </div>
  )
}
