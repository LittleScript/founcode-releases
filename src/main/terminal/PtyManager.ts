// Owns live PTY-backed agent sessions (Agent Terminal, v1.3). Each
// session runs an agent CLI in its interactive mode attached to a
// pseudo-terminal; data streams both ways. The orchestrator/IPC layer
// (T2) wires these to the renderer's xterm view.
//
// node-pty is a native module with N-API prebuilds (ABI-stable across
// Node versions — validated loading in Electron 43, T0 spike). It is
// imported lazily so the rest of main (and the test suite) never pulls
// the native binary unless a terminal is actually started.

import { nanoid } from 'nanoid'
import type { InteractiveLaunch } from '../agents/AgentAdapter'

export interface PtyHandle {
  id: string
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
}

// Minimal shape of node-pty we depend on (keeps this file typecheck-able
// without @types for the native module).
interface IPty {
  onData(cb: (data: string) => void): void
  onExit(cb: (e: { exitCode: number }) => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
}
interface NodePty {
  spawn(file: string, args: string[], opts: Record<string, unknown>): IPty
}

let nodePty: NodePty | null = null
async function loadPty(): Promise<NodePty> {
  if (!nodePty) nodePty = (await import('node-pty')) as unknown as NodePty
  return nodePty
}

export interface PtyCallbacks {
  onData: (sessionId: string, data: string) => void
  onExit: (sessionId: string, exitCode: number) => void
}

export class PtyManager {
  private sessions = new Map<string, IPty>()

  constructor(private cb: PtyCallbacks) {}

  async start(
    launch: InteractiveLaunch,
    opts: { cwd: string; cols?: number; rows?: number },
  ): Promise<PtyHandle> {
    const pty = await loadPty()
    const id = nanoid(10)
    const proc = pty.spawn(launch.file, launch.args, {
      name: 'xterm-color',
      cols: opts.cols ?? 80,
      rows: opts.rows ?? 24,
      cwd: opts.cwd,
      env: { ...process.env, ...launch.env },
    })
    this.sessions.set(id, proc)
    proc.onData((data) => this.cb.onData(id, data))
    proc.onExit(({ exitCode }) => {
      this.sessions.delete(id)
      this.cb.onExit(id, exitCode)
    })
    return {
      id,
      write: (d) => proc.write(d),
      resize: (c, r) => proc.resize(c, r),
      kill: () => proc.kill(),
    }
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.resize(cols, rows)
  }

  kill(id: string): void {
    this.sessions.get(id)?.kill()
  }

  killAll(): void {
    for (const proc of this.sessions.values()) {
      try {
        proc.kill()
      } catch {
        // Already gone.
      }
    }
    this.sessions.clear()
  }
}
