// Base for "simple" CLI agents (OpenCode, Codex, Gemini): plain-text
// stdout, no rich event stream. Each stdout line becomes a text event;
// the full output becomes resultText on done — which is all the
// plan/PRD/verdict parsers need. (Claude Code keeps its richer
// stream-json adapter.)

import { type ChildProcess, spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { AgentEvent } from '../../shared/types'
import type {
  AgentAdapter,
  AgentDetection,
  AgentRunOptions,
  InteractiveLaunch,
} from './AgentAdapter'
import { detectVersion, killTree, type ResolvedCli, resolveCli } from './cliResolver'

// CLIs color their output; ANSI escapes leaked into chat bubbles as
// "←[91m…" (QA finding). Strip them from every surfaced line.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching the ESC byte is the point
const ANSI_RE = /[][[\]()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-nqry=><]/g

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '')
}

export interface CliInvocation {
  args: string[]
  // 'stdin': write the prompt to stdin. 'arg': append as the final argv
  // element (only safe without a cmd.exe shim).
  promptVia: 'stdin' | 'arg'
}

export abstract class TextCliAdapter implements AgentAdapter {
  abstract readonly id: string
  abstract readonly displayName: string
  protected abstract readonly cliName: string
  protected versionFlag = '--version'

  abstract invocation(opts: AgentRunOptions): CliInvocation

  private resolved: ResolvedCli | null | undefined

  protected resolve(): ResolvedCli | null {
    if (this.resolved === undefined) this.resolved = resolveCli(this.cliName)
    return this.resolved
  }

  async detect(): Promise<AgentDetection> {
    const cli = this.resolve()
    if (!cli) return { installed: false }
    const version = detectVersion(cli, this.versionFlag)
    return version ? { installed: true, version } : { installed: false }
  }

  // Builds an interactive launch from the resolved CLI + subclass args.
  // The prompt-injection concern of batch mode doesn't apply here: an
  // interactive session takes keystrokes over the PTY, not a prompt on
  // argv, so the cmd.exe shim path is safe.
  protected buildInteractiveLaunch(interactiveArgs: string[]): InteractiveLaunch | null {
    const cli = this.resolve()
    if (!cli) return null
    return { file: cli.file, args: [...cli.prefixArgs, ...interactiveArgs] }
  }

  async *run(opts: AgentRunOptions): AsyncIterable<AgentEvent> {
    const cli = this.resolve()
    if (!cli) {
      yield { type: 'error', message: `${this.displayName} CLI not found on PATH` }
      yield { type: 'done', exitCode: -1 }
      return
    }

    const { args, promptVia } = this.invocation(opts)
    if (promptVia === 'arg' && cli.viaShell) {
      // cmd.exe would re-parse the prompt — refuse rather than risk it.
      yield {
        type: 'error',
        message: `${this.displayName} was found only as an npm shim; reinstall it so its real executable is available.`,
      }
      yield { type: 'done', exitCode: -1 }
      return
    }

    const argv = [...cli.prefixArgs, ...args]
    if (promptVia === 'arg') argv.push(opts.prompt)

    const child = spawn(cli.file, argv, {
      cwd: opts.cwd,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...opts.env },
    })

    const onAbort = () => killTree(child.pid)
    opts.abortSignal.addEventListener('abort', onAbort, { once: true })

    if (promptVia === 'stdin') child.stdin.write(opts.prompt)
    child.stdin.end()

    const stderrChunks: string[] = []
    child.stderr.on('data', (c: Buffer) => stderrChunks.push(c.toString()))

    const outLines: string[] = []
    try {
      for await (const rawLine of createInterface({ input: child.stdout })) {
        const line = stripAnsi(rawLine)
        outLines.push(line)
        if (line.trim()) yield { type: 'text', content: line }
      }
    } finally {
      opts.abortSignal.removeEventListener('abort', onAbort)
    }

    const exitCode = await waitForExit(child)
    if (exitCode !== 0 && !opts.abortSignal.aborted) {
      const stderr = stripAnsi(stderrChunks.join('')).trim()
      if (stderr) yield { type: 'error', message: stderr.slice(0, 4000) }
    }
    yield {
      type: 'done',
      exitCode: exitCode ?? -1,
      resultText: outLines.join('\n').trim() || undefined,
    }
  }
}

function waitForExit(child: ChildProcess): Promise<number | null> {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode)
  return new Promise((resolve) => child.once('exit', (code) => resolve(code)))
}
