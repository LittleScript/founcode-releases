import { type AppSettings, DEFAULT_SETTINGS } from '../../../shared/settings-types'
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
    return {
      defaultAgentId: this.raw('default_agent') ?? DEFAULT_SETTINGS.defaultAgentId,
      defaultModel: this.raw('default_model') ?? DEFAULT_SETTINGS.defaultModel,
      theme: (this.raw('theme') as AppSettings['theme']) ?? DEFAULT_SETTINGS.theme,
    }
  }

  set(next: Partial<AppSettings>): AppSettings {
    if (next.defaultAgentId !== undefined) this.write('default_agent', next.defaultAgentId)
    if (next.defaultModel !== undefined) this.write('default_model', next.defaultModel)
    if (next.theme !== undefined) this.write('theme', next.theme)
    return this.get()
  }
}
