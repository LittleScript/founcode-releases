import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatAction, ChatMessage, ChatSession } from '../../shared/chat-types'
import { MAIN_SIDE_ACTIONS } from '../../shared/chat-types'
import { SKILLS } from '../../shared/skills-types'
import type { AgentInfo, Task, TaskState } from '../../shared/types'
import { NewBlueprintDialog } from '../components/blueprint/NewBlueprintDialog'
import { ModelPicker } from '../components/ModelPicker'
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

// While the agent works, cycle through increasingly confident verbs —
// unhurried, Claude-Code pace (matches the think-word CSS duration).
const THINKING_WORDS = [
  'Thinking',
  'Contemplating',
  'Scheming',
  'Percolating',
  'Synthesizing',
  'Orchestrating',
  'Pondering',
  'Brewing',
  'Calibrating',
  'Distilling',
  'Assembling',
  'Founcoding',
]
// Random word, random unhurried cadence (10–20s) — like a person who
// is actually thinking, not a slot machine.
function ThinkingIndicator({ streamLine }: { streamLine?: string }) {
  const [word, setWord] = useState(() => Math.floor(Math.random() * THINKING_WORDS.length))
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const next = () => {
      timer = setTimeout(
        () => {
          setWord((prev) => {
            let pick = Math.floor(Math.random() * THINKING_WORDS.length)
            if (pick === prev) pick = (pick + 1) % THINKING_WORDS.length
            return pick
          })
          next()
        },
        10_000 + Math.random() * 10_000,
      )
    }
    next()
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2.5 rounded-xl border border-edge bg-surface-raised px-4 py-2.5">
        <span className="think-spark text-[15px] text-accent">✦</span>
        <span key={word} className="think-word font-mono text-[12px] text-slate-400">
          {THINKING_WORDS[word]}…
        </span>
        {streamLine && (
          <span className="max-w-md truncate border-edge border-l pl-2.5 font-mono text-[11px] text-slate-600">
            {streamLine}
          </span>
        )}
      </div>
    </div>
  )
}

