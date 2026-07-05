// Full generative Blueprint flow against MockAgentAdapter (no credits):
// idea -> questions -> answers -> structure -> PRD -> revise -> tasks.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentRegistry } from '../src/main/agents/AgentRegistry'
import { MockAgentAdapter } from '../src/main/agents/mock/MockAgentAdapter'
import { BlueprintOrchestrator } from '../src/main/blueprint/BlueprintOrchestrator'
import { type Database, openDatabase } from '../src/main/store/db'
import { BlueprintRepo } from '../src/main/store/repositories/BlueprintRepo'
import { ProjectRepo } from '../src/main/store/repositories/ProjectRepo'
import { TaskRepo } from '../src/main/store/repositories/TaskRepo'

let db: Database
let projects: ProjectRepo
let tasks: TaskRepo
let blueprints: BlueprintRepo
let orch: BlueprintOrchestrator
let projectId: string

function waitState(id: string, state: string) {
  return vi.waitFor(() => expect(blueprints.get(id)?.state).toBe(state), {
    timeout: 4000,
    interval: 10,
  })
}

beforeEach(() => {
  db = openDatabase(':memory:')
  projects = new ProjectRepo(db)
  tasks = new TaskRepo(db)
  blueprints = new BlueprintRepo(db)
  projectId = projects.add('demo', 'C:/demo').id
  orch = new BlueprintOrchestrator({
    projects,
    tasks,
    blueprints,
    registry: new AgentRegistry([new MockAgentAdapter(0)]),
    broadcastState: vi.fn(),
    broadcastEvent: vi.fn(),
  })
})

afterEach(() => db.close())

function newBp() {
  return blueprints.create({
    projectId,
    title: 'Padel Booking',
    idea: 'booking padel app',
    techPref: { mode: 'auto' },
    agentId: 'mock',
  })
}

describe('BlueprintOrchestrator generative flow', () => {
  it('generates questions and stays awaiting answers', async () => {
    const bp = newBp()
    orch.generateQuestions(bp.id)
    await waitState(bp.id, 'QUESTIONS')
    expect(orch.getQuestions(bp.id).length).toBeGreaterThan(0)
  })

  it('answers -> structure review with a parsed feature map', async () => {
    const bp = newBp()
    orch.generateQuestions(bp.id)
    await waitState(bp.id, 'QUESTIONS')

    orch.submitAnswers(bp.id, [{ question: 'Who?', answer: 'Customer' }])
    await waitState(bp.id, 'STRUCTURE_REVIEW')
    const loaded = blueprints.get(bp.id)
    expect(loaded?.answers?.[0]?.answer).toBe('Customer')
    expect(loaded?.structure?.features.length).toBeGreaterThan(0)
  })

  it('accept structure -> PRD review with markdown PRD', async () => {
    const bp = newBp()
    orch.generateQuestions(bp.id)
    await waitState(bp.id, 'QUESTIONS')
    orch.submitAnswers(bp.id, [])
    await waitState(bp.id, 'STRUCTURE_REVIEW')

    orch.acceptStructure(bp.id)
    await waitState(bp.id, 'PRD_REVIEW')
    expect(blueprints.get(bp.id)?.prd).toContain('# PRD')
  })

  it('revise PRD loops through generation and back to review', async () => {
    const bp = newBp()
    orch.generateQuestions(bp.id)
    await waitState(bp.id, 'QUESTIONS')
    orch.submitAnswers(bp.id, [])
    await waitState(bp.id, 'STRUCTURE_REVIEW')
    orch.acceptStructure(bp.id)
    await waitState(bp.id, 'PRD_REVIEW')

    orch.revisePrd(bp.id, 'use Postgres')
    await waitState(bp.id, 'PRD_REVIEW')
    expect(blueprints.get(bp.id)?.prd).toContain('# PRD')
  })

  it('accept PRD -> decompose into ordered Founcode tasks', async () => {
    const bp = newBp()
    orch.generateQuestions(bp.id)
    await waitState(bp.id, 'QUESTIONS')
    orch.submitAnswers(bp.id, [])
    await waitState(bp.id, 'STRUCTURE_REVIEW')
    orch.acceptStructure(bp.id)
    await waitState(bp.id, 'PRD_REVIEW')

    orch.acceptPrd(bp.id)
    await waitState(bp.id, 'TASK_REVIEW')

    const bpTasks = tasks.listByBlueprint(bp.id)
    expect(bpTasks.length).toBeGreaterThan(0)
    expect(bpTasks[0]?.orderIndex).toBe(0)
    expect(bpTasks[0]?.blueprintId).toBe(bp.id)
    expect(bpTasks[0]?.state).toBe('BACKLOG')
    // Order is preserved.
    expect(bpTasks.map((t) => t.orderIndex)).toEqual(bpTasks.map((_, i) => i))
  })

  it('recoverOrphans fails a blueprint stranded mid-generation', () => {
    const bp = newBp()
    blueprints.setState(bp.id, 'STRUCTURING')
    orch.recoverOrphans()
    expect(blueprints.get(bp.id)?.state).toBe('FAILED')
  })
})
