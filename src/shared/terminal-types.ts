// Agent Terminal — shared types (renderer-safe, no Node/native imports).

import type { PermissionLevel } from './settings-types'

export interface TerminalSession {
  id: string
  agentId: string
  projectId: string
  cwd: string
  permission: PermissionLevel
  model: string | null
  // Set once the process exits.
  exitCode: number | null
  createdAt: number
}

export interface StartTerminalInput {
  projectId: string
  agentId: string
  permission: PermissionLevel
  model?: string
  // Work in an isolated worktree (default) or directly in the repo.
  isolate?: boolean
}
