import { nanoid } from 'nanoid'
import type { Artifact, ArtifactKind, ArtifactSummary } from '../../../shared/types'
import type { Database } from '../db'

interface ArtifactRow {
  id: string
  task_id: string
  kind: string
  content: string
  created_at: number
}

function toArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    taskId: row.task_id,
    kind: row.kind as ArtifactKind,
    content: row.content,
    createdAt: row.created_at,
  }
}

export class ArtifactRepo {
  constructor(private db: Database) {}

  add(taskId: string, kind: ArtifactKind, content: string): Artifact {
    const artifact: Artifact = { id: nanoid(), taskId, kind, content, createdAt: Date.now() }
    this.db
      .prepare(
        'INSERT INTO artifacts (id, task_id, kind, content, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(artifact.id, artifact.taskId, artifact.kind, artifact.content, artifact.createdAt)
    return artifact
  }

  listByTask(taskId: string): Artifact[] {
    const rows = this.db
      .prepare('SELECT * FROM artifacts WHERE task_id = ? ORDER BY created_at ASC')
      .all(taskId) as unknown as ArtifactRow[]
    return rows.map(toArtifact)
  }

  // Global artifacts browser: metadata + a short preview, newest first.
  listAll(kind?: ArtifactKind, limit = 300): ArtifactSummary[] {
    const where = kind ? 'WHERE a.kind = ?' : ''
    const rows = this.db
      .prepare(
        `SELECT a.id, a.task_id, a.kind, substr(a.content, 1, 180) AS preview, a.created_at,
                t.title AS task_title, t.project_id, p.name AS project_name
         FROM artifacts a
         JOIN tasks t ON t.id = a.task_id
         JOIN projects p ON p.id = t.project_id
         ${where}
         ORDER BY a.created_at DESC LIMIT ?`,
      )
      .all(...(kind ? [kind, limit] : [limit])) as unknown as {
      id: string
      task_id: string
      kind: string
      preview: string
      created_at: number
      task_title: string
      project_id: string
      project_name: string
    }[]
    return rows.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      kind: r.kind as ArtifactKind,
      preview: r.preview,
      createdAt: r.created_at,
      taskTitle: r.task_title,
      projectId: r.project_id,
      projectName: r.project_name,
    }))
  }

  latest(taskId: string, kind: ArtifactKind): Artifact | undefined {
    const row = this.db
      .prepare(
        'SELECT * FROM artifacts WHERE task_id = ? AND kind = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
      )
      .get(taskId, kind) as ArtifactRow | undefined
    return row ? toArtifact(row) : undefined
  }
}
