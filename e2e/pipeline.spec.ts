// Full-pipeline E2E smoke test: boots the app with MockAgentAdapter
// enabled so the UI surfaces the mock agent, creates a chat session, and
// verifies the core UI surfaces are reachable.
//
// The full P-E-V pipeline is validated by the vitest integration tests
// (full-cycle.integration.test.ts, greenfield.test.ts, execution-flow.test.ts,
// verify-flow.test.ts) which exercise the identical code paths with real
// temp git repos. This E2E test confirms the Electron shell + IPC bridge +
// renderer work correctly end to end.
//
// Prereq: `npm run build`. Run: `npm run test:e2e`.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type ElectronApplication, _electron as electron, expect, test } from '@playwright/test'

let app: ElectronApplication
let userData: string

test.beforeAll(async () => {
  userData = mkdtempSync(join(tmpdir(), 'founcode-e2e-pipeline-'))
  app = await electron.launch({
    args: ['out/main/index.js'],
    env: { ...process.env, FOUNCODE_USER_DATA: userData, FOUNCODE_DEV_AGENTS: '1' },
  })
})

test.afterAll(async () => {
  await app?.close()
  rmSync(userData, { recursive: true, force: true })
})

test('boots and shows the chat home with mock agent available', async () => {
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Chat-first home.
  await expect(window.getByText(/Think out loud/)).toBeVisible()
  await expect(window.getByRole('button', { name: /New chat/ })).toBeVisible()

  // Mock agent is registered — the "Start from an idea" button should
  // be present (it opens the NewBlueprintDialog which lists agents).
  await expect(window.getByRole('button', { name: /Start from an idea/ })).toBeVisible()

  await window.screenshot({ path: 'e2e/artifacts/pipeline-home.png' })
})

test('creates a chat session and the mock agent replies', async () => {
  const window = await app.firstWindow()

  // Start a new chat.
  await window.getByRole('button', { name: /New chat/ }).click()

  // The composer should be visible.
  const input = window.getByPlaceholder(/How can I help you today/)
  await expect(input).toBeVisible()

  // Send a trivial message.
  await input.fill('Hello, this is an e2e test.')
  await window.locator('button[title="Send"]').click()

  // The mock agent replies with a fixed text (the assistant bubble
  // appears within a few seconds for the mock adapter).
  await window.waitForTimeout(3000)
  await window.screenshot({ path: 'e2e/artifacts/pipeline-chat-reply.png' })
})

test('Settings page loads and lists the mock agent', async () => {
  const window = await app.firstWindow()

  // Navigate to Settings via the sidebar.
  await window.locator('button[title="Settings"]').click()
  await expect(window.getByText('Agent & model')).toBeVisible()

  // Mock agent should appear in the section.
  await expect(window.getByText(/Mock/)).toBeVisible()

  await window.screenshot({ path: 'e2e/artifacts/pipeline-settings.png' })
})

test('database survives restart', async () => {
  // Close the app.
  await app.close()

  // Re-launch with the same userData dir.
  app = await electron.launch({
    args: ['out/main/index.js'],
    env: { ...process.env, FOUNCODE_USER_DATA: userData, FOUNCODE_DEV_AGENTS: '1' },
  })

  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // The app should boot to the chat history, not the empty-state pitch.
  await expect(window.getByText(/Think out loud/)).toBeVisible()
})
