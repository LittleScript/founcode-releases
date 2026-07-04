import { describe, expect, it } from 'vitest'
import { extractCriteria, validatePlan } from '../src/main/orchestrator/planParser'

const VALID_PLAN = `# Plan: Add dark mode

## Summary
Add a dark mode toggle to the settings page.

## Files Touched
| File | Action | Reason |
|------|--------|--------|
| src/settings.ts | edit | add toggle |

## Implementation Steps
1. Add toggle component to settings page.
2. Persist preference.

## Risks & Notes
- None significant.

## Verification Criteria
- [ ] Toggle visible on settings page
- [ ] All existing tests still pass
`

describe('validatePlan', () => {
  it('accepts a well-formed plan', () => {
    expect(validatePlan(VALID_PLAN)).toEqual({ valid: true, errors: [] })
  })

  it('rejects an empty plan', () => {
    const result = validatePlan('   \n  ')
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(['Plan is empty'])
  })

  it('rejects prose without structure, listing every missing piece', () => {
    const result = validatePlan('Sorry, here is some prose instead of a plan.')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Missing top-level heading '# Plan: <title>'")
    expect(result.errors.filter((e) => e.startsWith('Missing required section'))).toHaveLength(5)
  })

  it('rejects a plan missing one section', () => {
    const withoutRisks = VALID_PLAN.replace(/## Risks & Notes[\s\S]*?(?=## Verification)/, '')
    const result = validatePlan(withoutRisks)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(["Missing required section '## Risks & Notes'"])
  })

  it('rejects verification criteria without checkboxes', () => {
    const noCheckboxes = VALID_PLAN.replace(/- \[ \].*\n?/g, 'just some prose\n')
    const result = validatePlan(noCheckboxes)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('at least one')
  })
})

describe('extractCriteria', () => {
  it('extracts checkbox criteria', () => {
    expect(extractCriteria(VALID_PLAN)).toEqual([
      'Toggle visible on settings page',
      'All existing tests still pass',
    ])
  })

  it('returns empty for missing section', () => {
    expect(extractCriteria('# Plan: x')).toEqual([])
  })
})
