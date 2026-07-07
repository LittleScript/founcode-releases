import { useEffect, useRef, useState } from 'react'
import { agentModelSpec, MODEL_OPTIONS, type ModelOption } from '../../shared/settings-types'

// THE model picker — one component everywhere (chat composer, dialogs,
// task page, settings). Replaces both the native datalist (couldn't
// reopen the list after picking) and the ad-hoc popup (clipped, no
// scroll). Fixed-position popup, search filter, scrollable list, live
// catalog from the agent CLI when available, custom values always
// allowed.
export function ModelPicker({
  agentId,
  value,
  onChange,
  variant = 'field',
}: {
  agentId: string
  value: string
  onChange: (v: string) => void
  // field: full-width input look (dialogs/settings); ghost: borderless
  // text button (chat composer); chip: small bordered mono (task page,
  // matches the agent select next to it).
  variant?: 'field' | 'ghost' | 'chip'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [live, setLive] = useState<string[]>([])
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 })
  const ref = useRef<HTMLDivElement>(null)

  const spec = agentModelSpec(agentId)

  useEffect(() => {
    setLive([])
    window.founcode
      .invoke('agent:listModels', { agentId })
      .then(setLive)
      .catch(() => {})
  }, [agentId])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  // Options: curated (with hints) or live catalog (plain ids).
  const curated: ModelOption[] = spec.options ?? spec.suggestions ?? []
  const entries: ModelOption[] =
    live.length > 0
      ? live.map((m) => ({ value: m, label: m, hint: '' }))
      : curated.filter((m) => m.value !== '')

  const q = query.toLowerCase()
  const filtered = entries.filter(
    (m) => m.value.toLowerCase().includes(q) || m.label.toLowerCase().includes(q),
  )
  const exactMatch = entries.some((m) => m.value === query)

  const display =
    value === ''
      ? 'Default'
      : ([...curated, ...MODEL_OPTIONS].find((m) => m.value === value)?.label ?? value)

  function pick(v: string) {
    onChange(v)
    setOpen(false)
    setQuery('')
  }

  function toggle(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const openUp = rect.top > window.innerHeight / 2
    setPos({
      left: Math.min(rect.left, window.innerWidth - 300),
      ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    })
    setOpen((o) => !o)
    setQuery('')
  }

  const triggerClass =
    variant === 'ghost'
      ? 'flex max-w-40 items-center truncate rounded-lg px-2 py-1.5 text-[12px] text-slate-400 transition-colors hover:bg-surface-hover hover:text-slate-200'
      : variant === 'chip'
        ? 'flex max-w-48 items-center truncate rounded-md border border-edge bg-surface px-2 py-0.5 font-mono text-[10px] text-slate-400 transition-colors hover:border-edge-2'
        : 'input-field flex items-center justify-between text-left'

  return (
    <div ref={ref} className={variant === 'field' ? 'w-full' : ''}>
      <button type="button" onClick={toggle} title="Model" className={triggerClass}>
        <span className="truncate">{display}</span>
        <span className="ml-1 shrink-0 text-slate-600 text-xs">⌄</span>
      </button>

      {open && (
        <div
          style={pos}
          className="rise-in fixed z-50 flex max-h-80 w-72 flex-col overflow-hidden rounded-lg border border-edge bg-surface-raised shadow-black/50 shadow-xl"
        >
          <div className="border-edge border-b p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) pick(query.trim())
                if (e.key === 'Escape') setOpen(false)
              }}
              placeholder="Search or type a custom model…"
              // biome-ignore lint/a11y/noAutofocus: the popup exists to receive this input
              autoFocus
              className="input-field !py-1.5 text-[12px]"
            />
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => pick('')}
              className={`flex w-full flex-col px-3 py-1.5 text-left hover:bg-surface-hover ${
                value === '' ? 'bg-surface-hover' : ''
              }`}
            >
              <span className="text-[12px] text-slate-200">Default</span>
              <span className="text-[10px] text-slate-500">The agent CLI's configured model</span>
            </button>

            {filtered.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => pick(m.value)}
                className={`flex w-full flex-col px-3 py-1.5 text-left hover:bg-surface-hover ${
                  value === m.value ? 'bg-surface-hover' : ''
                }`}
              >
                <span className="truncate font-mono text-[12px] text-slate-200">{m.label}</span>
                {m.hint && <span className="text-[10px] text-slate-500">{m.hint}</span>}
              </button>
            ))}

            {query.trim() && !exactMatch && (
              <button
                type="button"
                onClick={() => pick(query.trim())}
                className="flex w-full flex-col border-edge border-t px-3 py-1.5 text-left hover:bg-surface-hover"
              >
                <span className="font-mono text-[12px] text-accent">Use "{query.trim()}"</span>
                <span className="text-[10px] text-slate-500">Custom model string</span>
              </button>
            )}
          </div>

          <div className="border-edge border-t px-3 py-1.5 font-mono text-[10px] text-slate-600">
            {live.length > 0
              ? `${live.length} models from your CLI`
              : (spec.hint ?? 'Curated list')}
          </div>
        </div>
      )}
    </div>
  )
}
