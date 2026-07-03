import { useEffect, useState } from 'react'
import type { AppInfo } from '../shared/types'

const BOARD_COLUMNS = [
  'Backlog',
  'Planning',
  'Awaiting Approval',
  'Executing',
  'Verifying',
  'Review',
  'Done',
] as const

export default function App() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [ipcOk, setIpcOk] = useState<boolean | null>(null)

  useEffect(() => {
    window.founcode
      .invoke('app:ping', undefined)
      .then((pong) => setIpcOk(pong === 'pong'))
      .catch(() => setIpcOk(false))
    window.founcode
      .invoke('app:info', undefined)
      .then(setInfo)
      .catch(() => setInfo(null))
  }, [])

  return (
    <div className="flex h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-edge bg-surface-raised">
        <div className="flex items-center gap-2 px-4 py-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-accent-dim font-bold text-surface">
            F
          </div>
          <span className="font-semibold text-lg tracking-tight">Founcode</span>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          <button
            type="button"
            className="rounded-md bg-surface-hover px-3 py-2 text-left text-slate-100 text-sm"
          >
            Board
          </button>
          <button
            type="button"
            className="rounded-md px-3 py-2 text-left text-slate-400 text-sm hover:bg-surface-hover"
          >
            Settings
          </button>
        </nav>
        <div className="mt-auto px-4 py-3 text-slate-500 text-xs">
          <div>
            v{info?.version ?? '…'} · schema v{info?.schemaVersion ?? '…'}
          </div>
          <div className={ipcOk ? 'text-accent' : 'text-red-400'}>
            IPC {ipcOk === null ? '…' : ipcOk ? 'connected' : 'FAILED'}
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-edge px-6 py-4">
          <h1 className="font-semibold text-slate-100">Task Board</h1>
          <button
            type="button"
            className="rounded-md bg-accent-dim px-3 py-1.5 font-medium text-sm text-surface hover:bg-accent"
          >
            + New Task
          </button>
        </header>
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {BOARD_COLUMNS.map((column) => (
            <section
              key={column}
              className="flex w-64 shrink-0 flex-col rounded-lg border border-edge bg-surface-raised"
            >
              <h2 className="px-3 py-2.5 font-medium text-slate-400 text-xs uppercase tracking-wide">
                {column}
              </h2>
              <div className="flex-1 px-3 pb-3 text-slate-600 text-sm">No tasks</div>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
