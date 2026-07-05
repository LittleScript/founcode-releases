// Blueprint domain types shared between main and renderer.
// Design: docs/BLUEPRINT-DESIGN.md.

import type { BlueprintState } from '../main/blueprint/BlueprintStateMachine'

export type { BlueprintState }

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
  answer: string | null // null = skipped
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
}

export type BlueprintMode = 'greenfield' | 'extend' | 'document'

export interface Blueprint {
  id: string
  projectId: string
  title: string
  idea: string
  mode: BlueprintMode
  techPref: TechPref
  answers: BlueprintAnswer[] | null
  structure: BlueprintStructure | null
  prd: string | null
  advanceMode: 'manual' | 'auto'
  agentId: string
  state: BlueprintState
  createdAt: number
  updatedAt: number
}
