import { describe, expect, it } from 'vitest'
import {
  parseQuestions,
  parseStructure,
  parseTaskSpecs,
} from '../src/main/blueprint/blueprintParsers'

describe('parseQuestions', () => {
  it('parses a valid questions fence with suggestions', () => {
    const text =
      'ok\n```json\n{"questions":[{"question":"Q?","options":["a","b"]}],"suggestions":["idea one"]}\n```'
    const r = parseQuestions(text)
    expect(r.value?.questions).toHaveLength(1)
    expect(r.value?.questions[0]?.allowSkip).toBe(true) // defaults true
    expect(r.value?.suggestions).toEqual(['idea one'])
  })

  it('defaults suggestions to an empty array when missing', () => {
    const r = parseQuestions('```json\n{"questions":[{"question":"Q?","options":["a"]}]}\n```')
    expect(r.value?.suggestions).toEqual([])
  })

  it('rejects missing fence and empty array', () => {
    expect(parseQuestions('no fence').errors[0]).toContain('No ```json')
    expect(parseQuestions('```json\n{"questions":[]}\n```').errors[0]).toContain('non-empty')
  })

  it('rejects malformed items', () => {
    const r = parseQuestions('```json\n{"questions":[{"question":"Q?"}]}\n```')
    expect(r.value).toBeNull()
    expect(r.errors[0]).toContain('options')
  })
})

describe('parseStructure', () => {
  it('parses features + subFeatures with priority', () => {
    const text =
      '```json\n{"features":[{"name":"Auth","priority":"high","subFeatures":[{"name":"Login"}]}]}\n```'
    const r = parseStructure(text)
    expect(r.value?.features[0]?.name).toBe('Auth')
    expect(r.value?.features[0]?.priority).toBe('high')
    expect(r.value?.features[0]?.subFeatures[0]?.name).toBe('Login')
  })

  it('drops invalid priority to undefined', () => {
    const text = '```json\n{"features":[{"name":"X","priority":"urgent","subFeatures":[]}]}\n```'
    expect(parseStructure(text).value?.features[0]?.priority).toBeUndefined()
  })

  it('rejects features without name or subFeatures', () => {
    expect(parseStructure('```json\n{"features":[{"name":"X"}]}\n```').errors[0]).toContain(
      'subFeatures',
    )
  })
})

describe('parseTaskSpecs', () => {
  it('parses ordered task specs, defaulting priority', () => {
    const text =
      '```json\n{"tasks":[{"title":"T1","intent":"do","feature":"F"},{"title":"T2","intent":"do2","feature":"F","priority":"low"}]}\n```'
    const r = parseTaskSpecs(text)
    expect(r.value).toHaveLength(2)
    expect(r.value?.[0]?.priority).toBe('medium')
    expect(r.value?.[1]?.priority).toBe('low')
  })

  it('rejects tasks without title/intent', () => {
    expect(parseTaskSpecs('```json\n{"tasks":[{"title":"T"}]}\n```').errors[0]).toContain('intent')
  })
})
