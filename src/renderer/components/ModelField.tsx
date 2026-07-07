import { ModelPicker } from './ModelPicker'

// Thin alias kept for existing call sites — everything renders through
// the unified ModelPicker now (search, scroll, live catalog, custom).
export function ModelField({
  agentId,
  value,
  onChange,
}: {
  agentId: string
  value: string
  onChange: (v: string) => void
}) {
  return <ModelPicker agentId={agentId} value={value} onChange={onChange} />
}
