import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Task } from '../../shared/types'
import { useAppStore } from '../stores/appStore'
import { useLogStore } from '../stores/logStore'

function PlanningProgress({ task }: { task: Task }) {
  const lines = useLogStore((s) => s.logs[task.id] ?? [])
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
    <div className="flex flex-col items-center gap-1 text-slate-500 text-xs">
      <div>elapsed {mmss(elapsed)}</div>
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
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="max-w-md text-center text-slate-400 text-sm">
          Start planning: the agent will analyze the repository read-only and produce an
          implementation plan for your review. No code is written in this phase.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            call(() => window.founcode.invoke('task:startPlanning', { taskId: task.id }))
          }
          className="rounded-md bg-accent-dim px-4 py-2 font-medium text-sm text-surface hover:bg-accent disabled:opacity-40"
        >
          ▶ Start Planning
        </button>
      </div>
    )
  }

  if (task.state === 'FAILED') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="max-w-md text-center text-red-400 text-sm">
          The agent run failed. Check the Log tab for details.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => call(() => window.founcode.invoke('task:retry', { taskId: task.id }))}
          className="rounded-md bg-accent-dim px-4 py-2 font-medium text-sm text-surface hover:bg-accent disabled:opacity-40"
        >
          ↻ Retry (back to Backlog)
        </button>
      </div>
    )
  }

  if (task.state === 'PLANNING') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="size-8 animate-spin rounded-full border-2 border-accent-dim border-t-transparent" />
        <p className="text-slate-400 text-sm">Agent is analyzing the repository… (see Log tab)</p>
        <PlanningProgress task={task} />
        <button
          type="button"
          onClick={() => call(() => window.founcode.invoke('task:cancel', { taskId: task.id }))}
          className="rounded-md border border-edge px-4 py-2 text-slate-300 text-sm hover:bg-surface-hover"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (!planContent) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-600 text-sm">
        No plan yet.
      </div>
    )
  }

  const reviewable = task.state === 'AWAITING_APPROVAL'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {reviewable && (
        <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
          {!editing ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  call(() => window.founcode.invoke('task:approvePlan', { taskId: task.id }))
                }
                className="rounded-md bg-accent-dim px-4 py-1.5 font-medium text-sm text-surface hover:bg-accent disabled:opacity-40"
              >
                ✓ Approve Plan
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(planContent)
                  setEditing(true)
                }}
                className="rounded-md border border-edge px-4 py-1.5 text-slate-300 text-sm hover:bg-surface-hover"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                className="rounded-md border border-edge px-4 py-1.5 text-slate-300 text-sm hover:bg-surface-hover"
              >
                ↻ Request Re-plan
              </button>
              <button
                type="button"
                onClick={() =>
                  call(() => window.founcode.invoke('task:cancel', { taskId: task.id }))
                }
                className="ml-auto rounded-md px-3 py-1.5 text-slate-500 text-sm hover:text-red-400"
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
                className="rounded-md bg-accent-dim px-4 py-1.5 font-medium text-sm text-surface hover:bg-accent disabled:opacity-40"
              >
                ✓ Approve Edited Plan
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-edge px-4 py-1.5 text-slate-300 text-sm hover:bg-surface-hover"
              >
                Cancel Edit
              </button>
            </>
          )}
        </div>
      )}

      {feedbackOpen && (
        <div className="border-b border-edge bg-surface-raised px-4 py-3">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="What should the agent change about this plan?"
            className="mb-2 w-full resize-none rounded-md border border-edge bg-surface px-3 py-2 text-slate-100 text-sm outline-none focus:border-accent-dim"
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
              className="rounded-md bg-accent-dim px-3 py-1.5 font-medium text-sm text-surface hover:bg-accent disabled:opacity-40"
            >
              Send &amp; Re-plan
            </button>
            <button
              type="button"
              onClick={() => setFeedbackOpen(false)}
              className="rounded-md px-3 py-1.5 text-slate-400 text-sm hover:bg-surface-hover"
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
          className="flex-1 resize-none bg-surface p-4 font-mono text-slate-200 text-sm outline-none"
        />
      ) : (
        <div className="prose prose-invert prose-sm max-w-none flex-1 overflow-y-auto p-6">
          <Markdown remarkPlugins={[remarkGfm]}>{planContent}</Markdown>
        </div>
      )}
    </div>
  )
}
