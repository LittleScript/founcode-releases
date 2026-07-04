// Agent adapter contract — TDD §4.1. Every CLI agent is wrapped in one
// of these; the rest of the app only ever sees normalized AgentEvents.

import type { AgentEvent } from '../../shared/types'

export interface AgentRunOptions {
  cwd: string
  prompt: string
  // Plan phase runs read-only: the agent must not write files.
  readOnly: boolean
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
