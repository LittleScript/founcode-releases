import { describe, expect, it } from 'vitest'
import type { AgentRunOptions } from '../src/main/agents/AgentAdapter'
import { AgentRegistry } from '../src/main/agents/AgentRegistry'
import { AntigravityAdapter } from '../src/main/agents/antigravity/AntigravityAdapter'
import { CodexAdapter } from '../src/main/agents/codex/CodexAdapter'
import { OpenCodeAdapter } from '../src/main/agents/opencode/OpenCodeAdapter'
import { stripAnsi } from '../src/main/agents/TextCliAdapter'

function opts(mode: AgentRunOptions['mode'], model?: string): AgentRunOptions {
  return { cwd: 'C:/x', prompt: 'p', mode, model, abortSignal: new AbortController().signal }
}

describe('stripAnsi', () => {
  it('removes color escapes that leaked into chat bubbles', () => {
    expect(stripAnsi('[91m[1mError: [0mModel not found')).toBe('Error: Model not found')
    expect(stripAnsi('plain text')).toBe('plain text')
  })
})

describe('OpenCodeAdapter invocation', () => {
  const a = new OpenCodeAdapter()
  it('maps read mode to the plan agent, others to build', () => {
    expect(a.invocation(opts('read')).args).toEqual(['run', '--agent', 'plan'])
    expect(a.invocation(opts('write')).args).toEqual(['run', '--agent', 'build'])
    expect(a.invocation(opts('verify')).args).toEqual(['run', '--agent', 'build'])
  })
  it('passes provider/model and uses positional prompt', () => {
    const inv = a.invocation(opts('write', 'deepseek/deepseek-v4'))
    expect(inv.args).toEqual(['run', '--model', 'deepseek/deepseek-v4', '--agent', 'build'])
    expect(inv.promptVia).toBe('arg')
  })
})

describe('CodexAdapter invocation', () => {
  const a = new CodexAdapter()
  it('maps modes to sandbox levels and reads the prompt from stdin', () => {
    const read = a.invocation(opts('read'))
    expect(read.args).toEqual(['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '-'])
    expect(read.promptVia).toBe('stdin')
    expect(a.invocation(opts('write')).args).toContain('workspace-write')
  })
  it('passes the model flag before the stdin positional', () => {
    const inv = a.invocation(opts('write', 'gpt-5-codex'))
    expect(inv.args.at(-1)).toBe('-')
    expect(inv.args).toContain('--model')
  })
})

describe('AntigravityAdapter invocation', () => {
  const a = new AntigravityAdapter()
  it('uses av gen with plain streaming and a positional prompt', () => {
    const inv = a.invocation(opts('read'))
    expect(inv.args).toEqual(['gen', '--stream-format=plain'])
    expect(inv.promptVia).toBe('arg')
  })
  it('passes --model', () => {
    expect(a.invocation(opts('write', 'gemini-3-pro')).args).toEqual([
      'gen',
      '--stream-format=plain',
      '--model',
      'gemini-3-pro',
    ])
  })
})

describe('AgentRegistry defaults', () => {
  it('ships the four production agents; mock is dev-only via register()', async () => {
    const registry = new AgentRegistry()
    for (const id of ['claude-code', 'opencode', 'codex', 'antigravity']) {
      expect(registry.get(id), id).toBeDefined()
    }
    expect(registry.get('gemini')).toBeUndefined()
    expect(registry.get('mock')).toBeUndefined()

    const { MockAgentAdapter } = await import('../src/main/agents/mock/MockAgentAdapter')
    registry.register(new MockAgentAdapter())
    expect(registry.get('mock')).toBeDefined()
  })
})
