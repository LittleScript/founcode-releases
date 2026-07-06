import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentRegistry } from '../src/main/agents/AgentRegistry'
import { MockAgentAdapter } from '../src/main/agents/mock/MockAgentAdapter'
import { WorktreeManager } from '../src/main/git/WorktreeManager'
import {
  LicenseService,
  type LicenseVendor,
  type VendorResult,
} from '../src/main/license/LicenseService'
import { Orchestrator } from '../src/main/orchestrator/Orchestrator'
import { type Database, openDatabase } from '../src/main/store/db'
import { ArtifactRepo } from '../src/main/store/repositories/ArtifactRepo'
import { ProjectRepo } from '../src/main/store/repositories/ProjectRepo'
import { TaskRepo } from '../src/main/store/repositories/TaskRepo'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const plainCrypto = {
  encrypt: (s: string) => Buffer.from(s),
  decrypt: (b: Buffer) => b.toString(),
}

class FakeVendor implements LicenseVendor {
  activateResult: VendorResult = { ok: true, valid: true, instanceId: 'inst-1' }
  validateResult: VendorResult = { ok: true, valid: true }
  async activate() {
    return this.activateResult
  }
  async validate() {
    return this.validateResult
  }
}

let dir: string
let now: number
const clock = () => now

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'founcode-lic-'))
  now = 1_000_000_000_000
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function service(vendor = new FakeVendor()) {
  return { vendor, svc: new LicenseService(vendor, join(dir, 'license.bin'), plainCrypto, clock) }
}

describe('LicenseService', () => {
  it('starts free; activate flips to pro and persists across restarts', async () => {
    const { svc } = service()
    expect(svc.getTier()).toBe('free')
    await svc.activate('KEY-123')
    expect(svc.getTier()).toBe('pro')

    // Fresh instance reads the persisted file.
    const { svc: reloaded } = service()
    expect(reloaded.getTier()).toBe('pro')
    expect(reloaded.getState().key).toBe('KEY-123')
  })

  it('rejects invalid keys with the vendor error', async () => {
    const vendor = new FakeVendor()
    vendor.activateResult = { ok: true, valid: false, error: 'license expired' }
    const { svc } = service(vendor)
    await expect(svc.activate('BAD')).rejects.toThrow('license expired')
    expect(svc.getTier()).toBe('free')
  })

  it('skips vendor calls when the last validation is fresh', async () => {
    const { vendor, svc } = service()
    await svc.activate('KEY')
    const spy = vi.spyOn(vendor, 'validate')
    now += HOUR // < 24h
    await svc.revalidate()
    expect(spy).not.toHaveBeenCalled()
  })

  it('downgrades immediately when the vendor says the key is revoked', async () => {
    const { vendor, svc } = service()
    await svc.activate('KEY')
    vendor.validateResult = { ok: true, valid: false }
    now += 2 * DAY
    await svc.revalidate()
    expect(svc.getTier()).toBe('free')
  })

  it('keeps pro through the 7-day offline grace, then downgrades', async () => {
    const { vendor, svc } = service()
    await svc.activate('KEY')
    vendor.validateResult = { ok: false, error: 'network' }

    now += 3 * DAY // offline, within grace
    await svc.revalidate()
    expect(svc.getTier()).toBe('pro')
    expect(svc.getState().inGrace).toBe(true)

    now += 5 * DAY // total 8 days since last success -> past grace
    await svc.revalidate()
    expect(svc.getTier()).toBe('free')
  })

  it('deactivate returns to free and clears persistence', async () => {
    const { svc } = service()
    await svc.activate('KEY')
    await svc.deactivate()
    expect(svc.getTier()).toBe('free')
    const { svc: reloaded } = service()
    expect(reloaded.getTier()).toBe('free')
  })
})

describe('free-tier enforcement (Orchestrator)', () => {
  let db: Database
  afterEach(() => db.close())

  it('blocks a second concurrent task on free, allows on pro', () => {
    db = openDatabase(':memory:')
    const projects = new ProjectRepo(db)
    const tasks = new TaskRepo(db)
    let tier: 'free' | 'pro' = 'free'
    const orchestrator = new Orchestrator({
      projects,
      tasks,
      artifacts: new ArtifactRepo(db),
      registry: new AgentRegistry([new MockAgentAdapter(1000)]),
      worktrees: new WorktreeManager(join(dir, 'wt')),
      broadcastStateChange: vi.fn(),
      broadcastAgentEvent: vi.fn(),
      getTier: () => tier,
    })
    const p = projects.add('demo', 'C:/demo')
    const t1 = tasks.create({ projectId: p.id, title: 'a', intent: 'x', agentId: 'mock' })
    const t2 = tasks.create({ projectId: p.id, title: 'b', intent: 'y', agentId: 'mock' })

    orchestrator.startPlanning(t1.id) // occupies the single free slot
    expect(() => orchestrator.startPlanning(t2.id)).toThrow('one task at a time')

    tier = 'pro'
    expect(() => orchestrator.startPlanning(t2.id)).not.toThrow()
  })
})
