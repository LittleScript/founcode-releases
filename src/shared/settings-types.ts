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

// Per-agent model input. Claude Code gets a curated alias dropdown; the
// other CLIs take a free-form model string (their catalogs are huge and
// move fast — OpenCode alone spans 75+ providers).
export interface AgentModelSpec {
  kind: 'options' | 'free'
  options?: ModelOption[]
  placeholder?: string
}

export const AGENT_MODELS: Record<string, AgentModelSpec> = {
  'claude-code': { kind: 'options', options: MODEL_OPTIONS },
  opencode: {
    kind: 'free',
    placeholder: 'provider/model — mis. zhipu/glm-5, deepseek/deepseek-v4 (kosong = default)',
  },
  codex: { kind: 'free', placeholder: 'mis. gpt-5-codex (kosong = default)' },
  gemini: { kind: 'free', placeholder: 'mis. gemini-2.5-pro (kosong = default)' },
  mock: { kind: 'options', options: [MODEL_OPTIONS[0] as ModelOption] },
}

export function agentModelSpec(agentId: string): AgentModelSpec {
  return AGENT_MODELS[agentId] ?? { kind: 'free', placeholder: 'model (kosong = default)' }
}

export function modelLabel(value: string | null | undefined): string {
  return MODEL_OPTIONS.find((m) => m.value === (value ?? ''))?.label ?? value ?? 'Default'
}
