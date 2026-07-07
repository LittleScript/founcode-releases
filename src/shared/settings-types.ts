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
    placeholder: 'provider/model — pick from the list or type any',
    hint: 'Full catalog & provider login: run `opencode models` / `opencode auth login`',
    suggestions: [
      // Names confirmed by opencode's own "did you mean" hints.
      { value: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', hint: 'Strong coding, cheap' },
      {
        value: 'deepseek/deepseek-v4-flash',
        label: 'DeepSeek V4 Flash',
        hint: 'Faster & even cheaper',
      },
      { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', hint: 'General chat' },
      { value: 'zhipu/glm-5.1', label: 'GLM 5.1 (Zhipu)', hint: 'Latest Zhipu flagship' },
      { value: 'zhipu/glm-5', label: 'GLM 5 (Zhipu)', hint: 'Stable, cheap' },
      { value: 'qwen/qwen3-coder', label: 'Qwen3 Coder', hint: 'Optimized for code' },
      { value: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6', hint: 'Agentic, long context' },
      {
        value: 'mistral/devstral-2',
        label: 'Devstral 2 (Mistral)',
        hint: 'Agentic coding, EU-hosted',
      },
      {
        value: 'anthropic/claude-sonnet-4-6',
        label: 'Claude Sonnet 4.6',
        hint: 'Via Anthropic API key',
      },
      { value: 'openai/gpt-5', label: 'GPT-5', hint: 'Via OpenAI API key' },
      {
        value: 'ollama/qwen3-coder',
        label: 'Qwen3 Coder (Ollama)',
        hint: 'LOCAL — free, offline',
      },
    ],
  },

  codex: {
    kind: 'free',
    placeholder: 'pick from the list or type any',
    hint: 'Check the models on your account: `codex --help` / OpenAI docs',
    suggestions: [
      { value: 'gpt-5-codex', label: 'GPT-5 Codex', hint: 'Default — tuned for agentic coding' },
      { value: 'gpt-5', label: 'GPT-5', hint: 'General purpose' },
      { value: 'gpt-5-mini', label: 'GPT-5 Mini', hint: 'Fast & cheap' },
    ],
  },

  antigravity: {
    kind: 'free',
    placeholder: 'pick from the list or type any',
    hint: 'Antigravity CLI (`av`) — the successor to Gemini CLI',
    suggestions: [
      { value: 'gemini-3-pro', label: 'Gemini 3 Pro', hint: 'Antigravity default — most capable' },
      { value: 'gemini-3-flash', label: 'Gemini 3 Flash', hint: 'Fast & cheap' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', hint: 'Legacy — still supported' },
    ],
  },

  mock: { kind: 'options', options: [MODEL_OPTIONS[0] as ModelOption] },
}

export function agentModelSpec(agentId: string): AgentModelSpec {
  return AGENT_MODELS[agentId] ?? { kind: 'free', placeholder: 'model (empty = default)' }
}

export function modelLabel(value: string | null | undefined): string {
  return MODEL_OPTIONS.find((m) => m.value === (value ?? ''))?.label ?? value ?? 'Default'
}
