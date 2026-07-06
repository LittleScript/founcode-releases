import { describe, expect, it } from 'vitest'
import { getSkillContent, skillSection } from '../src/main/skills/skillPacks'
import { parseSlashSkill, SKILLS, skillById } from '../src/shared/skills-types'

describe('skills registry', () => {
  it('every registered skill has bundled content', () => {
    for (const skill of SKILLS) {
      expect(getSkillContent(skill.id), skill.id).toBeTruthy()
      expect(getSkillContent(skill.id)).toContain('Founcode Skill')
    }
  })

  it('unknown ids yield no content and an empty section', () => {
    expect(getSkillContent('nope')).toBeNull()
    expect(skillSection('nope')).toBe('')
    expect(skillSection(null)).toBe('')
  })

  it('skillSection wraps content in the injection header', () => {
    const section = skillSection('debug')
    expect(section).toContain('## Active Founcode skill')
    expect(section).toContain('hypothesis')
  })
})

describe('parseSlashSkill', () => {
  it('parses /skill prefixed messages', () => {
    expect(parseSlashSkill('/debug why does login loop?')).toEqual({
      skillId: 'debug',
      rest: 'why does login loop?',
    })
    expect(parseSlashSkill('/TDD add tests')).toEqual({ skillId: 'tdd', rest: 'add tests' })
  })

  it('leaves plain messages and unknown slashes untouched', () => {
    expect(parseSlashSkill('just a question')).toEqual({
      skillId: null,
      rest: 'just a question',
    })
    expect(parseSlashSkill('/unknown thing')).toEqual({ skillId: null, rest: '/unknown thing' })
  })

  it('skillById resolves ids', () => {
    expect(skillById('security')?.name).toBe('Security Review')
    expect(skillById('x')).toBeUndefined()
  })
})
