// Founcode Plan format validation — TDD §5.3. A plan must pass this
// parser before it can be approved; the orchestrator re-prompts once
// with the errors when validation fails.

export const REQUIRED_SECTIONS = [
  'Summary',
  'Files Touched',
  'Implementation Steps',
  'Risks & Notes',
  'Verification Criteria',
] as const

export interface PlanValidation {
  valid: boolean
  errors: string[]
}

export function validatePlan(markdown: string): PlanValidation {
  const errors: string[] = []
  const text = markdown.trim()

  if (!text) {
    return { valid: false, errors: ['Plan is empty'] }
  }

  if (!/^#\s+Plan:/m.test(text)) {
    errors.push("Missing top-level heading '# Plan: <title>'")
  }

  for (const section of REQUIRED_SECTIONS) {
    const pattern = new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm')
    if (!pattern.test(text)) {
      errors.push(`Missing required section '## ${section}'`)
    }
  }

  // Verify criteria must be actionable: at least one markdown checkbox.
  const criteriaMatch = text.match(
    /^##\s+Verification Criteria\s*$([\s\S]*?)(?=^##\s|\s*$(?![\s\S]))/m,
  )
  if (criteriaMatch && !/^\s*-\s*\[[ x]\]/m.test(criteriaMatch[1] ?? '')) {
    errors.push(
      "Section '## Verification Criteria' must contain at least one '- [ ]' checkbox item",
    )
  }

  return { valid: errors.length === 0, errors }
}

// Extract the checkbox criteria for later use by the Verify phase.
export function extractCriteria(markdown: string): string[] {
  const section = markdown.match(/^##\s+Verification Criteria\s*$([\s\S]*)/m)?.[1] ?? ''
  const upToNextSection = section.split(/^##\s/m)[0] ?? ''
  return [...upToNextSection.matchAll(/^\s*-\s*\[[ x]\]\s*(.+)$/gm)].map((m) => (m[1] ?? '').trim())
}
