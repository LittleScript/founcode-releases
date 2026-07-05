// B5: greenfield project creation + a Blueprint task building into the
// fresh repo, end-to-end with MockAgentAdapter (no credits).

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentRegistry } from '../src/main/agents/AgentRegistry'
import { MockAgentAdapter } from '../src/main/agents/mock/MockAgentAdapter'
import { BlueprintOrchestrator } from '../src/main/blueprint/BlueprintOrchestrator'
import { createGreenfieldRepo } from '../src/main/git/createGreenfieldRepo'
import { WorktreeManager } from '../src/main/git/WorktreeManager'
import { Orchestrator } from '../src/main/orchestrator/Orchestrator'
import { openDatabase } from '../src/main/store/db'
import { ArtifactRepo } from '../src/main/store/repositories/ArtifactRepo'
import { BlueprintRepo } from '../src/main/store/repositories/BlueprintRepo'
import { ProjectRepo } from '../src/main/store/repositories/ProjectRepo'
import { TaskRepo } from '../src/main/store/repositories/TaskRepo'

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true })
  if (r.status !== 0) throw new Error(r.stderr)
  return r.stdout.trim()
}

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'founcode-green-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('createGreenfieldRepo', () => {
  it('creates a committed git repo with README and gitignore', () => {
    const { path } = createGreenfieldRepo(root, 'my-app')
    expect(existsSync(join(path, '.git'))).toBe(true)
    expect(readFileSync(join(path, 'README.md'), 'utf8')).toContain('# my-app')
    expect(existsSync(join(path, '.gitignore'))).toBe(true)
    expect(git(path, 'log', '--oneline')).toContain('Founcode greenfield')
    expect(git(path, 'status', '--porcelain')).toBe('')
  })

  it('sanitizes the name and refuses a non-empty existing folder', () => {
    const { path } = createGreenfieldRepo(root, 'a/b:c')
    expect(path.endsWith('a-b-c')).toBe(true)
    expect(() => createGreenfieldRepo(root, 'a/b:c')).toThrow('non-empty')
  })
})

describe('greenfield blueprint build (mock)', () => {
  it('idea -> tasks -> build first task -> merge into the greenfield repo', {
    timeout: 30000,
  }, async () => {
    const { path: repoPath } = createGreenfieldRepo(root, 'padel')

    const db = openDatabase(':memory:')
    const projects = new ProjectRepo(db)
    const tasks = new TaskRepo(db)
    const artifacts = new ArtifactRepo(db)
    const blueprints = new BlueprintRepo(db)
    const projectId = projects.add('padel', repoPath).id

    let bo: BlueprintOrchestrator
    const orchestrator = new Orchestrator({
      projects,
      tasks,
      artifacts,
      registry: new AgentRegistry([new MockAgentAdapter(0)]),
      worktrees: new WorktreeManager(join(root, 'wt')),
      broadcastStateChange: vi.fn(),
      broadcastAgentEvent: vi.fn(),
      getPlanContext: (t) => (t.blueprintId ? 'PRD context' : ''),
      onTaskSettled: (t) => bo.handleTaskSettled(t),
      shouldAutoApprovePlan: (t) => t.blueprintId !== null,
    })
    bo = new BlueprintOrchestrator({
      projects,
      tasks,
      blueprints,
      registry: new AgentRegistry([new MockAgentAdapter(0)]),
      broadcastState: vi.fn(),
      broadcastEvent: vi.fn(),
      startTaskPlanning: (id) => orchestrator.startPlanning(id),
    })

    const waitBp = (id: string, s: string) =>
      vi.waitFor(() => expect(blueprints.get(id)?.state).toBe(s), { timeout: 5000, interval: 10 })

    // Drive the generative flow to a task graph.
    const bp = blueprints.create({
      projectId,
      title: 'Padel',
      idea: 'padel booking',
      techPref: { mode: 'auto' },
      agentId: 'mock',
    })
    bo.generateQuestions(bp.id)
    await waitBp(bp.id, 'QUESTIONS')
    bo.submitAnswers(bp.id, [])
    await waitBp(bp.id, 'STRUCTURE_REVIEW')
    bo.acceptStructure(bp.id)
    await waitBp(bp.id, 'PRD_REVIEW')
    bo.acceptPrd(bp.id)
    await waitBp(bp.id, 'TASK_REVIEW')

    // PRD was written into the greenfield repo.
    expect(existsSync(join(repoPath, '.founcode', 'blueprints'))).toBe(true)

    // Implement the first task and merge it.
    bo.startImplementation(bp.id, 'manual')
    const [t0] = tasks.listByBlueprint(bp.id)
    await vi.waitFor(() => expect(tasks.get(t0?.id ?? '')?.state).toBe('REVIEW'), {
      timeout: 10000,
    })
    orchestrator.merge(t0?.id ?? '')

    expect(tasks.get(t0?.id ?? '')?.state).toBe('DONE')
    expect(readFileSync(join(repoPath, 'mock-execution.txt'), 'utf8')).toContain('Mock execution')
    expect(git(repoPath, 'status', '--porcelain')).toBe('')
    expect(git(repoPath, 'branch', '--list', 'founcode/*')).toBe('')

    db.close()
  })
})
