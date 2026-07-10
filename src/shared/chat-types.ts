// Chat-first home — shared types (renderer-safe: no Node imports).

export interface ChatSession {
  id: string
  projectId: string | null
  title: string
  agentId: string
  model: string | null
  pinned: boolean
  createdAt: number
  updatedAt: number
  // Transient (computed by main): a reply is currently streaming.
  busy?: boolean
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
      type: 'add_task_to_blueprint'
      blueprintId: string
      title: string
      intent: string
    }
  | { type: 'pause_auto'; blueprintId: string }
  | { type: 'resume_auto'; blueprintId: string }
  | { type: 'start_next'; blueprintId: string }
  // Renderer-side: opens the New-from-Idea dialog pre-filled.
  | { type: 'blueprint_from_idea'; idea: string; title?: string }
  // Renderer-side: navigation.
  | { type: 'open_project'; projectId: string }
  // A2A: agent-to-agent communication across sessions.
  | { type: 'a2a_ask'; targetSessionId: string; question: string }
  | { type: 'a2a_handoff'; targetAgentId: string; title: string; intent: string }
  | { type: 'a2a_notify'; targetSessionId: string; message: string }

export const MAIN_SIDE_ACTIONS = new Set([
  'create_task',
  'add_task_to_blueprint',
  'pause_auto',
  'resume_auto',
  'start_next',
  'a2a_ask',
  'a2a_handoff',
  'a2a_notify',
])
