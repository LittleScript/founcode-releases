// Task lifecycle state machine — TDD §4.3. Pure logic, no I/O.
// Every state change in the app MUST go through transition(); there is
// no other path. The Orchestrator persists results and emits events.

import type { TaskState } from '../../shared/types'

export const TASK_ACTIONS = [
  'start_planning',
  'plan_ready',
  'plan_failed',
  'request_replan',
  'approve_plan',
  'execution_finished',
  'execution_failed',
  'verify_passed',
  'verify_failed_retry',
  'verify_failed_final',
  'merge',
  'send_back',
  'discard',
  'cancel',
  'retry',
] as const

export type TaskAction = (typeof TASK_ACTIONS)[number]

// Automatic fix loop (VERIFYING -> EXECUTING) is capped so a failing
// task can never burn credits unattended. After the cap, only the user
// can decide. TDD §4.3.
export const MAX_VERIFY_RETRIES = 2

const TRANSITIONS: Record<TaskAction, Partial<Record<TaskState, TaskState>>> = {
  start_planning: { BACKLOG: 'PLANNING' },
  plan_ready: { PLANNING: 'AWAITING_APPROVAL' },
  plan_failed: { PLANNING: 'FAILED' },
  request_replan: { AWAITING_APPROVAL: 'PLANNING' },
  approve_plan: { AWAITING_APPROVAL: 'EXECUTING' },
  execution_finished: { EXECUTING: 'VERIFYING' },
  execution_failed: { EXECUTING: 'FAILED' },
  verify_passed: { VERIFYING: 'REVIEW' },
  verify_failed_retry: { VERIFYING: 'EXECUTING' },
  verify_failed_final: { VERIFYING: 'FAILED' },
  merge: { REVIEW: 'DONE' },
  send_back: { REVIEW: 'EXECUTING' },
  discard: { REVIEW: 'DISCARDED' },
  cancel: {
    PLANNING: 'DISCARDED',
    AWAITING_APPROVAL: 'DISCARDED',
    EXECUTING: 'DISCARDED',
    VERIFYING: 'DISCARDED',
  },
  retry: { FAILED: 'BACKLOG' },
}

export class IllegalTransitionError extends Error {
  constructor(
    readonly state: TaskState,
    readonly action: TaskAction,
  ) {
    super(`Illegal transition: action '${action}' is not allowed from state '${state}'`)
    this.name = 'IllegalTransitionError'
  }
}

export function transition(state: TaskState, action: TaskAction): TaskState {
  const next = TRANSITIONS[action]?.[state]
  if (!next) throw new IllegalTransitionError(state, action)
  return next
}

export function legalActions(state: TaskState): TaskAction[] {
  return TASK_ACTIONS.filter((action) => TRANSITIONS[action][state] !== undefined)
}
