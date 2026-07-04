import { create } from 'zustand'
import type { Project, Task } from '../../shared/types'

type View = { name: 'board' } | { name: 'task'; taskId: string }

interface AppState {
  view: View
  projects: Project[]
  activeProjectId: string | null
  tasks: Task[]
  error: string | null

  init: () => Promise<void>
  addProject: () => Promise<void>
  setActiveProject: (id: string) => Promise<void>
  createTask: (input: { title: string; intent: string }) => Promise<void>
  refreshTasks: () => Promise<void>
  openTask: (taskId: string) => void
  goBoard: () => void
  clearError: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  view: { name: 'board' },
  projects: [],
  activeProjectId: null,
  tasks: [],
  error: null,

  init: async () => {
    const projects = await window.founcode.invoke('project:list', undefined)
    const activeProjectId = projects[0]?.id ?? null
    set({ projects, activeProjectId })
    if (activeProjectId) await get().refreshTasks()
  },

  addProject: async () => {
    try {
      const path = await window.founcode.invoke('dialog:selectFolder', undefined)
      if (!path) return
      const project = await window.founcode.invoke('project:add', { path })
      set((s) => ({ projects: [...s.projects, project], activeProjectId: project.id }))
      await get().refreshTasks()
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  setActiveProject: async (id) => {
    set({ activeProjectId: id, view: { name: 'board' } })
    await get().refreshTasks()
  },

  createTask: async ({ title, intent }) => {
    const projectId = get().activeProjectId
    if (!projectId) return
    try {
      await window.founcode.invoke('task:create', {
        projectId,
        title,
        intent,
        agentId: 'claude-code',
      })
      await get().refreshTasks()
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  refreshTasks: async () => {
    const projectId = get().activeProjectId
    if (!projectId) {
      set({ tasks: [] })
      return
    }
    const tasks = await window.founcode.invoke('task:list', { projectId })
    set({ tasks })
  },

  openTask: (taskId) => set({ view: { name: 'task', taskId } }),
  goBoard: () => set({ view: { name: 'board' } }),
  clearError: () => set({ error: null }),
}))
