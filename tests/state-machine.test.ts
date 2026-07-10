import { describe, expect, it } from 'vitest'
import {
  IllegalTransitionError,
  legalActions,
  TASK_ACTIONS,
  type TaskAction,
  transition,
} from '../src/main/orchestrator/TaskStateMachine'
import { TASK_STATES, type TaskState } from '../src/shared/types'

// The complete legal transition table. Everything NOT in this list must
// throw — verified exhaustively below across all state x action pairs.
const LEGAL: [TaskState, TaskAction, TaskState][] = [
  ['BACKLOG', 'start_planning', 'PLANNING'],
  ['PLANNING', 'plan_ready', 'AWAITING_APPROVAL'],
  ['PLANNING', 'plan_failed', 'FAILED'],
  ['PLANNING', 'cancel', 'BACKLOG'],
  ['AWAITING_APPROVAL', 'request_replan', 'PLANNING'],
  ['AWAITING_APPROVAL', 'approve_plan', 'EXECUTING'],
  ['AWAITING_APPROVAL', 'cancel', 'BACKLOG'],
  ['EXECUTING', 'execution_finished', 'VERIFYING'],
  ['EXECUTING', 'execution_failed', 'FAILED'],
  ['EXECUTING', 'cancel', 'DISCARDED'],
  ['VERIFYING', 'verify_passed', 'REVIEW'],
  ['VERIFYING', 'verify_failed_retry', 'EXECUTING'],
  ['VERIFYING', 'verify_failed_final', 'FAILED'],
  ['VERIFYING', 'cancel', 'DISCARDED'],
  ['REVIEW', 'merge', 'DONE'],
  ['REVIEW', 'send_back', 'EXECUTING'],
  ['REVIEW', 'discard', 'DISCARDED'],
  ['FAILED', 'retry', 'BACKLOG'],
  ['FAILED', 'send_back', 'PLANNING'],
  ['DISCARDED', 'retry', 'BACKLOG'],
]

function expectedResult(state: TaskState, action: TaskAction): TaskState | undefined {
  return LEGAL.find(([s, a]) => s === state && a === action)?.[2]
}

describe('TaskStateMachine', () => {
  it('covers every state x action pair exactly once (exhaustive)', () => {
    for (const state of TASK_STATES) {
      for (const action of TASK_ACTIONS) {
        const expected = expectedResult(state, action)
        if (expected) {
          expect(transition(state, action), `${state} --${action}-->`).toBe(expected)
        } else {
          expect(() => transition(state, action), `${state} --${action}--> must throw`).toThrow(
            IllegalTransitionError,
          )
        }
      }
    }
  })

  it('DONE is terminal; DISCARDED and FAILED can be retried or sent back', () => {
    expect(legalActions('DONE')).toEqual([])
    expect(legalActions('DISCARDED')).toEqual(['retry'])
    expect(legalActions('FAILED').sort()).toEqual(['retry', 'send_back'])
  })

  it('cancel before execution returns to backlog; after, discards the work', () => {
    expect(transition('PLANNING', 'cancel')).toBe('BACKLOG')
    expect(transition('AWAITING_APPROVAL', 'cancel')).toBe('BACKLOG')
    expect(transition('EXECUTING', 'cancel')).toBe('DISCARDED')
    expect(transition('VERIFYING', 'cancel')).toBe('DISCARDED')
  })

  it('reports legal actions per state', () => {
    expect(legalActions('BACKLOG')).toEqual(['start_planning'])
    expect(legalActions('REVIEW').sort()).toEqual(['discard', 'merge', 'send_back'])
  })

  it('error carries the offending state and action', () => {
    try {
      transition('DONE', 'merge')
      expect.unreachable()
    } catch (error) {
      const e = error as IllegalTransitionError
      expect(e.state).toBe('DONE')
      expect(e.action).toBe('merge')
    }
  })
})
