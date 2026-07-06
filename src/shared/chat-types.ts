// Chat-first home — shared types (renderer-safe: no Node imports).

export interface ChatSession {
  id: string
  projectId: string | null
  title: string
  agentId: string
  model: string | null
  createdAt: number
  updatedAt: number
}

export interface ChatMessage {
  id: number
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  actions: ChatAction[]
  createdAt: number
}

// Actions the assistant may propose at the end of a reply. The user
// triggers them as chips — this is how a discussion crosses into the
// P-E-V pipeline (and how a RUNNING pipeline gets steered mid-flight:
// pause, add a new idea as a task, continue).
export type ChatAction =
  | { type: 'create_task'; projectId: string; title: string; intent: string }
  | {
      // Insert a new idea into a blueprint that is already implementing —
      // it joins the end of the task queue.
      type: 'add_task_to_blueprint'
      blueprintId: string
      title: string
      intent: string
    }
  | { type: 'pause_auto'; blueprintId: string } // auto-advance -> manual
  | { type: 'resume_auto'; blueprintId: string } // manual -> auto (Pro)
  | { type: 'start_next'; blueprintId: string }
  // Renderer-side: opens the New-from-Idea dialog pre-filled.
  | { type: 'blueprint_from_idea'; idea: string; title?: string }
  // Renderer-side: navigation.
  | { type: 'open_project'; projectId: string }

export const MAIN_SIDE_ACTIONS = new Set([
  'create_task',
  'add_task_to_blueprint',
  'pause_auto',
  'resume_auto',
  'start_next',
])
