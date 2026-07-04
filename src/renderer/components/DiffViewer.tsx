interface DiffFile {
  path: string
  lines: string[]
}

function parseDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = []
  let current: DiffFile | null = null
  for (const line of diff.split('\n')) {
    const header = line.match(/^diff --git a\/.+ b\/(.+)$/)
    if (header?.[1]) {
      current = { path: header[1], lines: [] }
      files.push(current)
      continue
    }
    current?.lines.push(line)
  }
  return files
}

function lineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'text-slate-600'
  if (line.startsWith('@@')) return 'text-phase-plan/80'
  if (line.startsWith('+')) return 'bg-accent/[0.07] text-emerald-300'
  if (line.startsWith('-')) return 'bg-phase-fail/[0.08] text-red-300'
  return 'text-slate-400'
}

function counts(lines: string[]): { add: number; del: number } {
  let add = 0
  let del = 0
  for (const l of lines) {
    if (l.startsWith('+') && !l.startsWith('+++')) add++
    else if (l.startsWith('-') && !l.startsWith('---')) del++
  }
  return { add, del }
}

export function DiffViewer({ diff }: { diff: string | null }) {
  if (!diff?.trim()) {
    return (
      <div className="flex flex-1 items-center justify-center font-mono text-slate-600 text-sm">
        {diff === null
          ? 'file changes will appear here after execution'
          : 'execution produced no file changes'}
      </div>
    )
  }

  const files = parseDiff(diff)

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {files.map((file) => {
        const c = counts(file.lines)
        return (
          <details key={file.path} open className="panel overflow-hidden">
            <summary className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-surface-hover">
              <span className="font-medium font-mono text-slate-200 text-xs">{file.path}</span>
              <span className="ml-auto font-mono text-[10px]">
                <span className="text-emerald-400">+{c.add}</span>{' '}
                <span className="text-red-400">−{c.del}</span>
              </span>
            </summary>
            <pre className="overflow-x-auto border-edge border-t bg-[#070a0e] p-3 font-mono text-xs leading-relaxed">
              {file.lines.map((line, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: diff lines are static once rendered
                <div key={i} className={`whitespace-pre ${lineClass(line)}`}>
                  {line || ' '}
                </div>
              ))}
            </pre>
          </details>
        )
      })}
    </div>
  )
}
