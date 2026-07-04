// Deterministic fake agent for UI development and tests — no CLI, no
// credits. Special markers in the prompt steer its behavior:
//   [mock:invalid]  -> emit a malformed plan (exercises the re-prompt path)
//   [mock:fail]     -> exit non-zero (exercises the failure path)

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import type { AgentEvent } from '../../../shared/types'
import type { AgentAdapter, AgentRunOptions } from '../AgentAdapter'

function buildValidPlan(prompt: string): string {
  const intentLine = prompt.split('\n').find((l) => l.trim().length > 0) ?? 'the requested change'
  return [
    '# Plan: Mock implementation plan',
    '',
    '## Summary',
    `This is a mock plan responding to: ${intentLine.slice(0, 120)}`,
    'It exists so the UI and orchestrator can be developed without a real agent.',
    '',
    '## Files Touched',
    '| File | Action | Reason |',
    '|------|--------|--------|',
    '| src/example.ts | edit | Demonstrate the plan format |',
    '',
    '## Implementation Steps',
    '1. Open src/example.ts and apply the requested change.',
    '2. Update related unit tests.',
    '',
    '## Risks & Notes',
    '- Mock plan: no real analysis was performed.',
    '',
    '## Verification Criteria',
    '- [ ] The requested change is present in src/example.ts',
    '- [ ] All existing tests still pass',
  ].join('\n')
}

export class MockAgentAdapter implements AgentAdapter {
  readonly id = 'mock'
  readonly displayName = 'Mock Agent (testing)'

  // Configurable delay so tests can run instantly.
  constructor(private stepDelayMs = 300) {}

  async detect() {
    return { installed: true, version: 'mock-1.0' }
  }

  async *run(opts: AgentRunOptions): AsyncIterable<AgentEvent> {
    const steps = ['Reading project structure…', 'Analyzing the request…', 'Drafting the plan…']
    for (const step of steps) {
      if (opts.abortSignal.aborted) return
      yield { type: 'text', content: step }
      await sleep(this.stepDelayMs, undefined, { signal: opts.abortSignal }).catch(() => {})
      if (opts.abortSignal.aborted) return
    }

    if (opts.prompt.includes('[mock:fail]')) {
      yield { type: 'error', message: 'Mock agent simulated failure' }
      yield { type: 'done', exitCode: 1 }
      return
    }

    if (!opts.readOnly) {
      // Execution mode: actually produce a change so the diff pipeline
      // has something real to show.
      const file = join(opts.cwd, 'mock-execution.txt')
      writeFileSync(file, `Mock execution output\nPrompt excerpt: ${opts.prompt.slice(0, 80)}\n`)
      yield { type: 'file_change', path: file, kind: 'create' }
      const resultText = 'Implemented the plan: created mock-execution.txt as requested.'
      yield { type: 'text', content: resultText }
      yield { type: 'done', exitCode: 0, costUsd: 0, resultText }
      return
    }

    const resultText = opts.prompt.includes('[mock:invalid]')
      ? 'Sorry, here is some prose that is not a valid Founcode plan at all.'
      : buildValidPlan(opts.prompt)

    yield { type: 'text', content: resultText }
    yield { type: 'done', exitCode: 0, costUsd: 0, resultText }
  }
}
