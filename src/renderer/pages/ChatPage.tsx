import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatAction, ChatMessage, ChatSession } from '../../shared/chat-types'
import { MAIN_SIDE_ACTIONS } from '../../shared/chat-types'
import type { Task, TaskState } from '../../shared/types'
import { NewBlueprintDialog } from '../components/blueprint/NewBlueprintDialog'
import { useAppStore } from '../stores/appStore'
import { NO_LINES, useLogStore } from '../stores/logStore'

// Pipeline → chat visibility: a slim strip of everything alive in the
// workspace right now, clickable straight into the task.
const LIVE_STATES: TaskState[] = [
  'PLANNING',
  'EXECUTING',
  'VERIFYING',
  'AWAITING_APPROVAL',
  'REVIEW',
]

function WorkspaceStrip() {
  const openTask = useAppStore((s) => s.openTask)
  const [live, setLive] = useState<Task[]>([])

  const reload = useCallback(async () => {
    const all = await window.founcode.invoke('task:list', {})
    setLive(all.filter((t) => LIVE_STATES.includes(t.state)))
  }, [])

  useEffect(() => {
    void reload()
    return window.founcode.on('task:stateChanged', () => void reload())
  }, [reload])

  if (live.length === 0) return null
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-edge border-b bg-surface-raised/40 px-4 py-2">
      <span className="live-dot size-1.5 shrink-0 rounded-full bg-accent" />
      <span className="shrink-0 font-mono text-[10px] text-slate-500 uppercase tracking-wider">
        live
      </span>
      {live.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => openTask(t.id)}
          className="shrink-0 rounded-full border border-edge bg-surface px-2.5 py-1 font-mono text-[10px] text-slate-400 transition-colors hover:border-edge-2 hover:text-slate-200"
          title={t.intent}
        >
          <span
            className={
              t.state === 'REVIEW' || t.state === 'AWAITING_APPROVAL'
                ? 'text-amber-300'
                : 'text-accent'
            }
          >
            {t.state}
          </span>{' '}
          {t.title.slice(0, 32)}
        </button>
      ))}
    </div>
  )
}

const ACTION_LABELS: Record<ChatAction['type'], string> = {
  blueprint_from_idea: '✦ Turn into a Blueprint',
  create_task: '+ Create task',
  add_task_to_blueprint: '+ Queue into blueprint',
  pause_auto: '⏸ Pause auto-advance',
  resume_auto: '▶ Resume auto-advance',
  start_next: '▶ Start next task',
  open_project: '→ Open project',
}

function ActionChips({
  sessionId,
  actions,
  onBlueprintIdea,
}: {
  sessionId: string
  actions: ChatAction[]
  onBlueprintIdea: (idea: string, title?: string) => void
}) {
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const [results, setResults] = useState<Record<number, string>>({})

  async function run(index: number, action: ChatAction) {
    if (action.type === 'blueprint_from_idea') {
      onBlueprintIdea(action.idea, action.title)
      return
    }
    if (action.type === 'open_project') {
      await setActiveProject(action.projectId)
      return
    }
    if (MAIN_SIDE_ACTIONS.has(action.type)) {
      const result = await window.founcode.invoke('chat:runAction', { sessionId, action })
      setResults((r) => ({
        ...r,
        [index]: result.ok ? `✓ ${result.message}` : `✕ ${result.message}`,
      }))
    }
  }

  if (actions.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {actions.map((action, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: actions are immutable once persisted — order never changes
        <div key={`${action.type}-${i}`} className="flex items-center gap-2">
          <button
            type="button"
            disabled={results[i] !== undefined}
            onClick={() => run(i, action)}
            className="rounded-lg border border-accent/40 bg-accent/5 px-3 py-1.5 text-[12px] text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            title={'intent' in action ? action.intent : 'idea' in action ? action.idea : undefined}
          >
            {ACTION_LABELS[action.type]}
            {'title' in action && action.title ? ` — ${action.title}` : ''}
          </button>
          {results[i] && <span className="font-mono text-[11px] text-slate-500">{results[i]}</span>}
        </div>
      ))}
    </div>
  )
}

