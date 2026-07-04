// The only component allowed to change task state. Owns the phase
// runners: Plan (this phase), Execute and Verify (Phase 3/4).

import planTemplate from '../../../prompts/plan.md?raw'
import type { AgentEvent, Task } from '../../shared/types'
import type { AgentAdapter, AgentRunOptions } from '../agents/AgentAdapter'
import type { AgentRegistry } from '../agents/AgentRegistry'
import type { ArtifactRepo } from '../store/repositories/ArtifactRepo'
import type { ProjectRepo } from '../store/repositories/ProjectRepo'
import type { TaskRepo } from '../store/repositories/TaskRepo'
import { validatePlan } from './planParser'
import { type TaskAction, transition } from './TaskStateMachine'

export const PLAN_TIMEOUT_MS = 15 * 60 * 1000

export interface OrchestratorDeps {
  projects: ProjectRepo
  tasks: TaskRepo
  artifacts: ArtifactRepo
  registry: AgentRegistry
  broadcastStateChange: (payload: {
    taskId: string
    from: Task['state']
    to: Task['state']
  }) => void
  broadcastAgentEvent: (payload: { taskId: string; event: AgentEvent }) => void
}

interface CollectResult {
  exitCode: number
  resultText?: string
  log: string
}

export class Orchestrator {
  private active = new Map<string, AbortController>()

  constructor(private deps: OrchestratorDeps) {}

  applyAction(taskId: string, action: TaskAction): Task {
    const task = this.deps.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    const to = transition(task.state, action)
    this.deps.tasks.setState(taskId, to)
    this.deps.tasks.recordEvent(taskId, 'state_change', { action, from: task.state, to })
    this.deps.broadcastStateChange({ taskId, from: task.state, to })

    const updated = this.deps.tasks.get(taskId)
    if (!updated) throw new Error(`Task disappeared during transition: ${taskId}`)
    return updated
  }

  // Kicks off planning and returns immediately; progress streams to the
  // renderer via task:event, completion via task:stateChanged.
  startPlanning(taskId: string, feedback?: string): void {
    const task = this.deps.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)
    this.applyAction(
      taskId,
      task.state === 'AWAITING_APPROVAL' ? 'request_replan' : 'start_planning',
    )
    void this.runPlanning(taskId, feedback)
  }

  approvePlan(taskId: string, editedPlan?: string): Task {
    if (editedPlan !== undefined) {
      const validation = validatePlan(editedPlan)
      if (!validation.valid) {
        throw new Error(`Edited plan is invalid:\n- ${validation.errors.join('\n- ')}`)
      }
      this.deps.artifacts.add(taskId, 'plan', editedPlan)
      this.deps.tasks.recordEvent(taskId, 'plan_edited_by_user')
    }
    // Phase 3 wires the execution runner onto this transition.
    return this.applyAction(taskId, 'approve_plan')
  }

  cancel(taskId: string): Task {
    const updated = this.applyAction(taskId, 'cancel')
    // Abort AFTER the transition so the runner sees a consistent state.
    this.active.get(taskId)?.abort()
    return updated
  }

  private async runPlanning(taskId: string, feedback?: string): Promise<void> {
    const task = this.deps.tasks.get(taskId)
    if (!task) return
    const project = this.deps.projects.get(task.projectId)
    const adapter = this.deps.registry.get(task.agentId)

    if (!project || !adapter) {
      this.deps.tasks.recordEvent(taskId, 'agent_error', {
        message: !project ? 'Project not found' : `Unknown agent: ${task.agentId}`,
      })
      this.applyActionSafe(taskId, 'plan_failed')
      return
    }

    const controller = new AbortController()
    this.active.set(taskId, controller)
    const timeout = setTimeout(() => controller.abort(), PLAN_TIMEOUT_MS)

    try {
      let formatErrors: string[] | undefined
      let lastResult: string | undefined

      // Attempt 1 + one automatic corrective re-prompt on bad format.
      for (let attempt = 0; attempt < 2; attempt++) {
        const prompt = buildPlanPrompt(task, feedback, formatErrors)
        const result = await this.collect(taskId, adapter, {
          cwd: project.path,
          prompt,
          readOnly: true,
          abortSignal: controller.signal,
        })
        this.deps.artifacts.add(taskId, 'log', result.log)

        if (controller.signal.aborted) return // cancel already handled state

        if (result.exitCode !== 0 || !result.resultText) {
          this.deps.tasks.recordEvent(taskId, 'agent_error', { exitCode: result.exitCode })
          this.applyActionSafe(taskId, 'plan_failed')
          return
        }

        lastResult = result.resultText
        const validation = validatePlan(result.resultText)
        if (validation.valid) {
          this.deps.artifacts.add(taskId, 'plan', result.resultText)
          this.applyActionSafe(taskId, 'plan_ready')
          return
        }
        formatErrors = validation.errors
        this.deps.tasks.recordEvent(taskId, 'plan_format_retry', { errors: formatErrors })
      }

      // Both attempts malformed: surface the raw text anyway so the user
      // can fix it manually in the Plan editor (TDD §8).
      if (lastResult) {
        this.deps.artifacts.add(taskId, 'plan', lastResult)
        this.deps.tasks.recordEvent(taskId, 'plan_format_invalid', { errors: formatErrors })
        this.applyActionSafe(taskId, 'plan_ready')
      } else {
        this.applyActionSafe(taskId, 'plan_failed')
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        this.deps.tasks.recordEvent(taskId, 'agent_error', { message: (error as Error).message })
        this.applyActionSafe(taskId, 'plan_failed')
      }
    } finally {
      clearTimeout(timeout)
      this.active.delete(taskId)
    }
  }

  private async collect(
    taskId: string,
    adapter: AgentAdapter,
    opts: AgentRunOptions,
  ): Promise<CollectResult> {
    const logLines: string[] = []
    let exitCode = -1
    let resultText: string | undefined

    for await (const event of adapter.run(opts)) {
      this.deps.broadcastAgentEvent({ taskId, event })
      if (event.type === 'text') logLines.push(event.content)
      else if (event.type === 'tool_use') logLines.push(`[tool] ${event.name} ${event.detail}`)
      else if (event.type === 'file_change') logLines.push(`[${event.kind}] ${event.path}`)
      else if (event.type === 'error') logLines.push(`[error] ${event.message}`)
      else if (event.type === 'done') {
        exitCode = event.exitCode
        if (event.resultText !== undefined) resultText = event.resultText
      }
    }
    return { exitCode, resultText, log: logLines.join('\n') }
  }

  // State may have moved (e.g. user cancelled) while the runner was
  // working; a now-illegal bookkeeping transition must not crash it.
  private applyActionSafe(taskId: string, action: TaskAction): void {
    try {
      this.applyAction(taskId, action)
    } catch {
      this.deps.tasks.recordEvent(taskId, 'transition_skipped', { action })
    }
  }
}

export function buildPlanPrompt(
  task: { title: string; intent: string },
  feedback?: string,
  formatErrors?: string[],
): string {
  const sections: string[] = []
  if (feedback) {
    sections.push(`\n## Reviewer feedback on the previous plan\n${feedback}\n`)
  }
  if (formatErrors?.length) {
    sections.push(
      `\n## Format correction required\nYour previous plan failed validation:\n${formatErrors
        .map((e) => `- ${e}`)
        .join('\n')}\nRegenerate the FULL plan following the exact required structure.\n`,
    )
  }
  return planTemplate
    .replace('{{title}}', task.title)
    .replace('{{intent}}', task.intent)
    .replace('{{feedback_section}}', sections.join(''))
}
