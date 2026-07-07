// Bundled skill pack contents (main-side; templates ship via ?raw).

import architecture from '../../../prompts/skills/architecture.md?raw'
import debug from '../../../prompts/skills/debug.md?raw'
import design from '../../../prompts/skills/design.md?raw'
import docs from '../../../prompts/skills/docs.md?raw'
import perf from '../../../prompts/skills/perf.md?raw'
import refactor from '../../../prompts/skills/refactor.md?raw'
import research from '../../../prompts/skills/research.md?raw'
import review from '../../../prompts/skills/review.md?raw'
import security from '../../../prompts/skills/security.md?raw'
import tdd from '../../../prompts/skills/tdd.md?raw'

const PACKS: Record<string, string> = {
  design,
  research,
  debug,
  tdd,
  security,
  architecture,
  refactor,
  perf,
  docs,
  review,
}

export function getSkillContent(id: string | null | undefined): string | null {
  if (!id) return null
  return PACKS[id] ?? null
}

// Wrapped section appended to agent prompts when a skill is active.
export function skillSection(id: string | null | undefined): string {
  const content = getSkillContent(id)
  if (!content) return ''
  return `\n\n## Active Founcode skill\nApply this working method throughout:\n\n${content}`
}
