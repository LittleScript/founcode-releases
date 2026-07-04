import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Task, Verdict } from '../../shared/types'
import { useAppStore } from '../stores/appStore'

interface StoredReport {
  report: string
  verdict: Verdict | null
}

function parseStored(content: string | null): StoredReport | null {
  if (!content) return null
  try {
    return JSON.parse(content) as StoredReport
  } catch {
    return { report: content, verdict: null }
  }
}

const VERDICT_BADGE: Record<Verdict['verdict'], { label: string; cls: string }> = {
  pass: { label: '✅ Verified', cls: 'bg-emerald-900 text-emerald-300' },
  pass_with_warnings: { label: '⚠️ Verified with warnings', cls: 'bg-amber-900 text-amber-300' },
  fail: { label: '❌ Failed verification', cls: 'bg-red-900 text-red-300' },
}

const CRITERION_ICON: Record<string, string> = { pass: '✓', fail: '✕', warning: '⚠' }
const CRITERION_CLS: Record<string, string> = {
  pass: 'text-emerald-400',
  fail: 'text-red-400',
  warning: 'text-amber-400',
}

export function VerifyReport({
  task,
  reportContent,
}: {
  task: Task
  reportContent: string | null
}) {
  const stored = parseStored(reportContent)
  const [showRaw, setShowRaw] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  async function call(fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
    } catch (error) {
      useAppStore.setState({ error: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  if (task.state === 'VERIFYING') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-accent-dim border-t-transparent" />
        <p className="text-slate-400 text-sm">
          A fresh agent is verifying the result against the plan… (see Log tab)
        </p>
      </div>
    )
  }

  if (!stored) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-600 text-sm">
        The verification report will appear here after the verify phase.
      </div>
    )
  }

  const { report, verdict } = stored

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {task.state === 'REVIEW' && (
        <div className="flex items-center gap-2 border-b border-edge bg-surface-raised/40 px-4 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => call(() => window.founcode.invoke('task:merge', { taskId: task.id }))}
            className="btn-primary"
          >
            ⇣ Merge to my branch
          </button>
          <button type="button" onClick={() => setFeedbackOpen(true)} className="btn-ghost">
            ↩ Send back
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => call(() => window.founcode.invoke('task:discard', { taskId: task.id }))}
            className="btn-danger ml-auto"
          >
            Discard
          </button>
        </div>
      )}

      {feedbackOpen && (
        <div className="border-b border-edge bg-surface-raised px-4 py-3">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="What should the agent fix or change?"
            className="input-field mb-2 resize-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!feedback.trim() || busy}
              onClick={() =>
                call(async () => {
                  await window.founcode.invoke('task:sendBack', {
                    taskId: task.id,
                    feedback: feedback.trim(),
                  })
                  setFeedback('')
                  setFeedbackOpen(false)
                })
              }
              className="btn-primary"
            >
              Send back to execution
            </button>
            <button
              type="button"
              onClick={() => setFeedbackOpen(false)}
              className="btn-ghost border-transparent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {verdict ? (
          <>
            <span
              className={`inline-block rounded-full px-3 py-1 font-medium text-sm ${VERDICT_BADGE[verdict.verdict].cls}`}
            >
              {VERDICT_BADGE[verdict.verdict].label}
            </span>

            <h3 className="mt-5 mb-2 font-medium text-slate-300 text-sm">Criteria</h3>
            <ul className="space-y-2">
              {verdict.criteria.map((c) => (
                <li key={c.criterion} className="flex gap-2 text-sm">
                  <span className={`font-bold ${CRITERION_CLS[c.status]}`}>
                    {CRITERION_ICON[c.status]}
                  </span>
                  <div>
                    <div className="text-slate-200">{c.criterion}</div>
                    {c.note && <div className="text-slate-500 text-xs">{c.note}</div>}
                  </div>
                </li>
              ))}
            </ul>

            {verdict.tests && (
              <>
                <h3 className="mt-5 mb-2 font-medium text-slate-300 text-sm">Tests</h3>
                <p className="text-slate-400 text-sm">
                  {verdict.tests.detected
                    ? `${verdict.tests.command ?? 'test suite'}: ${verdict.tests.passed ?? 0} passed, ${verdict.tests.failed ?? 0} failed`
                    : 'No test runner detected in this project.'}
                </p>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowRaw(!showRaw)}
              className="mt-6 text-slate-500 text-xs hover:text-slate-300"
            >
              {showRaw ? '▾ Hide full report' : '▸ Show full report'}
            </button>
            {showRaw && (
              <div className="prose prose-invert prose-sm mt-3 max-w-none border-edge border-t pt-4">
                <Markdown remarkPlugins={[remarkGfm]}>{report}</Markdown>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-4 rounded-md border border-amber-900 bg-amber-950/40 px-3 py-2 text-amber-300 text-sm">
              The agent's verdict could not be parsed — review the raw report below and decide
              manually.
            </div>
            <div className="prose prose-invert prose-sm max-w-none">
              <Markdown remarkPlugins={[remarkGfm]}>{report}</Markdown>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
