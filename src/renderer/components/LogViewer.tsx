import { useEffect, useRef } from 'react'
import { type LogLine, NO_LINES, useLogStore } from '../stores/logStore'

const COLORS: Record<LogLine['kind'], string> = {
  text: 'text-slate-300',
  tool: 'text-phase-plan',
  file: 'text-amber-300',
  error: 'text-phase-fail',
  done: 'text-slate-600',
}

export function LogViewer({ taskId, storedLog }: { taskId: string; storedLog: string | null }) {
  const lines = useLogStore((s) => s.logs[taskId] ?? NO_LINES)
  const bottomRef = useRef<HTMLDivElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: autoscroll must re-run whenever a line is appended
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  if (lines.length === 0 && !storedLog) {
    return (
      <div className="flex flex-1 items-center justify-center font-mono text-slate-600 text-sm">
        no agent activity yet
      </div>
    )
  }

  return (
    <div className="m-4 flex-1 overflow-y-auto rounded-lg border border-edge bg-[#070a0e] p-4 font-mono text-xs leading-relaxed">
      {storedLog && lines.length === 0 && (
        <pre className="whitespace-pre-wrap text-slate-500">{storedLog}</pre>
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
