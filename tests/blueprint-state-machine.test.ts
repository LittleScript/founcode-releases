import { describe, expect, it } from 'vitest'
import {
  BLUEPRINT_ACTIONS,
  BLUEPRINT_STATES,
  type BlueprintAction,
  type BlueprintState,
  IllegalBlueprintTransitionError,
  isGenerative,
  legalActions,
  transition,
} from '../src/main/blueprint/BlueprintStateMachine'

const LEGAL: [BlueprintState, BlueprintAction, BlueprintState][] = [
  ['IDEA', 'generate_questions', 'QUESTIONS'],
  ['IDEA', 'generate_prd_direct', 'GENERATING_PRD'],
  ['IDEA', 'generation_failed', 'FAILED'],
  ['QUESTIONS', 'submit_answers', 'STRUCTURING'],
  ['STRUCTURING', 'structure_ready', 'STRUCTURE_REVIEW'],
  ['STRUCTURING', 'generation_failed', 'FAILED'],
  ['STRUCTURE_REVIEW', 'accept_structure', 'GENERATING_PRD'],
  ['GENERATING_PRD', 'prd_ready', 'PRD_REVIEW'],
  ['GENERATING_PRD', 'generation_failed', 'FAILED'],
  ['PRD_REVIEW', 'revise_prd', 'GENERATING_PRD'],
  ['PRD_REVIEW', 'accept_prd', 'DECOMPOSING'],
  ['PRD_REVIEW', 'finish', 'DONE'],
  ['DECOMPOSING', 'tasks_ready', 'TASK_REVIEW'],
  ['DECOMPOSING', 'generation_failed', 'FAILED'],
  ['TASK_REVIEW', 'start_implementation', 'IMPLEMENTING'],
  ['IMPLEMENTING', 'all_tasks_done', 'DONE'],
  ['FAILED', 'retry', 'IDEA'],
]

function expected(state: BlueprintState, action: BlueprintAction): BlueprintState | undefined {
  return LEGAL.find(([s, a]) => s === state && a === action)?.[2]
}

describe('BlueprintStateMachine', () => {
  it('covers every state x action pair exactly once (exhaustive)', () => {
    for (const state of BLUEPRINT_STATES) {
      for (const action of BLUEPRINT_ACTIONS) {
        const exp = expected(state, action)
        if (exp) {
          expect(transition(state, action), `${state} --${action}-->`).toBe(exp)
        } else {
          expect(() => transition(state, action), `${state} --${action}--> must throw`).toThrow(
            IllegalBlueprintTransitionError,
          )
        }
      }
    }
  })

  it('every generative state can fail to FAILED', () => {
    for (const state of ['IDEA', 'STRUCTURING', 'GENERATING_PRD', 'DECOMPOSING'] as const) {
      expect(isGenerative(state)).toBe(true)
      expect(transition(state, 'generation_failed')).toBe('FAILED')
    }
  })

  it('review states are not generative', () => {
    for (const state of ['STRUCTURE_REVIEW', 'PRD_REVIEW', 'TASK_REVIEW'] as const) {
      expect(isGenerative(state)).toBe(false)
    }
  })

  it('PRD review can loop back to regenerate (chat revision)', () => {
    expect(transition('PRD_REVIEW', 'revise_prd')).toBe('GENERATING_PRD')
  })

  it('DONE is terminal', () => {
    expect(legalActions('DONE')).toEqual([])
  })

  it('FAILED can only retry', () => {
    expect(legalActions('FAILED')).toEqual(['retry'])
  })

  it('error carries offending state and action', () => {
    try {
      transition('DONE', 'retry')
      expect.unreachable()
    } catch (e) {
      const err = e as IllegalBlueprintTransitionError
      expect(err.state).toBe('DONE')
      expect(err.action).toBe('retry')
    }
  })
})
