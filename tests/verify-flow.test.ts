// Full Phase-4 flow against a real temp git repo + MockAgentAdapter:
// verify verdicts, the bounded fix loop, and finalization (merge /
// send back / discard) including conflict safety.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  root = mkdtempSync(join(tmpdir(), 'founcode-verify-'))
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

async function runToState(intent: string, target: string): Promise<string> {
  const p = projects.add('demo', repoPath)
  const t = tasks.create({ projectId: p.id, title: 'T', intent, agentId: 'mock' })
  orchestrator.startPlanning(t.id)
  await vi.waitFor(() => expect(tasks.get(t.id)?.state).toBe('AWAITING_APPROVAL'), {
    timeout: 5000,
  })
  orchestrator.approvePlan(t.id)
  await vi.waitFor(() => expect(tasks.get(t.id)?.state).toBe(target), { timeout: 15000 })
  return t.id
}

describe('verify flow (mock agent + real git)', () => {
  it('pass verdict: task reaches REVIEW with a parsed verify report', async () => {
    const taskId = await runToState('do it', 'REVIEW')

    const report = JSON.parse(artifacts.latest(taskId, 'verify_report')?.content ?? '{}')
    expect(report.verdict.verdict).toBe('pass')
    expect(report.verdict.criteria.length).toBeGreaterThan(0)
    expect(tasks.get(taskId)?.retryCount).toBe(0)
  })

  it('fail verdict: bounded fix loop runs, then FAILED after retries exhausted', {
    timeout: 30000,
  }, async () => {
    // Mock plan embeds the intent, verify prompt embeds the plan -> the
    // marker reaches the mock verifier, which then always fails.
    const taskId = await runToState('break it [mock:verify-fail]', 'FAILED')

    const task = tasks.get(taskId)
    expect(task?.retryCount).toBe(2)
    const events = tasks.listEvents(taskId).map((e) => e.event)
    expect(events.filter((e) => e === 'fix_iteration')).toHaveLength(2)
    expect(events).toContain('fix_loop_exhausted')
  })

  it('merge: changes land on the user branch, worktree + branch cleaned', async () => {
    const taskId = await runToState('do it', 'REVIEW')
    const worktreePath = tasks.get(taskId)?.worktree ?? ''

    const merged = orchestrator.merge(taskId)

    expect(merged.state).toBe('DONE')
    expect(readFileSync(join(repoPath, 'mock-execution.txt'), 'utf8')).toContain(
      'Mock execution output',
    )
    expect(git(repoPath, 'status', '--porcelain')).toBe('')
    expect(git(repoPath, 'branch', '--list', 'founcode/*')).toBe('')
    expect(existsSync(worktreePath)).toBe(false)
  })

  it('merge refuses when the user repo is dirty, leaving everything intact', async () => {
    const taskId = await runToState('do it', 'REVIEW')
    writeFileSync(join(repoPath, 'README.md'), 'demo\nlocal edit\n')

    expect(() => orchestrator.merge(taskId)).toThrow('uncommitted changes')
    expect(tasks.get(taskId)?.state).toBe('REVIEW')
    expect(readFileSync(join(repoPath, 'README.md'), 'utf8')).toContain('local edit')
  })

  it('merge conflict aborts cleanly: no partial state in the user repo', async () => {
    const taskId = await runToState('do it', 'REVIEW')
    // Create a conflicting commit on the user branch.
    writeFileSync(join(repoPath, 'mock-execution.txt'), 'conflicting user content\n')
    git(repoPath, 'add', '-A')
    git(repoPath, 'commit', '-m', 'user conflicting change')

    expect(() => orchestrator.merge(taskId)).toThrow('Merge conflict')
    expect(tasks.get(taskId)?.state).toBe('REVIEW')
    expect(git(repoPath, 'status', '--porcelain')).toBe('')
    expect(readFileSync(join(repoPath, 'mock-execution.txt'), 'utf8')).toContain(
      'conflicting user content',
    )
  })

  it('send back re-executes with feedback and returns to REVIEW', async () => {
    const taskId = await runToState('do it', 'REVIEW')

    orchestrator.sendBack(taskId, 'Please adjust the output file')
    expect(tasks.get(taskId)?.state).toBe('EXECUTING')

    await vi.waitFor(() => expect(tasks.get(taskId)?.state).toBe('REVIEW'), { timeout: 15000 })
    const events = tasks.listEvents(taskId).map((e) => e.event)
    expect(events).toContain('fix_iteration')
  })

  it('discard from REVIEW cleans worktree and branch', async () => {
    const taskId = await runToState('do it', 'REVIEW')
    const worktreePath = tasks.get(taskId)?.worktree ?? ''

    const discarded = orchestrator.discard(taskId)

    expect(discarded.state).toBe('DISCARDED')
    expect(existsSync(worktreePath)).toBe(false)
    expect(git(repoPath, 'branch', '--list', 'founcode/*')).toBe('')
  })

  it('approved plan is copied into <project>/.founcode/plans and git-excluded', async () => {
    const taskId = await runToState('do it', 'REVIEW')

    const planCopy = join(repoPath, '.founcode', 'plans', `${taskId}.md`)
    expect(existsSync(planCopy)).toBe(true)
    expect(readFileSync(planCopy, 'utf8')).toContain('# Plan:')
    // Repo-local exclude keeps user's tracked .gitignore untouched.
    expect(readFileSync(join(repoPath, '.git', 'info', 'exclude'), 'utf8')).toContain('.founcode/')
    expect(git(repoPath, 'status', '--porcelain')).toBe('')
  })
})
