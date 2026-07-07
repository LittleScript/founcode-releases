import { useEffect, useState } from 'react'
import type { ChatSession } from '../../shared/chat-types'
import { SessionMenu } from '../components/SessionMenu'
import { useAppStore } from '../stores/appStore'

// All chat sessions — Claude-app style "Chats" tab.
export function ChatsPage() {
  const goChat = useAppStore((s) => s.goChat)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    const reload = () =>
      void window.founcode.invoke('chat:listSessions', undefined).then(setSessions)
    reload()
    return window.founcode.on('chat:updated', reload)
  }, [])

  const filtered = sessions.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-edge border-b px-6 py-4">
        <h1 className="font-semibold text-[15px] text-slate-100">Chats</h1>
        <button type="button" onClick={() => goChat(null)} className="btn-primary">
          + New chat
        </button>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats…"
          className="input-field mb-4"
        />
        {filtered.length === 0 && (
          <p className="mt-10 text-center font-mono text-[12px] text-slate-600">
            no chats yet — start one
          </p>
        )}
        <div className="space-y-1.5">
          {filtered.map((s) => (
            <div key={s.id} className="group relative">
              <button
                type="button"
                onClick={() => goChat(s.id)}
                className="w-full rounded-lg border border-edge bg-surface px-4 py-3 text-left transition-colors hover:border-edge-2"
              >
                <div className="flex items-center gap-2">
                  {s.pinned && <span className="text-[11px] text-slate-600">📌</span>}
                  {s.busy && <span className="live-dot size-1.5 rounded-full bg-accent" />}
                  <span className="truncate font-medium text-[13.5px] text-slate-200">
                    {s.title}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[10px] text-slate-600">
                  {s.agentId}
                  {s.model ? ` · ${s.model}` : ''} · {new Date(s.updatedAt).toLocaleString()}
                </div>
              </button>
              <SessionMenu
                session={s}
                onChanged={() =>
                  void window.founcode.invoke('chat:listSessions', undefined).then(setSessions)
                }
                onDeleted={() =>
                  void window.founcode.invoke('chat:listSessions', undefined).then(setSessions)
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
