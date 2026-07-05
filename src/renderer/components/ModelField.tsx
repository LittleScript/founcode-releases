import { agentModelSpec } from '../../shared/settings-types'

// Model input that adapts to the selected agent: curated dropdown for
// Claude Code, free-form provider/model string for the multi-provider
// CLIs (OpenCode/Codex/Gemini).
export function ModelField({
  agentId,
  value,
  onChange,
}: {
  agentId: string
  value: string
  onChange: (v: string) => void
}) {
  const spec = agentModelSpec(agentId)

  if (spec.kind === 'options') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
        title="Model"
      >
        {(spec.options ?? []).map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={spec.placeholder}
      className="input-field"
      title="Model"
    />
  )
}
