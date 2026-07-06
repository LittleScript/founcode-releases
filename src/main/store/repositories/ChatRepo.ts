import { nanoid } from 'nanoid'
import type { ChatAction, ChatMessage, ChatSession } from '../../../shared/chat-types'
import type { Database } from '../db'

interface SessionRow {
  id: string
  project_id: string | null
  title: string
  agent_id: string
  model: string | null
  created_at: number
  updated_at: number
}

interface MessageRow {
  id: number
  session_id: string
  role: string
  content: string
  actions: string | null
  created_at: number
}

function toSession(row: SessionRow): ChatSession {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    agentId: row.agent_id,
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as ChatMessage['role'],
    content: row.content,
    actions: row.actions ? (JSON.parse(row.actions) as ChatAction[]) : [],
    createdAt: row.created_at,
  }
}

export class ChatRepo {
  constructor(private db: Database) {}

  createSession(input: {
    projectId?: string | null
    title?: string
    agentId: string
    model?: string | null
  }): ChatSession {
    const id = nanoid(12)
    const now = Date.now()
    this.db
      .prepare(
        `INSERT INTO chat_sessions (id, project_id, title, agent_id, model, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.projectId ?? null,
        input.title ?? 'New chat',
        input.agentId,
        input.model ?? null,
        now,
        now,
      )
    const session = this.getSession(id)
    if (!session) throw new Error('chat session insert failed')
    return session
  }

  getSession(id: string): ChatSession | undefined {
    const row = this.db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) as
      | SessionRow
      | undefined
    return row ? toSession(row) : undefined
  }

  listSessions(): ChatSession[] {
    const rows = this.db
      .prepare('SELECT * FROM chat_sessions ORDER BY updated_at DESC')
      .all() as unknown as SessionRow[]
    return rows.map(toSession)
  }

  // First user message becomes the title (truncated) — like every chat app.
  setTitle(id: string, title: string): void {
    this.db
      .prepare('UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?')
      .run(title.slice(0, 60), Date.now(), id)
  }

  touch(id: string): void {
    this.db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(Date.now(), id)
  }

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(id)
    this.db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(id)
  }

  addMessage(
    sessionId: string,
    role: ChatMessage['role'],
    content: string,
    actions: ChatAction[] = [],
  ): ChatMessage {
    const result = this.db
      .prepare(
        `INSERT INTO chat_messages (session_id, role, content, actions, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        sessionId,
        role,
        content,
        actions.length > 0 ? JSON.stringify(actions) : null,
        Date.now(),
      )
    this.touch(sessionId)
    const row = this.db
      .prepare('SELECT * FROM chat_messages WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as unknown as MessageRow
    return toMessage(row)
  }

  listMessages(sessionId: string): ChatMessage[] {
    const rows = this.db
      .prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY id')
      .all(sessionId) as unknown as MessageRow[]
    return rows.map(toMessage)
  }
}
