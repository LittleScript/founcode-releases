import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Orchestrator } from '../src/main/orchestrator/Orchestrator'
import { type Database, openDatabase } from '../src/main/store/db'
import { ArtifactRepo } from '../src/main/store/repositories/ArtifactRepo'
import { ProjectRepo } from '../src/main/store/repositories/ProjectRepo'
import { TaskRepo } from '../src/main/store/repositories/TaskRepo'

let db: Database
let projects: ProjectRepo
let tasks: TaskRepo
let artifacts: ArtifactRepo

beforeEach(() => {
  db = openDatabase(':memory:')
  projects = new ProjectRepo(db)
  tasks = new TaskRepo(db)
  artifacts = new ArtifactRepo(db)
})

afterEach(() => db.close())

describe('ProjectRepo', () => {
  it('adds and lists projects', () => {
    const p = projects.add('demo', 'C:/repos/demo')
    expect(projects.list()).toEqual([p])
    expect(projects.get(p.id)).toEqual(p)
    expect(projects.getByPath('C:/repos/demo')).toEqual(p)
  })

  it('rejects duplicate paths (UNIQUE)', () => {
    projects.add('a', 'C:/same')
    expect(() => projects.add('b', 'C:/same')).toThrow()
  })
})

describe('TaskRepo', () => {
  it('creates tasks in BACKLOG with zero retries', () => {
    const p = projects.add('demo', 'C:/demo')
    const t = tasks.create({ projectId: p.id, title: 'T', intent: 'do x', agentId: 'claude-code' })
    expect(t.state).toBe('BACKLOG')
    expect(t.retryCount).toBe(0)
    expect(tasks.get(t.id)).toEqual(t)
  })

  it('filters list by project', () => {
    const p1 = projects.add('one', 'C:/one')
    const p2 = projects.add('two', 'C:/two')
    tasks.create({ projectId: p1.id, title: 'a', intent: 'x', agentId: 'claude-code' })
    tasks.create({ projectId: p2.id, title: 'b', intent: 'y', agentId: 'claude-code' })
    expect(tasks.list()).toHaveLength(2)
    expect(tasks.list(p1.id)).toHaveLength(1)
    expect(tasks.list(p1.id)[0]?.title).toBe('a')
  })

  it('updates state, worktree, and retry count', () => {
    const p = projects.add('demo', 'C:/demo')
    const t = tasks.create({ projectId: p.id, title: 'T', intent: 'x', agentId: 'claude-code' })
    tasks.setState(t.id, 'PLANNING')
    tasks.setWorktree(t.id, 'founcode/task-1', 'C:/wt/1')
    expect(tasks.incrementRetry(t.id)).toBe(1)
    const updated = tasks.get(t.id)
    expect(updated?.state).toBe('PLANNING')
    expect(updated?.branch).toBe('founcode/task-1')
    expect(updated?.retryCount).toBe(1)
  })

  it('records and lists audit events with JSON detail', () => {
    const p = projects.add('demo', 'C:/demo')
    const t = tasks.create({ projectId: p.id, title: 'T', intent: 'x', agentId: 'claude-code' })
    tasks.recordEvent(t.id, 'state_change', { from: 'BACKLOG', to: 'PLANNING' })
    tasks.recordEvent(t.id, 'user_action')
    const events = tasks.listEvents(t.id)
    expect(events).toHaveLength(2)
    expect(events[0]?.detail).toEqual({ from: 'BACKLOG', to: 'PLANNING' })
    expect(events[1]?.detail).toBeUndefined()
  })
})

describe('ArtifactRepo', () => {
  it('stores artifacts and returns the latest of a kind', () => {
    const p = projects.add('demo', 'C:/demo')
    const t = tasks.create({ projectId: p.id, title: 'T', intent: 'x', agentId: 'claude-code' })
    artifacts.add(t.id, 'plan', 'v1')
    artifacts.add(t.id, 'plan', 'v2')
    artifacts.add(t.id, 'log', 'log content')
    expect(artifacts.listByTask(t.id)).toHaveLength(3)
    expect(artifacts.latest(t.id, 'plan')?.content).toBe('v2')
  })
})

describe('Orchestrator', () => {
  it('applies legal actions: persists, audits, broadcasts', () => {
    const p = projects.add('demo', 'C:/demo')
    const t = tasks.create({ projectId: p.id, title: 'T', intent: 'x', agentId: 'claude-code' })
    const broadcast = vi.fn()
    const orchestrator = new Orchestrator(tasks, broadcast)

    const updated = orchestrator.applyAction(t.id, 'start_planning')

    expect(updated.state).toBe('PLANNING')
    expect(tasks.get(t.id)?.state).toBe('PLANNING')
    expect(broadcast).toHaveBeenCalledWith({ taskId: t.id, from: 'BACKLOG', to: 'PLANNING' })
    expect(tasks.listEvents(t.id)[0]?.event).toBe('state_change')
  })

  it('rejects illegal actions without touching state', () => {
    const p = projects.add('demo', 'C:/demo')
    const t = tasks.create({ projectId: p.id, title: 'T', intent: 'x', agentId: 'claude-code' })
    const broadcast = vi.fn()
    const orchestrator = new Orchestrator(tasks, broadcast)

    expect(() => orchestrator.applyAction(t.id, 'merge')).toThrow()
    expect(tasks.get(t.id)?.state).toBe('BACKLOG')
    expect(broadcast).not.toHaveBeenCalled()
    expect(tasks.listEvents(t.id)).toHaveLength(0)
  })

  it('throws for unknown task', () => {
    const orchestrator = new Orchestrator(tasks, vi.fn())
    expect(() => orchestrator.applyAction('nope', 'start_planning')).toThrow('Task not found')
  })
})
