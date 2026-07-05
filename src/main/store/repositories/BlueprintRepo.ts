import { nanoid } from 'nanoid'
import type {
  Blueprint,
  BlueprintAnswer,
  BlueprintMode,
  BlueprintStructure,
  TechPref,
} from '../../../shared/blueprint-types'
import type { BlueprintState } from '../../blueprint/BlueprintStateMachine'
import type { Database } from '../db'

interface BlueprintRow {
  id: string
  project_id: string
  title: string
  idea: string
  mode: string
  model: string | null
  tech_pref: string
  answers: string | null
  structure: string | null
  prd: string | null
  advance_mode: string
  agent_id: string
  state: string
  created_at: number
  updated_at: number
}

function toBlueprint(row: BlueprintRow): Blueprint {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    idea: row.idea,
    mode: (row.mode ?? 'greenfield') as BlueprintMode,
    model: row.model,
    techPref: JSON.parse(row.tech_pref) as TechPref,
    answers: row.answers ? (JSON.parse(row.answers) as BlueprintAnswer[]) : null,
    structure: row.structure ? (JSON.parse(row.structure) as BlueprintStructure) : null,
    prd: row.prd,
    advanceMode: row.advance_mode as 'manual' | 'auto',
    agentId: row.agent_id,
    state: row.state as BlueprintState,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateBlueprintInput {
  projectId: string
  title: string
  idea: string
  techPref: TechPref
  agentId: string
  mode?: BlueprintMode
  model?: string | null
  advanceMode?: 'manual' | 'auto'
}

export class BlueprintRepo {
  constructor(private db: Database) {}

  create(input: CreateBlueprintInput): Blueprint {
    const now = Date.now()
    const bp: Blueprint = {
      id: nanoid(),
      projectId: input.projectId,
      title: input.title,
      idea: input.idea,
      mode: input.mode ?? 'greenfield',
      model: input.model ?? null,
      techPref: input.techPref,
      answers: null,
      structure: null,
      prd: null,
      advanceMode: input.advanceMode ?? 'manual',
      agentId: input.agentId,
      state: 'IDEA',
      createdAt: now,
      updatedAt: now,
    }
    this.db
      .prepare(
        `INSERT INTO blueprints
         (id, project_id, title, idea, mode, model, tech_pref, advance_mode, agent_id, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        bp.id,
        bp.projectId,
        bp.title,
        bp.idea,
        bp.mode,
        bp.model,
        JSON.stringify(bp.techPref),
        bp.advanceMode,
        bp.agentId,
        bp.state,
        bp.createdAt,
        bp.updatedAt,
      )
    return bp
  }

  get(id: string): Blueprint | undefined {
    const row = this.db.prepare('SELECT * FROM blueprints WHERE id = ?').get(id) as
      | BlueprintRow
      | undefined
    return row ? toBlueprint(row) : undefined
  }

  list(projectId?: string): Blueprint[] {
    const rows = (projectId
      ? this.db
          .prepare('SELECT * FROM blueprints WHERE project_id = ? ORDER BY created_at DESC')
          .all(projectId)
      : this.db
          .prepare('SELECT * FROM blueprints ORDER BY created_at DESC')
          .all()) as unknown as BlueprintRow[]
    return rows.map(toBlueprint)
  }

  setState(id: string, state: BlueprintState): void {
    this.db
      .prepare('UPDATE blueprints SET state = ?, updated_at = ? WHERE id = ?')
      .run(state, Date.now(), id)
  }

  setAdvanceMode(id: string, mode: 'manual' | 'auto'): void {
    this.db
      .prepare('UPDATE blueprints SET advance_mode = ?, updated_at = ? WHERE id = ?')
      .run(mode, Date.now(), id)
  }

  update(
    id: string,
    fields: Partial<Pick<Blueprint, 'answers' | 'structure' | 'prd' | 'title'>>,
  ): void {
    const sets: string[] = []
    const values: unknown[] = []
    if (fields.title !== undefined) {
      sets.push('title = ?')
      values.push(fields.title)
    }
    if (fields.answers !== undefined) {
      sets.push('answers = ?')
      values.push(JSON.stringify(fields.answers))
    }
    if (fields.structure !== undefined) {
      sets.push('structure = ?')
      values.push(JSON.stringify(fields.structure))
    }
    if (fields.prd !== undefined) {
      sets.push('prd = ?')
      values.push(fields.prd)
    }
    if (sets.length === 0) return
    sets.push('updated_at = ?')
    values.push(Date.now(), id)
    this.db
      .prepare(`UPDATE blueprints SET ${sets.join(', ')} WHERE id = ?`)
      .run(...(values as never[]))
  }

  addMessage(
    blueprintId: string,
    phase: 'structure' | 'prd',
    role: 'user' | 'agent',
    content: string,
  ): void {
    this.db
      .prepare(
        'INSERT INTO blueprint_messages (blueprint_id, phase, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(blueprintId, phase, role, content, Date.now())
  }

  listMessages(blueprintId: string, phase: 'structure' | 'prd') {
    const rows = this.db
      .prepare(
        'SELECT id, phase, role, content, created_at FROM blueprint_messages WHERE blueprint_id = ? AND phase = ? ORDER BY id ASC',
      )
      .all(blueprintId, phase) as unknown as {
      id: number
      phase: string
      role: string
      content: string
      created_at: number
    }[]
    return rows.map((r) => ({
      id: r.id,
      phase: r.phase as 'structure' | 'prd',
      role: r.role as 'user' | 'agent',
      content: r.content,
      createdAt: r.created_at,
    }))
  }

  recordEvent(blueprintId: string, event: string, detail?: unknown): void {
    this.db
      .prepare(
        'INSERT INTO blueprint_events (blueprint_id, event, detail, created_at) VALUES (?, ?, ?, ?)',
      )
      .run(blueprintId, event, detail === undefined ? null : JSON.stringify(detail), Date.now())
  }
}
