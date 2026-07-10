import { type AppSettings, DEFAULT_SETTINGS } from '../../../shared/settings-types'
import type { SkillInfo } from '../../../shared/skills-types'
import { setCustomSkills } from '../../../shared/skills-types'
import type { Database } from '../db'

// App settings persist as key/value rows in the existing `settings` table
// (the same table that tracks schema_version, under different keys).
export class SettingsRepo {
  constructor(private db: Database) {}

  private raw(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value
  }

  private write(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value)
  }

  get(): AppSettings {
    let perAgentEnv: Record<string, Record<string, string>> = DEFAULT_SETTINGS.perAgentEnv
    const raw = this.raw('per_agent_env')
    if (raw) {
      try {
        perAgentEnv = JSON.parse(raw)
      } catch {
        /* corrupt — use default */
      }
    }
    return {
      defaultAgentId: this.raw('default_agent') ?? DEFAULT_SETTINGS.defaultAgentId,
      defaultModel: this.raw('default_model') ?? DEFAULT_SETTINGS.defaultModel,
      theme: (this.raw('theme') as AppSettings['theme']) ?? DEFAULT_SETTINGS.theme,
      perAgentEnv,
      deepVerify: this.raw('deep_verify') === '1',
      locale: (this.raw('locale') as AppSettings['locale']) ?? DEFAULT_SETTINGS.locale,
      customSkills: parseCustomSkills(this.raw('custom_skills')),
    }
  }

  set(next: Partial<AppSettings>): AppSettings {
    if (next.defaultAgentId !== undefined) this.write('default_agent', next.defaultAgentId)
    if (next.defaultModel !== undefined) this.write('default_model', next.defaultModel)
    if (next.theme !== undefined) this.write('theme', next.theme)
    if (next.perAgentEnv !== undefined)
      this.write('per_agent_env', JSON.stringify(next.perAgentEnv))
    if (next.deepVerify !== undefined) this.write('deep_verify', next.deepVerify ? '1' : '0')
    if (next.locale !== undefined) this.write('locale', next.locale)
    if (next.customSkills !== undefined) {
      this.write('custom_skills', JSON.stringify(next.customSkills))
      setCustomSkills(next.customSkills)
    }
    return this.get()
  }
}

function parseCustomSkills(raw: string | undefined): SkillInfo[] {
  if (!raw) return []
  try {
    return JSON.parse(raw) as SkillInfo[]
  } catch {
    return []
  }
}
