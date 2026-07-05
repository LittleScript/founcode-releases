// OpenAI Codex CLI. Non-interactive mode: `codex exec` — reads the
// prompt from stdin when the positional is "-" (always used here so the
// npm .cmd shim path stays injection-safe).
//
// Sandbox maps our modes: read -> read-only, write/verify ->
// workspace-write (the worktree is isolated; verify needs to run tests).

import type { AgentRunOptions } from '../AgentAdapter'
import { type CliInvocation, TextCliAdapter } from '../TextCliAdapter'

export class CodexAdapter extends TextCliAdapter {
  readonly id = 'codex'
  readonly displayName = 'Codex (OpenAI)'
  protected readonly cliName = 'codex'

  invocation(opts: AgentRunOptions): CliInvocation {
    const args = [
      'exec',
      '--skip-git-repo-check',
      '--sandbox',
      opts.mode === 'read' ? 'read-only' : 'workspace-write',
    ]
    if (opts.model) args.push('--model', opts.model)
    args.push('-') // read the prompt from stdin
    return { args, promptVia: 'stdin' }
  }
}
