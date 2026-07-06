// The only component allowed to change task state. Owns the three
// phase runners: Plan, Execute, and Verify.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import executeTemplate from '../../../prompts/execute.md?raw'
import planTemplate from '../../../prompts/plan.md?raw'
import verifyTemplate from '../../../prompts/verify.md?raw'
import type { AgentEvent, Task } from '../../shared/types'
import type { AgentAdapter, AgentRunOptions } from '../agents/AgentAdapter'
import type { AgentRegistry } from '../agents/AgentRegistry'
import type { WorktreeManager } from '../git/WorktreeManager'
import type { ArtifactRepo } from '../store/repositories/ArtifactRepo'
import type { ProjectRepo } from '../store/repositories/ProjectRepo'
import type { TaskRepo } from '../store/repositories/TaskRepo'
import { validatePlan } from './planParser'
import { MAX_VERIFY_RETRIES, type TaskAction, transition } from './TaskStateMachine'
import { parseVerdict } from './verdictParser'

export const PLAN_TIMEOUT_MS = 15 * 60 * 1000
export const EXEC_TIMEOUT_MS = 30 * 60 * 1000
export const VERIFY_TIMEOUT_MS = 15 * 60 * 1000

export interface OrchestratorDeps {
  projects: ProjectRepo
  tasks: TaskRepo
  artifacts: ArtifactRepo
  registry: AgentRegistry
  worktrees: WorktreeManager
  broadcastStateChange: (payload: {
    taskId: string
    from: Task['state']
    to: Task['state']
  }) => void
  broadcastAgentEvent: (payload: { taskId: string; event: AgentEvent }) => void
  // Extra context injected into the plan prompt (Blueprint tasks get the
  // PRD + a summary of already-completed sibling tasks).
  getPlanContext?: (task: Task) => string
  // Called when a task reaches a terminal state (DONE/DISCARDED) so a
  // Blueprint can advance its sequential feeding.
  onTaskSettled?: (task: Task) => void
  // Blueprint tasks skip the per-task plan-approval gate (the PRD review
  // was the human gate; review returns at the verify/merge step).
  shouldAutoApprovePlan?: (task: Task) => boolean
  // Free tier runs one task at a time; Pro runs in parallel.
  getTier?: () => 'free' | 'pro'
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

  // Free tier: one task in flight at a time. Called before any action
  // that would put another task to work.
  private ensureCapacity(): void {
    if (this.deps.getTier?.() === 'free' && this.deps.tasks.countActive() >= 1) {
      throw new Error(
        'Free plan runs one task at a time — wait for the active task to finish, or upgrade to Pro for parallel tasks.',
      )
    }
  }

