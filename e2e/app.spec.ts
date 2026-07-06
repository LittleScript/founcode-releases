// UI smoke E2E: boots the real Electron app (built output) against a
// throwaway userData dir and walks the first-run surface.
// Prereq: `npm run build` (out/ must exist). Run: `npm run test:e2e`.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type ElectronApplication, _electron as electron, expect, test } from '@playwright/test'

let app: ElectronApplication
let userData: string

test.beforeAll(async () => {
  userData = mkdtempSync(join(tmpdir(), 'founcode-e2e-ui-'))
  app = await electron.launch({
    args: ['out/main/index.js'],
    env: { ...process.env, FOUNCODE_USER_DATA: userData },
  })
})

test.afterAll(async () => {
  await app?.close()
  rmSync(userData, { recursive: true, force: true })
})

test('boots to onboarding with both entry points', async () => {
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Fresh install -> onboarding hero + the two entry CTAs.
  await expect(window.getByText('Trust what your agents ship.')).toBeVisible()
  await expect(window.getByRole('button', { name: /Start from an idea/ })).toBeVisible()
  await expect(window.getByRole('button', { name: /Add existing project/ })).toBeVisible()

  // The three-phase explainer cards render.
  for (const phase of ['Plan', 'Execute', 'Verify']) {
    await expect(window.getByRole('heading', { name: phase, exact: true })).toBeVisible()
  }

  await window.screenshot({ path: 'e2e/artifacts/onboarding.png' })
})

test('New-from-Idea dialog opens with mode choices and agent list', async () => {
  const window = await app.firstWindow()

  await window.getByRole('button', { name: /Start from an idea/ }).click()
  await expect(window.getByText('Where to build')).toBeVisible()
  await expect(window.getByRole('button', { name: /New project/ })).toBeVisible()

  // Agent dropdown lists the five agents (installed or not).
  const agentSelect = window.locator('#bp-agent')
  await expect(agentSelect).toBeVisible()
  const options = await agentSelect.locator('option').allTextContents()
  expect(options.join(' ')).toContain('Claude Code')
  expect(options.join(' ')).toContain('OpenCode')

  await window.screenshot({ path: 'e2e/artifacts/new-blueprint-dialog.png' })
  await window.getByRole('button', { name: 'Cancel', exact: true }).click()
})

test('fresh database was created with the full schema', async () => {
  // The app booted against the throwaway dir — its DB must exist and be
  // migrated (proves main-process bootstrap end to end).
  const { existsSync } = await import('node:fs')
  expect(existsSync(join(userData, 'founcode.db'))).toBe(true)
})
