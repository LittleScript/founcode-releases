// Chat home against the REAL Claude Code CLI — one cheap send that
// exercises the full path: context snapshot -> prompt -> agent ->
// reply persisted (+ actions parsed if proposed). Gated:
//   FOUNCODE_IT=1 npx vitest run tests/chat-e2e.integration.test.ts

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { AgentRegistry } from '../src/main/agents/AgentRegistry'
import { ChatOrchestrator } from '../src/main/chat/ChatOrchestrator'
import { type Database, openDatabase } from '../src/main/store/db'
import { BlueprintRepo } from '../src/main/store/repositories/BlueprintRepo'
import { ChatRepo } from '../src/main/store/repositories/ChatRepo'
import { ProjectRepo } from '../src/main/store/repositories/ProjectRepo'
import { SettingsRepo } from '../src/main/store/repositories/SettingsRepo'
import { TaskRepo } from '../src/main/store/repositories/TaskRepo'

const enabled = process.env.FOUNCODE_IT === '1'

describe.skipIf(!enabled)('Chat home (real Claude Code)', () => {
  let db: Database
  let dir: string
  let chat: ChatRepo
  let orchestrator: ChatOrchestrator

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'founcode-chat-it-'))
    execFileSync('git', ['init'], { cwd: dir })
    writeFileSync(join(dir, 'README.md'), '# Demo\nA tiny demo repo for Founcode chat E2E.\n')

    db = openDatabase(':memory:')
    chat = new ChatRepo(db)
    const projects = new ProjectRepo(db)
    projects.add('demo', dir)
    orchestrator = new ChatOrchestrator({
      chat,
      projects,
      tasks: new TaskRepo(db),
      blueprints: new BlueprintRepo(db),
      registry: new AgentRegistry(),
      settings: new SettingsRepo(db),
      fallbackCwd: dir,
      broadcastEvent: vi.fn(),
      pingUpdated: vi.fn(),
      startNextTask: vi.fn(),
    })
  })

  afterAll(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('answers a workspace question with a persisted assistant reply', async () => {
    const session = chat.createSession({ agentId: 'claude-code', model: 'haiku' })
    orchestrator.send(session.id, 'Berapa project yang terdaftar di workspace ini? Jawab singkat.')

    await vi.waitFor(
      () => {
        const last = chat.listMessages(session.id).at(-1)
        expect(last?.role).toBe('assistant')
      },
      { timeout: 120_000, interval: 2000 },
    )

    const last = chat.listMessages(session.id).at(-1)
    expect(last?.content).toBeTruthy()
    expect(last?.content).not.toMatch(/^\(error|^\(no response/)
    // It can see the workspace: one project named "demo".
    expect(last?.content.toLowerCase()).toMatch(/1|satu|demo/)
  }, 180_000)
})
