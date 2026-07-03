// Database bootstrap on node:sqlite (bundled with Electron's Node runtime).
// Chosen over better-sqlite3 so the app has zero native modules: no
// node-gyp/VS Build Tools on user machines, no dual-ABI headaches between
// Electron and the Node that runs vitest.

import { DatabaseSync } from 'node:sqlite'
import { MIGRATIONS } from './migrations'

export type Database = DatabaseSync

export function openDatabase(path: string): Database {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  return db
}

export function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  for (const migration of MIGRATIONS) {
    if (migration.version <= getSchemaVersion(db)) continue
    db.exec('BEGIN')
    try {
      db.exec(migration.sql)
      db.prepare(
        `INSERT INTO settings (key, value) VALUES ('schema_version', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run(String(migration.version))
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}

export function getSchemaVersion(db: Database): number {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined
  return row ? Number(row.value) : 0
}
