import { useEffect, useState } from 'react'
import type { ArtifactKind, ArtifactSummary } from '../../shared/types'
import { useAppStore } from '../stores/appStore'

const KIND_LABELS: Record<ArtifactKind, string> = {
  plan: 'Plan',
  plan_revision: 'Plan revision',
  diff: 'Diff',
  verify_report: 'Verdict',
  log: 'Log',
}
const KIND_COLORS: Record<ArtifactKind, string> = {
  plan: 'text-phase-plan border-phase-plan/30',
  plan_revision: 'text-phase-plan border-phase-plan/30',
  diff: 'text-phase-exec border-phase-exec/30',
  verify_report: 'text-phase-verify border-phase-verify/30',
  log: 'text-slate-500 border-edge',
}
const FILTERS: (ArtifactKind | 'all')[] = ['all', 'plan', 'diff', 'verify_report', 'log']

// Everything the pipeline has produced, across all projects — plans,
// diffs, verdicts, logs. Click through to the owning task.
export function ArtifactsPage() {
  const openTask = useAppStore((s) => s.openTask)
  const [items, setItems] = useState<ArtifactSummary[]>([])
  const [kind, setKind] = useState<ArtifactKind | 'all'>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    window.founcode
      .invoke('artifact:listAll', { kind: kind === 'all' ? undefined : kind })
      .then(setItems)
  }, [kind])

  const q = query.toLowerCase()
  const filtered = items.filter(
    (a) =>
      a.taskTitle.toLowerCase().includes(q) ||
      a.projectName.toLowerCase().includes(q) ||
      a.preview.toLowerCase().includes(q),
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-edge border-b px-6 py-4">
        <h1 className="font-semibold text-[15px] text-slate-100">Artifacts</h1>
        <span className="font-mono text-[10px] text-slate-600">
          {filtered.length} item{filtered.length === 1 ? '' : 's'}
        </span>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-6 py-6">
        <div className="mb-4 flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by task, project, or content…"
            className="input-field flex-1"
          />
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setKind(f)}
                className={`rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                  kind === f
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-edge text-slate-500 hover:border-edge-2 hover:text-slate-300'
                }`}
              >
                {f === 'all' ? 'All' : KIND_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <p className="mt-10 text-center font-mono text-[12px] text-slate-600">
            nothing here yet — artifacts appear as the pipeline works
          </p>
        )}

        <div className="space-y-1.5">
          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => openTask(a.taskId)}
              className="w-full rounded-lg border border-edge bg-surface px-4 py-3 text-left transition-colors hover:border-edge-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${KIND_COLORS[a.kind]}`}
                >
                  {KIND_LABELS[a.kind]}
                </span>
                <span className="truncate font-medium text-[13px] text-slate-200">
                  {a.taskTitle}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-600">
                  {a.projectName} · {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 font-mono text-[11px] text-slate-500 leading-relaxed">
                {a.preview}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
