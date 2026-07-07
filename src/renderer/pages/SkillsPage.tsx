import { SKILLS } from '../../shared/skills-types'

// Built-in skills & tools — Founcode's working methods for the agents.
export function SkillsPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-edge border-b px-6 py-4">
        <h1 className="font-semibold text-[15px] text-slate-100">Skills &amp; Tools</h1>
        <span className="font-mono text-[10px] text-slate-600">
          {SKILLS.length} built-in skills
        </span>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-6 py-6">
        <p className="mb-5 max-w-2xl text-slate-500 text-sm leading-relaxed">
          Skills are working methods the agent applies — battle-tested engineering discipline
          injected into its prompts. Use them <b className="text-slate-300">per task</b> (the Skill
          picker in New Task shapes both the plan and the execution) or{' '}
          <b className="text-slate-300">in chat</b> with a slash command.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {SKILLS.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-edge bg-surface p-4 transition-colors hover:border-edge-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-[14px] text-slate-100">{s.name}</span>
                <code className="shrink-0 rounded bg-accent-ghost px-1.5 py-0.5 font-mono text-[11px] text-accent">
                  /{s.id}
                </code>
              </div>
              <p className="mt-1.5 text-[12px] text-slate-500 leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-edge border-dashed p-4">
          <h2 className="font-medium text-[13px] text-slate-300">Coming next</h2>
          <ul className="mt-2 space-y-1 text-[12px] text-slate-500">
            <li>· Custom skills — write your own packs, stored locally per workspace</li>
            <li>· Tools — connect MCP servers and expose them to your agents</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
