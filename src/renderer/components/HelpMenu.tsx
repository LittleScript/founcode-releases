import { useEffect, useRef, useState } from 'react'

// Claude-app-style help popup: external links + keyboard shortcuts.
const LINKS: { label: string; url: string }[] = [
  {
    label: 'Releases & changelog',
    url: 'https://github.com/LittleScript/founcode-releases/releases',
  },
  { label: 'Report an issue', url: 'https://github.com/LittleScript/founcode-releases/issues' },
  { label: 'About Founcode', url: 'https://github.com/LittleScript/founcode-releases#readme' },
]

const SHORTCUTS: [string, string][] = [
  ['Enter', 'Send message'],
  ['Shift + Enter', 'New line'],
  ['/', 'Skill palette in chat'],
  ['↑ / ↓ + Enter', 'Navigate & pick a skill'],
  ['Esc', 'Close the skill palette'],
  ['Drop files', 'Share file paths with the agent'],
]

export function HelpMenu({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Help"
        className={`flex w-full items-center gap-2.5 rounded-md py-1.5 text-left text-[13.5px] text-slate-400 transition-colors hover:bg-surface-hover hover:text-slate-200 ${
          collapsed ? 'justify-center px-0' : 'px-3'
        }`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01" />
        </svg>
        {!collapsed && 'Help'}
      </button>

      {open && (
        <div className="rise-in absolute bottom-full left-2 z-30 mb-2 w-56 overflow-hidden rounded-lg border border-edge bg-surface-raised py-1 shadow-black/50 shadow-xl">
          {LINKS.map((link) => (
            <button
              key={link.url}
              type="button"
              onClick={() => {
                void window.founcode.invoke('app:openExternal', { url: link.url })
                setOpen(false)
              }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] text-slate-300 transition-colors hover:bg-surface-hover"
            >
              {link.label}
              <span className="text-[10px] text-slate-600">↗</span>
            </button>
          ))}
          <div className="my-1 border-edge border-t" />
          <button
            type="button"
            onClick={() => {
              setShowShortcuts(true)
              setOpen(false)
            }}
            className="flex w-full items-center px-3 py-1.5 text-left text-[12px] text-slate-300 transition-colors hover:bg-surface-hover"
          >
            Keyboard shortcuts
          </button>
        </div>
      )}

      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px]">
          <div className="rise-in w-[420px] rounded-xl border border-edge bg-surface-raised p-6 shadow-2xl shadow-black/60">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-lg text-slate-100 tracking-tight">
                Keyboard shortcuts
              </h2>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="rounded px-2 py-0.5 text-slate-400 text-xs hover:bg-surface-hover"
              >
                ✕ Close
              </button>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map(([keys, action]) => (
                <div key={keys} className="flex items-center justify-between">
                  <kbd className="rounded border border-edge bg-surface px-2 py-0.5 font-mono text-[11px] text-slate-300">
                    {keys}
                  </kbd>
                  <span className="text-[12.5px] text-slate-400">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
