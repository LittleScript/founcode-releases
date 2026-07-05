import { useState } from 'react'
import type { BlueprintStructure } from '../../../shared/blueprint-types'
import { blueprintActions } from '../../stores/blueprintStore'

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-accent',
  medium: 'bg-phase-plan',
  low: 'bg-slate-600',
}

export function StructureStep({
  blueprintId,
  structure,
}: {
  blueprintId: string
  structure: BlueprintStructure
}) {
  const [submitting, setSubmitting] = useState(false)

  async function accept() {
    setSubmitting(true)
    await blueprintActions.acceptStructure(blueprintId)
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden px-6 py-8">
      <div className="mb-6">
        <h2 className="font-semibold text-lg text-slate-100">Feature map</h2>
        <p className="mt-1 text-slate-500 text-sm">
          Here's how Founcode will structure the product. Looks right? Continue to generate the PRD.
        </p>
      </div>

      <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
        {structure.features.map((f, i) => (
          <section
            key={f.name}
            className="rise-in flex w-64 shrink-0 flex-col"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className={`size-1.5 rounded-full ${PRIORITY_DOT[f.priority ?? 'medium']}`} />
              <h3 className="font-medium text-slate-100 text-sm">{f.name}</h3>
              {f.priority && (
                <span className="ml-auto font-mono text-[9px] text-slate-600 uppercase tracking-wider">
                  {f.priority}
                </span>
              )}
            </div>
            {f.description && (
              <p className="mb-2 px-1 text-[11px] text-slate-500 leading-relaxed">
                {f.description}
              </p>
            )}
            <div className="flex flex-col gap-1.5 rounded-lg border border-edge/50 bg-surface-raised/40 p-2">
              {f.subFeatures.map((sf) => (
                <div
                  key={sf.name}
                  className="rounded-md border border-edge bg-surface px-2.5 py-1.5"
                  title={sf.description}
                >
                  <span className="text-[13px] text-slate-300">{sf.name}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="font-mono text-[11px] text-slate-600">
          {structure.features.length} features ·{' '}
          {structure.features.reduce((n, f) => n + f.subFeatures.length, 0)} sub-features
        </span>
        <button type="button" onClick={accept} disabled={submitting} className="btn-primary px-5">
          {submitting ? 'Writing PRD…' : 'Accept → Generate PRD'}
        </button>
      </div>
    </div>
  )
}
