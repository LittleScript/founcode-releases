import { nanoid } from 'nanoid'
import type { Artifact, ArtifactKind } from '../../../shared/types'
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

  latest(taskId: string, kind: ArtifactKind): Artifact | undefined {
    const row = this.db
      .prepare(
        'SELECT * FROM artifacts WHERE task_id = ? AND kind = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
      )
      .get(taskId, kind) as ArtifactRow | undefined
    return row ? toArtifact(row) : undefined
  }
}
