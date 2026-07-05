// Google Gemini CLI. Non-interactive: piped stdin becomes the prompt.
// Approval modes map our modes: read -> default (write tools are denied
// non-interactively), write/verify -> yolo (auto-approve; the worktree
// is isolated and verify needs to run tests).

import type { AgentRunOptions } from '../AgentAdapter'
import { type CliInvocation, TextCliAdapter } from '../TextCliAdapter'

export class GeminiAdapter extends TextCliAdapter {
  readonly id = 'gemini'
  readonly displayName = 'Gemini CLI'
  protected readonly cliName = 'gemini'

  invocation(opts: AgentRunOptions): CliInvocation {
    const args: string[] = []
    if (opts.model) args.push('-m', opts.model)
    args.push('--approval-mode', opts.mode === 'read' ? 'default' : 'yolo')
    return { args, promptVia: 'stdin' }
  }
}
