// Agent Terminal service (v1.3 T2): turns a "start terminal" request
// into a live PTY-backed agent session and streams it to the renderer.
// Worktree isolation + the merge gate come in T4 — for now the session
// runs in the project's own directory.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PermissionLevel } from '../../shared/settings-types'
import type {
  StartTerminalInput,
  TerminalReview,
  TerminalSession,
} from '../../shared/terminal-types'
import { isInteractive } from '../agents/AgentAdapter'
import type { AgentRegistry } from '../agents/AgentRegistry'
import type { WorktreeManager } from '../git/WorktreeManager'
import type { ArtifactRepo } from '../store/repositories/ArtifactRepo'
import type { ProjectRepo } from '../store/repositories/ProjectRepo'
import type { TaskRepo } from '../store/repositories/TaskRepo'
import { PtyManager } from './PtyManager'

export interface TerminalDeps {
  registry: AgentRegistry
  projects: ProjectRepo
  tasks: TaskRepo
  artifacts: ArtifactRepo
  worktrees: WorktreeManager
  getTier: () => 'free' | 'pro'
  broadcastData: (p: { sessionId: string; data: string }) => void
  broadcastExit: (p: { sessionId: string; exitCode: number }) => void
}

// Terminals hold a bounded rolling transcript (agent output) so it can
// be saved to Foundry when a task-bound session ends.
const TRANSCRIPT_CAP = 200_000

// Per-session worktree bookkeeping (isolated sessions only).
interface Isolation {
  wtId: string
  worktreePath: string
  baseRef: string
  projectPath: string
}

export class TerminalService {
  private pty: PtyManager
  private meta = new Map<string, TerminalSession>()
  private isolation = new Map<string, Isolation>()
  private transcript = new Map<string, string>()

  constructor(private deps: TerminalDeps) {
    this.pty = new PtyManager({
      onData: (id, data) => {
        const prev = this.transcript.get(id) ?? ''
        const next = (prev + data).slice(-TRANSCRIPT_CAP)
        this.transcript.set(id, next)
        this.deps.broadcastData({ sessionId: id, data })
      },
      onExit: (id, exitCode) => {
        const m = this.meta.get(id)
        if (m) m.exitCode = exitCode
        this.saveTranscript(id)
        this.deps.broadcastExit({ sessionId: id, exitCode })
      },
    })
  }

  // Free tier: one live terminal at a time (Pro = parallel).
  private ensureCapacity(): void {
    if (this.deps.getTier() === 'free' && this.list().length >= 1) {
      throw new Error(
        'Free plan runs one terminal at a time — upgrade to Pro for parallel terminals.',
      )
    }
  }

