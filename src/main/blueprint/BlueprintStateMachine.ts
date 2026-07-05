// Blueprint lifecycle — the Idea -> PRD -> Task Graph funnel. Pure logic.
// Distinct from the per-task state machine: this governs the product-level
// spec flow. Every state persists so the flow resumes after a restart.
// Design: docs/BLUEPRINT-DESIGN.md §4.2.

export const BLUEPRINT_STATES = [
  'IDEA', // created, awaiting question generation
  'QUESTIONS', // questions generated, awaiting user answers
  'STRUCTURING', // agent building the feature map
  'STRUCTURE_REVIEW', // map ready, awaiting accept
  'GENERATING_PRD', // agent writing the PRD
  'PRD_REVIEW', // PRD ready, awaiting accept (or chat revision)
  'DECOMPOSING', // agent breaking PRD into tasks
  'TASK_REVIEW', // task graph ready, awaiting start
  'IMPLEMENTING', // tasks feeding the P-E-V pipeline
  'DONE', // all tasks complete
  'FAILED', // a generative step failed
] as const

export type BlueprintState = (typeof BLUEPRINT_STATES)[number]

export const BLUEPRINT_ACTIONS = [
  'generate_questions', // IDEA -> QUESTIONS
  'generate_prd_direct', // IDEA -> GENERATING_PRD (document mode: skip Q + structure)
  'submit_answers', // QUESTIONS -> STRUCTURING
  'structure_ready', // STRUCTURING -> STRUCTURE_REVIEW
  'accept_structure', // STRUCTURE_REVIEW -> GENERATING_PRD
  'prd_ready', // GENERATING_PRD -> PRD_REVIEW
  'revise_prd', // PRD_REVIEW -> GENERATING_PRD (chat revision loop)
  'accept_prd', // PRD_REVIEW -> DECOMPOSING
  'finish', // PRD_REVIEW -> DONE (keep the PRD, no task build)
  'tasks_ready', // DECOMPOSING -> TASK_REVIEW
  'start_implementation', // TASK_REVIEW -> IMPLEMENTING
  'all_tasks_done', // IMPLEMENTING -> DONE
  'generation_failed', // (any generative state) -> FAILED
  'retry', // FAILED -> IDEA (restart the flow)
] as const

export type BlueprintAction = (typeof BLUEPRINT_ACTIONS)[number]

// States where an agent generation is in flight; failure sends them to FAILED.
const GENERATIVE_STATES: BlueprintState[] = ['IDEA', 'STRUCTURING', 'GENERATING_PRD', 'DECOMPOSING']

const TRANSITIONS: Record<BlueprintAction, Partial<Record<BlueprintState, BlueprintState>>> = {
  generate_questions: { IDEA: 'QUESTIONS' },
  generate_prd_direct: { IDEA: 'GENERATING_PRD' },
  submit_answers: { QUESTIONS: 'STRUCTURING' },
  structure_ready: { STRUCTURING: 'STRUCTURE_REVIEW' },
  accept_structure: { STRUCTURE_REVIEW: 'GENERATING_PRD' },
  prd_ready: { GENERATING_PRD: 'PRD_REVIEW' },
  revise_prd: { PRD_REVIEW: 'GENERATING_PRD' },
  accept_prd: { PRD_REVIEW: 'DECOMPOSING' },
  finish: { PRD_REVIEW: 'DONE' },
  tasks_ready: { DECOMPOSING: 'TASK_REVIEW' },
  start_implementation: { TASK_REVIEW: 'IMPLEMENTING' },
  all_tasks_done: { IMPLEMENTING: 'DONE' },
  generation_failed: Object.fromEntries(GENERATIVE_STATES.map((s) => [s, 'FAILED'])) as Partial<
    Record<BlueprintState, BlueprintState>
  >,
  retry: { FAILED: 'IDEA' },
}

export class IllegalBlueprintTransitionError extends Error {
  constructor(
    readonly state: BlueprintState,
    readonly action: BlueprintAction,
  ) {
    super(`Illegal blueprint transition: '${action}' not allowed from '${state}'`)
    this.name = 'IllegalBlueprintTransitionError'
  }
}

export function transition(state: BlueprintState, action: BlueprintAction): BlueprintState {
  const next = TRANSITIONS[action]?.[state]
  if (!next) throw new IllegalBlueprintTransitionError(state, action)
  return next
}

export function legalActions(state: BlueprintState): BlueprintAction[] {
  return BLUEPRINT_ACTIONS.filter((a) => TRANSITIONS[a][state] !== undefined)
}

export function isGenerative(state: BlueprintState): boolean {
  return GENERATIVE_STATES.includes(state)
}
