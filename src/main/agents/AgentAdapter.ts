// Agent adapter contract — TDD §4.1. Every CLI agent is wrapped in one
// of these; the rest of the app only ever sees normalized AgentEvents.

import type { AgentEvent } from '../../shared/types'

// Capability mode per phase:
//   read   — Plan: only reads/searches files, cannot write or run commands
//   write  — Execute: edits files and runs commands
//   verify — Verify: reads files and runs commands (tests), cannot edit
export type AgentRunMode = 'read' | 'write' | 'verify'

export interface AgentRunOptions {
  cwd: string
  prompt: string
  mode: AgentRunMode
  abortSignal: AbortSignal
}

export interface AgentDetection {
  installed: boolean
  version?: string
}

export interface AgentAdapter {
  readonly id: string
  readonly displayName: string
  detect(): Promise<AgentDetection>
  run(opts: AgentRunOptions): AsyncIterable<AgentEvent>
}