  // Briefing file dropped into the worktree so a taken-over agent knows
  // exactly what it's continuing (goal, plan, verdict, recent activity).
  private writeTakeoverContext(worktree: string, taskId: string): void {
    const task = this.deps.tasks.get(taskId)
    if (!task) return
    const plan = this.deps.artifacts.latest(taskId, 'plan')?.content
    const verdict = this.deps.artifacts.latest(taskId, 'verify_report')?.content
    const events = this.deps.tasks
      .listEvents(taskId)
      .slice(-8)
      .map((e) => `- ${e.event}`)
      .join('\n')
    const md = [
      `# Continuing: ${task.title}`,
      '',
      '## Goal',
      task.intent,
      '',
      ...(plan ? ['## The plan so far', plan, ''] : []),
      ...(verdict ? ['## Latest verification result', verdict, ''] : []),
      '## Recent activity',
      events || '- (none recorded)',
      '',
      '---',
      `This work lives in an isolated git worktree (branch for task ${taskId}). Make your changes here; the user reviews and merges them afterward.`,
    ].join('\n')
    try {
      // Keep it in .founcode/ with a self-ignoring .gitignore so the
      // briefing never pollutes the diff the user reviews/merges.
      const dir = join(worktree, '.founcode')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, '.gitignore'), '*\n')
      writeFileSync(join(dir, 'CONTEXT.md'), md)
    } catch {
      // Non-fatal: the agent just won't have the briefing file.
    }
  }

  // A task-bound session's transcript is saved to Foundry (as a task
  // log artifact) so the interactive work is browsable afterward.
  private saveTranscript(sessionId: string): void {
    const session = this.meta.get(sessionId)
    const text = this.transcript.get(sessionId)?.trim()
    if (session?.taskId && text) {
      this.deps.artifacts.add(session.taskId, 'log', `# Terminal session\n\n${text}`)
    }
    this.transcript.delete(sessionId)
  }

  async start(input: StartTerminalInput): Promise<TerminalSession> {
    const project = this.deps.projects.get(input.projectId)
    if (!project) throw new Error('Unknown project')
    const adapter = this.deps.registry.get(input.agentId)
    if (!adapter) throw new Error(`Unknown agent: ${input.agentId}`)
    if (!isInteractive(adapter)) {
      throw new Error(`${adapter.displayName} does not support interactive terminal sessions yet.`)
    }

    this.ensureCapacity()
    const permission: PermissionLevel = input.permission
    // Default: an isolated worktree so the agent's free-form edits never
    // touch the user's checkout until they review & merge (T4). The
    // worktree id needs to be known before we have a session id, so use
    // a dedicated ticket.
    const isolated = input.isolate !== false
    let cwd = project.path
    let iso: Isolation | null = null
    if (isolated) {
      const wtId = `term-${Date.now().toString(36)}`
      const info = this.deps.worktrees.create(project.path, wtId)
      cwd = info.worktreePath
      iso = {
        wtId,
        worktreePath: info.worktreePath,
        baseRef: info.baseRef,
        projectPath: project.path,
      }
    }

    const launch = adapter.launchInteractive({ cwd, permission, model: input.model })
    if (!launch) {
      if (iso) this.deps.worktrees.remove(project.path, iso.wtId)
      throw new Error(`${adapter.displayName} CLI not found on PATH`)
    }

    const handle = await this.pty.start(launch, { cwd })
    const session: TerminalSession = {
      id: handle.id,
      agentId: input.agentId,
      projectId: input.projectId,
      cwd,
      permission,
      model: input.model ?? null,
      isolated,
      taskId: null,
      exitCode: null,
      createdAt: Date.now(),
    }
    this.meta.set(handle.id, session)
    if (iso) this.isolation.set(handle.id, iso)
    return session
  }

  // Bridge pipeline → terminal: take over an existing task's worktree
  // interactively. Runs in the task's own isolated worktree (no nested
  // worktree); the user then merges through the normal task Review gate.
  async startForTask(input: {
    taskId: string
    agentId: string
    permission: PermissionLevel
    model?: string
  }): Promise<TerminalSession> {
    this.ensureCapacity()
    const task = this.deps.tasks.get(input.taskId)
    if (!task) throw new Error('Unknown task')
    if (!task.worktree) {
      throw new Error('This task has no worktree yet — run it through Plan/Execute first.')
    }
    const adapter = this.deps.registry.get(input.agentId)
    if (!adapter || !isInteractive(adapter)) {
      throw new Error(`${adapter?.displayName ?? input.agentId} has no interactive terminal.`)
    }

    // Give the agent the task's context so it isn't a blank terminal:
    // write a briefing file into the worktree and seed the first turn
    // with a short, injection-safe prompt pointing at it.
    this.writeTakeoverContext(task.worktree, task.id)
    const initialPrompt =
      "You are continuing a task already in progress. Read .founcode/CONTEXT.md in the current folder first — it has the goal, the plan, and what's been done — then help me finish it."

    const launch = adapter.launchInteractive({
      cwd: task.worktree,
      permission: input.permission,
      model: input.model,
      initialPrompt,
    })
    if (!launch) throw new Error(`${adapter.displayName} CLI not found on PATH`)

    const handle = await this.pty.start(launch, { cwd: task.worktree })
    const session: TerminalSession = {
      id: handle.id,
      agentId: input.agentId,
      projectId: task.projectId,
      cwd: task.worktree,
      permission: input.permission,
      model: input.model ?? null,
      isolated: false, // the task owns the worktree + its merge gate
      taskId: task.id,
      exitCode: null,
      createdAt: Date.now(),
    }
    this.meta.set(handle.id, session)
    return session
  }

  // Finish an isolated session: commit whatever the agent left and
  // return the diff for review. (Non-isolated sessions have nothing to
  // review — their edits are already in the repo.)
  finish(sessionId: string): TerminalReview {
    const session = this.meta.get(sessionId)
    const iso = this.isolation.get(sessionId)
    if (!session || !iso) return { changed: false, diff: '', filesChanged: 0 }
    this.pty.kill(sessionId)
    const changed = this.deps.worktrees.commitAll(
      iso.worktreePath,
      `founcode: agent terminal session ${sessionId}`,
    )
    if (!changed) return { changed: false, diff: '', filesChanged: 0 }
    const diff = this.deps.worktrees.getDiff(iso.worktreePath, iso.baseRef)
    const filesChanged = (diff.match(/^diff --git /gm) ?? []).length
    return { changed: true, diff, filesChanged }
  }

  // Merge the session's worktree branch into the user's checkout, then
  // clean up. Guards live in WorktreeManager (dirty tree / conflicts).
  merge(sessionId: string): void {
    const iso = this.isolation.get(sessionId)
    if (!iso) throw new Error('Session has no isolated worktree to merge')
    this.deps.worktrees.merge(iso.projectPath, iso.wtId)
    this.deps.worktrees.remove(iso.projectPath, iso.wtId)
    this.isolation.delete(sessionId)
  }

  // Throw away the worktree without merging.
  discard(sessionId: string): void {
    const iso = this.isolation.get(sessionId)
    if (iso) {
      this.deps.worktrees.remove(iso.projectPath, iso.wtId)
      this.isolation.delete(sessionId)
    }
  }

  write(sessionId: string, data: string): void {
    this.pty.write(sessionId, data)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.pty.resize(sessionId, cols, rows)
  }

  kill(sessionId: string): void {
    this.pty.kill(sessionId)
  }

  list(): TerminalSession[] {
    return [...this.meta.values()].filter((s) => s.exitCode === null)
  }

  // App quit — never leave a PTY (and its agent CLI) running. Isolated
  // worktrees are left on disk (the branch keeps the work); startup
  // orphan-cleanup / the user can discard them later.
  killAll(): void {
    this.pty.killAll()
  }
}
