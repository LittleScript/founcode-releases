import { describe, expect, it } from 'vitest'
import { parseStreamJsonLine } from '../src/main/agents/claude/ClaudeCodeAdapter'

describe('parseStreamJsonLine', () => {
  it('ignores empty lines', () => {
    expect(parseStreamJsonLine('')).toEqual([])
  })

  it('maps system init to a session-started text event', () => {
    expect(
      parseStreamJsonLine('{"type":"system","subtype":"init","model":"claude-fable-5"}'),
    ).toEqual([{ type: 'text', content: '· session started (claude-fable-5)' }])
    expect(parseStreamJsonLine('{"type":"system","subtype":"other"}')).toEqual([])
  })

  it('passes through non-JSON lines as text', () => {
    expect(parseStreamJsonLine('plain output')).toEqual([{ type: 'text', content: 'plain output' }])
  })

  it('maps assistant text blocks', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Analyzing…' }] },
    })
    expect(parseStreamJsonLine(line)).toEqual([{ type: 'text', content: 'Analyzing…' }])
  })

  it('maps tool_use blocks, adding file_change for file tools', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', name: 'Edit', input: { file_path: 'C:/x/a.ts', old_string: 'a' } },
        ],
      },
    })
    const events = parseStreamJsonLine(line)
    expect(events[0]).toMatchObject({ type: 'tool_use', name: 'Edit' })
    expect(events[1]).toEqual({ type: 'file_change', path: 'C:/x/a.ts', kind: 'edit' })
  })

  it('maps the result message to done with cost and text', () => {
    const line = JSON.stringify({
      type: 'result',
      subtype: 'success',
      total_cost_usd: 0.0123,
      result: '# Plan: X',
    })
    expect(parseStreamJsonLine(line)).toEqual([
      { type: 'done', exitCode: 0, costUsd: 0.0123, resultText: '# Plan: X' },
    ])
  })

  it('maps failed results to non-zero exit', () => {
    const line = JSON.stringify({ type: 'result', subtype: 'error_during_execution' })
    expect(parseStreamJsonLine(line)[0]).toMatchObject({ type: 'done', exitCode: 1 })
  })
})
