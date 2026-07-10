// Integration test against the REAL Antigravity CLI. Gated:
//   FOUNCODE_IT=1 npx vitest run tests/antigravity-adapter.integration.test.ts

import { describe, expect, it } from 'vitest'
import { AntigravityAdapter } from '../src/main/agents/antigravity/AntigravityAdapter'

const enabled = process.env.FOUNCODE_IT === '1'

describe.skipIf(!enabled)('AntigravityAdapter (real CLI)', () => {
  it('detects the installed CLI', async () => {
    const adapter = new AntigravityAdapter()
    const detection = await adapter.detect()
    expect(detection.installed).toBe(true)
    expect(detection.version).toBeTruthy()
  }, 30_000)

  it('runs a trivial prompt and yields done with result text', async () => {
    const adapter = new AntigravityAdapter()
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
    const done = events.find((e) => e.type === 'done')
    expect(done && done.type === 'done' ? done.exitCode : -1).toBe(0)
    const text = done && done.type === 'done' ? (done.resultText ?? '') : ''
    expect(text.toLowerCase()).toContain('pong')
  }, 180_000)
})
