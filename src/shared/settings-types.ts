// App-wide settings + the model catalog shown in pickers.

export interface AppSettings {
  defaultAgentId: string
  // Model alias passed to the agent CLI; '' = the CLI's own default.
  defaultModel: string
  theme: 'dark' | 'light'
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultAgentId: 'claude-code',
  defaultModel: '',
  theme: 'dark',
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
  { value: 'opus', label: 'Opus (4.8)', hint: 'Most capable — architecture, hard problems' },
  { value: 'sonnet', label: 'Sonnet (4.6)', hint: 'Balanced — best for most tasks' },
  { value: 'haiku', label: 'Haiku (4.5)', hint: 'Fastest & cheapest — simple tasks' },
]

// Per-agent model input. Claude Code gets a curated alias dropdown; the
// other CLIs take a free-form model string WITH curated suggestions
// (their catalogs move fast — the suggestions are a starting point, any
// string the CLI accepts is valid).
export interface AgentModelSpec {
  kind: 'options' | 'free'
  options?: ModelOption[]
  suggestions?: ModelOption[]
  placeholder?: string
  hint?: string
}

export const AGENT_MODELS: Record<string, AgentModelSpec> = {
  'claude-code': { kind: 'options', options: MODEL_OPTIONS },

  opencode: {
    kind: 'free',
    placeholder: 'provider/model — pilih dari daftar atau ketik sendiri',
    hint: 'Daftar lengkap & login provider: jalankan `opencode models` / `opencode auth login`',
    suggestions: [
      { value: 'deepseek/deepseek-v4', label: 'DeepSeek V4', hint: 'Coding kuat, sangat murah' },
      {
        value: 'deepseek/deepseek-v4-flash',
        label: 'DeepSeek V4 Flash',
        hint: 'Lebih cepat & lebih murah lagi',
      },
      { value: 'zhipu/glm-5.1', label: 'GLM 5.1 (Zhipu)', hint: 'Flagship Zhipu terbaru' },
      { value: 'zhipu/glm-5', label: 'GLM 5 (Zhipu)', hint: 'Stabil, murah' },
      { value: 'qwen/qwen3-coder', label: 'Qwen3 Coder', hint: 'Dioptimalkan untuk kode' },
      { value: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6', hint: 'Agentic, context panjang' },
      {
        value: 'mistral/devstral-2',
        label: 'Devstral 2 (Mistral)',
        hint: 'Agentic coding, EU-hosted',
      },
      {
        value: 'anthropic/claude-sonnet-4-6',
        label: 'Claude Sonnet 4.6',
        hint: 'Via API key Anthropic',
      },
      { value: 'openai/gpt-5', label: 'GPT-5', hint: 'Via API key OpenAI' },
      {
        value: 'ollama/qwen3-coder',
        label: 'Qwen3 Coder (Ollama)',
        hint: 'LOKAL — gratis, offline',
      },
      {
        value: 'openrouter/deepseek/deepseek-chat',
        label: 'DeepSeek via OpenRouter',
        hint: '1 key OpenRouter = ratusan model',
      },
    ],
  },

  codex: {
    kind: 'free',
    placeholder: 'pilih dari daftar atau ketik sendiri',
    hint: 'Cek model aktif akunmu: `codex --help` / dokumentasi OpenAI',
    suggestions: [
      { value: 'gpt-5-codex', label: 'GPT-5 Codex', hint: 'Default — dioptimalkan agentic coding' },
      { value: 'gpt-5', label: 'GPT-5', hint: 'General purpose' },
      { value: 'gpt-5-mini', label: 'GPT-5 Mini', hint: 'Cepat & murah' },
    ],
  },

  antigravity: {
    kind: 'free',
    placeholder: 'pilih dari daftar atau ketik sendiri',
    hint: 'Antigravity CLI (`av`) — penerus Gemini CLI',
    suggestions: [
      { value: 'gemini-3-pro', label: 'Gemini 3 Pro', hint: 'Default Antigravity — paling mampu' },
      { value: 'gemini-3-flash', label: 'Gemini 3 Flash', hint: 'Cepat & murah' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', hint: 'Legacy — masih didukung' },
    ],
  },

  mock: { kind: 'options', options: [MODEL_OPTIONS[0] as ModelOption] },
}

export function agentModelSpec(agentId: string): AgentModelSpec {
  return AGENT_MODELS[agentId] ?? { kind: 'free', placeholder: 'model (kosong = default)' }
}

export function modelLabel(value: string | null | undefined): string {
  return MODEL_OPTIONS.find((m) => m.value === (value ?? ''))?.label ?? value ?? 'Default'
}
