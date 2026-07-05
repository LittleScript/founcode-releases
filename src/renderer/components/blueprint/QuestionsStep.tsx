import { useState } from 'react'
import type { BlueprintAnswer, BlueprintQuestion } from '../../../shared/blueprint-types'
import { blueprintActions } from '../../stores/blueprintStore'

const OTHER = '__other__'

export function QuestionsStep({
  blueprintId,
  questions,
}: {
  blueprintId: string
  questions: BlueprintQuestion[]
}) {
  const [choices, setChoices] = useState<Record<number, string>>({})
  const [others, setOthers] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)

  function resolve(q: BlueprintQuestion, i: number): BlueprintAnswer {
    const c = choices[i]
    if (c === undefined || c === '__skip__') return { question: q.question, answer: null }
    if (c === OTHER) return { question: q.question, answer: others[i]?.trim() || null }
    return { question: q.question, answer: c }
  }

  async function submit() {
    setSubmitting(true)
    const answers = questions.map(resolve)
    await blueprintActions.submitAnswers(blueprintId, answers)
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="font-semibold text-lg text-slate-100">A few quick questions</h2>
        <p className="mt-1 text-slate-500 text-sm">
          Answer what you can — skip the rest. This sharpens the PRD.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {questions.map((q, i) => (
          <div
            key={q.question}
            className="rise-in panel p-4"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="mb-3 flex items-start gap-2">
              <span className="mt-0.5 font-mono text-[11px] text-accent">{i + 1}</span>
              <p className="font-medium text-slate-200 text-sm">{q.question}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 pl-6">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setChoices((c) => ({ ...c, [i]: opt }))}
                  className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${
                    choices[i] === opt
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-edge text-slate-300 hover:border-edge-2 hover:bg-surface-hover'
                  }`}
                >
                  {opt}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setChoices((c) => ({ ...c, [i]: OTHER }))}
                className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${
                  choices[i] === OTHER
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-edge text-slate-400 hover:border-edge-2'
                }`}
              >
                Other…
              </button>
              {q.allowSkip && (
                <button
                  type="button"
                  onClick={() => setChoices((c) => ({ ...c, [i]: '__skip__' }))}
                  className={`rounded-full px-3 py-1 text-[13px] transition-colors ${
                    choices[i] === '__skip__'
                      ? 'text-slate-300'
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  Skip
                </button>
              )}
            </div>
            {choices[i] === OTHER && (
              <input
                value={others[i] ?? ''}
                onChange={(e) => setOthers((o) => ({ ...o, [i]: e.target.value }))}
                placeholder="Type your answer…"
                className="input-field mt-2 ml-6 w-[calc(100%-1.5rem)]"
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <button type="button" onClick={submit} disabled={submitting} className="btn-primary px-5">
          {submitting ? 'Generating map…' : 'Continue → Structure'}
        </button>
      </div>
    </div>
  )
}
