// Real PTY smoke against node-pty (the T0 native module). Not gated on
// FOUNCODE_IT because it needs no external CLI — just proves PtyManager
// spawns a shell, streams output, and exits cleanly.
//   npx vitest run tests/pty.integration.test.ts

import { describe, expect, it, vi } from 'vitest'
import { PtyManager } from '../src/main/terminal/PtyManager'

describe('PtyManager (real node-pty)', () => {
  it('spawns a shell, streams output, and reports exit', async () => {
    const chunks: string[] = []
    let exited: number | null = null
    const mgr = new PtyManager({
      onData: (_id, data) => chunks.push(data),
      onExit: (_id, code) => {
        exited = code
      },
    })

    const isWin = process.platform === 'win32'
    const handle = await mgr.start(
      isWin
        ? { file: 'cmd.exe', args: ['/c', 'echo founcode-pty && exit'] }
        : { file: 'bash', args: ['-c', 'echo founcode-pty'] },
      { cwd: process.cwd() },
    )
    expect(handle.id).toBeTruthy()

    await vi.waitFor(() => expect(exited).not.toBeNull(), { timeout: 15_000, interval: 200 })
    expect(chunks.join('')).toContain('founcode-pty')
  }, 20_000)
})
