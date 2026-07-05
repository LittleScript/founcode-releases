import { NO_LINES, useLogStore } from '../../stores/logStore'

// Shown while an agent is generating (questions/structure/PRD/tasks).
// Peeks the streaming log so the wait feels alive, not frozen.
export function GeneratingView({ blueprintId, label }: { blueprintId: string; label: string }) {
  const lines = useLogStore((s) => s.logs[blueprintId] ?? NO_LINES)
  const recent = lines.slice(-6)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="relative flex size-14 items-center justify-center">
        <div className="absolute size-14 animate-spin rounded-full border-2 border-accent-dim/30 border-t-accent" />
        <span className="font-mono text-accent text-sm">F/</span>
      </div>
      <div className="text-center">
        <p className="font-medium text-slate-200">{label}</p>
        <p className="mt-1 font-mono text-[11px] text-slate-600">
          the agent is working — this usually takes under a minute
        </p>
      </div>
      {recent.length > 0 && (
        <div className="w-full max-w-lg rounded-lg border border-edge bg-[#070a0e] p-3 font-mono text-[11px] text-slate-500 leading-relaxed">
          {recent.map((l) => (
            <div key={l.key} className="truncate">
              {l.content}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
