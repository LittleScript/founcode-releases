// Execution flow against a real temp git repo + MockAgentAdapter:
// approve -> worktree -> agent writes -> diff artifact -> VERIFYING.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}

let root: string
let repoPath: string
let db: Database
let projects: ProjectRepo
let tasks: TaskRepo
let artifacts: ArtifactRepo
let orchestrator: Orchestrator

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'founcode-exec-'))
  repoPath = join(root, 'repo')
  spawnSync('git', ['init', repoPath], { windowsHide: true })
  git(repoPath, 'config', 'user.name', 'Test')
  git(repoPath, 'config', 'user.email', 'test@local')
  writeFileSync(join(repoPath, 'README.md'), 'demo\n')
  git(repoPath, 'add', '-A')
  git(repoPath, 'commit', '-m', 'init')

  db = openDatabase(':memory:')
  projects = new ProjectRepo(db)
  tasks = new TaskRepo(db)
  artifacts = new ArtifactRepo(db)
  orchestrator = new Orchestrator({
    projects,
    tasks,
    artifacts,
    registry: new AgentRegistry([new MockAgentAdapter(0)]),
    worktrees: new WorktreeManager(join(root, 'worktrees')),
    broadcastStateChange: vi.fn(),
    broadcastAgentEvent: vi.fn(),
  })
})

afterEach(() => {
  db.close()
  rmSync(root, { recursive: true, force: true })
})

async function planAndApprove(): Promise<string> {
  const p = projects.add('demo', repoPath)
  const t = tasks.create({ projectId: p.id, title: 'T', intent: 'do it', agentId: 'mock' })
  orchestrator.startPlanning(t.id)
  await vi.waitFor(() => expect(tasks.get(t.id)?.state).toBe('AWAITING_APPROVAL'), {
    timeout: 5000,
  })
  orchestrator.approvePlan(t.id)
  return t.id
}

describe('execution flow (mock agent + real git)', () => {
  it('full happy path: approve -> EXECUTING -> diff artifact -> VERIFYING', async () => {
    const taskId = await planAndApprove()
    expect(tasks.get(taskId)?.state).toBe('EXECUTING')

    await vi.waitFor(() => expect(tasks.get(taskId)?.state).toBe('VERIFYING'), { timeout: 10000 })

    const task = tasks.get(taskId)
    expect(task?.branch).toBe(`founcode/task-${taskId}`)
    expect(task?.worktree).toBeTruthy()

    const diff = artifacts.latest(taskId, 'diff')
    expect(diff?.content).toContain('mock-execution.txt')
    expect(diff?.content).toContain('Mock execution output')

    // User repo untouched.
    expect(git(repoPath, 'status', '--porcelain')).toBe('')

    const events = tasks.listEvents(taskId).map((e) => e.event)
    expect(events).toContain('worktree_created')
  })

  it('cancel during execution discards and cleans the worktree', async () => {
    // Slow mock so we can cancel mid-run.
    orchestrator = new Orchestrator({
      projects,
      tasks,
      artifacts,
      registry: new AgentRegistry([new MockAgentAdapter(300)]),
      worktrees: new WorktreeManager(join(root, 'worktrees')),
      broadcastStateChange: vi.fn(),
      broadcastAgentEvent: vi.fn(),
    })
    const taskId = await planAndApprove()
    expect(tasks.get(taskId)?.state).toBe('EXECUTING')

    const cancelled = orchestrator.cancel(taskId)
    expect(cancelled.state).toBe('DISCARDED')

    await new Promise((r) => setTimeout(r, 800))
    expect(tasks.get(taskId)?.state).toBe('DISCARDED')
    expect(tasks.get(taskId)?.worktree).toBeNull()
    expect(git(repoPath, 'branch', '--list', 'founcode/*')).toBe('')
  })

  it('recoverOrphans fails tasks stranded mid-phase', () => {
    const p = projects.add('demo', repoPath)
    const t1 = tasks.create({ projectId: p.id, title: 'a', intent: 'x', agentId: 'mock' })
    const t2 = tasks.create({ projectId: p.id, title: 'b', intent: 'x', agentId: 'mock' })
    tasks.setState(t1.id, 'EXECUTING')
    tasks.setState(t2.id, 'PLANNING')

    orchestrator.recoverOrphans()

    expect(tasks.get(t1.id)?.state).toBe('FAILED')
    expect(tasks.get(t2.id)?.state).toBe('FAILED')
    expect(tasks.listEvents(t1.id).map((e) => e.event)).toContain('crash_recovery')
  })
})
