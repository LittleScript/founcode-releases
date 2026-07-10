import { useState } from 'react'
import type { BlueprintAnswer, BlueprintQuestion } from '../../../shared/blueprint-types'
import { blueprintActions } from '../../stores/blueprintStore'

export function QuestionsStep({
  blueprintId,
  questions,
  suggestions,
}: {
  blueprintId: string
  questions: BlueprintQuestion[]
  suggestions: string[]
}) {
  // Multi-select per question: a set of chosen option labels.
  const [picked, setPicked] = useState<Record<number, Set<string>>>({})
  const [others, setOthers] = useState<Record<number, string>>({})
  const [acceptedIdeas, setAcceptedIdeas] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  function toggle(qi: number, opt: string) {
    setPicked((prev) => {
      const set = new Set(prev[qi] ?? [])
      set.has(opt) ? set.delete(opt) : set.add(opt)
      return { ...prev, [qi]: set }
    })
  }

  function toggleAll(qi: number, q: BlueprintQuestion) {
    setPicked((prev) => {
      const cur = prev[qi] ?? new Set<string>()
      const all = cur.size === q.options.length ? new Set<string>() : new Set(q.options)
      return { ...prev, [qi]: all }
    })
  }

  function resolve(q: BlueprintQuestion, i: number): BlueprintAnswer {
    const chosen = [...(picked[i] ?? [])]
    const other = others[i]?.trim()
    if (other) chosen.push(other)
    return { question: q.question, answers: chosen }
  }

  async function submit() {
    setSubmitting(true)
    const answers = questions.map(resolve)
    if (acceptedIdeas.size > 0) {
      answers.push({
        question: 'Additional feature ideas the user wants included',
        answers: [...acceptedIdeas],
      })
    }
    await blueprintActions.submitAnswers(blueprintId, answers)
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="font-semibold text-lg text-slate-100">A few quick questions</h2>
        <p className="mt-1 text-slate-500 text-sm">
          Pick any that apply — one, several, or all. Skip what you're unsure about.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {questions.map((q, i) => {
          const set = picked[i] ?? new Set<string>()
          const allOn = set.size === q.options.length
          return (
            <div
              key={q.question}
              className="rise-in panel p-4"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="mb-3 flex items-start gap-2">
                <span className="mt-0.5 font-mono text-[11px] text-accent">{i + 1}</span>
                <p className="flex-1 font-medium text-slate-200 text-sm">{q.question}</p>
                <button
                  type="button"
                  onClick={() => toggleAll(i, q)}
                  className="shrink-0 font-mono text-[10px] text-slate-500 uppercase tracking-wider hover:text-accent"
                >
                  {allOn ? 'clear' : 'all'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-6">
                {q.options.map((opt) => {
                  const on = set.has(opt)
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggle(i, opt)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] transition-colors ${
                        on
                          ? 'border-accent/50 bg-accent/10 text-accent'
                          : 'border-edge text-slate-300 hover:border-edge-2 hover:bg-surface-hover'
                      }`}
                    >
                      <span
                        className={`flex size-3 items-center justify-center rounded-[3px] border text-[8px] ${
                          on ? 'border-accent bg-accent text-slate-950' : 'border-slate-600'
                        }`}
                      >
                        {on ? '✓' : ''}
                      </span>
                      {opt}
                    </button>
                  )
                })}
                <input
                  value={others[i] ?? ''}
                  onChange={(e) => setOthers((o) => ({ ...o, [i]: e.target.value }))}
                  placeholder="+ other…"
                  className="rounded-full border border-edge bg-surface px-3 py-1 text-[13px] text-slate-200 outline-none focus:border-accent-dim"
                />
              </div>
            </div>
          )
        })}
      </div>

      {suggestions.length > 0 && (
        <div className="rise-in mt-6 rounded-lg border border-accent/20 bg-accent/[0.04] p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-accent">✦</span>
            <h3 className="font-medium text-slate-100 text-sm">Fresh ideas from the agent</h3>
            <span className="font-mono text-[10px] text-slate-500">tap to include</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((idea) => {
              const on = acceptedIdeas.has(idea)
              return (
                <button
                  key={idea}
                  type="button"
                  onClick={() =>
                    setAcceptedIdeas((prev) => {
                      const next = new Set(prev)
                      next.has(idea) ? next.delete(idea) : next.add(idea)
                      return next
                    })
                  }
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 text-left text-[13px] transition-colors ${
                    on
                      ? 'border-accent/50 bg-accent/10 text-slate-100'
                      : 'border-edge text-slate-400 hover:border-edge-2'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border text-[9px] ${
                      on ? 'border-accent bg-accent text-slate-950' : 'border-slate-600'
                    }`}
                  >
                    {on ? '✓' : ''}
                  </span>
                  {idea}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <button type="button" onClick={submit} disabled={submitting} className="btn-primary px-5">
          {submitting ? 'Generating map…' : 'Continue → Structure'}
        </button>
      </div>
    </div>
  )
}
