import { useState } from 'react'
import type { BlueprintStructure } from '../../../shared/blueprint-types'
import { blueprintActions } from '../../stores/blueprintStore'
import { StructureGraph } from './StructureGraph'

export function StructureStep({
  blueprintId,
  structure,
  projectName,
}: {
  blueprintId: string
  structure: BlueprintStructure
  projectName: string
}) {
  const [submitting, setSubmitting] = useState(false)

  async function accept() {
    setSubmitting(true)
    await blueprintActions.acceptStructure(blueprintId)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h2 className="font-semibold text-lg text-slate-100">Feature map</h2>
          <p className="mt-0.5 text-slate-500 text-sm">
            How Founcode will structure the product. Pan &amp; zoom to explore, then generate the
            PRD.
          </p>
        </div>
        <button type="button" onClick={accept} disabled={submitting} className="btn-primary px-5">
          {submitting ? 'Writing PRD…' : 'Accept → Generate PRD'}
        </button>
      </div>

      <div className="min-h-0 flex-1 border-edge border-y">
        <StructureGraph structure={structure} projectName={projectName} />
      </div>

      <div className="px-6 py-2 font-mono text-[11px] text-slate-600">
        {structure.features.length} features ·{' '}
        {structure.features.reduce((n, f) => n + f.subFeatures.length, 0)} sub-features
      </div>
    </div>
  )
}
