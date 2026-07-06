// Google Antigravity CLI — the successor to Gemini CLI (which Google
// retired on 2026-06-18). Binary is `av` (some builds shipped as `agy`);
// we detect either. Headless generation: `av gen --stream-format=plain`.
//
// NOTE: built against the documented migration contract; the CLI is not
// installed on the dev machine yet, so flags are best-effort until the
// gated integration test can run. No sandbox/approval flags are
// documented — write/verify modes rely on prompt discipline inside the
// isolated worktree.

import type { AgentRunOptions } from '../AgentAdapter'
import { type ResolvedCli, resolveCli } from '../cliResolver'
import { type CliInvocation, TextCliAdapter } from '../TextCliAdapter'

export class AntigravityAdapter extends TextCliAdapter {
  readonly id = 'antigravity'
  readonly displayName = 'Antigravity (Google)'
  protected readonly cliName = 'av'

  private dualResolved: ResolvedCli | null | undefined

  protected override resolve(): ResolvedCli | null {
    if (this.dualResolved === undefined) {
      this.dualResolved = resolveCli('av') ?? resolveCli('agy')
    }
    return this.dualResolved
  }

  invocation(opts: AgentRunOptions): CliInvocation {
    const args = ['gen', '--stream-format=plain']
    if (opts.model) args.push('--model', opts.model)
    // Installed via Google's installer (real exe, not an npm shim), so a
    // positional prompt is argv-safe.
    return { args, promptVia: 'arg' }
  }
}
