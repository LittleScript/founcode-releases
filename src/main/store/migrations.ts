// Schema migrations, applied in order at startup. Never edit a shipped
// migration — add a new one. TDD §5.1.

export interface Migration {
  version: number
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        path        TEXT NOT NULL UNIQUE,
        created_at  INTEGER NOT NULL
      );

      CREATE TABLE tasks (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES projects(id),
        title       TEXT NOT NULL,
        intent      TEXT NOT NULL,
        agent_id    TEXT NOT NULL,
        state       TEXT NOT NULL,
        branch      TEXT,
        worktree    TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      CREATE TABLE artifacts (
        id          TEXT PRIMARY KEY,
        task_id     TEXT NOT NULL REFERENCES tasks(id),
        kind        TEXT NOT NULL,
        content     TEXT NOT NULL,
        created_at  INTEGER NOT NULL
      );

      CREATE TABLE task_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id     TEXT NOT NULL REFERENCES tasks(id),
        event       TEXT NOT NULL,
        detail      TEXT,
        created_at  INTEGER NOT NULL
      );

      CREATE INDEX idx_tasks_project ON tasks(project_id);
      CREATE INDEX idx_artifacts_task ON artifacts(task_id);
      CREATE INDEX idx_task_events_task ON task_events(task_id);
    `,
  },
]
