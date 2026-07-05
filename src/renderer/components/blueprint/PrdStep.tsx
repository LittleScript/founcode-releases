import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { BlueprintMode } from '../../../shared/blueprint-types'
import { blueprintActions } from '../../stores/blueprintStore'
import { ChatPanel } from './ChatPanel'

export function PrdStep({
  blueprintId,
  prd,
  mode,
}: {
  blueprintId: string
  prd: string
  mode: BlueprintMode
}) {
  const [busy, setBusy] = useState(false)

  async function accept() {
    setBusy(true)
    await blueprintActions.acceptPrd(blueprintId)
  }

  async function finish() {
    setBusy(true)
    await blueprintActions.finish(blueprintId)
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* PRD document */}
      <div className="flex-1 overflow-y-auto border-edge border-r">
        <div className="prose prose-invert prose-sm mx-auto max-w-3xl px-8 py-8">
          <Markdown remarkPlugins={[remarkGfm]}>{prd}</Markdown>
        </div>
      </div>

      {/* Discussion + actions rail */}
      <aside className="flex w-80 shrink-0 flex-col bg-surface-raised/40">
        <div className="min-h-0 flex-1">
          <ChatPanel blueprintId={blueprintId} phase="prd" />
        </div>

        <div className="flex flex-col border-edge border-t p-4">
          {mode === 'document' ? (
            <>
              <button
                type="button"
                onClick={finish}
                disabled={busy}
                className="btn-primary w-full justify-center py-2"
              >
                {busy ? 'Working…' : '✓ Save PRD & finish'}
              </button>
              <button
                type="button"
                onClick={accept}
                disabled={busy}
                className="btn-ghost mt-2 w-full justify-center"
              >
                Continue → build remaining work
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={accept}
                disabled={busy}
                className="btn-primary w-full justify-center py-2"
              >
                {busy ? 'Working…' : 'Accept PRD → Break into Tasks'}
              </button>
              <button
                type="button"
                onClick={finish}
                disabled={busy}
                className="mt-2 w-full text-center text-[11px] text-slate-600 hover:text-slate-400"
              >
                or just keep the PRD and finish
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
