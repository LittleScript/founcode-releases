// App-wide settings + the model catalog shown in pickers.

export interface AppSettings {
  defaultAgentId: string
  // Model alias passed to the agent CLI; '' = the CLI's own default.
  defaultModel: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultAgentId: 'claude-code',
  defaultModel: '',
}

// Curated model choices. Aliases (opus/sonnet/haiku) stay valid across
// Claude Code versions — the CLI maps them to the current release.
export interface ModelOption {
  value: string // '' means default
  label: string
  hint: string
}

export const MODEL_OPTIONS: ModelOption[] = [
  { value: '', label: 'Default (agent setting)', hint: 'Use the agent CLI’s configured model' },
  { value: 'opus', label: 'Opus', hint: 'Most capable' },
  { value: 'sonnet', label: 'Sonnet', hint: 'Balanced' },
  { value: 'haiku', label: 'Haiku', hint: 'Fastest' },
]

export function modelLabel(value: string | null | undefined): string {
  return MODEL_OPTIONS.find((m) => m.value === (value ?? ''))?.label ?? value ?? 'Default'
}
