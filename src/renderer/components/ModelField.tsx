import { useEffect, useState } from 'react'
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
  // The agent's LIVE catalog beats curated suggestions (e.g. `opencode
  // models` returns exactly what the user's install accepts).
  const [liveModels, setLiveModels] = useState<string[]>([])
  useEffect(() => {
    setLiveModels([])
    if (spec.kind === 'free') {
      window.founcode
        .invoke('agent:listModels', { agentId })
        .then(setLiveModels)
        .catch(() => {})
    }
  }, [agentId, spec.kind])

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
        {liveModels.length > 0
          ? liveModels.map((m) => <option key={m} value={m} />)
          : (spec.suggestions ?? []).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label} — {m.hint}
              </option>
            ))}
      </datalist>
      <p className="mt-1 font-mono text-[10px] text-slate-600">
        {liveModels.length > 0 ? `${liveModels.length} models from your CLI` : spec.hint}
      </p>
    </div>
  )
}
