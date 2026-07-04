// Claude Code CLI adapter — TDD §4.2.
//
// Invocation: `claude -p --output-format stream-json` with the prompt
// written to stdin. Passing the prompt via stdin (never argv) means no
// shell quoting of user-controlled text, even when the npm .cmd shim
// forces us through cmd.exe on Windows.

import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { AgentEvent } from '../../../shared/types'
import type { AgentAdapter, AgentDetection, AgentRunOptions } from '../AgentAdapter'

const FILE_TOOLS: Record<string, 'create' | 'edit' | 'delete'> = {
  Write: 'create',
  Edit: 'edit',
  NotebookEdit: 'edit',
}

interface ResolvedCommand {
  file: string
  prefixArgs: string[]
}

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly id = 'claude-code'
  readonly displayName = 'Claude Code'

  private resolved: ResolvedCommand | null = null

  // `where` finds the real location; .cmd/.bat shims (npm installs) are
  // not directly spawnable on Windows and must go through cmd.exe. Only
  // fixed args ever travel that path — the prompt goes via stdin.
  private resolve(): ResolvedCommand | null {
    if (this.resolved) return this.resolved
    const which = process.platform === 'win32' ? 'where.exe' : 'which'
    const result = spawnSync(which, ['claude'], { encoding: 'utf8', windowsHide: true })
    if (result.status !== 0) return null
    const candidates = result.stdout.split(/\r?\n/).filter(Boolean)

    // `where` can return several entries (npm installs ship an
    // extensionless sh shim next to claude.cmd; the sh shim is not
    // spawnable on Windows). Prefer a real exe, then the cmd shim.
    const byExt = (ext: string) => candidates.find((c) => c.toLowerCase().endsWith(ext))
    const exe = byExt('.exe')
    const shim = byExt('.cmd') ?? byExt('.bat')
    const chosen = exe ?? shim ?? candidates[0]
    if (!chosen) return null

    const lower = chosen.toLowerCase()
    this.resolved =
      lower.endsWith('.cmd') || lower.endsWith('.bat')
        ? { file: 'cmd.exe', prefixArgs: ['/d', '/s', '/c', chosen] }
        : { file: chosen, prefixArgs: [] }
    return this.resolved
  }

  async detect(): Promise<AgentDetection> {
    const cmd = this.resolve()
    if (!cmd) return { installed: false }
    const result = spawnSync(cmd.file, [...cmd.prefixArgs, '--version'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10_000,
    })
    if (result.status !== 0) return { installed: false }
    return { installed: true, version: result.stdout.trim() }
  }

  async *run(opts: AgentRunOptions): AsyncIterable<AgentEvent> {
    const cmd = this.resolve()
    if (!cmd) {
      yield { type: 'error', message: 'Claude Code CLI not found on PATH' }
      yield { type: 'done', exitCode: -1 }
      return
    }

    // Read-only enforcement uses a tool allowlist rather than
    // `--permission-mode plan`: plan mode hijacks the output into Claude
    // Code's own ExitPlanMode flow (and spawns explore subagents),
    // breaking the Founcode Plan format contract. With an allowlist,
    // non-listed tools are auto-denied in headless mode and the final
    // response stays plain text.
    const args = [
      ...cmd.prefixArgs,
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      ...(opts.readOnly
        ? ['--allowedTools', 'Read', 'Glob', 'Grep']
        : ['--permission-mode', 'acceptEdits']),
    ]

    const child = spawn(cmd.file, args, {
      cwd: opts.cwd,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const killTree = () => {
      if (child.pid === undefined || child.exitCode !== null) return
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
      } else {
        child.kill('SIGKILL')
      }
    }
    opts.abortSignal.addEventListener('abort', killTree, { once: true })

    child.stdin.write(opts.prompt)
    child.stdin.end()

    const stderrChunks: string[] = []
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk.toString()))

    try {
      for await (const line of createInterface({ input: child.stdout })) {
        const events = parseStreamJsonLine(line)
        for (const event of events) yield event
      }
    } finally {
      opts.abortSignal.removeEventListener('abort', killTree)
    }

    const exitCode = await waitForExit(child)
    if (exitCode !== 0 && !opts.abortSignal.aborted) {
      const stderr = stderrChunks.join('').trim()
      if (stderr) yield { type: 'error', message: stderr.slice(0, 4000) }
    }
    // The 'result' stream event already carried resultText/cost when the
    // run succeeded; this final event marks process termination.
    yield { type: 'done', exitCode: exitCode ?? -1 }
  }
}

function waitForExit(child: ChildProcess): Promise<number | null> {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode)
  return new Promise((resolve) => child.once('exit', (code) => resolve(code)))
}

// One stream-json line -> zero or more normalized events. Exported for
// unit testing against captured CLI output.
export function parseStreamJsonLine(line: string): AgentEvent[] {
  const trimmed = line.trim()
  if (!trimmed) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return [{ type: 'text', content: trimmed }]
  }
  const msg = parsed as Record<string, unknown>
  const events: AgentEvent[] = []

  if (msg.type === 'system' && msg.subtype === 'init') {
    const model = typeof msg.model === 'string' ? msg.model : 'unknown model'
    events.push({ type: 'text', content: `· session started (${model})` })
  } else if (msg.type === 'assistant') {
    const message = msg.message as { content?: unknown[] } | undefined
    for (const block of message?.content ?? []) {
      const b = block as Record<string, unknown>
      if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
        events.push({ type: 'text', content: b.text })
      } else if (b.type === 'tool_use' && typeof b.name === 'string') {
        const input = (b.input ?? {}) as Record<string, unknown>
        events.push({
          type: 'tool_use',
          name: b.name,
          detail: JSON.stringify(input).slice(0, 500),
        })
        const kind = FILE_TOOLS[b.name]
        if (kind && typeof input.file_path === 'string') {
          events.push({ type: 'file_change', path: input.file_path, kind })
        }
      }
    }
  } else if (msg.type === 'result') {
    events.push({
      type: 'done',
      exitCode: msg.subtype === 'success' ? 0 : 1,
      costUsd: typeof msg.total_cost_usd === 'number' ? msg.total_cost_usd : undefined,
      resultText: typeof msg.result === 'string' ? msg.result : undefined,
    })
  }
  // system/init and user messages carry no user-facing signal — skipped.
  return events
}
