// Parsers for the generative Blueprint steps. Each agent step ends its
// output with a ```json fence; we take the LAST fence, parse, and
// validate. Same discipline as the verdict parser (TDD §5.4): on failure
// the orchestrator re-prompts once, then surfaces raw for manual fixing.

import type {
  BlueprintStructure,
  BlueprintTaskSpec,
  QuestionsResult,
  StructureFeature,
} from '../../shared/blueprint-types'

export interface ParseResult<T> {
  value: T | null
  errors: string[]
}

const PRIORITIES = ['high', 'medium', 'low']

function extractJson(text: string): { data: unknown; error?: string } {
  const fences = [...text.matchAll(/```json\s*\n([\s\S]*?)```/g)]
  const last = fences.at(-1)?.[1]
  if (!last) return { data: null, error: 'No ```json fence found in the output' }
  try {
    return { data: JSON.parse(last) }
  } catch (e) {
    return { data: null, error: `JSON parse error: ${(e as Error).message}` }
  }
}

export function parseQuestions(text: string): ParseResult<QuestionsResult> {
  const { data, error } = extractJson(text)
  if (error) return { value: null, errors: [error] }

  const obj = data as { questions?: unknown; suggestions?: unknown }
  const arr = obj?.questions
  if (!Array.isArray(arr) || arr.length === 0) {
    return { value: null, errors: ["'questions' must be a non-empty array"] }
  }

  const errors: string[] = []
  const questions: QuestionsResult['questions'] = []
  for (const [i, raw] of arr.entries()) {
    const q = raw as Record<string, unknown>
    if (typeof q?.question !== 'string' || !Array.isArray(q?.options)) {
      errors.push(`questions[${i}] needs 'question' (string) and 'options' (array)`)
      continue
    }
    questions.push({
      question: q.question,
      options: (q.options as unknown[]).map(String),
      allowSkip: q.allowSkip !== false, // default true
    })
  }
  if (errors.length > 0) return { value: null, errors }

  const suggestions = Array.isArray(obj.suggestions)
    ? (obj.suggestions as unknown[]).map(String).filter(Boolean)
    : []
  return { value: { questions, suggestions }, errors: [] }
}

export function parseStructure(text: string): ParseResult<BlueprintStructure> {
  const { data, error } = extractJson(text)
  if (error) return { value: null, errors: [error] }

  const obj = data as { features?: unknown }
  const arr = obj?.features
  if (!Array.isArray(arr) || arr.length === 0) {
    return { value: null, errors: ["'features' must be a non-empty array"] }
  }

  const errors: string[] = []
  const features: StructureFeature[] = []
  for (const [i, raw] of arr.entries()) {
    const f = raw as Record<string, unknown>
    if (typeof f?.name !== 'string' || !Array.isArray(f?.subFeatures)) {
      errors.push(`features[${i}] needs 'name' (string) and 'subFeatures' (array)`)
      continue
    }
    const priority = PRIORITIES.includes(f.priority as string)
      ? (f.priority as StructureFeature['priority'])
      : undefined
    features.push({
      name: f.name,
      priority,
      description: typeof f.description === 'string' ? f.description : undefined,
      subFeatures: (f.subFeatures as Record<string, unknown>[]).map((sf) => ({
        name: String(sf?.name ?? ''),
        description: typeof sf?.description === 'string' ? sf.description : undefined,
      })),
    })
  }
  if (errors.length > 0) return { value: null, errors }
  return { value: { features }, errors: [] }
}

export function parseTaskSpecs(text: string): ParseResult<BlueprintTaskSpec[]> {
  const { data, error } = extractJson(text)
  if (error) return { value: null, errors: [error] }

  const obj = data as { tasks?: unknown }
  const arr = obj?.tasks
  if (!Array.isArray(arr) || arr.length === 0) {
    return { value: null, errors: ["'tasks' must be a non-empty array"] }
  }

  const errors: string[] = []
  const tasks: BlueprintTaskSpec[] = []
  for (const [i, raw] of arr.entries()) {
    const t = raw as Record<string, unknown>
    if (typeof t?.title !== 'string' || typeof t?.intent !== 'string') {
      errors.push(`tasks[${i}] needs 'title' and 'intent' (strings)`)
      continue
    }
    tasks.push({
      title: t.title,
      intent: t.intent,
      feature: typeof t.feature === 'string' ? t.feature : '',
      priority: PRIORITIES.includes(t.priority as string)
        ? (t.priority as BlueprintTaskSpec['priority'])
        : 'medium',
    })
  }
  if (errors.length > 0) return { value: null, errors }
  return { value: tasks, errors: [] }
}
