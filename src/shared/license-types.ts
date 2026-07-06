// License domain types shared between main and renderer (kept free of
// Node imports so the renderer tsconfig can compile them).

export type Tier = 'free' | 'pro'

export const FREE_LIMITS = {
  maxProjects: 1,
  maxActiveTasks: 1,
  autoAdvance: false,
} as const

export interface LicenseState {
  tier: Tier
  key?: string
  instanceId?: string
  lastValidatedAt?: number
  // Set when validation is failing only due to network problems.
  inGrace?: boolean
}
