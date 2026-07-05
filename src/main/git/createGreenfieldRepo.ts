// Greenfield project creation for Blueprint: make a folder, git init,
// seed a minimal commit, and configure a local identity so Founcode's
// later commits/merges work without touching the user's global git config.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function git(cwd: string, args: string[]): void {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true })
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr?.trim() || r.stdout?.trim()}`)
  }
}

export interface GreenfieldResult {
  path: string
}

// Creates <parentDir>/<name> as a fresh git repo. Refuses to touch a
// non-empty existing folder so we never clobber the user's files.
export function createGreenfieldRepo(parentDir: string, rawName: string): GreenfieldResult {
  const name = rawName.trim().replace(/[<>:"/\\|?*]+/g, '-')
  if (!name) throw new Error('Project name is required')
  if (!existsSync(parentDir)) throw new Error(`Location does not exist: ${parentDir}`)

  const path = join(parentDir, name)
  if (existsSync(path) && readdirSync(path).length > 0) {
    throw new Error(`A non-empty folder already exists at ${path}`)
  }
  mkdirSync(path, { recursive: true })

  const init = spawnSync('git', ['init', path], { encoding: 'utf8', windowsHide: true })
  if (init.status !== 0) throw new Error(`git init failed: ${init.stderr?.trim()}`)

  git(path, ['config', 'user.name', 'Founcode'])
  git(path, ['config', 'user.email', 'founcode@local'])

  writeFileSync(
    join(path, 'README.md'),
    `# ${name}\n\nScaffolded by Founcode from an idea. The product spec lives in \`.founcode/blueprints/\`.\n`,
  )
  writeFileSync(join(path, '.gitignore'), 'node_modules/\ndist/\n.env\n.env.*\n')

  git(path, ['add', '-A'])
  git(path, ['commit', '-m', 'chore: initial commit (Founcode greenfield)'])

  return { path }
}
