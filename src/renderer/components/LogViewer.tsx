import { useEffect, useRef } from 'react'
import { type LogLine, useLogStore } from '../stores/logStore'

const COLORS: Record<LogLine['kind'], string> = {
  text: 'text-slate-300',
  tool: 'text-sky-400',
  file: 'text-amber-400',
  error: 'text-red-400',
  done: 'text-slate-500',
}

export function LogViewer({ taskId, storedLog }: { taskId: string; storedLog: string | null }) {
  const lines = useLogStore((s) => s.logs[taskId] ?? [])
  const bottomRef = useRef<HTMLDivElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: autoscroll must re-run whenever a line is appended
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  if (lines.length === 0 && !storedLog) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-600 text-sm">
        No agent activity yet.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-surface p-4 font-mono text-xs leading-relaxed">
      {storedLog && lines.length === 0 && (
        <pre className="whitespace-pre-wrap text-slate-400">{storedLog}</pre>
      )}
      {lines.map((line) => (
        <div key={line.key} className={`whitespace-pre-wrap ${COLORS[line.kind]}`}>
          {line.content}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
