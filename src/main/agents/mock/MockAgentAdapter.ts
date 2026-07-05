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
  // The real plan prompt wraps the user's intent under an "Intent:"
  // header; quote the actual intent so downstream phases (and their
  // [mock:*] markers) see it.
  const intentMatch = prompt.match(/Intent:\s*\n([^\n]+)/)
  const intentLine =
    intentMatch?.[1]?.trim() ??
    prompt.split('\n').find((l) => l.trim().length > 0) ??
    'the requested change'
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

function fence(obj: unknown): string {
  return `Here is the result.\n\n\`\`\`json\n${JSON.stringify(obj, null, 2)}\n\`\`\`\n`
}

function buildBlueprintOutput(kind: string, prompt = ''): string {
  switch (kind) {
    case 'questions':
      return fence({
        questions: [
          { question: 'Who is the primary user?', options: ['Customer', 'Admin'], allowSkip: true },
          {
            question: 'First success moment?',
            options: ['See list', 'Book a slot', 'Pay'],
            allowSkip: true,
          },
        ],
        suggestions: ['Add a loyalty program.', 'Send WhatsApp reminders.'],
      })
    case 'structure':
      return fence({
        features: [
          {
            name: 'Browse',
            priority: 'high',
            description: 'View listings',
            subFeatures: [{ name: 'List page' }, { name: 'Detail page' }],
          },
          {
            name: 'Booking',
            priority: 'high',
            description: 'Reserve a slot',
            subFeatures: [{ name: 'Pick slot' }, { name: 'Pay' }],
          },
        ],
      })
    case 'tasks':
      return fence({
        tasks: [
          {
            title: 'Scaffold project',
            intent: 'Set up the base app structure with routing.',
            feature: 'Browse',
            priority: 'high',
          },
          {
            title: 'Build list page',
            intent: 'Create the listing page with mock data.',
            feature: 'Browse',
            priority: 'high',
          },
        ],
      })
    case 'chat': {
      // Conversational reply; if the user message carried a change marker,
      // append the updated artifact after the right delimiter.
      const reply = 'Sure — here is my answer to your question about the plan.'
      if (prompt.includes('[mock:change-structure]')) {
        return `${reply}\n===STRUCTURE===\n\`\`\`json\n${JSON.stringify({
          features: [{ name: 'Revised', priority: 'high', subFeatures: [{ name: 'New sub' }] }],
        })}\n\`\`\`\n`
      }
      if (prompt.includes('[mock:change-prd]')) {
        return `${reply}\n===PRD===\n# PRD — Revised\n\nUpdated per your request.\n`
      }
      return reply
    }
    default:
      // prd / revise -> markdown, not json
      return '# PRD — Mock Product\n\n## Overview\nA mock PRD generated for testing.\n\n## Tech Stack\nNext.js, SQLite.\n'
  }
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

    if (opts.mode === 'write') {
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

    // Blueprint generative steps route on the founcode:gen marker the
    // prompt templates carry.
    const gen = opts.prompt.match(/founcode:gen=(\w+)/)?.[1]
    if (gen) {
      const resultText = buildBlueprintOutput(gen, opts.prompt)
      yield { type: 'text', content: resultText }
      yield { type: 'done', exitCode: 0, costUsd: 0, resultText }
      return
    }

    if (opts.mode === 'verify') {
      const fail = opts.prompt.includes('[mock:verify-fail]')
      const verdict = {
        verdict: fail ? 'fail' : 'pass',
        criteria: [
          {
            criterion: 'The requested change is present',
            status: fail ? 'fail' : 'pass',
            note: fail ? 'Mock simulated failure' : 'Mock verified',
          },
          { criterion: 'All existing tests still pass', status: 'pass' },
        ],
        tests: { detected: false },
        ...(fail ? { fix_instructions: 'Mock fix instructions: correct the change.' } : {}),
      }
      const resultText = `# Verification Report\n\nMock verification complete.\n\n\`\`\`json\n${JSON.stringify(verdict, null, 2)}\n\`\`\`\n`
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
