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
  if (line.startsWith('+++') || line.startsWith('---')) return 'text-slate-500'
  if (line.startsWith('@@')) return 'text-cyan-500'
  if (line.startsWith('+')) return 'bg-emerald-950/60 text-emerald-300'
  if (line.startsWith('-')) return 'bg-red-950/60 text-red-300'
  return 'text-slate-400'
}

export function DiffViewer({ diff }: { diff: string | null }) {
  if (!diff?.trim()) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-600 text-sm">
        {diff === null
          ? 'File changes from the isolated worktree will appear here after execution.'
          : 'Execution produced no file changes.'}
      </div>
    )
  }

  const files = parseDiff(diff)

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {files.map((file) => (
        <details key={file.path} open className="rounded-lg border border-edge bg-surface-raised">
          <summary className="cursor-pointer px-3 py-2 font-medium font-mono text-slate-200 text-xs hover:bg-surface-hover">
            {file.path}
          </summary>
          <pre className="overflow-x-auto border-edge border-t p-3 font-mono text-xs leading-relaxed">
            {file.lines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: diff lines are static once rendered
              <div key={i} className={`whitespace-pre ${lineClass(line)}`}>
                {line || ' '}
              </div>
            ))}
          </pre>
        </details>
      ))}
    </div>
  )
}