// Typing "/" opens the command palette of built-in skills.
function SlashMenu({
  filter,
  selected,
  onPick,
}: {
  filter: string
  selected: number
  onPick: (id: string) => void
}) {
  const matches = SKILLS.filter((s) => s.id.startsWith(filter.toLowerCase()))
  if (matches.length === 0) return null
  return (
    <div className="rise-in absolute bottom-full left-0 mb-2 w-full max-w-md overflow-hidden rounded-lg border border-edge bg-surface-raised shadow-black/50 shadow-xl">
      {matches.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault() // keep textarea focus
            onPick(s.id)
          }}
          className={`flex w-full items-baseline gap-3 px-3 py-2 text-left transition-colors ${
            i === selected % matches.length ? 'bg-surface-hover' : 'hover:bg-surface-hover/60'
          }`}
        >
          <code className="shrink-0 font-mono text-[12px] text-accent">/{s.id}</code>
          <span className="text-[12px] text-slate-300">{s.name}</span>
          <span className="truncate text-[11px] text-slate-500">{s.description}</span>
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

// A fresh invitation every time you land on the home screen —
// welcoming, not interrogating (Koko's list).
const GREETINGS = [
  'Where should we begin?',
  "What's on your mind?",
  "Let's build something.",
  'Start with a thought.',
  'What needs building today?',
  'What are we building today?',
  'Where do we want to start?',
  "Let's create something.",
  'Start anywhere.',
  'Create your Blueprint.',
  'Start with an idea.',
]

export function ChatPage({ sessionId }: { sessionId: string | null }) {
  const goChat = useAppStore((s) => s.goChat)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [slashIndex, setSlashIndex] = useState(0)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  // Instant optimistic flag; authoritative busy comes per-session from main.
  const [justSent, setJustSent] = useState(false)
  const [ideaDialog, setIdeaDialog] = useState<{ idea: string; title?: string } | null>(null)
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)])
  const bottomRef = useRef<HTMLDivElement>(null)

  // null = "the latest session" (app open / New chat before first message).
  const activeId = sessionId ?? sessions[0]?.id ?? null
  const active = sessions.find((s) => s.id === activeId)

  const streamLines = useLogStore((s) => (activeId ? (s.logs[activeId] ?? NO_LINES) : NO_LINES))
  const pending = justSent || (active?.busy ?? false)

  const reloadSessions = useCallback(async () => {
    const list = await window.founcode.invoke('chat:listSessions', undefined)
    setSessions(list)
    return list
  }, [])

  const reloadMessages = useCallback(async (id: string) => {
    const m = await window.founcode.invoke('chat:messages', { sessionId: id })
    setMessages(m)
    setJustSent((p) => (p && m.at(-1)?.role === 'assistant' ? false : p))
  }, [])

  useEffect(() => {
    void reloadSessions()
  }, [reloadSessions])

  useEffect(() => {
    setJustSent(false) // optimistic flag never crosses sessions
    if (activeId) void reloadMessages(activeId)
    else setMessages([])
  }, [activeId, reloadMessages])

  useEffect(() => {
    return window.founcode.on('chat:updated', ({ sessionId: updated }) => {
      void reloadSessions()
      if (updated === activeId) void reloadMessages(updated)
    })
  }, [activeId, reloadSessions, reloadMessages])

  useEffect(() => {
    window.founcode.invoke('agent:listInstalled', undefined).then(setAgents)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: autoscroll on updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, pending, streamLines.length])

  async function send() {
    const text = draft.trim()
    if (!text || pending) return
    let id = activeId
    if (!id) {
      const session = await window.founcode.invoke('chat:createSession', {})
      id = session.id
      goChat(id)
      await reloadSessions()
    }
    setDraft('')
    setJustSent(true)
    setMessages((m) => [
      ...m,
      {
        id: -Date.now(),
        sessionId: id,
        role: 'user',
        content: text,
        actions: [],
        createdAt: Date.now(),
      },
    ])
    try {
      await window.founcode.invoke('chat:send', { sessionId: id, content: text })
    } catch (error) {
      useAppStore.setState({ error: (error as Error).message })
      setJustSent(false)
    }
  }

  async function patchSession(p: { agentId?: string; model?: string }) {
    if (!activeId) return
    await window.founcode.invoke('chat:updateSession', { sessionId: activeId, ...p })
    await reloadSessions()
  }

  async function attachFiles() {
    const paths = await window.founcode.invoke('dialog:selectFiles', undefined)
    insertPaths(paths)
  }

  function insertPaths(paths: string[]) {
    const refs = paths.filter(Boolean).map((p) => `@"${p}"`)
    if (refs.length > 0) {
      setDraft((d) => `${d}${d && !d.endsWith('\n') ? '\n' : ''}${refs.join('\n')}\n`)
    }
  }

  const lastStreamLine = pending ? streamLines.at(-1)?.content : undefined

  const slashFilter = draft.match(/^\/(\w*)$/)?.[1] ?? null
  const slashMatches =
    slashFilter !== null ? SKILLS.filter((s) => s.id.startsWith(slashFilter.toLowerCase())) : []

  function pickSlash(id: string) {
    setDraft(`/${id} `)
    setSlashIndex(0)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <WorkspaceStrip />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
          {messages.length === 0 && !pending && (
            <div className="rise-in mt-16 text-center">
              <p className="font-semibold text-slate-200 text-xl tracking-tight">{greeting}</p>
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
                    ? 'whitespace-pre-wrap bg-accent-dim/20 text-slate-100'
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

          {pending && <ThinkingIndicator streamLine={lastStreamLine} />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* composer — Claude-style: one container, input on top, controls below */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop file target, not an interactive control */}
      <div
        className="px-6 pb-5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          insertPaths(
            Array.from(e.dataTransfer.files).map((f) => window.founcode.getPathForFile(f)),
          )
        }}
      >
        <div className="relative mx-auto max-w-3xl">
          {slashFilter !== null && slashMatches.length > 0 && (
            <SlashMenu filter={slashFilter} selected={slashIndex} onPick={pickSlash} />
          )}

          <div className="rounded-2xl border border-edge bg-surface-raised shadow-black/30 shadow-lg transition-colors focus-within:border-edge-2">
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setSlashIndex(0)
              }}
              onKeyDown={(e) => {
                if (slashFilter !== null && slashMatches.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setSlashIndex((i) => (i + 1) % slashMatches.length)
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length)
                    return
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault()
                    const pick = slashMatches[slashIndex % slashMatches.length]
                    if (pick) pickSlash(pick.id)
                    return
                  }
                  if (e.key === 'Escape') {
                    setDraft('')
                    return
                  }
                }
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
                  : 'How can I help you today? ( / for skills, drop files to share paths )'
              }
              className="w-full resize-none border-none bg-transparent px-4 pt-3.5 pb-1 text-[13.5px] text-slate-100 outline-none placeholder:text-slate-600 disabled:opacity-60"
            />

            <div className="flex items-center gap-1 px-2.5 pb-2.5">
              <button
                type="button"
                onClick={() => void attachFiles()}
                title="Attach files — paths are shared with the agent"
                className="flex size-8 items-center justify-center rounded-lg text-lg text-slate-400 transition-colors hover:bg-surface-hover hover:text-slate-200"
              >
                +
              </button>

              <div className="ml-auto flex items-center gap-1">
                {active && (
                  <>
                    <select
                      value={active.agentId}
                      onChange={(e) => void patchSession({ agentId: e.target.value, model: '' })}
                      title="Agent for this chat"
                      className="cursor-pointer rounded-lg border-none bg-transparent px-2 py-1.5 text-[12px] text-slate-300 outline-none transition-colors hover:bg-surface-hover"
                    >
                      {agents.map((a) => (
                        <option key={a.id} value={a.id} disabled={!a.installed}>
                          {a.displayName}
                          {a.installed ? '' : ' — not installed'}
                        </option>
                      ))}
                    </select>

                    <ModelPicker
                      agentId={active.agentId}
                      value={active.model ?? ''}
                      onChange={(v) => void patchSession({ model: v })}
                      variant="ghost"
                    />
                  </>
                )}

                {pending ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeId)
                        void window.founcode.invoke('chat:stop', { sessionId: activeId })
                      setJustSent(false)
                    }}
                    title="Stop the reply"
                    className="ml-1 flex size-8 items-center justify-center rounded-full border border-red-500/50 text-red-400 transition-colors hover:bg-red-950/30"
                  >
                    <span className="block size-2.5 rounded-[2px] bg-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!draft.trim()}
                    title="Send (Enter)"
                    className="ml-1 flex size-8 items-center justify-center rounded-full bg-accent font-semibold text-[#06281c] transition-all hover:shadow-[0_0_16px_rgba(52,232,169,0.4)] disabled:bg-surface-hover disabled:text-slate-600"
                  >
                    ↑
                  </button>
                )}
              </div>
            </div>
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
