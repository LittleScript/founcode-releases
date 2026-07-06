// Built-in Founcode skills (v1.1 C3) — curated prompt packs injected
// into agent runs. Used two ways: per-task (picker in New Task) and
// in chat via /slash (e.g. "/debug why does login loop?").

export interface SkillInfo {
  id: string
  name: string
  description: string
}

export const SKILLS: SkillInfo[] = [
  {
    id: 'design',
    name: 'Design',
    description: 'Distinctive, production-grade UI — typography, color tokens, motion, a11y',
  },
  {
    id: 'research',
    name: 'Research',
    description:
      'Evidence-based answers: sub-questions, cross-checked sources, committed recommendation',
  },
  {
    id: 'debug',
    name: 'Debug',
    description:
      'Systematic root-cause hunting: reproduce, bisect, one hypothesis, regression test',
  },
  {
    id: 'tdd',
    name: 'TDD',
    description: 'Red → green → refactor; behavior-boundary tests define done',
  },
  {
    id: 'security',
    name: 'Security Review',
    description: 'Hostile-input walkthrough: injection, authz, secrets, fail-closed',
  },
  {
    id: 'architecture',
    name: 'Architecture',
    description: 'Boundaries, domain-first modeling, dependencies inward, YAGNI',
  },
]

export function skillById(id: string | null | undefined): SkillInfo | undefined {
  return SKILLS.find((s) => s.id === id)
}

// "/debug why is X slow" -> { skillId: 'debug', rest: 'why is X slow' }
export function parseSlashSkill(message: string): { skillId: string | null; rest: string } {
  const match = message.match(/^\/(\w+)\s*([\s\S]*)$/)
  if (!match) return { skillId: null, rest: message }
  const skill = skillById(match[1]?.toLowerCase())
  if (!skill) return { skillId: null, rest: message }
  return { skillId: skill.id, rest: (match[2] ?? '').trim() }
}
