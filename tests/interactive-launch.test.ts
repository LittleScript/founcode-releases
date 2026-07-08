import { describe, expect, it } from 'vitest'
import { isInteractive } from '../src/main/agents/AgentAdapter'
import { ClaudeCodeAdapter } from '../src/main/agents/claude/ClaudeCodeAdapter'
import { MockAgentAdapter } from '../src/main/agents/mock/MockAgentAdapter'

describe('interactive capability', () => {
  it('Claude Code advertises interactive support; Mock does not', () => {
    expect(isInteractive(new ClaudeCodeAdapter())).toBe(true)
    expect(isInteractive(new MockAgentAdapter())).toBe(false)
  })
})

describe('Claude Code launchInteractive', () => {
  const adapter = new ClaudeCodeAdapter()

  // resolve() returns null when the CLI isn't installed on this machine;
  // the arg-mapping assertions only run when it is.
  const base = { cwd: 'C:/x' }

  it('maps permission levels to Claude flags (no -p = interactive REPL)', () => {
    const safe = adapter.launchInteractive({ ...base, permission: 'safe' })
    if (safe) {
      expect(safe.args).not.toContain('-p')
      expect(safe.args.join(' ')).toContain('--permission-mode plan')
    }
    const auto = adapter.launchInteractive({ ...base, permission: 'auto' })
    if (auto) expect(auto.args.join(' ')).toContain('--permission-mode acceptEdits')

    const full = adapter.launchInteractive({ ...base, permission: 'full' })
    if (full) expect(full.args).toContain('--dangerously-skip-permissions')
  })

  it('passes --model when set', () => {
    const withModel = adapter.launchInteractive({ ...base, permission: 'auto', model: 'opus' })
    if (withModel) {
      expect(withModel.args).toContain('--model')
      expect(withModel.args).toContain('opus')
    }
  })
})
