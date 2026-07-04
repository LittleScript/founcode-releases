import { nanoid } from 'nanoid'
import type { Project } from '../../../shared/types'
import type { Database } from '../db'

interface ProjectRow {
  id: string
  name: string
  path: string
  created_at: number
}

function toProject(row: ProjectRow): Project {
  return { id: row.id, name: row.name, path: row.path, createdAt: row.created_at }
}

export class ProjectRepo {
  constructor(private db: Database) {}

  add(name: string, path: string): Project {
    const project: Project = { id: nanoid(), name, path, createdAt: Date.now() }
    this.db
      .prepare('INSERT INTO projects (id, name, path, created_at) VALUES (?, ?, ?, ?)')
      .run(project.id, project.name, project.path, project.createdAt)
    return project
  }

  list(): Project[] {
    const rows = this.db
      .prepare('SELECT * FROM projects ORDER BY created_at ASC')
      .all() as unknown as ProjectRow[]
    return rows.map(toProject)
  }

  get(id: string): Project | undefined {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
      | ProjectRow
      | undefined
    return row ? toProject(row) : undefined
  }

  getByPath(path: string): Project | undefined {
    const row = this.db.prepare('SELECT * FROM projects WHERE path = ?').get(path) as
      | ProjectRow
      | undefined
    return row ? toProject(row) : undefined
  }
}
