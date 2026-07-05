import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Database, openDatabase } from '../src/main/store/db'
import { BlueprintRepo } from '../src/main/store/repositories/BlueprintRepo'
import { ProjectRepo } from '../src/main/store/repositories/ProjectRepo'

let db: Database
let projects: ProjectRepo
let blueprints: BlueprintRepo
let projectId: string

beforeEach(() => {
  db = openDatabase(':memory:')
  projects = new ProjectRepo(db)
  blueprints = new BlueprintRepo(db)
  projectId = projects.add('demo', 'C:/demo').id
})

afterEach(() => db.close())

function create() {
  return blueprints.create({
    projectId,
    title: 'Padel Booking',
    idea: 'booking padel app',
    techPref: { mode: 'auto' },
    agentId: 'mock',
  })
}

describe('BlueprintRepo', () => {
  it('creates a blueprint in IDEA state with manual advance by default', () => {
    const bp = create()
    expect(bp.state).toBe('IDEA')
    expect(bp.advanceMode).toBe('manual')
    expect(bp.mode).toBe('greenfield')
    expect(bp.model).toBeNull()
    expect(bp.techPref).toEqual({ mode: 'auto' })
    expect(blueprints.get(bp.id)).toEqual(bp)
  })

  it('lists blueprints by project, newest first', () => {
    const a = create()
    const b = create()
    const ids = blueprints.list(projectId).map((x) => x.id)
    expect(ids).toContain(a.id)
    expect(ids).toContain(b.id)
    expect(blueprints.list(projectId)).toHaveLength(2)
  })

  it('round-trips JSON blobs (answers, structure) and prd', () => {
    const bp = create()
    blueprints.update(bp.id, {
      answers: [{ question: 'Q1?', answer: 'A1' }],
      structure: {
        features: [{ name: 'Auth', priority: 'high', subFeatures: [{ name: 'Login' }] }],
      },
      prd: '# PRD\n\nHello',
    })
    const loaded = blueprints.get(bp.id)
    expect(loaded?.answers).toEqual([{ question: 'Q1?', answer: 'A1' }])
    expect(loaded?.structure?.features[0]?.subFeatures[0]?.name).toBe('Login')
    expect(loaded?.prd).toContain('# PRD')
  })

  it('updates state and advance mode', () => {
    const bp = create()
    blueprints.setState(bp.id, 'QUESTIONS')
    blueprints.setAdvanceMode(bp.id, 'auto')
    const loaded = blueprints.get(bp.id)
    expect(loaded?.state).toBe('QUESTIONS')
    expect(loaded?.advanceMode).toBe('auto')
  })

  it('records events with JSON detail', () => {
    const bp = create()
    blueprints.recordEvent(bp.id, 'questions_generated', { count: 5 })
    const rows = db
      .prepare('SELECT event, detail FROM blueprint_events WHERE blueprint_id = ?')
      .all(bp.id) as { event: string; detail: string }[]
    expect(rows).toHaveLength(1)
    expect(JSON.parse(rows[0]?.detail ?? '{}')).toEqual({ count: 5 })
  })

  it('enforces the project foreign key', () => {
    expect(() =>
      blueprints.create({
        projectId: 'missing',
        title: 'x',
        idea: 'y',
        techPref: { mode: 'auto' },
        agentId: 'mock',
      }),
    ).toThrow()
  })
})
