// Licensing — TDD §4.6. Local-first and honest: enforcement is soft
// (limits, never data hostage), validation is resilient (7-day offline
// grace), and the vendor sits behind an interface so switching from
// Lemon Squeezy costs one class.

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import type { LicenseState, Tier } from '../../shared/license-types'

export { FREE_LIMITS } from '../../shared/license-types'
export type { LicenseState, Tier }

export interface VendorResult {
  // ok=false means the vendor could not be reached (network/API outage);
  // valid answers whether the license itself is good.
  ok: boolean
  valid?: boolean
  instanceId?: string
  error?: string
}

export interface LicenseVendor {
  activate(key: string, instanceName: string): Promise<VendorResult>
  validate(key: string, instanceId: string): Promise<VendorResult>
  deactivate?(key: string, instanceId: string): Promise<VendorResult>
}

export interface LicenseCrypto {
  encrypt(plain: string): Buffer
  decrypt(blob: Buffer): string
}

const REVALIDATE_AFTER_MS = 24 * 60 * 60 * 1000 // check daily
const GRACE_MS = 7 * 24 * 60 * 60 * 1000 // 7-day offline grace

export class LicenseService {
  private state: LicenseState = { tier: 'free' }

  constructor(
    private vendor: LicenseVendor,
    private filePath: string,
    private crypto: LicenseCrypto,
    private now: () => number = Date.now,
    // Dev/QA env override — the caller must gate this on unpackaged
    // builds so shipped binaries never honor FOUNCODE_TIER.
    private allowEnvOverride = false,
  ) {
    this.load()
  }

  getState(): LicenseState {
    return { ...this.state }
  }

  getTier(): Tier {
    if (this.allowEnvOverride && process.env.FOUNCODE_TIER === 'pro') return 'pro'
    return this.state.tier
  }

  async activate(key: string): Promise<LicenseState> {
    const result = await this.vendor.activate(key.trim(), instanceName())
    if (!result.ok) {
      throw new Error(`Could not reach the license server: ${result.error ?? 'network error'}`)
    }
    if (!result.valid) {
      throw new Error(result.error ?? 'This license key is not valid.')
    }
    this.state = {
      tier: 'pro',
      key: key.trim(),
      instanceId: result.instanceId,
      lastValidatedAt: this.now(),
    }
    this.save()
    return this.getState()
  }

  async deactivate(): Promise<LicenseState> {
    if (this.state.key && this.state.instanceId && this.vendor.deactivate) {
      // Best effort — local deactivation always succeeds.
      await this.vendor.deactivate(this.state.key, this.state.instanceId).catch(() => {})
    }
    this.state = { tier: 'free' }
    this.save()
    return this.getState()
  }

  // Called at startup and periodically. Only hits the vendor when the
  // last successful validation is older than a day.
  async revalidate(): Promise<LicenseState> {
    if (this.state.tier !== 'pro' || !this.state.key) return this.getState()
    const age = this.now() - (this.state.lastValidatedAt ?? 0)
    if (age < REVALIDATE_AFTER_MS) return this.getState()

    const result = await this.vendor
      .validate(this.state.key, this.state.instanceId ?? '')
      .catch((): VendorResult => ({ ok: false, error: 'network' }))

    if (result.ok && result.valid) {
      this.state.lastValidatedAt = this.now()
      this.state.inGrace = false
      this.save()
    } else if (result.ok && !result.valid) {
      // The vendor answered: license revoked/expired -> downgrade now.
      this.state = { tier: 'free' }
      this.save()
    } else {
      // Vendor unreachable: keep pro within the grace window.
      if (age > GRACE_MS) {
        this.state = { tier: 'free' }
        this.save()
      } else {
        this.state.inGrace = true
      }
    }
    return this.getState()
  }

  private load(): void {
    try {
      if (!existsSync(this.filePath)) return
      const parsed = JSON.parse(this.crypto.decrypt(readFileSync(this.filePath))) as LicenseState
      if (parsed && (parsed.tier === 'pro' || parsed.tier === 'free')) this.state = parsed
    } catch {
      // Corrupt/undecryptable license file -> free (never crash the app).
      this.state = { tier: 'free' }
    }
  }

  private save(): void {
    try {
      if (this.state.tier === 'free' && !this.state.key) {
        if (existsSync(this.filePath)) unlinkSync(this.filePath)
        return
      }
      writeFileSync(this.filePath, this.crypto.encrypt(JSON.stringify(this.state)))
    } catch {
      // Persistence failure is non-fatal; state stays in memory.
    }
  }
}

function instanceName(): string {
  return `founcode-${process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? 'device'}`
}
