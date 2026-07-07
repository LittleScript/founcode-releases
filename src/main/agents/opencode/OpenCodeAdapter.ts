// OpenCode — the model-agnostic gateway (GLM, DeepSeek, Qwen, Kimi,
// Mistral, local Ollama, 75+ providers). Model format: "provider/model",
// e.g. "zhipu/glm-5" or "deepseek/deepseek-v4".
//
// Invocation: `opencode run [message..]` with:
//   --agent plan   (read-only-ish agent)   for read mode
//   --agent build  (default working agent) for write/verify
//   --model provider/model
// The prompt travels as the positional message (safe: cliResolver finds
// the real opencode.exe inside node_modules, so no cmd.exe re-parsing).

import { spawnSync } from 'node:child_process'
import type { AgentRunOptions } from '../AgentAdapter'
import { type CliInvocation, stripAnsi, TextCliAdapter } from '../TextCliAdapter'

export class OpenCodeAdapter extends TextCliAdapter {
  readonly id = 'opencode'
  readonly displayName = 'OpenCode'
  protected readonly cliName = 'opencode'

  // The REAL model catalog straight from the CLI (`opencode models`) —
  // curated suggestions went stale within a day (QA: "Model not found").
  listModels(): string[] {
    const cli = this.resolve()
    if (!cli) return []
    const result = spawnSync(cli.file, [...cli.prefixArgs, 'models'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
    })
    if (result.status !== 0) return []
    return stripAnsi(result.stdout)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^[\w.-]+\/[\w.@:/-]+$/.test(l))
  }

  invocation(opts: AgentRunOptions): CliInvocation {
    const args = ['run']
    if (opts.model) args.push('--model', opts.model)
    // plan agent for read-only analysis; build agent does the work.
    // Verify runs in the isolated worktree with prompt discipline.
    args.push('--agent', opts.mode === 'read' ? 'plan' : 'build')
    return { args, promptVia: 'arg' }
  }
}
