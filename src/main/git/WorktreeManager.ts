// Git worktree isolation — TDD §4.4. Every executing task gets its own
// worktree (outside the user's repo, in app data) on a dedicated
// branch. Guards: never touch the user's checked-out branch, never
// push, never auto-resolve conflicts.

import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export interface WorktreeInfo {
  branch: string
  worktreePath: string
  baseRef: string
}

function git(cwd: string, args: string[]): string {
  const result = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed: ${result.stderr?.trim() || result.stdout?.trim()}`,
    )
  }
  return result.stdout
}

function gitOk(cwd: string, args: string[]): boolean {
  return (
    spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true }).status === 0
  )
}

export class WorktreeManager {
  constructor(private baseDir: string) {}

  pathFor(taskId: string): string {
    return join(this.baseDir, taskId)
  }

  branchFor(taskId: string): string {
    return `founcode/task-${taskId}`
  }

  // Creates a fresh worktree for the task at the project's current HEAD.
  // Stale leftovers from a crashed earlier run of the SAME task are
  // removed first so retry always starts clean.
  create(projectPath: string, taskId: string): WorktreeInfo {
    const branch = this.branchFor(taskId)
    const worktreePath = this.pathFor(taskId)

    this.remove(projectPath, taskId)

    const baseRef = git(projectPath, ['rev-parse', 'HEAD']).trim()
    git(projectPath, ['worktree', 'add', worktreePath, '-b', branch])
    return { branch, worktreePath, baseRef }
  }

  // Commits everything the agent left uncommitted so the branch fully
  // captures the execution result. Returns false when nothing changed.
  commitAll(worktreePath: string, message: string): boolean {
    git(worktreePath, ['add', '-A'])
    if (gitOk(worktreePath, ['diff', '--cached', '--quiet'])) return false
    git(worktreePath, [
      '-c',
      'user.name=Founcode',
      '-c',
      'user.email=founcode@local',
      'commit',
      '-m',
      message,
    ])
    return true
  }

  getDiff(worktreePath: string, baseRef: string): string {
    return git(worktreePath, ['diff', baseRef, 'HEAD'])
  }

  // Merges the task branch into the user's CURRENT branch, in the user
  // repo. Guards: working tree must be clean; conflicts abort the merge
  // completely (never auto-resolve, never leave a half-merged state).
  merge(projectPath: string, taskId: string): void {
    const branch = this.branchFor(taskId)
    const status = git(projectPath, ['status', '--porcelain']).trim()
    if (status) {
      throw new Error(
        'Your repository has uncommitted changes. Commit or stash them before merging this task.',
      )
    }
    const result = spawnSync(
      'git',
      ['-C', projectPath, 'merge', '--no-ff', branch, '-m', `founcode: merge task ${taskId}`],
      { encoding: 'utf8', windowsHide: true },
    )
    if (result.status !== 0) {
      gitOk(projectPath, ['merge', '--abort'])
      throw new Error(
        `Merge conflict: the task branch could not be merged automatically. ` +
          `Nothing was changed in your repository. You can merge '${branch}' manually, ` +
          `or send the task back with instructions.\n${result.stderr?.trim() ?? ''}`,
      )
    }
  }

  // Removes worktree + branch. Safe to call when nothing exists.
  remove(projectPath: string, taskId: string): void {
    const worktreePath = this.pathFor(taskId)
    if (existsSync(worktreePath)) {
      if (!gitOk(projectPath, ['worktree', 'remove', '--force', worktreePath])) {
        rmSync(worktreePath, { recursive: true, force: true })
      }
    }
    gitOk(projectPath, ['worktree', 'prune'])
    if (gitOk(projectPath, ['show-ref', '--verify', `refs/heads/${this.branchFor(taskId)}`])) {
      gitOk(projectPath, ['branch', '-D', this.branchFor(taskId)])
    }
  }
}
