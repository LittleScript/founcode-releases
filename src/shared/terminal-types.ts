// Agent Terminal — shared types (renderer-safe, no Node/native imports).

import type { PermissionLevel } from './settings-types'

export interface TerminalSession {
  id: string
  agentId: string
  projectId: string
  cwd: string
  permission: PermissionLevel
  model: string | null
  // True when the session runs in an isolated git worktree (default);
  // false when it works directly in the repo (or in a task's worktree).
  isolated: boolean
  // Set when this terminal took over an existing pipeline task's
  // worktree (bridge from pipeline → terminal). Back-nav returns here.
  taskId: string | null
  // Set once the process exits.
  exitCode: number | null
  createdAt: number
}

// Result of finishing an isolated session: what the agent changed.
export interface TerminalReview {
  changed: boolean
  diff: string
  filesChanged: number
}

export interface StartTerminalInput {
  projectId: string
  agentId: string
  permission: PermissionLevel
  model?: string
  // Work in an isolated worktree (default) or directly in the repo.
  isolate?: boolean
}
