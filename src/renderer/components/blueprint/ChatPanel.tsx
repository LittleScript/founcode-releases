import { useEffect, useRef, useState } from 'react'
import type { BlueprintMessage, ChatPhase } from '../../../shared/blueprint-types'
import { useBlueprintStore } from '../../stores/blueprintStore'

// Discussion thread for the structure / PRD steps. The user can ask
// questions or request changes; the agent replies and may regenerate the
// artifact in place. Reloads on blueprint:stateChanged (the store's
// version counter bumps on every refresh).
export function ChatPanel({ blueprintId, phase }: { blueprintId: string; phase: ChatPhase }) {
  const version = useBlueprintStore((s) => s.version)
  const [messages, setMessages] = useState<BlueprintMessage[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload thread whenever the store version bumps
  useEffect(() => {
    window.founcode.invoke('blueprint:messages', { blueprintId, phase }).then((m) => {
      setMessages(m)
      // Once the agent's reply lands, the message count grows past the
      // optimistic user message — clear the pending indicator.
      setPending((p) => (p && m.at(-1)?.role === 'agent' ? false : p))
    })
  }, [blueprintId, phase, version])

  // biome-ignore lint/correctness/useExhaustiveDependencies: autoscroll on new message / pending change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, pending])

  async function send() {
    const text = draft.trim()
    if (!text || pending) return
    setDraft('')
    setPending(true)
    // Optimistic: show the user message immediately.
    setMessages((m) => [
      ...m,
      { id: -Date.now(), phase, role: 'user', content: text, createdAt: Date.now() },
    ])
    await window.founcode.invoke('blueprint:chat', { blueprintId, phase, message: text })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-edge border-b px-4 py-3">
        <h3 className="font-medium text-slate-100 text-sm">Discuss with the agent</h3>
        <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">
          Ask why, explore options, or request a change — the agent updates the {phase} in place.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !pending && (
          <p className="mt-6 text-center font-mono text-[11px] text-slate-600">
            no messages yet — start the conversation
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-accent-dim/20 text-slate-100'
                  : 'border border-edge bg-surface-raised text-slate-300'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-lg border border-edge bg-surface-raised px-3 py-2 text-slate-500">
              <span className="size-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:0ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-edge border-t p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={2}
          placeholder="Ask or request a change… (Enter to send)"
          className="input-field resize-none text-[13px]"
        />
      </div>
    </div>
  )
}
