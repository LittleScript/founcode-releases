// End-to-end planning flow against the MockAgentAdapter: the exact
// pipeline the UI triggers, minus Electron.

import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentRegistry } from '../src/main/agents/AgentRegistry'
import { MockAgentAdapter } from '../src/main/agents/mock/MockAgentAdapter'
import { WorktreeManager } from '../src/main/git/WorktreeManager'
import { Orchestrator } from '../src/main/orchestrator/Orchestrator'
import { type Database, openDatabase } from '../src/main/store/db'
import { ArtifactRepo } from '../src/main/store/repositories/ArtifactRepo'
import { ProjectRepo } from '../src/main/store/repositories/ProjectRepo'
import { TaskRepo } from '../src/main/store/repositories/TaskRepo'

let db: Database
let projects: ProjectRepo
let tasks: TaskRepo
let artifacts: ArtifactRepo
let orchestrator: Orchestrator
let stateChanges: { from: string; to: string }[]
let agentEvents: { taskId: string }[]

function waitForState(taskId: string, state: string, timeoutMs = 5000): Promise<void> {
  return vi.waitFor(
    () => {
      expect(tasks.get(taskId)?.state).toBe(state)
    },
    { timeout: timeoutMs, interval: 20 },
  )
}

beforeEach(() => {
  db = openDatabase(':memory:')
  projects = new ProjectRepo(db)
  tasks = new TaskRepo(db)
  artifacts = new ArtifactRepo(db)
  stateChanges = []
  agentEvents = []
  orchestrator = new Orchestrator({
    projects,
    tasks,
    artifacts,
    registry: new AgentRegistry([new MockAgentAdapter(0)]),
    worktrees: new WorktreeManager(join(tmpdir(), 'founcode-test-unused')),
    broadcastStateChange: (c) => stateChanges.push(c),
    broadcastAgentEvent: (e) => agentEvents.push(e),
  })
})

afterEach(() => db.close())

function createTask(intent = 'Add a feature') {
  const p = projects.add('demo', 'C:/demo')
  return tasks.create({ projectId: p.id, title: 'T', intent, agentId: 'mock' })
}

describe('planning flow (mock agent)', () => {
  it('happy path: BACKLOG -> PLANNING -> AWAITING_APPROVAL with plan artifact', async () => {
    const t = createTask()
    orchestrator.startPlanning(t.id)
    expect(tasks.get(t.id)?.state).toBe('PLANNING')

    await waitForState(t.id, 'AWAITING_APPROVAL')

    const plan = artifacts.latest(t.id, 'plan')
    expect(plan?.content).toContain('# Plan:')
    expect(artifacts.latest(t.id, 'log')).toBeDefined()
    expect(agentEvents.length).toBeGreaterThan(0)
    expect(stateChanges.map((c) => c.to)).toEqual(['PLANNING', 'AWAITING_APPROVAL'])
  })

  it('invalid plan format: auto re-prompt once, then surface raw for manual edit', async () => {
    const t = createTask('Do a thing [mock:invalid]')
    orchestrator.startPlanning(t.id)

    await waitForState(t.id, 'AWAITING_APPROVAL')

    // Mock stays invalid on retry -> raw surfaced, retry + invalid recorded.
    const eventNames = tasks.listEvents(t.id).map((e) => e.event)
    expect(eventNames).toContain('plan_format_retry')
    expect(eventNames).toContain('plan_format_invalid')
    expect(artifacts.latest(t.id, 'plan')?.content).toContain('prose')
    // Two attempts -> two log artifacts.
    expect(artifacts.listByTask(t.id).filter((a) => a.kind === 'log')).toHaveLength(2)
  })

  it('agent failure: task lands in FAILED', async () => {
    const t = createTask('Do a thing [mock:fail]')
    orchestrator.startPlanning(t.id)
    await waitForState(t.id, 'FAILED')
    expect(tasks.listEvents(t.id).map((e) => e.event)).toContain('agent_error')
  })

  it('approvePlan stores the edited plan and moves to EXECUTING', async () => {
    const t = createTask()
    orchestrator.startPlanning(t.id)
    await waitForState(t.id, 'AWAITING_APPROVAL')

    const plan = artifacts.latest(t.id, 'plan')?.content ?? ''
    const edited = plan.replace('Mock implementation plan', 'Edited by user')
    const updated = orchestrator.approvePlan(t.id, edited)

    expect(updated.state).toBe('EXECUTING')
    expect(artifacts.latest(t.id, 'plan')?.content).toContain('Edited by user')
  })

  it('approvePlan rejects an invalid edited plan', async () => {
    const t = createTask()
    orchestrator.startPlanning(t.id)
    await waitForState(t.id, 'AWAITING_APPROVAL')

    expect(() => orchestrator.approvePlan(t.id, 'garbage')).toThrow('invalid')
    expect(tasks.get(t.id)?.state).toBe('AWAITING_APPROVAL')
  })

  it('replan with feedback runs the agent again from AWAITING_APPROVAL', async () => {
    const t = createTask()
    orchestrator.startPlanning(t.id)
    await waitForState(t.id, 'AWAITING_APPROVAL')

    orchestrator.startPlanning(t.id, 'Please also cover the settings page')
    expect(tasks.get(t.id)?.state).toBe('PLANNING')
    await waitForState(t.id, 'AWAITING_APPROVAL')

    expect(artifacts.listByTask(t.id).filter((a) => a.kind === 'plan').length).toBe(2)
  })

  it('cancel during planning discards the task and the runner stays silent', async () => {
    const slow = new MockAgentAdapter(200)
    orchestrator = new Orchestrator({
      projects,
      tasks,
      artifacts,
      registry: new AgentRegistry([slow]),
      worktrees: new WorktreeManager(join(tmpdir(), 'founcode-test-unused')),
      broadcastStateChange: (c) => stateChanges.push(c),
      broadcastAgentEvent: (e) => agentEvents.push(e),
    })
    const t = createTask()
    orchestrator.startPlanning(t.id)
    const cancelled = orchestrator.cancel(t.id)
    expect(cancelled.state).toBe('DISCARDED')

    // Give the aborted runner time to finish; state must not move again.
    await new Promise((r) => setTimeout(r, 500))
    expect(tasks.get(t.id)?.state).toBe('DISCARDED')
  })
})
