import { create } from 'zustand'
import type { Blueprint, BlueprintAnswer, BlueprintQuestion } from '../../shared/blueprint-types'
import type { Task } from '../../shared/types'

interface BlueprintState {
  blueprint: Blueprint | null
  questions: BlueprintQuestion[]
  tasks: Task[]
  loading: boolean

  open: (blueprintId: string) => Promise<void>
  refresh: () => Promise<void>
  clear: () => void
}

export const useBlueprintStore = create<BlueprintState>((set, get) => ({
  blueprint: null,
  questions: [],
  tasks: [],
  loading: false,

  open: async (blueprintId) => {
    set({ loading: true, blueprint: null, questions: [], tasks: [] })
    const blueprint = await window.founcode.invoke('blueprint:get', { blueprintId })
    set({ blueprint, loading: false })
    await get().refresh()
  },

  refresh: async () => {
    const id = get().blueprint?.id
    if (!id) return
    const [blueprint, questions, tasks] = await Promise.all([
      window.founcode.invoke('blueprint:get', { blueprintId: id }),
      window.founcode.invoke('blueprint:getQuestions', { blueprintId: id }),
      window.founcode.invoke('blueprint:tasks', { blueprintId: id }),
    ])
    set({ blueprint, questions, tasks })
  },

  clear: () => set({ blueprint: null, questions: [], tasks: [] }),
}))

// Convenience wrappers for the studio actions.
export const blueprintActions = {
  submitAnswers: (blueprintId: string, answers: BlueprintAnswer[]) =>
    window.founcode.invoke('blueprint:submitAnswers', { blueprintId, answers }),
  acceptStructure: (blueprintId: string) =>
    window.founcode.invoke('blueprint:acceptStructure', { blueprintId }),
  revisePrd: (blueprintId: string, instructions: string) =>
    window.founcode.invoke('blueprint:revisePrd', { blueprintId, instructions }),
  acceptPrd: (blueprintId: string) =>
    window.founcode.invoke('blueprint:acceptPrd', { blueprintId }),
  finish: (blueprintId: string) => window.founcode.invoke('blueprint:finish', { blueprintId }),
  setAdvanceMode: (blueprintId: string, mode: 'manual' | 'auto') =>
    window.founcode.invoke('blueprint:setAdvanceMode', { blueprintId, mode }),
  retry: (blueprintId: string) => window.founcode.invoke('blueprint:retry', { blueprintId }),
}
