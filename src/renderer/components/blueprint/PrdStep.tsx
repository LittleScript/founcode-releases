import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { blueprintActions } from '../../stores/blueprintStore'

export function PrdStep({ blueprintId, prd }: { blueprintId: string; prd: string }) {
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState(false)

  async function revise() {
    if (!instructions.trim()) return
    setBusy(true)
    await blueprintActions.revisePrd(blueprintId, instructions.trim())
    setInstructions('')
  }

  async function accept() {
    setBusy(true)
    await blueprintActions.acceptPrd(blueprintId)
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* PRD document */}
      <div className="flex-1 overflow-y-auto border-edge border-r">
        <div className="prose prose-invert prose-sm mx-auto max-w-3xl px-8 py-8">
          <Markdown remarkPlugins={[remarkGfm]}>{prd}</Markdown>
        </div>
      </div>

      {/* Revision rail */}
      <aside className="flex w-80 shrink-0 flex-col bg-surface-raised/40">
        <div className="border-edge border-b px-5 py-4">
          <h3 className="font-medium text-slate-100 text-sm">Product Requirements</h3>
          <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
            Read it over. Want changes? Ask in plain language — Founcode rewrites the whole doc.
          </p>
        </div>

        <div className="flex flex-1 flex-col justify-end p-4">
          <div className="mb-3 rounded-lg border border-edge bg-surface p-3">
            <p className="mb-2 font-mono text-[10px] text-slate-600 uppercase tracking-widest">
              revise
            </p>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="e.g. use Postgres instead of SQLite; add a notifications feature"
              className="input-field resize-none text-[13px]"
            />
            <button
              type="button"
              onClick={revise}
              disabled={!instructions.trim() || busy}
              className="btn-ghost mt-2 w-full justify-center"
            >
              ↻ Revise PRD
            </button>
          </div>

          <button
            type="button"
            onClick={accept}
            disabled={busy}
            className="btn-primary w-full justify-center py-2"
          >
            {busy ? 'Working…' : 'Accept PRD → Break into Tasks'}
          </button>
        </div>
      </aside>
    </div>
  )
}
