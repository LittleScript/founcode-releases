import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorktreeManager } from '../src/main/git/WorktreeManager'

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}

let root: string
let repo: string
let manager: WorktreeManager

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'founcode-wt-'))
  repo = join(root, 'user-repo')
  spawnSync('git', ['init', repo], { encoding: 'utf8', windowsHide: true })
  git(repo, 'config', 'user.name', 'Test')
  git(repo, 'config', 'user.email', 'test@local')
  writeFileSync(join(repo, 'README.md'), 'hello\n')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-m', 'init')
  manager = new WorktreeManager(join(root, 'worktrees'))
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('WorktreeManager', () => {
  it('creates an isolated worktree on a dedicated branch', () => {
    const info = manager.create(repo, 'task1')
    expect(existsSync(info.worktreePath)).toBe(true)
    expect(info.branch).toBe('founcode/task-task1')
    expect(git(info.worktreePath, 'branch', '--show-current')).toBe('founcode/task-task1')
    // User repo stays on its own branch, clean.
    expect(git(repo, 'branch', '--show-current')).not.toBe('founcode/task-task1')
    expect(git(repo, 'status', '--porcelain')).toBe('')
  })

  it('captures changes via commitAll and getDiff without touching the user repo', () => {
    const info = manager.create(repo, 'task2')
    writeFileSync(join(info.worktreePath, 'new-file.txt'), 'agent was here\n')
    writeFileSync(join(info.worktreePath, 'README.md'), 'hello\nmodified\n')

    expect(manager.commitAll(info.worktreePath, 'founcode: execute')).toBe(true)
    const diff = manager.getDiff(info.worktreePath, info.baseRef)

    expect(diff).toContain('new-file.txt')
    expect(diff).toContain('agent was here')
    expect(diff).toContain('+modified')
    // User repo untouched: same HEAD, clean tree.
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(info.baseRef)
    expect(git(repo, 'status', '--porcelain')).toBe('')
    expect(existsSync(join(repo, 'new-file.txt'))).toBe(false)
  })

  it('commitAll returns false when nothing changed', () => {
    const info = manager.create(repo, 'task3')
    expect(manager.commitAll(info.worktreePath, 'noop')).toBe(false)
    expect(manager.getDiff(info.worktreePath, info.baseRef)).toBe('')
  })

  it('remove cleans worktree and branch; create after crash starts fresh', () => {
    const first = manager.create(repo, 'task4')
    writeFileSync(join(first.worktreePath, 'junk.txt'), 'stale\n')

    // Recreate same task (retry after crash): must not fail, must be clean.
    const second = manager.create(repo, 'task4')
    expect(existsSync(join(second.worktreePath, 'junk.txt'))).toBe(false)

    manager.remove(repo, 'task4')
    expect(existsSync(second.worktreePath)).toBe(false)
    const branches = git(repo, 'branch', '--list', 'founcode/*')
    expect(branches).toBe('')
  })
})
