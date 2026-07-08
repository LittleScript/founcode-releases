// Agent adapter contract — TDD §4.1. Every CLI agent is wrapped in one
// of these; the rest of the app only ever sees normalized AgentEvents.

import type { PermissionLevel } from '../../shared/settings-types'
import type { AgentEvent } from '../../shared/types'

export type { PermissionLevel }

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
  // Optional model alias/id passed to the agent CLI; empty/undefined =
  // the CLI's own default.
  model?: string
}

export interface AgentDetection {
  installed: boolean
  version?: string
}

export interface InteractiveLaunch {
  // The actual process to spawn under a PTY.
  file: string
  args: string[]
  // Extra env for this launch (merged over process.env).
  env?: Record<string, string>
}

export interface InteractiveLaunchOptions {
  cwd: string
  permission: PermissionLevel
  model?: string
  // Seeds the agent's first turn (used when taking over a task so the
  // agent knows what it's continuing). App-generated, kept short & safe.
  initialPrompt?: string
}

// Optional capability: an agent that can run as a live, interactive
// terminal session (attached to a PTY) rather than one-shot batch.
export interface InteractiveAgent {
  readonly supportsInteractive: true
  // Returns the launch spec, or null when the CLI is not on PATH.
  launchInteractive(opts: InteractiveLaunchOptions): InteractiveLaunch | null
}

export function isInteractive(a: AgentAdapter): a is AgentAdapter & InteractiveAgent {
  return (a as Partial<InteractiveAgent>).supportsInteractive === true
}

export interface AgentAdapter {
  readonly id: string
  readonly displayName: string
  detect(): Promise<AgentDetection>
  run(opts: AgentRunOptions): AsyncIterable<AgentEvent>
}
