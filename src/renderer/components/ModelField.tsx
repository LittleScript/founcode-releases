import { agentModelSpec } from '../../shared/settings-types'

// Model input that adapts to the selected agent: curated dropdown for
// Claude Code; for the multi-provider CLIs a free-form input backed by a
// datalist of curated suggestions (pick one or type any model string).
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
          <option key={m.value} value={m.value} title={m.hint}>
            {m.label}
            {m.hint ? ` — ${m.hint}` : ''}
          </option>
        ))}
      </select>
    )
  }

  const listId = `models-${agentId}`
  return (
    <div className="flex-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={spec.placeholder}
        className="input-field w-full"
        title="Model"
        list={listId}
      />
      <datalist id={listId}>
        {(spec.suggestions ?? []).map((m) => (
          <option key={m.value} value={m.value}>
            {m.label} — {m.hint}
          </option>
        ))}
      </datalist>
      {spec.hint && <p className="mt-1 font-mono text-[10px] text-slate-600">{spec.hint}</p>}
    </div>
  )
}
