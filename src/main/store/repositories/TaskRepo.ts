import { nanoid } from 'nanoid'
import type { Task, TaskState } from '../../../shared/types'
import type { Database } from '../db'

interface TaskRow {
  id: string
  project_id: string
  title: string
  intent: string
  agent_id: string
  state: string
  branch: string | null
  worktree: string | null
  retry_count: number
  created_at: number
  updated_at: number
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    intent: row.intent,
    agentId: row.agent_id,
    state: row.state as TaskState,
    branch: row.branch,
    worktree: row.worktree,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateTaskInput {
  projectId: string
  title: string
  intent: string
  agentId: string
}

export class TaskRepo {
  constructor(private db: Database) {}

  create(input: CreateTaskInput): Task {
    const now = Date.now()
    const task: Task = {
      id: nanoid(),
      projectId: input.projectId,
      title: input.title,
      intent: input.intent,
      agentId: input.agentId,
      state: 'BACKLOG',
      branch: null,
      worktree: null,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    this.db
      .prepare(
        `INSERT INTO tasks (id, project_id, title, intent, agent_id, state, branch, worktree, retry_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        task.id,
        task.projectId,
        task.title,
        task.intent,
        task.agentId,
        task.state,
        task.branch,
        task.worktree,
        task.retryCount,
        task.createdAt,
        task.updatedAt,
      )
    return task
  }

  list(projectId?: string): Task[] {
    const rows = (projectId
      ? this.db
          .prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC')
          .all(projectId)
      : this.db
          .prepare('SELECT * FROM tasks ORDER BY created_at ASC')
          .all()) as unknown as TaskRow[]
    return rows.map(toTask)
  }

  get(id: string): Task | undefined {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
    return row ? toTask(row) : undefined
  }

  setState(id: string, state: TaskState): void {
    this.db
      .prepare('UPDATE tasks SET state = ?, updated_at = ? WHERE id = ?')
      .run(state, Date.now(), id)
  }

  setWorktree(id: string, branch: string | null, worktree: string | null): void {
    this.db
      .prepare('UPDATE tasks SET branch = ?, worktree = ?, updated_at = ? WHERE id = ?')
      .run(branch, worktree, Date.now(), id)
  }

  incrementRetry(id: string): number {
    this.db
      .prepare('UPDATE tasks SET retry_count = retry_count + 1, updated_at = ? WHERE id = ?')
      .run(Date.now(), id)
    const row = this.db.prepare('SELECT retry_count FROM tasks WHERE id = ?').get(id) as
      | { retry_count: number }
      | undefined
    return row?.retry_count ?? 0
  }

  recordEvent(taskId: string, event: string, detail?: unknown): void {
    this.db
      .prepare('INSERT INTO task_events (task_id, event, detail, created_at) VALUES (?, ?, ?, ?)')
      .run(taskId, event, detail === undefined ? null : JSON.stringify(detail), Date.now())
  }

  listEvents(taskId: string): { event: string; detail: unknown; createdAt: number }[] {
    const rows = this.db
      .prepare(
        'SELECT event, detail, created_at FROM task_events WHERE task_id = ? ORDER BY id ASC',
      )
      .all(taskId) as unknown as { event: string; detail: string | null; created_at: number }[]
    return rows.map((r) => ({
      event: r.event,
      detail: r.detail ? JSON.parse(r.detail) : undefined,
      createdAt: r.created_at,
    }))
  }
}
