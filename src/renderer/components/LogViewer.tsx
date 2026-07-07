import { useEffect, useRef } from 'react'
import { type LogLine, NO_LINES, useLogStore } from '../stores/logStore'

// The log panel is ALWAYS a dark terminal — fixed colors, independent
// of the app theme (the slate ladder inverts in light mode and made
// the log unreadable — QA).
const COLORS: Record<LogLine['kind'], string> = {
  text: 'text-[#cbd5e1]',
  tool: 'text-[#4cb8ff]',
  file: 'text-[#fbbf24]',
  error: 'text-[#f87171]',
  done: 'text-[#64748b]',
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
    <div className="m-4 flex-1 overflow-y-auto rounded-lg border border-[#1e2734] bg-[#070a0e] p-4 font-mono text-xs leading-relaxed">
      {storedLog && lines.length === 0 && (
        <pre className="whitespace-pre-wrap text-[#94a3b8]">{storedLog}</pre>
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