  // Kicks off planning and returns immediately; progress streams to the
  // renderer via task:event, completion via task:stateChanged.
  startPlanning(taskId: string, feedback?: string): void {
    const task = this.deps.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)
    this.ensureCapacity()
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
    this.writePlanCopy(taskId)
    const updated = this.applyAction(taskId, 'approve_plan')
    void this.runExecution(taskId)
    return updated
  }

  merge(taskId: string): Task {
    const task = this.deps.tasks.get(taskId)
    const project = task ? this.deps.projects.get(task.projectId) : undefined
    if (!task || !project) throw new Error(`Task not found: ${taskId}`)
    if (task.state !== 'REVIEW') throw new Error('Only tasks in Review can be merged')

    // Merge first (throws on dirty repo / conflict, leaving everything
    // untouched), only then advance state and clean up.
    this.deps.worktrees.merge(project.path, taskId)
    const updated = this.applyAction(taskId, 'merge')
    this.cleanupWorktree(taskId)
    this.deps.onTaskSettled?.(updated)
    return updated
  }

  discard(taskId: string): Task {
    const updated = this.applyAction(taskId, 'discard')
    this.cleanupWorktree(taskId)
    this.deps.onTaskSettled?.(updated)
    return updated
  }

  sendBack(taskId: string, feedback: string): Task {
    this.ensureCapacity()
    const updated = this.applyAction(taskId, 'send_back')
    void this.runExecution(taskId, feedback)
    return updated
  }

  // Approved plans are also written into the project as plain files so
  // they survive outside Founcode. Ignored via .git/info/exclude (repo-
  // local, never touches the user's tracked .gitignore).
  private writePlanCopy(taskId: string): void {
    try {
      const task = this.deps.tasks.get(taskId)
      const project = task ? this.deps.projects.get(task.projectId) : undefined
      const plan = this.deps.artifacts.latest(taskId, 'plan')
      if (!task || !project || !plan) return

      const plansDir = join(project.path, '.founcode', 'plans')
      mkdirSync(plansDir, { recursive: true })
      writeFileSync(join(plansDir, `${taskId}.md`), plan.content)

      const excludePath = join(project.path, '.git', 'info', 'exclude')
      const current = existsSync(excludePath) ? readFileSync(excludePath, 'utf8') : ''
      if (!current.includes('.founcode/')) {
        appendFileSync(excludePath, `${current.endsWith('\n') || !current ? '' : '\n'}.founcode/\n`)
      }
    } catch (error) {
      this.deps.tasks.recordEvent(taskId, 'plan_copy_failed', {
        message: (error as Error).message,
      })
    }
  }

  cancel(taskId: string): Task {
    const updated = this.applyAction(taskId, 'cancel')
    // Abort AFTER the transition so the runner sees a consistent state.
    this.active.get(taskId)?.abort()
    this.cleanupWorktree(taskId)
    return updated
  }

  // Called once at startup: tasks left mid-phase by a crash or forced
  // shutdown cannot resume (their runner is gone) — fail them so the
  // user gets a retry path. Worktrees are recreated fresh on retry.
  recoverOrphans(): void {
    const failActions: Partial<Record<Task['state'], TaskAction>> = {
      PLANNING: 'plan_failed',
      EXECUTING: 'execution_failed',
      VERIFYING: 'verify_failed_final',
    }
    for (const task of this.deps.tasks.list()) {
      const action = failActions[task.state]
      if (!action) continue
      this.deps.tasks.recordEvent(task.id, 'crash_recovery', { orphanedState: task.state })
      this.applyActionSafe(task.id, action)
    }
  }

  private cleanupWorktree(taskId: string): void {
    const task = this.deps.tasks.get(taskId)
    const project = task ? this.deps.projects.get(task.projectId) : undefined
    if (!task?.worktree || !project) return
    try {
      this.deps.worktrees.remove(project.path, taskId)
      this.deps.tasks.setWorktree(taskId, null, null)
    } catch (error) {
      this.deps.tasks.recordEvent(taskId, 'worktree_cleanup_failed', {
        message: (error as Error).message,
      })
    }
  }

  // fixInstructions is set on verify-fail retries and user send-backs:
  // the existing worktree is reused so the agent fixes its previous
  // attempt instead of starting over.
  private async runExecution(taskId: string, fixInstructions?: string): Promise<void> {
    const task = this.deps.tasks.get(taskId)
    if (!task) return
    const project = this.deps.projects.get(task.projectId)
    const adapter = this.deps.registry.get(task.agentId)
    const plan = this.deps.artifacts.latest(taskId, 'plan')

    if (!project || !adapter || !plan) {
      this.deps.tasks.recordEvent(taskId, 'agent_error', {
        message: !project
          ? 'Project not found'
          : !adapter
            ? `Unknown agent: ${task.agentId}`
            : 'No approved plan artifact',
      })
      this.applyActionSafe(taskId, 'execution_failed')
      return
    }

    const controller = new AbortController()
    this.active.set(taskId, controller)
    const timeout = setTimeout(() => controller.abort(), EXEC_TIMEOUT_MS)

    try {
      let worktreePath: string
      let baseRef: string
      if (fixInstructions && task.worktree && task.baseRef) {
        worktreePath = task.worktree
        baseRef = task.baseRef
        this.deps.tasks.recordEvent(taskId, 'fix_iteration', { fixInstructions })
      } else {
        const created = this.deps.worktrees.create(project.path, taskId)
        worktreePath = created.worktreePath
        baseRef = created.baseRef
        this.deps.tasks.setWorktree(taskId, created.branch, worktreePath, baseRef)
        this.deps.tasks.recordEvent(taskId, 'worktree_created', {
          branch: created.branch,
          worktreePath,
          baseRef,
        })
      }

      let prompt = executeTemplate.replace('{{plan}}', plan.content)
      if (fixInstructions) {
        prompt += `\n\n## Fix required\nYour previous attempt is already in this worktree. Do NOT start over — fix it according to these findings:\n\n${fixInstructions}\n`
      }

      const result = await this.collect(taskId, adapter, {
        cwd: worktreePath,
        prompt,
        mode: 'write',
        model: task.model ?? undefined,
        abortSignal: controller.signal,
      })
      this.deps.artifacts.add(taskId, 'log', result.log)

      if (controller.signal.aborted) return // cancel already handled state + cleanup

      const blocked = result.resultText?.trimStart().startsWith('FOUNCODE_BLOCKED:')
      if (result.exitCode !== 0 || blocked) {
        this.deps.tasks.recordEvent(taskId, 'agent_error', {
          exitCode: result.exitCode,
          blocked: blocked ?? false,
          message: blocked ? result.resultText?.slice(0, 2000) : undefined,
        })
        this.applyActionSafe(taskId, 'execution_failed')
        return
      }

      this.deps.worktrees.commitAll(worktreePath, `founcode: execute task ${taskId}`)
      const diff = this.deps.worktrees.getDiff(worktreePath, baseRef)
      this.deps.artifacts.add(taskId, 'diff', diff)
      if (!diff.trim()) {
        this.deps.tasks.recordEvent(taskId, 'empty_diff')
      }
      this.applyActionSafe(taskId, 'execution_finished')
      if (this.deps.tasks.get(taskId)?.state === 'VERIFYING') {
        void this.runVerify(taskId)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        this.deps.tasks.recordEvent(taskId, 'agent_error', { message: (error as Error).message })
        this.applyActionSafe(taskId, 'execution_failed')
      }
    } finally {
      clearTimeout(timeout)
      this.active.delete(taskId)
    }
  }

  private async runVerify(taskId: string): Promise<void> {
    const task = this.deps.tasks.get(taskId)
    if (!task?.worktree) return
    const adapter = this.deps.registry.get(task.agentId)
    const plan = this.deps.artifacts.latest(taskId, 'plan')
    const diff = this.deps.artifacts.latest(taskId, 'diff')
    if (!adapter || !plan || !diff) {
      this.applyActionSafe(taskId, 'verify_failed_final')
      return
    }

    const controller = new AbortController()
    this.active.set(taskId, controller)
    const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

    try {
      const basePrompt = verifyTemplate
        .replace('{{plan}}', plan.content)
        .replace('{{diff}}', diff.content.slice(0, 200_000))

      let lastRaw: string | undefined
      let parseErrors: string[] = []

      // Attempt 1 + one corrective re-prompt on an unparseable verdict.
      for (let attempt = 0; attempt < 2; attempt++) {
        const prompt =
          attempt === 0
            ? basePrompt
            : `${basePrompt}\n\n## Format correction required\nYour previous report's json verdict failed validation:\n${parseErrors.map((e) => `- ${e}`).join('\n')}\nReply with the FULL report again, ending with a valid \`\`\`json verdict fence.`

        const result = await this.collect(taskId, adapter, {
          cwd: task.worktree,
          prompt,
          mode: 'verify',
          model: task.model ?? undefined,
          abortSignal: controller.signal,
        })
        this.deps.artifacts.add(taskId, 'log', result.log)

        if (controller.signal.aborted) return

        if (result.exitCode !== 0 || !result.resultText) {
          this.deps.tasks.recordEvent(taskId, 'agent_error', { exitCode: result.exitCode })
          this.applyActionSafe(taskId, 'verify_failed_final')
          return
        }

        lastRaw = result.resultText
        const parsed = parseVerdict(result.resultText)
        if (parsed.verdict) {
          this.deps.artifacts.add(
            taskId,
            'verify_report',
            JSON.stringify({ report: result.resultText, verdict: parsed.verdict }),
          )
          this.settleVerdict(taskId, parsed.verdict)
          return
        }
        parseErrors = parsed.errors
        this.deps.tasks.recordEvent(taskId, 'verdict_format_retry', { errors: parseErrors })
      }

      // Unparseable after retry: surface the raw report and hand the
      // decision to the user in Review (TDD §8).
      this.deps.artifacts.add(
        taskId,
        'verify_report',
        JSON.stringify({ report: lastRaw ?? '', verdict: null }),
      )
      this.deps.tasks.recordEvent(taskId, 'verdict_unparseable', { errors: parseErrors })
      this.applyActionSafe(taskId, 'verify_passed')
    } catch (error) {
      if (!controller.signal.aborted) {
        this.deps.tasks.recordEvent(taskId, 'agent_error', { message: (error as Error).message })
        this.applyActionSafe(taskId, 'verify_failed_final')
      }
    } finally {
      clearTimeout(timeout)
      this.active.delete(taskId)
    }
  }

  private settleVerdict(
    taskId: string,
    verdict: { verdict: string; fix_instructions?: string },
  ): void {
    if (verdict.verdict === 'pass' || verdict.verdict === 'pass_with_warnings') {
      this.applyActionSafe(taskId, 'verify_passed')
      return
    }
    // Fail: bounded automatic fix loop, then require the user.
    const task = this.deps.tasks.get(taskId)
    if (!task) return
    if (task.retryCount < MAX_VERIFY_RETRIES) {
      this.deps.tasks.incrementRetry(taskId)
      this.applyActionSafe(taskId, 'verify_failed_retry')
      void this.runExecution(taskId, verdict.fix_instructions ?? 'Verification failed; see report.')
    } else {
      this.deps.tasks.recordEvent(taskId, 'fix_loop_exhausted', { retries: task.retryCount })
      this.applyActionSafe(taskId, 'verify_failed_final')
    }
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
        const prompt = buildPlanPrompt(
          task,
          feedback,
          formatErrors,
          this.deps.getPlanContext?.(task),
        )
        const result = await this.collect(taskId, adapter, {
          cwd: project.path,
          prompt,
          mode: 'read',
          model: task.model ?? undefined,
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
          // Blueprint tasks auto-approve their plan: the human gate was
          // approving the PRD + task graph, and review still happens at
          // the verify/merge step. Only a VALID plan is auto-approved.
          const t = this.deps.tasks.get(taskId)
          if (t?.state === 'AWAITING_APPROVAL' && this.deps.shouldAutoApprovePlan?.(t)) {
            this.approvePlan(taskId)
          }
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
  context?: string,
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
    .replace('{{context_section}}', context ? `\n${context}\n` : '')
    .replace('{{feedback_section}}', sections.join(''))
}
