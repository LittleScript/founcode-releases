import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentRegistry } from '../src/main/agents/AgentRegistry'
import { MockAgentAdapter } from '../src/main/agents/mock/MockAgentAdapter'
import { ChatOrchestrator } from '../src/main/chat/ChatOrchestrator'
import { parseChatReply } from '../src/main/chat/chatActions'
import { type Database, openDatabase } from '../src/main/store/db'
import { BlueprintRepo } from '../src/main/store/repositories/BlueprintRepo'
import { ChatRepo } from '../src/main/store/repositories/ChatRepo'
import { ProjectRepo } from '../src/main/store/repositories/ProjectRepo'
import { SettingsRepo } from '../src/main/store/repositories/SettingsRepo'
import { TaskRepo } from '../src/main/store/repositories/TaskRepo'

describe('parseChatReply', () => {
  it('returns plain replies untouched', () => {
    const { reply, actions } = parseChatReply('Just an answer.\nWith two lines.')
    expect(reply).toContain('two lines')
    expect(actions).toEqual([])
  })

  it('extracts the actions tail and strips it from the reply', () => {
    const raw = `Let's build it.\n===ACTIONS===\n[{"type":"blueprint_from_idea","idea":"A padel booking app","title":"Padel"}]`
    const { reply, actions } = parseChatReply(raw)
    expect(reply).toBe("Let's build it.")
    expect(actions).toEqual([
      { type: 'blueprint_from_idea', idea: 'A padel booking app', title: 'Padel' },
    ])
  })

  it('drops unknown action types and survives broken json', () => {
    expect(
      parseChatReply(
        'x\n===ACTIONS===\n[{"type":"rm_rf_root"},{"type":"pause_auto","blueprintId":"b1"}]',
      ).actions,
    ).toEqual([{ type: 'pause_auto', blueprintId: 'b1' }])
    expect(parseChatReply('x\n===ACTIONS===\nnot json').actions).toEqual([])
  })
})

describe('ChatOrchestrator (mock agent)', () => {
  let db: Database
  let chat: ChatRepo
  let projects: ProjectRepo
  let tasks: TaskRepo
  let blueprints: BlueprintRepo
  let orchestrator: ChatOrchestrator
  const startNextTask = vi.fn()
  const pings: string[] = []

  beforeEach(() => {
    db = openDatabase(':memory:')
    chat = new ChatRepo(db)
    projects = new ProjectRepo(db)
    tasks = new TaskRepo(db)
    blueprints = new BlueprintRepo(db)
    orchestrator = new ChatOrchestrator({
      chat,
      projects,
      tasks,
      blueprints,
      registry: new AgentRegistry([new MockAgentAdapter(1)]),
      settings: new SettingsRepo(db),
      fallbackCwd: 'C:/tmp',
      broadcastEvent: vi.fn(),
      pingUpdated: (id) => pings.push(id),
      startNextTask,
    })
  })
  afterEach(() => db.close())

  function session() {
    return chat.createSession({ agentId: 'mock' })
  }

  it('persists user + assistant messages and titles the session', async () => {
    const s = session()
    orchestrator.send(s.id, 'Aku mau bikin app booking padel')
    await vi.waitFor(() => {
      const messages = chat.listMessages(s.id)
      expect(messages).toHaveLength(2)
      expect(messages[1]?.role).toBe('assistant')
    })
    expect(chat.getSession(s.id)?.title).toContain('padel')
    expect(pings.length).toBeGreaterThanOrEqual(2)
  })

  it('parses proposed actions from the reply ([mock:action])', async () => {
    const s = session()
    orchestrator.send(s.id, 'Oke gas [mock:action]')
    await vi.waitFor(() => {
      const last = chat.listMessages(s.id).at(-1)
      expect(last?.role).toBe('assistant')
      expect(last?.actions).toEqual([
        { type: 'blueprint_from_idea', idea: 'A mock app from our chat', title: 'Mock App' },
      ])
    })
  })

  it('rejects a second send while a reply is streaming', async () => {
    const s = session()
    orchestrator.send(s.id, 'first')
    expect(() => orchestrator.send(s.id, 'second')).toThrow('still replying')
    await vi.waitFor(() => expect(chat.listMessages(s.id).at(-1)?.role).toBe('assistant'))
  })

  describe('runAction (the chat -> pipeline bridge)', () => {
    it('create_task creates a real task', () => {
      const p = projects.add('demo', 'C:/demo')
      const s = session()
      const result = orchestrator.runAction(s.id, {
        type: 'create_task',
        projectId: p.id,
        title: 'Add dark mode',
        intent: 'Users asked for it',
      })
      expect(result.ok).toBe(true)
      expect(tasks.list(p.id)).toHaveLength(1)
    })

    it('add_task_to_blueprint queues a NEW idea at the end of a running blueprint', () => {
      const p = projects.add('demo', 'C:/demo')
      const bp = blueprints.create({
        projectId: p.id,
        title: 'Shop',
        idea: 'a shop',
        techPref: { mode: 'auto' },
        agentId: 'mock',
      })
      tasks.create({
        projectId: p.id,
        title: 'T1',
        intent: 'x',
        agentId: 'mock',
        blueprintId: bp.id,
        orderIndex: 0,
      })
      tasks.create({
        projectId: p.id,
        title: 'T2',
        intent: 'y',
        agentId: 'mock',
        blueprintId: bp.id,
        orderIndex: 1,
      })

      const s = session()
      const result = orchestrator.runAction(s.id, {
        type: 'add_task_to_blueprint',
        blueprintId: bp.id,
        title: 'Mid-flight idea',
        intent: 'User thought of it during the build',
      })
      expect(result.ok).toBe(true)
      const queued = tasks.listByBlueprint(bp.id)
      expect(queued).toHaveLength(3)
      expect(queued.at(-1)?.orderIndex).toBe(2)
      expect(queued.at(-1)?.agentId).toBe('mock') // inherits the blueprint's agent
    })

    it('pause_auto / resume_auto flip the advance mode of a running blueprint', () => {
      const p = projects.add('demo', 'C:/demo')
      const bp = blueprints.create({
        projectId: p.id,
        title: 'Shop',
        idea: 'a shop',
        techPref: { mode: 'auto' },
        agentId: 'mock',
        advanceMode: 'auto',
      })
      const s = session()
      expect(orchestrator.runAction(s.id, { type: 'pause_auto', blueprintId: bp.id }).ok).toBe(true)
      expect(blueprints.get(bp.id)?.advanceMode).toBe('manual')
      expect(orchestrator.runAction(s.id, { type: 'resume_auto', blueprintId: bp.id }).ok).toBe(
        true,
      )
      expect(blueprints.get(bp.id)?.advanceMode).toBe('auto')
    })

    it('start_next delegates to the blueprint orchestrator', () => {
      const s = session()
      orchestrator.runAction(s.id, { type: 'start_next', blueprintId: 'bp-1' })
      expect(startNextTask).toHaveBeenCalledWith('bp-1')
    })

    it('fails gracefully on unknown ids', () => {
      const s = session()
      const result = orchestrator.runAction(s.id, {
        type: 'create_task',
        projectId: 'nope',
        title: 'x',
        intent: 'y',
      })
      expect(result.ok).toBe(false)
    })
  })
})
