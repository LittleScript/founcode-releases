import { useEffect, useRef, useState } from 'react'
import type { ChatSession } from '../../shared/chat-types'
import { useAppStore } from '../stores/appStore'

// Per-chat management menu (Claude-app parity): pin, rename, add to
// project, delete. Rendered inside a `relative group` row.
export function SessionMenu({
  session,
  onChanged,
  onDeleted,
}: {
  session: ChatSession
  onChanged: () => void
  onDeleted: () => void
}) {
  const projects = useAppStore((s) => s.projects)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'menu' | 'rename' | 'project'>('menu')
  const [title, setTitle] = useState(session.title)
  // Fixed-position coords so the popup escapes the sidebar's clipping
  // (a narrow sidebar was cutting the menu off).
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false)
        setMode('menu')
      }
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  async function patch(p: {
    pinned?: boolean
    title?: string
    projectId?: string | null
  }): Promise<void> {
    await window.founcode.invoke('chat:updateSession', { sessionId: session.id, ...p })
    setOpen(false)
    setMode('menu')
    onChanged()
  }

  const item =
    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-slate-300 transition-colors hover:bg-surface-hover'

  return (
    <div ref={ref} className="absolute top-1 right-1">
      <button
        type="button"
        aria-label="Chat options"
        onClick={(e) => {
          e.stopPropagation()
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setPos({
            top: Math.min(rect.bottom + 4, window.innerHeight - 220),
            left: Math.min(rect.left, window.innerWidth - 220),
          })
          setOpen((o) => !o)
          setMode('menu')
          setTitle(session.title)
        }}
        className={`rounded px-1.5 py-0.5 text-slate-500 text-xs hover:bg-surface-hover hover:text-slate-200 ${
          open ? 'block' : 'hidden group-hover:block'
        }`}
      >
        ⋯
      </button>

      {open && (
        <div
          style={{ top: pos.top, left: pos.left }}
          className="rise-in fixed z-50 w-52 overflow-hidden rounded-lg border border-edge bg-surface-raised py-1 shadow-black/50 shadow-xl"
        >
          {mode === 'menu' && (
            <>
              <button
                type="button"
                className={item}
                onClick={() => void patch({ pinned: !session.pinned })}
              >
                {session.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button type="button" className={item} onClick={() => setMode('rename')}>
                Rename
              </button>
              <button type="button" className={item} onClick={() => setMode('project')}>
                Add to project →
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-red-400 transition-colors hover:bg-red-950/30"
                onClick={async () => {
                  await window.founcode.invoke('chat:deleteSession', { sessionId: session.id })
                  setOpen(false)
                  onDeleted()
                }}
              >
                Delete
              </button>
            </>
          )}

          {mode === 'rename' && (
            <div className="p-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && title.trim()) void patch({ title: title.trim() })
                  if (e.key === 'Escape') setMode('menu')
                }}
                // biome-ignore lint/a11y/noAutofocus: focus belongs in the rename field the user just opened
                autoFocus
                className="input-field !py-1 text-[12px]"
              />
              <button
                type="button"
                onClick={() => title.trim() && void patch({ title: title.trim() })}
                className="btn-primary mt-1.5 w-full !py-1 text-[12px]"
              >
                Save
              </button>
            </div>
          )}

          {mode === 'project' && (
            <>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={item}
                  onClick={() => void patch({ projectId: p.id })}
                >
                  {session.projectId === p.id ? '✓ ' : ''}
                  {p.name}
                </button>
              ))}
              <button
                type="button"
                className={item}
                onClick={() => void patch({ projectId: null })}
              >
                {session.projectId === null ? '✓ ' : ''}No project
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