export function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  // Instant optimistic flag; authoritative busy comes per-session from main.
  const [justSent, setJustSent] = useState(false)
  const [ideaDialog, setIdeaDialog] = useState<{ idea: string; title?: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const streamLines = useLogStore((s) => (activeId ? (s.logs[activeId] ?? NO_LINES) : NO_LINES))

  // Pending is PER SESSION (main tracks it) — switching sessions while
  // one is replying can't leak state or slip past the guard anymore.
  const pending = justSent || (sessions.find((s) => s.id === activeId)?.busy ?? false)

  const reloadSessions = useCallback(async () => {
    const list = await window.founcode.invoke('chat:listSessions', undefined)
    setSessions(list)
    return list
  }, [])

  const reloadMessages = useCallback(async (sessionId: string) => {
    const m = await window.founcode.invoke('chat:messages', { sessionId })
    setMessages(m)
    setJustSent((p) => (p && m.at(-1)?.role === 'assistant' ? false : p))
  }, [])

  // Initial load: latest session or a fresh one.
  useEffect(() => {
    void (async () => {
      const list = await reloadSessions()
      if (list.length > 0) {
        setActiveId(list[0]?.id ?? null)
      }
    })()
  }, [reloadSessions])

  useEffect(() => {
    setJustSent(false) // optimistic flag never crosses sessions
    if (activeId) void reloadMessages(activeId)
  }, [activeId, reloadMessages])

  // Live reload when main pings (reply arrived / user msg persisted).
  useEffect(() => {
    return window.founcode.on('chat:updated', ({ sessionId }) => {
      void reloadSessions()
      if (sessionId === activeId) void reloadMessages(sessionId)
    })
  }, [activeId, reloadSessions, reloadMessages])

  // biome-ignore lint/correctness/useExhaustiveDependencies: autoscroll on updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, pending, streamLines.length])

  async function newSession() {
    const session = await window.founcode.invoke('chat:createSession', {})
    await reloadSessions()
    setActiveId(session.id)
    setMessages([])
  }

  async function send() {
    const text = draft.trim()
    if (!text || pending) return
    let sessionId = activeId
    if (!sessionId) {
      const session = await window.founcode.invoke('chat:createSession', {})
      sessionId = session.id
      setActiveId(sessionId)
      await reloadSessions()
    }
    setDraft('')
    setJustSent(true)
    setMessages((m) => [
      ...m,
      {
        id: -Date.now(),
        sessionId,
        role: 'user',
        content: text,
        actions: [],
        createdAt: Date.now(),
      },
    ])
    try {
      await window.founcode.invoke('chat:send', { sessionId, content: text })
    } catch (error) {
      useAppStore.setState({ error: (error as Error).message })
      setJustSent(false)
    }
  }

  const lastStreamLine = pending ? streamLines.at(-1)?.content : undefined

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* sessions rail */}
      <aside className="flex w-56 shrink-0 flex-col border-edge border-r bg-surface-raised/30">
        <div className="p-3">
          <button type="button" onClick={newSession} className="btn-ghost w-full text-[13px]">
            + New chat
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {sessions.map((s) => (
            <div key={s.id} className="group relative">
              <button
                type="button"
                onClick={() => setActiveId(s.id)}
                className={`w-full truncate rounded-md px-3 py-2 pr-7 text-left text-[13px] transition-colors ${
                  s.id === activeId
                    ? 'bg-surface-hover text-slate-100'
                    : 'text-slate-400 hover:bg-surface-hover/60 hover:text-slate-200'
                }`}
                title={s.title}
              >
                {s.busy && (
                  <span className="live-dot mr-1.5 inline-block size-1.5 rounded-full bg-accent align-middle" />
                )}
                {s.title}
              </button>
              <button
                type="button"
                aria-label="Delete chat"
                onClick={async () => {
                  await window.founcode.invoke('chat:deleteSession', { sessionId: s.id })
                  const list = await reloadSessions()
                  if (s.id === activeId) {
                    setActiveId(list[0]?.id ?? null)
                    setMessages([])
                  }
                }}
                className="absolute top-1.5 right-1.5 hidden rounded px-1.5 py-0.5 text-slate-600 text-xs hover:bg-red-950/40 hover:text-red-300 group-hover:block"
              >
                ✕
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {/* thread */}
      <div className="flex flex-1 flex-col">
        <WorkspaceStrip />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
            {messages.length === 0 && !pending && (
              <div className="rise-in mt-16 text-center">
                <p className="font-semibold text-slate-200 text-xl tracking-tight">
                  What do you want to build?
                </p>
                <p className="mx-auto mt-2 max-w-md text-slate-500 text-sm leading-relaxed">
                  Think out loud — discuss an idea, ask about your projects, or steer a build that's
                  already running. When you're ready, one click turns the discussion into a verified
                  pipeline.
                </p>
                <button
                  type="button"
                  onClick={() => setIdeaDialog({ idea: '' })}
                  className="btn-ghost mt-5 border-accent/30 text-accent hover:border-accent/50 hover:bg-accent/5"
                >
                  ✦ Start from an idea
                </button>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-accent-dim/20 text-slate-100 whitespace-pre-wrap'
                      : 'border border-edge bg-surface-raised text-slate-300'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-pre:my-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      {activeId && (
                        <ActionChips
                          sessionId={activeId}
                          actions={m.actions}
                          onBlueprintIdea={(idea, title) => setIdeaDialog({ idea, title })}
                        />
                      )}
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-xl border border-edge bg-surface-raised px-4 py-2.5">
                  <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:0ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:300ms]" />
                  {lastStreamLine && (
                    <span className="max-w-md truncate font-mono text-[11px] text-slate-500">
                      {lastStreamLine}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* composer */}
        <div className="border-edge border-t bg-surface-raised/40 px-6 py-4">
          <div className="mx-auto max-w-3xl">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              rows={2}
              disabled={pending}
              placeholder={
                pending
                  ? 'The assistant is replying…'
                  : 'Discuss an idea, ask about a project, steer a running build… (Enter to send, /skill for methods)'
              }
              className="input-field w-full resize-none text-[13.5px] disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {ideaDialog && (
        <NewBlueprintDialog
          initial={{ idea: ideaDialog.idea, title: ideaDialog.title }}
          onClose={() => setIdeaDialog(null)}
        />
      )}
    </div>
  )
}
