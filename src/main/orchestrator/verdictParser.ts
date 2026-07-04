// Founcode Verdict extraction & validation — TDD §5.4. The verify agent
// must end its report with a ```json fence containing the verdict; the
// orchestrator re-prompts once when it is missing or malformed.

import type { Verdict, VerdictCriterion, VerdictStatus } from '../../shared/types'

const VERDICT_VALUES: VerdictStatus[] = ['pass', 'pass_with_warnings', 'fail']
const CRITERION_VALUES = ['pass', 'fail', 'warning']

export interface VerdictParseResult {
  verdict: Verdict | null
  errors: string[]
}

export function parseVerdict(text: string): VerdictParseResult {
  const fences = [...text.matchAll(/```json\s*\n([\s\S]*?)```/g)]
  const last = fences.at(-1)?.[1]
  if (!last) {
    return { verdict: null, errors: ['No ```json fence found in the report'] }
  }

  let raw: unknown
  try {
    raw = JSON.parse(last)
  } catch (error) {
    return { verdict: null, errors: [`JSON parse error: ${(error as Error).message}`] }
  }

  const errors: string[] = []
  const obj = raw as Record<string, unknown>

  if (!VERDICT_VALUES.includes(obj.verdict as VerdictStatus)) {
    errors.push(`'verdict' must be one of ${VERDICT_VALUES.join(' | ')}`)
  }
  if (!Array.isArray(obj.criteria) || obj.criteria.length === 0) {
    errors.push("'criteria' must be a non-empty array")
  } else {
    for (const [i, c] of (obj.criteria as Record<string, unknown>[]).entries()) {
      if (typeof c?.criterion !== 'string' || !CRITERION_VALUES.includes(c?.status as string)) {
        errors.push(
          `criteria[${i}] must have 'criterion' (string) and 'status' (pass|fail|warning)`,
        )
      }
    }
  }
  if (obj.verdict === 'fail' && typeof obj.fix_instructions !== 'string') {
    errors.push("a 'fail' verdict must include 'fix_instructions'")
  }

  if (errors.length > 0) return { verdict: null, errors }

  return {
    verdict: {
      verdict: obj.verdict as VerdictStatus,
      criteria: obj.criteria as VerdictCriterion[],
      tests: obj.tests as Verdict['tests'],
      fix_instructions: obj.fix_instructions as string | undefined,
    },
    errors: [],
  }
}
