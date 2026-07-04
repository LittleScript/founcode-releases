import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Database, getSchemaVersion, migrate, openDatabase } from '../src/main/store/db'
import { MIGRATIONS } from '../src/main/store/migrations'

const LATEST_VERSION = MIGRATIONS.at(-1)?.version ?? 0

describe('database bootstrap', () => {
  let dir: string
  let db: Database

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'founcode-test-'))
    db = openDatabase(join(dir, 'test.db'))
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('applies all migrations and records schema version', () => {
    expect(getSchemaVersion(db)).toBe(LATEST_VERSION)
  })

  it('creates the full schema', () => {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .all() as { name: string }[]
    const names = tables.map((t) => t.name)
    for (const expected of ['projects', 'tasks', 'artifacts', 'task_events', 'settings']) {
      expect(names).toContain(expected)
    }
  })

  it('is idempotent — migrating twice is a no-op', () => {
    expect(() => migrate(db)).not.toThrow()
    expect(getSchemaVersion(db)).toBe(LATEST_VERSION)
  })

  it('enforces foreign keys', () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO tasks (id, project_id, title, intent, agent_id, state, created_at, updated_at)
           VALUES ('t1', 'missing-project', 'x', 'x', 'claude-code', 'BACKLOG', 0, 0)`,
        )
        .run(),
    ).toThrow()
  })

  it('accepts a valid project + task insert', () => {
    db.prepare(`INSERT INTO projects (id, name, path, created_at) VALUES ('p1', 'demo', 'C:/demo', 0)`).run()
    db.prepare(
      `INSERT INTO tasks (id, project_id, title, intent, agent_id, state, created_at, updated_at)
       VALUES ('t1', 'p1', 'title', 'intent', 'claude-code', 'BACKLOG', 0, 0)`,
    ).run()
    const task = db.prepare(`SELECT * FROM tasks WHERE id = 't1'`).get() as { state: string }
    expect(task.state).toBe('BACKLOG')
  })
})
