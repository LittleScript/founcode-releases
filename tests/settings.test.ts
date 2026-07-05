import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseStreamJsonLine } from '../src/main/agents/claude/ClaudeCodeAdapter'
import { type Database, openDatabase } from '../src/main/store/db'
import { SettingsRepo } from '../src/main/store/repositories/SettingsRepo'

let db: Database
let settings: SettingsRepo

beforeEach(() => {
  db = openDatabase(':memory:')
  settings = new SettingsRepo(db)
})
afterEach(() => db.close())

describe('SettingsRepo', () => {
  it('returns defaults when unset', () => {
    expect(settings.get()).toEqual({ defaultAgentId: 'claude-code', defaultModel: '' })
  })

  it('persists and merges partial updates', () => {
    settings.set({ defaultModel: 'opus' })
    expect(settings.get().defaultModel).toBe('opus')
    expect(settings.get().defaultAgentId).toBe('claude-code')
    settings.set({ defaultAgentId: 'mock' })
    expect(settings.get()).toEqual({ defaultAgentId: 'mock', defaultModel: 'opus' })
  })

  it('does not collide with schema_version key', () => {
    settings.set({ defaultModel: 'sonnet' })
    const v = db.prepare("SELECT value FROM settings WHERE key='schema_version'").get() as {
      value: string
    }
    expect(Number(v.value)).toBeGreaterThan(0)
  })
})

// Sanity: adapter parser still fine (unrelated, keeps this file cohesive).
describe('adapter still parses', () => {
  it('parses result line', () => {
    expect(
      parseStreamJsonLine('{"type":"result","subtype":"success","result":"ok"}')[0],
    ).toMatchObject({ type: 'done', exitCode: 0 })
  })
})
