import '@xterm/xterm/css/xterm.css'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useEffect, useRef, useState } from 'react'
import { PERMISSION_LABELS } from '../../shared/settings-types'
import type { TerminalSession } from '../../shared/terminal-types'
import { useAppStore } from '../stores/appStore'

// Live agent terminal (v1.3 T2): an xterm.js view bound to a PTY session
// in main. Output streams in via terminal:data; keystrokes go out via
// terminal:input. Same phosphor palette as the rest of the app.
export function TerminalView({ session }: { session: TerminalSession }) {
  const goBoard = useAppStore((s) => s.goBoard)
  const hostRef = useRef<HTMLDivElement>(null)
  const [exited, setExited] = useState<number | null>(session.exitCode)

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount once per session id
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: {
        background: '#070a0e',
        foreground: '#cbd5e1',
        cursor: '#34e8a9',
        black: '#0a0d12',
        green: '#34e8a9',
        blue: '#4cb8ff',
        red: '#f87171',
        yellow: '#fbbf24',
        magenta: '#c084fc',
      },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    fit.fit()
    term.focus()

    const send = (data: string) =>
      window.founcode.invoke('terminal:input', { sessionId: session.id, data })
    term.onData(send)

    const pushResize = () => {
      fit.fit()
      window.founcode.invoke('terminal:resize', {
        sessionId: session.id,
        cols: term.cols,
        rows: term.rows,
      })
    }
    const ro = new ResizeObserver(pushResize)
    ro.observe(host)
    pushResize()

    const offData = window.founcode.on('terminal:data', ({ sessionId, data }) => {
      if (sessionId === session.id) term.write(data)
    })
    const offExit = window.founcode.on('terminal:exit', ({ sessionId, exitCode }) => {
      if (sessionId === session.id) {
        setExited(exitCode)
        term.write(`\r\n\x1b[90m— session ended (exit ${exitCode}) —\x1b[0m\r\n`)
      }
    })

    return () => {
      offData()
      offExit()
      ro.disconnect()
      term.dispose()
    }
  }, [session.id])

  const perm = PERMISSION_LABELS[session.permission]

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#070a0e]">
      <header className="flex items-center gap-3 border-edge border-b bg-surface-raised px-4 py-2.5">
        <button
          type="button"
          onClick={goBoard}
          className="rounded-md border border-edge px-2.5 py-1 text-[12px] text-slate-300 transition-colors hover:border-edge-2 hover:bg-surface-hover"
        >
          ← Back
        </button>
        <span className="font-mono text-[11px] text-slate-400">
          {session.agentId}
          {session.model ? ` · ${session.model}` : ''}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
            session.permission === 'full'
              ? 'border-phase-fail/40 text-phase-fail'
              : 'border-edge text-slate-500'
          }`}
          title={perm.hint}
        >
          {perm.label}
        </span>
        <span className="truncate font-mono text-[10px] text-slate-600">{session.cwd}</span>
        <div className="ml-auto flex items-center gap-2">
          {exited === null ? (
            <button
              type="button"
              onClick={() => window.founcode.invoke('terminal:kill', { sessionId: session.id })}
              className="btn-danger border border-red-900/60"
            >
              ■ Stop
            </button>
          ) : (
            <span className="font-mono text-[11px] text-slate-500">ended · exit {exited}</span>
          )}
        </div>
      </header>
      <div ref={hostRef} className="min-h-0 flex-1 p-2" />
    </div>
  )
}
