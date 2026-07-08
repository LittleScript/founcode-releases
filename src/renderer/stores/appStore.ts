import { create } from 'zustand'
import type { TerminalSession } from '../../shared/terminal-types'
import type { Project, Task } from '../../shared/types'

// Claude-app-style IA: New chat / Chats / Projects / Artifacts.
type View =
  | { name: 'chat'; sessionId: string | null } // null = latest session
  | { name: 'chats' }
  | { name: 'projects' }
  | { name: 'skills' }
  | { name: 'artifacts' }
  | { name: 'board' }
  | { name: 'task'; taskId: string }
  | { name: 'blueprint'; blueprintId: string }
  | { name: 'terminal'; session: TerminalSession }
  | { name: 'settings' }

interface AppState {
  view: View
  projects: Project[]
  activeProjectId: string | null
  tasks: Task[]
  error: string | null

  init: () => Promise<void>
  addProject: () => Promise<void>
  setActiveProject: (id: string) => Promise<void>
  createTask: (input: {
    title: string
    intent: string
    agentId: string
    model?: string
    skill?: string
  }) => Promise<void>
  refreshTasks: () => Promise<void>
  openTask: (taskId: string) => void
  openBlueprint: (blueprintId: string) => void
  openSettings: () => void
  goBoard: () => void
  goChat: (sessionId?: string | null) => void
  goChats: () => void
  goProjects: () => void
  goSkills: () => void
  goArtifacts: () => void
  openTerminal: (session: TerminalSession) => void
  clearError: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Chat is the front door — discussion first, pipeline when ready.
  view: { name: 'chat', sessionId: null },
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

  createTask: async ({ title, intent, agentId, model, skill }) => {
    const projectId = get().activeProjectId
    if (!projectId) return
    try {
      await window.founcode.invoke('task:create', {
        projectId,
        title,
        intent,
        agentId,
        model,
        skill,
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
  openBlueprint: (blueprintId) => set({ view: { name: 'blueprint', blueprintId } }),
  openSettings: () => set({ view: { name: 'settings' } }),
  goBoard: () => set({ view: { name: 'board' } }),
  goChat: (sessionId = null) => set({ view: { name: 'chat', sessionId } }),
  goChats: () => set({ view: { name: 'chats' } }),
  goProjects: () => set({ view: { name: 'projects' } }),
  goSkills: () => set({ view: { name: 'skills' } }),
  goArtifacts: () => set({ view: { name: 'artifacts' } }),
  openTerminal: (session) => set({ view: { name: 'terminal', session } }),
  clearError: () => set({ error: null }),
}))
