import { describe, expect, it } from 'vitest'
import type { AgentRunOptions } from '../src/main/agents/AgentAdapter'
import { AgentRegistry } from '../src/main/agents/AgentRegistry'
import { CodexAdapter } from '../src/main/agents/codex/CodexAdapter'
import { GeminiAdapter } from '../src/main/agents/gemini/GeminiAdapter'
import { OpenCodeAdapter } from '../src/main/agents/opencode/OpenCodeAdapter'

function opts(mode: AgentRunOptions['mode'], model?: string): AgentRunOptions {
  return { cwd: 'C:/x', prompt: 'p', mode, model, abortSignal: new AbortController().signal }
}

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

describe('GeminiAdapter invocation', () => {
  const a = new GeminiAdapter()
  it('maps read to default approval and write/verify to yolo, prompt via stdin', () => {
    expect(a.invocation(opts('read')).args).toEqual(['--approval-mode', 'default'])
    expect(a.invocation(opts('write')).args).toEqual(['--approval-mode', 'yolo'])
    expect(a.invocation(opts('read')).promptVia).toBe('stdin')
  })
  it('passes -m model', () => {
    expect(a.invocation(opts('read', 'gemini-2.5-pro')).args).toEqual([
      '-m',
      'gemini-2.5-pro',
      '--approval-mode',
      'default',
    ])
  })
})

describe('AgentRegistry defaults', () => {
  it('registers all five agents', () => {
    const registry = new AgentRegistry()
    for (const id of ['claude-code', 'opencode', 'codex', 'gemini', 'mock']) {
      expect(registry.get(id), id).toBeDefined()
    }
  })
})
