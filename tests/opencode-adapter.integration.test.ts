// Integration test against the REAL OpenCode CLI (whatever provider the
// user has configured). Tiny prompt, but still real usage — gated:
//   FOUNCODE_IT=1 npx vitest run tests/opencode-adapter.integration.test.ts

import { describe, expect, it } from 'vitest'
import { OpenCodeAdapter } from '../src/main/agents/opencode/OpenCodeAdapter'

const enabled = process.env.FOUNCODE_IT === '1'

describe.skipIf(!enabled)('OpenCodeAdapter (real CLI)', () => {
  it('detects the installed CLI', async () => {
    const adapter = new OpenCodeAdapter()
    const detection = await adapter.detect()
    expect(detection.installed).toBe(true)
    expect(detection.version).toBeTruthy()
  }, 30_000)

  it('runs a trivial prompt and yields done with result text', async () => {
    const adapter = new OpenCodeAdapter()
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
