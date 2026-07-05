// FULL end-to-end cycle against the REAL Claude Code CLI:
// plan -> approve -> execute (worktree) -> verify (fresh agent) -> merge.
// Uses real credits and takes minutes. Only runs when explicitly asked:
//   FOUNCODE_IT=1 npx vitest run tests/full-cycle.integration.test.ts

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AgentRegistry } from '../src/main/agents/AgentRegistry'
import { ClaudeCodeAdapter } from '../src/main/agents/claude/ClaudeCodeAdapter'
import { WorktreeManager } from '../src/main/git/WorktreeManager'
import { Orchestrator } from '../src/main/orchestrator/Orchestrator'
import { type Database, openDatabase } from '../src/main/store/db'
import { ArtifactRepo } from '../src/main/store/repositories/ArtifactRepo'
import { ProjectRepo } from '../src/main/store/repositories/ProjectRepo'
import { TaskRepo } from '../src/main/store/repositories/TaskRepo'

const enabled = process.env.FOUNCODE_IT === '1'

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

async function waitForState(taskId: string, targets: string[], timeoutMs: number): Promise<string> {
  const start = Date.now()
  let lastState = ''
  while (Date.now() - start < timeoutMs) {
    const state = tasks.get(taskId)?.state ?? ''
    if (state !== lastState) {
      lastState = state
      console.log(`[full-cycle] state -> ${state} (+${Math.round((Date.now() - start) / 1000)}s)`)
    }
    if (targets.includes(state)) return state
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Timed out waiting for ${targets.join('|')}; last state: ${lastState}`)
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'founcode-e2e-'))
  repoPath = join(root, 'demo-repo')
  spawnSync('git', ['init', repoPath], { windowsHide: true })
  git(repoPath, 'config', 'user.name', 'E2E')
  git(repoPath, 'config', 'user.email', 'e2e@local')
  writeFileSync(
    join(repoPath, 'README.md'),
    '# Demo Repo\n\nA tiny repository used for Founcode end-to-end testing.\n',
  )
  writeFileSync(
    join(repoPath, 'greeting.js'),
    'function greeting(name) {\n  return `Hello, ${name}!`\n}\n\nmodule.exports = { greeting }\n',
  )
  git(repoPath, 'add', '-A')
  git(repoPath, 'commit', '-m', 'init demo repo')

  db = openDatabase(join(root, 'e2e.db'))
  projects = new ProjectRepo(db)
  tasks = new TaskRepo(db)
  artifacts = new ArtifactRepo(db)
  orchestrator = new Orchestrator({
    projects,
    tasks,
    artifacts,
    registry: new AgentRegistry([new ClaudeCodeAdapter()]),
    worktrees: new WorktreeManager(join(root, 'worktrees')),
    broadcastStateChange: ({ from, to }) => console.log(`[full-cycle] transition ${from} -> ${to}`),
    broadcastAgentEvent: ({ event }) => {
      if (event.type === 'tool_use') console.log(`[full-cycle] tool: ${event.name}`)
      if (event.type === 'error') console.log(`[full-cycle] ERROR: ${event.message}`)
      if (event.type === 'done') console.log(`[full-cycle] agent done, exit ${event.exitCode}`)
    },
  })
})

afterAll(() => {
  db?.close()
  if (root) rmSync(root, { recursive: true, force: true })
})

describe.skipIf(!enabled)('FULL CYCLE with real Claude Code', () => {
  it('plan -> approve -> execute -> verify -> merge lands the change on the user branch', {
    timeout: 20 * 60 * 1000,
  }, async () => {
    const project = projects.add('demo-repo', repoPath)
    const task = tasks.create({
      projectId: project.id,
      title: 'Add uppercase greeting variant',
      intent:
        'In greeting.js, add a new exported function greetingLoud(name) that returns the same ' +
        'greeting as greeting(name) but in ALL UPPERCASE. Keep the existing greeting function unchanged.',
      agentId: 'claude-code',
    })

    // PLAN
    orchestrator.startPlanning(task.id)
    const afterPlan = await waitForState(task.id, ['AWAITING_APPROVAL', 'FAILED'], 8 * 60 * 1000)
    expect(afterPlan).toBe('AWAITING_APPROVAL')

    const plan = artifacts.latest(task.id, 'plan')
    console.log(`[full-cycle] PLAN:\n${plan?.content}\n`)
    expect(plan?.content).toContain('# Plan:')
    expect(plan?.content).toContain('## Verification Criteria')

    // APPROVE -> EXECUTE -> VERIFY (automatic chain)
    orchestrator.approvePlan(task.id)
    const finalState = await waitForState(task.id, ['REVIEW', 'FAILED'], 15 * 60 * 1000)
    expect(finalState).toBe('REVIEW')

    const diff = artifacts.latest(task.id, 'diff')
    console.log(`[full-cycle] DIFF:\n${diff?.content}\n`)
    expect(diff?.content).toContain('greetingLoud')

    const reportRaw = artifacts.latest(task.id, 'verify_report')
    const report = JSON.parse(reportRaw?.content ?? '{}')
    console.log(`[full-cycle] VERDICT: ${JSON.stringify(report.verdict, null, 2)}`)
    expect(report.verdict).toBeTruthy()
    expect(['pass', 'pass_with_warnings']).toContain(report.verdict.verdict)

    // MERGE
    orchestrator.merge(task.id)
    expect(tasks.get(task.id)?.state).toBe('DONE')

    const merged = readFileSync(join(repoPath, 'greeting.js'), 'utf8')
    expect(merged).toContain('greetingLoud')
    expect(merged).toContain('greeting')
    expect(git(repoPath, 'status', '--porcelain')).toBe('')
    expect(git(repoPath, 'branch', '--list', 'founcode/*')).toBe('')
    expect(existsSync(tasks.get(task.id)?.worktree ?? join(root, 'nope'))).toBe(false)

    console.log('[full-cycle] ✅ merged greeting.js:\n' + merged)
  })
})
