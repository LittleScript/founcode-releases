// Shared CLI resolution for agent adapters on Windows.
//
// npm installs put three shims on PATH (extensionless sh, .cmd, .ps1) —
// none directly spawnable except via cmd.exe, which RE-PARSES argv and
// makes user-controlled prompt text unsafe as an argument. Preference
// order therefore is:
//   1. a real .exe on PATH,
//   2. the package's real binary inside the npm node_modules (safe direct
//      spawn; known layouts registered below),
//   3. the .cmd shim via cmd.exe — safe ONLY when the prompt travels via
//      stdin, never argv.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface ResolvedCli {
  file: string
  prefixArgs: string[]
  // When true, callers MUST pass the prompt via stdin (cmd.exe shim).
  viaShell: boolean
}

// Known real-binary locations relative to the npm global dir (where the
// shims live).
const REAL_BINARIES: Record<string, string[]> = {
  opencode: ['node_modules', 'opencode-ai', 'bin', 'opencode.exe'],
  codex: ['node_modules', '@openai', 'codex', 'bin', 'codex.exe'],
}

export function resolveCli(name: string): ResolvedCli | null {
  const which = process.platform === 'win32' ? 'where.exe' : 'which'
  const result = spawnSync(which, [name], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) return null
  const candidates = result.stdout.split(/\r?\n/).filter(Boolean)

  const exe = candidates.find((c) => c.toLowerCase().endsWith('.exe'))
  if (exe) return { file: exe, prefixArgs: [], viaShell: false }

  const shim = candidates.find(
    (c) => c.toLowerCase().endsWith('.cmd') || c.toLowerCase().endsWith('.ps1'),
  )
  if (!shim) {
    const first = candidates[0]
    return first ? { file: first, prefixArgs: [], viaShell: false } : null
  }

  // Try the package's real binary next to the shim.
  const layout = REAL_BINARIES[name]
  if (layout) {
    const real = join(dirname(shim), ...layout)
    if (existsSync(real)) return { file: real, prefixArgs: [], viaShell: false }
  }

  // Fall back to the .cmd shim through cmd.exe (prompt must use stdin).
  const cmdShim = shim.toLowerCase().endsWith('.cmd') ? shim : shim.replace(/\.ps1$/i, '.cmd')
  return {
    file: 'cmd.exe',
    prefixArgs: ['/d', '/s', '/c', existsSync(cmdShim) ? cmdShim : shim],
    viaShell: true,
  }
}

export function detectVersion(cli: ResolvedCli, flag = '--version'): string | null {
  const result = spawnSync(cli.file, [...cli.prefixArgs, flag], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15_000,
  })
  if (result.status !== 0) return null
  return result.stdout.trim().split(/\r?\n/)[0] ?? null
}

export function killTree(pid: number | undefined): void {
  if (pid === undefined) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
  }
}
