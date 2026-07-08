import { describe, expect, it } from 'vitest'
import { isInteractive } from '../src/main/agents/AgentAdapter'
import { AntigravityAdapter } from '../src/main/agents/antigravity/AntigravityAdapter'
import { ClaudeCodeAdapter } from '../src/main/agents/claude/ClaudeCodeAdapter'
import { CodexAdapter } from '../src/main/agents/codex/CodexAdapter'
import { MockAgentAdapter } from '../src/main/agents/mock/MockAgentAdapter'
import { OpenCodeAdapter } from '../src/main/agents/opencode/OpenCodeAdapter'

describe('interactive capability', () => {
  it('the four real agents support interactive; Mock does not', () => {
    expect(isInteractive(new ClaudeCodeAdapter())).toBe(true)
    expect(isInteractive(new OpenCodeAdapter())).toBe(true)
    expect(isInteractive(new CodexAdapter())).toBe(true)
    expect(isInteractive(new AntigravityAdapter())).toBe(true)
    expect(isInteractive(new MockAgentAdapter())).toBe(false)
  })
})

describe('TextCli agents launchInteractive (when installed)', () => {
  it('Codex maps permission to --sandbox', () => {
    const a = new CodexAdapter()
    const safe = a.launchInteractive({ cwd: 'C:/x', permission: 'safe' })
    if (safe) {
      expect(safe.args).not.toContain('exec')
      expect(safe.args.join(' ')).toContain('--sandbox read-only')
    }
    const full = a.launchInteractive({ cwd: 'C:/x', permission: 'full' })
    if (full) expect(full.args.join(' ')).toContain('--sandbox danger-full-access')
  })

  it('OpenCode maps safe→plan agent, else build; passes --model', () => {
    const a = new OpenCodeAdapter()
    const safe = a.launchInteractive({ cwd: 'C:/x', permission: 'safe', model: 'zhipu/glm-5' })
    if (safe) {
      expect(safe.args.join(' ')).toContain('--agent plan')
      expect(safe.args).toContain('zhipu/glm-5')
    }
    const auto = a.launchInteractive({ cwd: 'C:/x', permission: 'auto' })
    if (auto) expect(auto.args.join(' ')).toContain('--agent build')
  })

  it('Antigravity maps permission to --approval-mode', () => {
    const a = new AntigravityAdapter()
    const full = a.launchInteractive({ cwd: 'C:/x', permission: 'full' })
    if (full) expect(full.args.join(' ')).toContain('--approval-mode yolo')
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
