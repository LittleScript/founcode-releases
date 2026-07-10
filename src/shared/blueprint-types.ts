// Blueprint domain types shared between main and renderer.
// Design: docs/BLUEPRINT-DESIGN.md.

export const BLUEPRINT_STATES = [
  'IDEA',
  'QUESTIONS',
  'STRUCTURING',
  'STRUCTURE_REVIEW',
  'GENERATING_PRD',
  'PRD_REVIEW',
  'DECOMPOSING',
  'TASK_REVIEW',
  'IMPLEMENTING',
  'DONE',
  'FAILED',
] as const

export type BlueprintState = (typeof BLUEPRINT_STATES)[number]

export interface TechPref {
  mode: 'auto' | 'manual'
  stack?: string
}

export interface BlueprintQuestion {
  question: string
  options: string[]
  allowSkip: boolean
}

// Questions step output: the clarifying questions plus a few fresh
// feature ideas the agent proposes (the user opts in per idea).
export interface QuestionsResult {
  questions: BlueprintQuestion[]
  suggestions: string[]
}

export interface BlueprintAnswer {
  question: string
  answers: string[] // multi-select; empty = skipped
}

// Feature tree — Product -> Features (phases) -> Sub-features.
export interface StructureSubFeature {
  name: string
  description?: string
}

export interface StructureFeature {
  name: string
  priority?: 'high' | 'medium' | 'low'
  description?: string
  subFeatures: StructureSubFeature[]
}

export interface BlueprintStructure {
  features: StructureFeature[]
}

// A decomposed task, before it becomes a Founcode task row.
export interface BlueprintTaskSpec {
  title: string
  intent: string
  feature: string
  priority: 'high' | 'medium' | 'low'
  // order_index values of tasks this one depends on (resolved to task
  // IDs after creation).
  depends_on?: number[]
}

export type BlueprintMode = 'greenfield' | 'extend' | 'document'

export type ChatPhase = 'structure' | 'prd'

export interface BlueprintMessage {
  id: number
  phase: ChatPhase
  role: 'user' | 'agent'
  content: string
  createdAt: number
}

export interface Blueprint {
  id: string
  projectId: string
  title: string
  idea: string
  mode: BlueprintMode
  techPref: TechPref
  model: string | null
  answers: BlueprintAnswer[] | null
  structure: BlueprintStructure | null
  prd: string | null
  advanceMode: 'manual' | 'auto'
  agentId: string
  state: BlueprintState
  createdAt: number
  updatedAt: number
}
