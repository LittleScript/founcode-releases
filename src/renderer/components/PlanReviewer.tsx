import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Task } from '../../shared/types'
import { useAppStore } from '../stores/appStore'
import { NO_LINES, useLogStore } from '../stores/logStore'

function PlanningProgress({ task }: { task: Task }) {
  const lines = useLogStore((s) => s.logs[task.id] ?? NO_LINES)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const elapsed = Math.max(0, Math.floor((now - task.updatedAt) / 1000))
  const lastLine = lines.at(-1)
  const sinceActivity = lastLine ? Math.floor((now - lastLine.at) / 1000) : null
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="flex flex-col items-center gap-1.5 font-mono text-[11px] text-slate-500">
      <div className="text-slate-400">elapsed {mmss(elapsed)}</div>
      <div>
        {lines.length > 0
          ? `${lines.length} events · last activity ${sinceActivity}s ago`
          : 'waiting for the first agent event…'}
      </div>
      {lastLine && (
        <div className="max-w-md truncate text-slate-600">{lastLine.content.slice(0, 100)}</div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div className="size-8 animate-spin rounded-full border-2 border-accent-dim border-t-transparent" />
  )
}

export function PlanReviewer({ task, planContent }: { task: Task; planContent: string | null }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setEditing(false)
    setFeedbackOpen(false)
  }, [])

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

  if (task.state === 'BACKLOG') {
    return (
      <div className="rise-in flex flex-1 flex-col items-center justify-center gap-5">
        <p className="max-w-md text-center text-slate-400 text-sm leading-relaxed">
          Start planning: the agent will analyze the repository{' '}
          <span className="text-slate-200">read-only</span> and produce an implementation plan for
          your review. No code is written in this phase.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            call(() => window.founcode.invoke('task:startPlanning', { taskId: task.id }))
          }
          className="btn-primary px-6 py-2"
        >
          ▶ Start Planning
        </button>
      </div>
    )
  }

  if (task.state === 'FAILED') {
    return (
      <div className="rise-in flex flex-1 flex-col items-center justify-center gap-5">
        <p className="max-w-md text-center text-phase-fail text-sm">
          The agent run failed. Check the Log tab for details.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => call(() => window.founcode.invoke('task:retry', { taskId: task.id }))}
          className="btn-primary"
        >
          ↻ Retry (back to Backlog)
        </button>
      </div>
    )
  }

  if (task.state === 'PLANNING') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <Spinner />
        <p className="text-slate-400 text-sm">Agent is analyzing the repository… (see Log tab)</p>
        <PlanningProgress task={task} />
        <button
          type="button"
          onClick={() => call(() => window.founcode.invoke('task:cancel', { taskId: task.id }))}
          className="btn-ghost"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (!planContent) {
    return (
      <div className="flex flex-1 items-center justify-center font-mono text-slate-600 text-sm">
        no plan yet
      </div>
    )
  }

  const reviewable = task.state === 'AWAITING_APPROVAL'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {reviewable && (
        <div className="flex items-center gap-2 border-b border-edge bg-surface-raised/40 px-4 py-3">
          {!editing ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  call(() => window.founcode.invoke('task:approvePlan', { taskId: task.id }))
                }
                className="btn-primary"
              >
                ✓ Approve Plan
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(planContent)
                  setEditing(true)
                }}
                className="btn-ghost"
              >
                Edit
              </button>
              <button type="button" onClick={() => setFeedbackOpen(true)} className="btn-ghost">
                ↻ Request Re-plan
              </button>
              <button
                type="button"
                onClick={() =>
                  call(() => window.founcode.invoke('task:cancel', { taskId: task.id }))
                }
                className="btn-danger ml-auto"
              >
                Discard
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  call(async () => {
                    await window.founcode.invoke('task:approvePlan', {
                      taskId: task.id,
                      editedPlan: draft,
                    })
                    setEditing(false)
                  })
                }
                className="btn-primary"
              >
                ✓ Approve Edited Plan
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn-ghost">
                Cancel Edit
              </button>
            </>
          )}
        </div>
      )}

      {feedbackOpen && (
        <div className="border-b border-edge bg-surface-raised/60 px-4 py-3">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="What should the agent change about this plan?"
            className="input-field mb-2 resize-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!feedback.trim() || busy}
              onClick={() =>
                call(async () => {
                  await window.founcode.invoke('task:requestReplan', {
                    taskId: task.id,
                    feedback: feedback.trim(),
                  })
                  setFeedback('')
                  setFeedbackOpen(false)
                })
              }
              className="btn-primary"
            >
              Send &amp; Re-plan
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

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 resize-none bg-surface p-5 font-mono text-[13px] text-slate-200 leading-relaxed outline-none"
        />
      ) : (
        <div className="prose prose-invert prose-sm max-w-none flex-1 overflow-y-auto px-6 py-5">
          <Markdown remarkPlugins={[remarkGfm]}>{planContent}</Markdown>
        </div>
      )}
    </div>
  )
}
