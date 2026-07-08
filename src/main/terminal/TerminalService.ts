// Agent Terminal service (v1.3 T2): turns a "start terminal" request
// into a live PTY-backed agent session and streams it to the renderer.
// Worktree isolation + the merge gate come in T4 — for now the session
// runs in the project's own directory.

import type { PermissionLevel } from '../../shared/settings-types'
import type { StartTerminalInput, TerminalSession } from '../../shared/terminal-types'
import { isInteractive } from '../agents/AgentAdapter'
import type { AgentRegistry } from '../agents/AgentRegistry'
import type { ProjectRepo } from '../store/repositories/ProjectRepo'
import { PtyManager } from './PtyManager'

export interface TerminalDeps {
  registry: AgentRegistry
  projects: ProjectRepo
  broadcastData: (p: { sessionId: string; data: string }) => void
  broadcastExit: (p: { sessionId: string; exitCode: number }) => void
}

export class TerminalService {
  private pty: PtyManager
  private meta = new Map<string, TerminalSession>()

  constructor(private deps: TerminalDeps) {
    this.pty = new PtyManager({
      onData: (id, data) => this.deps.broadcastData({ sessionId: id, data }),
      onExit: (id, exitCode) => {
        const m = this.meta.get(id)
        if (m) m.exitCode = exitCode
        this.deps.broadcastExit({ sessionId: id, exitCode })
      },
    })
  }

  async start(input: StartTerminalInput): Promise<TerminalSession> {
    const project = this.deps.projects.get(input.projectId)
    if (!project) throw new Error('Unknown project')
    const adapter = this.deps.registry.get(input.agentId)
    if (!adapter) throw new Error(`Unknown agent: ${input.agentId}`)
    if (!isInteractive(adapter)) {
      throw new Error(`${adapter.displayName} does not support interactive terminal sessions yet.`)
    }

    const permission: PermissionLevel = input.permission
    const launch = adapter.launchInteractive({
      cwd: project.path,
      permission,
      model: input.model,
    })
    if (!launch) throw new Error(`${adapter.displayName} CLI not found on PATH`)

    const handle = await this.pty.start(launch, { cwd: project.path })
    const session: TerminalSession = {
      id: handle.id,
      agentId: input.agentId,
      projectId: input.projectId,
      cwd: project.path,
      permission,
      model: input.model ?? null,
      exitCode: null,
      createdAt: Date.now(),
    }
    this.meta.set(handle.id, session)
    return session
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

  // App quit — never leave a PTY (and its agent CLI) running.
  killAll(): void {
    this.pty.killAll()
  }
}
