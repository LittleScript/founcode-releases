// Domain types shared between main and renderer.
// Single source of truth — TDD §5.

import type { PermissionLevel } from './settings-types'

export const TASK_STATES = [
  'BACKLOG',
  'PLANNING',
  'AWAITING_APPROVAL',
  'EXECUTING',
  'VERIFYING',
  'REVIEW',
  'DONE',
  'DISCARDED',
  'FAILED',
] as const

export type TaskState = (typeof TASK_STATES)[number]

export interface Project {
  id: string
  name: string
  path: string
  createdAt: number
}

export interface Task {
  id: string
  projectId: string
  title: string
  intent: string
  agentId: string
  state: TaskState
  branch: string | null
  worktree: string | null
  baseRef: string | null
  blueprintId: string | null
  orderIndex: number | null
  model: string | null
  // Built-in Founcode skill applied to this task's plan+execute prompts.
  skill: string | null
  permission: PermissionLevel
  // JSON array of task IDs that must be DONE before this task can start.
  dependsOn: string[] | null
  retryCount: number
  createdAt: number
  updatedAt: number
}

export const ARTIFACT_KINDS = ['plan', 'plan_revision', 'diff', 'verify_report', 'log'] as const

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number]

export interface Artifact {
  id: string
  taskId: string
  kind: ArtifactKind
  content: string
  createdAt: number
}

// Global artifacts browser: artifact metadata + owning task/project
// (content excluded — listing 100s of diffs would be heavy; fetch the
// full artifact via task:artifacts when opened).
export interface ArtifactSummary {
  id: string
  taskId: string
  kind: ArtifactKind
  preview: string
  createdAt: number
  taskTitle: string
  projectId: string
  projectName: string
}

export interface AgentInfo {
  id: string
  displayName: string
  installed: boolean
  version?: string
}

// Founcode Verdict — output of the Verify phase. TDD §5.4.
export type VerdictStatus = 'pass' | 'pass_with_warnings' | 'fail'

export interface VerdictCriterion {
  criterion: string
  status: 'pass' | 'fail' | 'warning'
  note?: string
}

export interface Verdict {
  verdict: VerdictStatus
  criteria: VerdictCriterion[]
  tests?: { detected: boolean; command?: string; passed?: number; failed?: number }
  fix_instructions?: string
}

export interface AppInfo {
  version: string
  schemaVersion: number
  dbPath: string
}

// Normalized agent output events — every adapter translates its CLI's
// native output into these. TDD §4.1.
export type AgentEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; name: string; detail: string }
  | { type: 'file_change'; path: string; kind: 'create' | 'edit' | 'delete' }
  | { type: 'error'; message: string }
  | { type: 'done'; exitCode: number; costUsd?: number; resultText?: string }
