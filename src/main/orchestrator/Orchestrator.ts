// The only component allowed to change task state. Owns the three
// phase runners: Plan, Execute, and Verify.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import executeTemplate from '../../../prompts/execute.md?raw'
import memoryExtractTemplate from '../../../prompts/memory-extract.md?raw'
import planTemplate from '../../../prompts/plan.md?raw'
import verifyTemplate from '../../../prompts/verify.md?raw'
import type { AgentEvent, Task } from '../../shared/types'
import type { AgentAdapter, AgentRunOptions } from '../agents/AgentAdapter'
import type { AgentRegistry } from '../agents/AgentRegistry'
import type { WorktreeManager } from '../git/WorktreeManager'
import { skillSection } from '../skills/skillPacks'
import type { ArtifactRepo } from '../store/repositories/ArtifactRepo'
import type { ProjectRepo } from '../store/repositories/ProjectRepo'
import type { TaskRepo } from '../store/repositories/TaskRepo'
import { validatePlan } from './planParser'
import { MAX_VERIFY_RETRIES, type TaskAction, transition } from './TaskStateMachine'
import { parseVerdict } from './verdictParser'

function readProjectMemory(projectPath: string): string {
  const parts: string[] = []

  // Memory file — patterns, decisions, gotchas from past tasks.
  const memoryPath = join(projectPath, '.founcode', 'memory.md')
  if (existsSync(memoryPath)) {
    try {
      const content = readFileSync(memoryPath, 'utf8')
      if (content.trim()) {
        const tail = content.slice(-6000)
        parts.push(`## Project memory (patterns, decisions, gotchas)\n${tail}`)
      }
    } catch {
      /* ignore */
    }
  }

  // Task log — structured history of completed tasks for pattern matching.
  const logPath = join(projectPath, '.founcode', 'task-log.json')
  if (existsSync(logPath)) {
    try {
      const raw = JSON.parse(readFileSync(logPath, 'utf8')) as {
        title: string
        intent: string
        verdict: string
        date: string
      }[]
      const done = raw.filter((t) => t.verdict === 'pass')
      if (done.length > 0) {
        const recent = done.slice(-5)
        const lines = recent.map((t) => `- **${t.title}** (${t.date}): ${t.intent.slice(0, 120)}`)
        parts.push(
          `## Recently completed in this project\nThese tasks were planned and merged successfully — follow their conventions and avoid redoing their work:\n${lines.join('\n')}`,
        )
      }
    } catch {
      /* ignore */
    }
  }

  return parts.length > 0 ? `\n${parts.join('\n\n')}\n` : ''
}

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
  getTier?: () => 'free' | 'pro'
  // Per-agent environment variables from Settings, merged into spawn.
  getAgentEnv?: (agentId: string) => Record<string, string>
  // Deep Verify check — Pro-only multi-agent verification.
  getSettings?: () => { deepVerify: boolean }
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
    // Post-merge: extract learnings asynchronously — non-blocking, best-effort.
    void this.extractMemory(taskId)
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
    const task = this.deps.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)
    const updated = this.applyAction(taskId, 'send_back')
    // Save the feedback as a plan_revision artifact so it is injected into
    // the plan prompt whether we are re-planning (FAILED) or re-executing
    // (REVIEW).
    this.deps.artifacts.add(taskId, 'plan_revision', feedback)
    this.deps.tasks.recordEvent(taskId, 'send_back', { feedback })
    if (task.state === 'FAILED') {
      void this.runPlanning(taskId, feedback)
    } else {
      void this.runExecution(taskId, feedback)
    }
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

  // Retry also scrubs any stale worktree so `git worktree add` can't
  // collide with a crashed run's leftovers.
  retryTask(taskId: string): Task {
    const updated = this.applyAction(taskId, 'retry')
    this.cleanupWorktree(taskId)
    return updated
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
      // Best-effort worktree cleanup so retry starts on a clean slate
      // (a crashed run's leftovers blocked `git worktree add` — QA).
      try {
        this.cleanupWorktree(task.id)
      } catch {
        // Locked by a stray process — remove() will explain on retry.
      }
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

      let prompt = executeTemplate.replace('{{plan}}', plan.content) + skillSection(task.skill)
      if (fixInstructions) {
        prompt += `\n\n## Fix required\nYour previous attempt is already in this worktree. Do NOT start over — fix it according to these findings:\n\n${fixInstructions}\n`
      }

      const result = await this.collect(taskId, adapter, {
        cwd: worktreePath,
        prompt,
        mode: 'write',
        model: task.model ?? undefined,
        permission: task.permission,
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
        this.note(taskId, (error as Error).message)
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

    const isPro = this.deps.getTier?.() === 'pro'
    const deepVerify = isPro && this.deps.getSettings?.()?.deepVerify

    if (deepVerify) {
      await this.runDeepVerify(taskId, task, adapter, plan.content, diff.content)
    } else {
      await this.runSingleVerify(taskId, task, adapter, plan.content, diff.content)
    }
  }

  private async runSingleVerify(
    taskId: string,
    task: Task,
    adapter: AgentAdapter,
    planContent: string,
    diffContent: string,
  ): Promise<void> {
    const controller = new AbortController()
    this.active.set(taskId, controller)
    const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

    try {
      const basePrompt = verifyTemplate
        .replace('{{plan}}', planContent)
        .replace('{{diff}}', diffContent.slice(0, 200_000))

      let lastRaw: string | undefined
      let parseErrors: string[] = []

      // Attempt 1 + one corrective re-prompt on an unparseable verdict.
      for (let attempt = 0; attempt < 2; attempt++) {
        const prompt =
          attempt === 0
            ? basePrompt
            : `${basePrompt}\n\n## Format correction required\nYour previous report's json verdict failed validation:\n${parseErrors.map((e) => `- ${e}`).join('\n')}\nReply with the FULL report again, ending with a valid \`\`\`json verdict fence.`

        const result = await this.collect(taskId, adapter, {
          cwd: task.worktree ?? '',
          prompt,
          mode: 'verify',
          model: task.model ?? undefined,
          permission: task.permission,
          abortSignal: controller.signal,
        })
        this.deps.artifacts.add(taskId, 'log', result.log)

        if (controller.signal.aborted) return

        if (result.exitCode !== 0 || !result.resultText) {
          this.note(taskId, `agent exited with code ${result.exitCode} — see the log above`)
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
        this.note(taskId, (error as Error).message)
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

  // Deep Verify (Pro): run verification through 3 independent agents and
  // take a majority vote. All reports are saved so the user can compare.
  private async runDeepVerify(
    taskId: string,
    task: Task,
    primaryAdapter: AgentAdapter,
    planContent: string,
    diffContent: string,
  ): Promise<void> {
    const alternates = this.deps.registry
      .all()
      .filter((a) => a.id !== primaryAdapter.id)
      .slice(0, 2)

    if (alternates.length === 0) {
      // Fallback: run single verify — Deep Verify requires ≥2 installed
      // agents, and the primary is the only one available.
      this.deps.tasks.recordEvent(taskId, 'deep_verify_skipped', {
        reason: 'only one agent installed',
      })
      await this.runSingleVerify(taskId, task, primaryAdapter, planContent, diffContent)
      return
    }

    const controller = new AbortController()
    this.active.set(taskId, controller)
    const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

    try {
      const panel = [primaryAdapter, ...alternates].slice(0, 3)
      const panelIds = panel.map((a) => a.id)
      this.deps.tasks.recordEvent(taskId, 'deep_verify_started', { agents: panelIds })

      const basePrompt = verifyTemplate
        .replace('{{plan}}', planContent)
        .replace('{{diff}}', diffContent.slice(0, 200_000))

      // Run all panelists in parallel.
      const runs = panel.map((adapter) =>
        this.collect(taskId, adapter, {
          cwd: task.worktree ?? '',
          prompt: basePrompt,
          mode: 'verify' as const,
          model: task.model ?? undefined,
          permission: task.permission,
          abortSignal: controller.signal,
        }),
      )
      const results = await Promise.all(runs)

      if (controller.signal.aborted) return

      // Parse all verdicts. Unparseable → treat as abstain.
      const verdicts = results.map((r, i) => {
        const parsed = r.resultText
          ? parseVerdict(r.resultText)
          : { verdict: null, errors: [] as string[] }
        return {
          agentId: panel[i].id,
          agentName: panel[i].displayName,
          report: r.resultText ?? '',
          verdict: parsed.verdict,
        }
      })

      // Save all reports.
      this.deps.artifacts.add(
        taskId,
        'verify_report',
        JSON.stringify({
          deep: true,
          reports: verdicts,
        }),
      )

      // Majority vote: pass/pass_with_warnings count as "approve",
      // fail/null count as "reject".
      const approves = verdicts.filter(
        (v) => v.verdict?.verdict === 'pass' || v.verdict?.verdict === 'pass_with_warnings',
      ).length
      const rejects = verdicts.length - approves

      if (approves > rejects) {
        this.deps.tasks.recordEvent(taskId, 'deep_verify_result', {
          approves,
          rejects,
          verdict: 'pass',
        })
        this.applyActionSafe(taskId, 'verify_passed')
      } else {
        this.deps.tasks.recordEvent(taskId, 'deep_verify_result', {
          approves,
          rejects,
          verdict: 'fail',
        })
        // Collect fix_instructions from the rejecting panelists.
        const fixInstructions = verdicts
          .filter((v) => v.verdict?.fix_instructions)
          .map((v) => `[${v.agentId}]: ${v.verdict!.fix_instructions}`)
          .join('\n')
        this.settleVerdict(taskId, {
          verdict: 'fail',
          fix_instructions: fixInstructions || 'Verification failed — see panel reports.',
        })
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        this.note(taskId, (error as Error).message)
        this.applyActionSafe(taskId, 'verify_failed_final')
      }
    } finally {
      clearTimeout(timeout)
      this.active.delete(taskId)
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
          // Blueprint context (PRD etc.) + project memory + skill pack.
          (this.deps.getPlanContext?.(task) ?? '') +
            readProjectMemory(project.path) +
            skillSection(task.skill),
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
          this.note(taskId, `agent exited with code ${result.exitCode} — see the log above`)
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
        this.note(
          taskId,
          `Plan format warnings (review it manually before approving): ${formatErrors?.join('; ')}`,
        )
        this.applyActionSafe(taskId, 'plan_ready')
      } else {
        this.applyActionSafe(taskId, 'plan_failed')
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        this.note(taskId, (error as Error).message)
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

    // Inject per-agent env from Settings (e.g. 9Router tokens).
    const task = this.deps.tasks.get(taskId)
    const agentEnv = task ? this.deps.getAgentEnv?.(task.agentId) : undefined
    const finalOpts = agentEnv ? { ...opts, env: { ...opts.env, ...agentEnv } } : opts

    // Run separator: logs accumulate across attempts and agent
    // switches — every run announces who is doing what (QA: an old
    // Claude line looked like the wrong agent was running).
    const header = `━━ ${finalOpts.mode} run · ${adapter.id}${finalOpts.model ? ` · ${finalOpts.model}` : ''} ━━`
    this.deps.broadcastAgentEvent({ taskId, event: { type: 'text', content: header } })
    logLines.push(header)

    for await (const event of adapter.run(finalOpts)) {
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

  // Failures must be VISIBLE: record the event AND stream it into the
  // live log (QA: worktree errors were silently swallowed into events).
  private note(taskId: string, message: string): void {
    this.deps.tasks.recordEvent(taskId, 'agent_error', { message })
    this.deps.broadcastAgentEvent({ taskId, event: { type: 'error', message } })
  }

  // App quit: abort every in-flight run so no orphaned agent process
  // keeps writing into (and locking) a worktree.
  abortAll(): void {
    for (const controller of this.active.values()) controller.abort()
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

  // Post-merge memory extraction: runs a read-only agent over the plan,
  // diff, and verdict to extract patterns, decisions, gotchas, and stack
  // notes. Writes them to the project's .founcode/memory.md. Best-effort
  // and non-blocking — failures are logged as task events.
  private async extractMemory(taskId: string): Promise<void> {
    try {
      const task = this.deps.tasks.get(taskId)
      const project = task ? this.deps.projects.get(task.projectId) : undefined
      const plan = this.deps.artifacts.latest(taskId, 'plan')
      const diff = this.deps.artifacts.latest(taskId, 'diff')
      const verdict = this.deps.artifacts.latest(taskId, 'verify_report')
      const adapter = task ? this.deps.registry.get(task.agentId) : undefined
      if (!task || !project || !plan || !adapter) return

      const prompt = memoryExtractTemplate
        .replace('{{task_title}}', task.title)
        .replace('{{task_intent}}', task.intent)
        .replace('{{plan}}', plan.content.slice(0, 8000))
        .replace('{{diff}}', (diff?.content ?? '').slice(0, 6000))
        .replace('{{verdict}}', (verdict?.content ?? 'no verdict').slice(0, 3000))

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3 * 60 * 1000)
      const parts: string[] = []

      try {
        for await (const event of adapter.run({
          cwd: project.path,
          prompt,
          mode: 'read',
          abortSignal: controller.signal,
        })) {
          if (event.type === 'text') parts.push(event.content)
        }
      } finally {
        clearTimeout(timeout)
      }

      const output = parts.join('\n')
      if (!output.trim()) return

      // Append to the project's memory file. Each extraction adds its
      // sections; the file grows over time (no dedup yet — patterns
      // repeating means they've been confirmed across tasks).
      const founcodeDir = join(project.path, '.founcode')
      mkdirSync(founcodeDir, { recursive: true })
      const memoryPath = join(founcodeDir, 'memory.md')
      const header = `\n## ${task.title} (${new Date().toISOString().slice(0, 10)})\n`
      appendFileSync(memoryPath, `${header}${output}\n`)

      // Structured task log: records every completed task so future plan
      // prompts can reference recent work (pattern matching / anti-dup).
      const logPath = join(founcodeDir, 'task-log.json')
      const logEntry = {
        title: task.title,
        intent: task.intent.slice(0, 300),
        verdict: verdict ? 'pass' : 'unknown',
        date: new Date().toISOString().slice(0, 10),
      }
      let log: (typeof logEntry)[] = []
      if (existsSync(logPath)) {
        try {
          log = JSON.parse(readFileSync(logPath, 'utf8'))
        } catch {
          /* corrupt — start fresh */
        }
      }
      log.push(logEntry)
      writeFileSync(logPath, JSON.stringify(log, null, 2))
    } catch (error) {
      this.deps.tasks.recordEvent(taskId, 'memory_extract_failed', {
        message: (error as Error).message,
      })
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
