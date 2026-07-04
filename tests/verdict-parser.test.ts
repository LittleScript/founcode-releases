import { describe, expect, it } from 'vitest'
import { parseVerdict } from '../src/main/orchestrator/verdictParser'

const VALID = `# Report

All good.

\`\`\`json
{
  "verdict": "pass",
  "criteria": [ { "criterion": "Change present", "status": "pass", "note": "ok" } ],
  "tests": { "detected": true, "command": "npm test", "passed": 5, "failed": 0 }
}
\`\`\`
`

describe('parseVerdict', () => {
  it('parses a valid report', () => {
    const { verdict, errors } = parseVerdict(VALID)
    expect(errors).toEqual([])
    expect(verdict?.verdict).toBe('pass')
    expect(verdict?.criteria).toHaveLength(1)
    expect(verdict?.tests?.passed).toBe(5)
  })

  it('takes the LAST json fence when several exist', () => {
    const twoFences = `\`\`\`json\n{"verdict":"fail"}\n\`\`\`\n${VALID}`
    expect(parseVerdict(twoFences).verdict?.verdict).toBe('pass')
  })

  it('rejects reports without a json fence', () => {
    const result = parseVerdict('just prose, no fence')
    expect(result.verdict).toBeNull()
    expect(result.errors[0]).toContain('No ```json fence')
  })

  it('rejects malformed JSON', () => {
    const result = parseVerdict('```json\n{not json}\n```')
    expect(result.verdict).toBeNull()
    expect(result.errors[0]).toContain('JSON parse error')
  })

  it('rejects invalid verdict values and empty criteria', () => {
    const result = parseVerdict('```json\n{"verdict":"maybe","criteria":[]}\n```')
    expect(result.verdict).toBeNull()
    expect(result.errors).toHaveLength(2)
  })

  it('requires fix_instructions on fail', () => {
    const result = parseVerdict(
      '```json\n{"verdict":"fail","criteria":[{"criterion":"x","status":"fail"}]}\n```',
    )
    expect(result.verdict).toBeNull()
    expect(result.errors[0]).toContain('fix_instructions')
  })

  it('accepts a complete fail verdict', () => {
    const result = parseVerdict(
      '```json\n{"verdict":"fail","criteria":[{"criterion":"x","status":"fail"}],"fix_instructions":"do y"}\n```',
    )
    expect(result.verdict?.verdict).toBe('fail')
    expect(result.verdict?.fix_instructions).toBe('do y')
  })
})
