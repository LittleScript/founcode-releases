// FULL Blueprint E2E against the REAL Claude Code CLI:
// greenfield repo -> idea -> questions -> structure -> PRD -> tasks ->
// build & merge the first task. Real credits, several minutes. Gated:
//   FOUNCODE_IT=1 npx vitest run tests/blueprint-e2e.integration.test.ts

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AgentRegistry } from '../src/main/agents/AgentRegistry'
import { ClaudeCodeAdapter } from '../src/main/agents/claude/ClaudeCodeAdapter'
import { BlueprintOrchestrator } from '../src/main/blueprint/BlueprintOrchestrator'
import { createGreenfieldRepo } from '../src/main/git/createGreenfieldRepo'
import { WorktreeManager } from '../src/main/git/WorktreeManager'
import { Orchestrator } from '../src/main/orchestrator/Orchestrator'
import { openDatabase } from '../src/main/store/db'
import { ArtifactRepo } from '../src/main/store/repositories/ArtifactRepo'
import { BlueprintRepo } from '../src/main/store/repositories/BlueprintRepo'
import { ProjectRepo } from '../src/main/store/repositories/ProjectRepo'
import { TaskRepo } from '../src/main/store/repositories/TaskRepo'

const enabled = process.env.FOUNCODE_IT === '1'

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true })
  if (r.status !== 0) throw new Error(r.stderr)
  return r.stdout.trim()
}

let root: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'founcode-bpe2e-'))
})
afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})

describe.skipIf(!enabled)('Blueprint E2E with real Claude Code', () => {
  it('greenfield idea -> PRD -> tasks -> build & merge first task', {
    timeout: 25 * 60 * 1000,
  }, async () => {
    const { path: repoPath } = createGreenfieldRepo(root, 'quote-api')

    const db = openDatabase(join(root, 'e2e.db'))
    const projects = new ProjectRepo(db)
    const tasks = new TaskRepo(db)
    const artifacts = new ArtifactRepo(db)
    const blueprints = new BlueprintRepo(db)
    const projectId = projects.add('quote-api', repoPath).id

    let bo: BlueprintOrchestrator
    const orchestrator = new Orchestrator({
      projects,
      tasks,
      artifacts,
      registry: new AgentRegistry([new ClaudeCodeAdapter()]),
      worktrees: new WorktreeManager(join(root, 'wt')),
      broadcastStateChange: ({ to }) => console.log(`[bp-e2e] task -> ${to}`),
      broadcastAgentEvent: () => {},
      getPlanContext: (t) => buildCtx(t, blueprints, tasks),
      onTaskSettled: (t) => bo.handleTaskSettled(t),
      shouldAutoApprovePlan: (t) => t.blueprintId !== null,
    })
    bo = new BlueprintOrchestrator({
      projects,
      tasks,
      blueprints,
      registry: new AgentRegistry([new ClaudeCodeAdapter()]),
      broadcastState: ({ to }) => console.log(`[bp-e2e] blueprint -> ${to}`),
      broadcastEvent: () => {},
      startTaskPlanning: (id) => orchestrator.startPlanning(id),
    })

    const waitBp = (id: string, states: string[], ms: number) =>
      poll(() => blueprints.get(id)?.state ?? '', states, ms, '[bp-e2e] blueprint')
    const waitTask = (id: string, states: string[], ms: number) =>
      poll(() => tasks.get(id)?.state ?? '', states, ms, '[bp-e2e] task')

    const bp = blueprints.create({
      projectId,
      title: 'Quote API',
      idea: 'A tiny HTTP API in a single Node.js file that returns a random inspirational quote as JSON from an in-memory list. No database.',
      techPref: { mode: 'manual', stack: 'Plain Node.js, no dependencies' },
      agentId: 'claude-code',
      advanceMode: 'manual',
    })

    bo.generateQuestions(bp.id)
    expect(await waitBp(bp.id, ['QUESTIONS', 'FAILED'], 5 * 60 * 1000)).toBe('QUESTIONS')

    bo.submitAnswers(bp.id, []) // skip all — exercise the default path
    expect(await waitBp(bp.id, ['STRUCTURE_REVIEW', 'FAILED'], 5 * 60 * 1000)).toBe(
      'STRUCTURE_REVIEW',
    )
    expect(blueprints.get(bp.id)?.structure?.features.length).toBeGreaterThan(0)

    bo.acceptStructure(bp.id)
    expect(await waitBp(bp.id, ['PRD_REVIEW', 'FAILED'], 5 * 60 * 1000)).toBe('PRD_REVIEW')
    const prd = blueprints.get(bp.id)?.prd ?? ''
    console.log(`[bp-e2e] PRD length: ${prd.length}`)
    expect(prd).toContain('#')

    bo.acceptPrd(bp.id)
    expect(await waitBp(bp.id, ['TASK_REVIEW', 'FAILED'], 5 * 60 * 1000)).toBe('TASK_REVIEW')
    const bpTasks = tasks.listByBlueprint(bp.id)
    console.log(`[bp-e2e] ${bpTasks.length} tasks:`, bpTasks.map((t) => t.title).join(' | '))
    expect(bpTasks.length).toBeGreaterThan(0)

    // Build & merge the first task (auto-approves its plan).
    bo.startImplementation(bp.id, 'manual')
    const t0 = tasks.listByBlueprint(bp.id)[0]
    expect(await waitTask(t0?.id ?? '', ['REVIEW', 'FAILED'], 12 * 60 * 1000)).toBe('REVIEW')

    orchestrator.merge(t0?.id ?? '')
    expect(tasks.get(t0?.id ?? '')?.state).toBe('DONE')
    expect(git(repoPath, 'status', '--porcelain')).toBe('')
    expect(git(repoPath, 'branch', '--list', 'founcode/*')).toBe('')
    // Something was actually built beyond the initial scaffold.
    const files = git(repoPath, 'ls-files').split('\n')
    console.log('[bp-e2e] repo files:', files.join(', '))
    expect(files.length).toBeGreaterThan(2)
    expect(existsSync(join(repoPath, '.founcode', 'blueprints'))).toBe(true)

    db.close()
  })
})

async function poll(
  read: () => string,
  targets: string[],
  timeoutMs: number,
  tag: string,
): Promise<string> {
  const start = Date.now()
  let last = ''
  while (Date.now() - start < timeoutMs) {
    const s = read()
    if (s !== last) {
      last = s
      console.log(`${tag} -> ${s} (+${Math.round((Date.now() - start) / 1000)}s)`)
    }
    if (targets.includes(s)) return s
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error(`Timed out waiting for ${targets.join('|')}; last: ${last}`)
}

function buildCtx(
  task: { blueprintId: string | null },
  blueprints: BlueprintRepo,
  tasks: TaskRepo,
): string {
  if (!task.blueprintId) return ''
  const bp = blueprints.get(task.blueprintId)
  if (!bp?.prd) return ''
  const done = tasks.listByBlueprint(task.blueprintId).filter((t) => t.state === 'DONE')
  return `## Product context (PRD)\n${bp.prd}\n\n## Completed\n${done.map((t) => `- ${t.title}`).join('\n') || '- none'}`
}
