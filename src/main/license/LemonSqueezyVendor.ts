// Lemon Squeezy license API (public endpoints — no API key needed for
// activate/validate/deactivate). Docs: docs.lemonsqueezy.com/help/licensing
//
// STORE_ID/PRODUCT_ID are optional guards: when set (after Koko creates
// the store), keys from other stores/products are rejected.

import type { LicenseVendor, VendorResult } from './LicenseService'

const API = 'https://api.lemonsqueezy.com/v1/licenses'

// Fill these in once the Lemon Squeezy store + product exist.
const STORE_ID: number | null = null
const PRODUCT_ID: number | null = null

interface LsResponse {
  activated?: boolean
  valid?: boolean
  error?: string | null
  instance?: { id?: string } | null
  meta?: { store_id?: number; product_id?: number } | null
}

async function post(path: string, body: Record<string, string>): Promise<LsResponse> {
  const response = await fetch(`${API}/${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })
  return (await response.json()) as LsResponse
}

function checkScope(data: LsResponse): string | null {
  if (STORE_ID !== null && data.meta?.store_id !== STORE_ID) return 'Key belongs to another store'
  if (PRODUCT_ID !== null && data.meta?.product_id !== PRODUCT_ID)
    return 'Key belongs to another product'
  return null
}

export class LemonSqueezyVendor implements LicenseVendor {
  async activate(key: string, instanceName: string): Promise<VendorResult> {
    try {
      const data = await post('activate', { license_key: key, instance_name: instanceName })
      const scopeError = checkScope(data)
      if (scopeError) return { ok: true, valid: false, error: scopeError }
      return {
        ok: true,
        valid: data.activated === true,
        instanceId: data.instance?.id,
        error: data.error ?? undefined,
      }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }

  async validate(key: string, instanceId: string): Promise<VendorResult> {
    try {
      const data = await post('validate', { license_key: key, instance_id: instanceId })
      const scopeError = checkScope(data)
      if (scopeError) return { ok: true, valid: false, error: scopeError }
      return { ok: true, valid: data.valid === true, error: data.error ?? undefined }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }

  async deactivate(key: string, instanceId: string): Promise<VendorResult> {
    try {
      await post('deactivate', { license_key: key, instance_id: instanceId })
      return { ok: true, valid: true }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }
}
