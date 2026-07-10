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
  {
    version: 2,
    // Fix loop needs the execution base commit to recompute diffs
    // without recreating the worktree.
    sql: 'ALTER TABLE tasks ADD COLUMN base_ref TEXT;',
  },
  {
    version: 3,
    // Blueprint (Spec Studio): idea -> PRD -> task graph. A blueprint
    // owns an ordered set of tasks that feed the P-E-V pipeline.
    sql: `
      CREATE TABLE blueprints (
        id           TEXT PRIMARY KEY,
        project_id   TEXT NOT NULL REFERENCES projects(id),
        title        TEXT NOT NULL,
        idea         TEXT NOT NULL,
        tech_pref    TEXT NOT NULL,      -- json: { mode: 'auto'|'manual', stack?: string }
        answers      TEXT,               -- json: [{ question, options, answer|skipped }]
        structure    TEXT,               -- json: feature tree
        prd          TEXT,               -- markdown
        advance_mode TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'auto'
        agent_id     TEXT NOT NULL,
        state        TEXT NOT NULL,
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
      );

      CREATE TABLE blueprint_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        blueprint_id TEXT NOT NULL REFERENCES blueprints(id),
        event       TEXT NOT NULL,
        detail      TEXT,
        created_at  INTEGER NOT NULL
      );

      ALTER TABLE tasks ADD COLUMN blueprint_id TEXT;
      ALTER TABLE tasks ADD COLUMN order_index INTEGER;

      CREATE INDEX idx_blueprints_project ON blueprints(project_id);
      CREATE INDEX idx_blueprint_events_bp ON blueprint_events(blueprint_id);
      CREATE INDEX idx_tasks_blueprint ON tasks(blueprint_id);
    `,
  },
  {
    version: 4,
    // Brownfield support: a blueprint targets a new repo (greenfield),
    // extends an existing one toward a goal (extend), or documents an
    // existing codebase into a PRD (document).
    sql: "ALTER TABLE blueprints ADD COLUMN mode TEXT NOT NULL DEFAULT 'greenfield';",
  },
  {
    version: 5,
    // Real-time discussion threads on the structure and PRD steps. The
    // agent can answer questions and regenerate the artifact in place.
    sql: `
      CREATE TABLE blueprint_messages (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        blueprint_id TEXT NOT NULL REFERENCES blueprints(id),
        phase        TEXT NOT NULL,   -- 'structure' | 'prd'
        role         TEXT NOT NULL,   -- 'user' | 'agent'
        content      TEXT NOT NULL,
        created_at   INTEGER NOT NULL
      );
      CREATE INDEX idx_bp_messages ON blueprint_messages(blueprint_id, phase);
    `,
  },
  {
    version: 6,
    // Per-task / per-blueprint model override (null = use the app
    // default / the agent CLI's own default).
    sql: `
      ALTER TABLE tasks ADD COLUMN model TEXT;
      ALTER TABLE blueprints ADD COLUMN model TEXT;
    `,
  },
  {
    version: 7,
    // Chat-first home (v1.1 C1): persistent discussion sessions. A
    // session may be bound to a project (null = global). Assistant
    // messages can carry proposed actions (json array) that the user
    // triggers as chips — the bridge from discussion into the P-E-V
    // pipeline.
    sql: `
      CREATE TABLE chat_sessions (
        id         TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        title      TEXT NOT NULL,
        agent_id   TEXT NOT NULL,
        model      TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE chat_messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES chat_sessions(id),
        role       TEXT NOT NULL,   -- 'user' | 'assistant'
        content    TEXT NOT NULL,
        actions    TEXT,            -- json: ChatAction[] proposed by the assistant
        created_at INTEGER NOT NULL
      );

      CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
      CREATE INDEX idx_chat_sessions_updated ON chat_sessions(updated_at);
    `,
  },
  {
    version: 8,
    // Built-in skills (v1.1 C3): optional per-task skill pack injected
    // into the plan/execute prompts.
    sql: 'ALTER TABLE tasks ADD COLUMN skill TEXT;',
  },
  {
    version: 9,
    // Chat management (Claude-app parity): pinned sessions sort first.
    sql: 'ALTER TABLE chat_sessions ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;',
  },
  {
    version: 10,
    // Persist generative outputs so they survive a restart (the
    // orchestrator previously kept them in memory only, which meant
    // questions + suggestions were lost on app restart, leaving the
    // blueprint permanently stuck in the QUESTIONS state).
    sql: `
      ALTER TABLE blueprints ADD COLUMN questions TEXT;
      ALTER TABLE blueprints ADD COLUMN suggestions TEXT;
    `,
  },
  {
    version: 11,
    // Multi-select answers: the old `answers` column stored single-value
    // selections. After converting to multi-select (answer -> answers
    // array), we migrate existing single-value answers into arrays.
    // The column itself stays (JSON blob), but the shape inside changes.
    // No DDL change needed — just a conceptual migration marker.
    sql: `
      UPDATE blueprints SET answers = (
        SELECT json_group_array(json_object(
          'question', j.value ->> '$.question',
          'answers',
            CASE
              WHEN j.value ->> '$.answer' IS NOT NULL AND j.value ->> '$.answer' != ''
              THEN json_array(j.value ->> '$.answer')
              ELSE json_array()
            END
        ))
        FROM json_each(answers) AS j
      )
      WHERE answers IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM json_each(answers) AS j
          WHERE j.value ->> '$.answer' IS NOT NULL
        )
    `,
  },
  {
    version: 12,
    // Per-task permission level for the Execute/Verify phases. Matches
    // the Terminal permission concept: safe (asks before edits), auto
    // (default, acceptEdits), full (skip all confirmations).
    sql: "ALTER TABLE tasks ADD COLUMN permission TEXT NOT NULL DEFAULT 'auto';",
  },
  {
    version: 13,
    // Missing indices for hot paths: free-tier concurrency check,
    // blueprint sequential feeding ordering, and orphan recovery.
    sql: `
      CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);
      CREATE INDEX IF NOT EXISTS idx_tasks_bp_order ON tasks(blueprint_id, order_index);
      CREATE INDEX IF NOT EXISTS idx_blueprints_state ON blueprints(state);
    `,
  },
  {
    version: 14,
    // Dependency graph for parallel execution (Pro tier). Each task may
    // declare which other tasks it depends on (by order_index, resolved
    // to task IDs after creation). Independent tasks can run in parallel.
    sql: 'ALTER TABLE tasks ADD COLUMN depends_on TEXT',
  },
]
