// Integration test against the REAL Claude Code CLI. Costs real usage,
// so it only runs when explicitly requested:
//   FOUNCODE_IT=1 npm test -- claude-adapter.integration

import { describe, expect, it } from 'vitest'
import { ClaudeCodeAdapter } from '../src/main/agents/claude/ClaudeCodeAdapter'

const enabled = process.env.FOUNCODE_IT === '1'

describe.skipIf(!enabled)('ClaudeCodeAdapter (real CLI)', () => {
  it('detects the installed CLI', async () => {
    const adapter = new ClaudeCodeAdapter()
    const detection = await adapter.detect()
    expect(detection.installed).toBe(true)
    expect(detection.version).toBeTruthy()
  }, 30_000)

  it('runs a trivial prompt and yields a done event with result text', async () => {
    const adapter = new ClaudeCodeAdapter()
    const controller = new AbortController()
    const events = []
    for await (const event of adapter.run({
      cwd: process.cwd(),
      prompt: 'Reply with exactly the word: pong',
      mode: 'read',
      abortSignal: controller.signal,
    })) {
      events.push(event)
    }
    const done = events.filter((e) => e.type === 'done')
    expect(done.length).toBeGreaterThan(0)
    const result = done.find((e) => e.type === 'done' && e.resultText)
    expect(result && result.type === 'done' ? result.resultText : '').toContain('pong')
  }, 120_000)
})
