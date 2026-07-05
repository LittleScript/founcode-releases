// Owns the Blueprint (Spec Studio) flow: idea -> questions -> structure
// -> PRD -> task graph. Generative runs produce DATA, not code, so they
// need no worktree. Design: docs/BLUEPRINT-DESIGN.md §4.3.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import chatTemplate from '../../../prompts/blueprint/chat.md?raw'
import documentPrdTemplate from '../../../prompts/blueprint/document-prd.md?raw'
import prdTemplate from '../../../prompts/blueprint/prd.md?raw'
import questionsTemplate from '../../../prompts/blueprint/questions.md?raw'
import reviseTemplate from '../../../prompts/blueprint/revise.md?raw'
import structureTemplate from '../../../prompts/blueprint/structure.md?raw'
import tasksTemplate from '../../../prompts/blueprint/tasks.md?raw'
import type {
  Blueprint,
  BlueprintAnswer,
  BlueprintQuestion,
  BlueprintState,
  BlueprintStructure,
  BlueprintTaskSpec,
} from '../../shared/blueprint-types'
import type { AgentEvent } from '../../shared/types'
import type { AgentRegistry } from '../agents/AgentRegistry'
import type { BlueprintRepo } from '../store/repositories/BlueprintRepo'
import type { ProjectRepo } from '../store/repositories/ProjectRepo'
import type { TaskRepo } from '../store/repositories/TaskRepo'
import { type BlueprintAction, transition } from './BlueprintStateMachine'
import { parseQuestions, parseStructure, parseTaskSpecs } from './blueprintParsers'

export const GEN_TIMEOUT_MS = 10 * 60 * 1000

export interface BlueprintDeps {
  projects: ProjectRepo
  tasks: TaskRepo
  blueprints: BlueprintRepo
  registry: AgentRegistry
  broadcastState: (p: { blueprintId: string; from: BlueprintState; to: BlueprintState }) => void
  broadcastEvent: (p: { blueprintId: string; event: AgentEvent }) => void
  // Populated by main once questions are generated so the renderer can render them.
  onQuestions?: (blueprintId: string, questions: BlueprintQuestion[]) => void
  // Kicks off a task's Plan phase (points at the task Orchestrator).
  startTaskPlanning?: (taskId: string) => void
}

interface GenResult {
  ok: boolean
  text: string
}

export class BlueprintOrchestrator {
  private active = new Map<string, AbortController>()
  private questionsCache = new Map<string, BlueprintQuestion[]>()
  private suggestionsCache = new Map<string, string[]>()

  constructor(private deps: BlueprintDeps) {}

  getQuestions(blueprintId: string): BlueprintQuestion[] {
    return this.questionsCache.get(blueprintId) ?? []
  }

  getSuggestions(blueprintId: string): string[] {
    return this.suggestionsCache.get(blueprintId) ?? []
  }

  private apply(blueprintId: string, action: BlueprintAction): Blueprint {
    const bp = this.deps.blueprints.get(blueprintId)
    if (!bp) throw new Error(`Blueprint not found: ${blueprintId}`)
    const to = transition(bp.state, action)
    this.deps.blueprints.setState(blueprintId, to)
    this.deps.blueprints.recordEvent(blueprintId, 'state_change', { action, from: bp.state, to })
    this.deps.broadcastState({ blueprintId, from: bp.state, to })
    const updated = this.deps.blueprints.get(blueprintId)
    if (!updated) throw new Error('Blueprint vanished mid-transition')
    return updated
  }

  private applySafe(blueprintId: string, action: BlueprintAction): void {
    try {
      this.apply(blueprintId, action)
    } catch {
      this.deps.blueprints.recordEvent(blueprintId, 'transition_skipped', { action })
    }
  }

  // Entry point after creation — routes by mode. Document mode skips
  // questions + structure and reverse-engineers a PRD from the code.
  start(blueprintId: string): void {
    const bp = this.deps.blueprints.get(blueprintId)
    if (!bp) return
    if (bp.mode === 'document') this.generateDocumentPrd(blueprintId)
    else this.generateQuestions(blueprintId)
  }

  // ---- document mode: IDEA -> GENERATING_PRD (skip Q + structure) ----
  private generateDocumentPrd(blueprintId: string): void {
    void (async () => {
      const bp = this.deps.blueprints.get(blueprintId)
      if (!bp) return
      this.applySafe(blueprintId, 'generate_prd_direct') // IDEA -> GENERATING_PRD
      const goal = bp.idea.trim()
        ? `## User's note / goal\n${bp.idea.trim()}`
        : 'The user did not add a specific goal — just document what exists.'
      const prompt = documentPrdTemplate.replace('{{goal_section}}', goal)
      try {
        const result = await this.collect(blueprintId, bp, prompt)
        if (result.ok && result.text.trim()) {
          this.deps.blueprints.update(blueprintId, { prd: result.text.trim() })
          this.applySafe(blueprintId, 'prd_ready')
          return
        }
        this.applySafe(blueprintId, 'generation_failed')
      } catch (error) {
        this.deps.blueprints.recordEvent(blueprintId, 'agent_error', {
          message: (error as Error).message,
        })
        this.applySafe(blueprintId, 'generation_failed')
      }
    })()
  }

  // ---- step 1: questions ----
  // Runs while still in IDEA (a generative state); only transitions to
  // QUESTIONS once the questions are parsed and cached.
  generateQuestions(blueprintId: string): void {
    void (async () => {
      const bp = this.deps.blueprints.get(blueprintId)
      if (!bp) return
      const prompt = questionsTemplate
        .replace('{{idea}}', bp.idea)
        .replace('{{tech_pref}}', techPrefText(bp))
        .replace('{{existing_section}}', existingSection(bp))
      try {
        const result = await this.collect(blueprintId, bp, prompt)
        const parsed = result.ok ? parseQuestions(result.text) : null
        if (parsed?.value) {
          this.questionsCache.set(blueprintId, parsed.value.questions)
          this.suggestionsCache.set(blueprintId, parsed.value.suggestions)
          this.deps.onQuestions?.(blueprintId, parsed.value.questions)
          this.applySafe(blueprintId, 'generate_questions') // IDEA -> QUESTIONS
          return
        }
        if (parsed)
          this.deps.blueprints.recordEvent(blueprintId, 'parse_error', { errors: parsed.errors })
        this.applySafe(blueprintId, 'generation_failed')
      } catch (error) {
        this.deps.blueprints.recordEvent(blueprintId, 'agent_error', {
          message: (error as Error).message,
        })
        this.applySafe(blueprintId, 'generation_failed')
      }
    })()
  }

  // ---- step 2: answers -> structure ----
  submitAnswers(blueprintId: string, answers: BlueprintAnswer[]): void {
    const bp = this.deps.blueprints.get(blueprintId)
    if (!bp) throw new Error(`Blueprint not found: ${blueprintId}`)
    this.deps.blueprints.update(blueprintId, { answers })
    this.apply(blueprintId, 'submit_answers') // -> STRUCTURING
    void this.runStructure(blueprintId)
  }

  private async runStructure(blueprintId: string): Promise<void> {
    const bp = this.deps.blueprints.get(blueprintId)
    if (!bp) return
    const prompt = structureTemplate
      .replace('{{idea}}', bp.idea)
      .replace('{{tech_pref}}', techPrefText(bp))
      .replace('{{answers}}', answersText(bp.answers))
      .replace('{{existing_section}}', existingSection(bp))
    const result = await this.collect(blueprintId, bp, prompt)
    if (result.ok) {
      const parsed = parseStructure(result.text)
      if (parsed.value) {
        this.deps.blueprints.update(blueprintId, { structure: parsed.value })
        this.applySafe(blueprintId, 'structure_ready')
        return
      }
      this.deps.blueprints.recordEvent(blueprintId, 'parse_error', { errors: parsed.errors })
    }
    this.applySafe(blueprintId, 'generation_failed')
  }

  // ---- step 3: accept structure -> PRD ----
  acceptStructure(blueprintId: string, editedStructure?: BlueprintStructure): void {
    if (editedStructure) this.deps.blueprints.update(blueprintId, { structure: editedStructure })
    this.apply(blueprintId, 'accept_structure') // -> GENERATING_PRD
    void this.runPrd(blueprintId)
  }

  private async runPrd(blueprintId: string, reviseInstructions?: string): Promise<void> {
    const bp = this.deps.blueprints.get(blueprintId)
    if (!bp) return
    const prompt = reviseInstructions
      ? reviseTemplate
          .replace('{{prd}}', bp.prd ?? '')
          .replace('{{instructions}}', reviseInstructions)
      : prdTemplate
          .replace('{{idea}}', bp.idea)
          .replace('{{tech_pref}}', techPrefText(bp))
          .replace('{{answers}}', answersText(bp.answers))
          .replace('{{structure}}', JSON.stringify(bp.structure, null, 2))
          .replace('{{existing_section}}', existingSection(bp))
    const result = await this.collect(blueprintId, bp, prompt)
    if (result.ok && result.text.trim()) {
      this.deps.blueprints.update(blueprintId, { prd: result.text.trim() })
      this.applySafe(blueprintId, 'prd_ready')
      return
    }
    this.applySafe(blueprintId, 'generation_failed')
  }

  // ---- PRD chat revision ----
  revisePrd(blueprintId: string, instructions: string): void {
    this.apply(blueprintId, 'revise_prd') // PRD_REVIEW -> GENERATING_PRD
    void this.runPrd(blueprintId, instructions)
  }

  // Keep the PRD and stop here (no task build) — the natural end for
  // document mode, and available to any mode.
  finish(blueprintId: string): void {
    this.writePrdToProject(blueprintId)
    this.apply(blueprintId, 'finish') // PRD_REVIEW -> DONE
  }

  // ---- discussion chat (structure / PRD steps) ----
  // Answers questions and, when asked, regenerates the artifact in place.
  // Does NOT change blueprint state — the user stays on the review step.
  chat(blueprintId: string, phase: 'structure' | 'prd', message: string): void {
    void (async () => {
      const bp = this.deps.blueprints.get(blueprintId)
      if (!bp) return
      this.deps.blueprints.addMessage(blueprintId, phase, 'user', message)
      this.pingRefresh(blueprintId)

      const artifact =
        phase === 'structure' ? JSON.stringify(bp.structure, null, 2) : (bp.prd ?? '')
      const history = this.deps.blueprints
        .listMessages(blueprintId, phase)
        .map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`)
        .join('\n')
      const prompt = chatTemplate
        .replaceAll('{{phase}}', phase)
        .replace('{{artifact}}', artifact)
        .replace('{{history}}', history)
        .replace('{{message}}', message)

      try {
        const result = await this.collect(blueprintId, bp, prompt)
        if (!result.ok || !result.text.trim()) {
          this.deps.blueprints.addMessage(blueprintId, phase, 'agent', '(no response — try again)')
          this.pingRefresh(blueprintId)
          return
        }
        const { reply, updated } = splitChatReply(result.text, phase)
        this.deps.blueprints.addMessage(blueprintId, phase, 'agent', reply)

        if (updated !== null) {
          if (phase === 'structure') {
            const parsed = parseStructure(updated)
            if (parsed.value) this.deps.blueprints.update(blueprintId, { structure: parsed.value })
          } else {
            this.deps.blueprints.update(blueprintId, { prd: updated.trim() })
          }
          this.deps.blueprints.recordEvent(blueprintId, 'chat_updated_artifact', { phase })
        }
        this.pingRefresh(blueprintId)
      } catch (error) {
        this.deps.blueprints.addMessage(
          blueprintId,
          phase,
          'agent',
          `(error: ${(error as Error).message})`,
        )
        this.pingRefresh(blueprintId)
      }
    })()
  }

  // Nudge the renderer to reload the blueprint (state unchanged).
  private pingRefresh(blueprintId: string): void {
    const bp = this.deps.blueprints.get(blueprintId)
    if (bp) this.deps.broadcastState({ blueprintId, from: bp.state, to: bp.state })
  }

  // ---- step 4: accept PRD -> decompose into tasks ----
  acceptPrd(blueprintId: string): void {
    this.apply(blueprintId, 'accept_prd') // -> DECOMPOSING
    this.writePrdToProject(blueprintId)
    void this.runDecompose(blueprintId)
  }

  private async runDecompose(blueprintId: string): Promise<void> {
    const bp = this.deps.blueprints.get(blueprintId)
    if (!bp) return
    const prompt = tasksTemplate
      .replace('{{prd}}', bp.prd ?? '')
      .replace('{{structure}}', JSON.stringify(bp.structure, null, 2))
      .replace('{{existing_section}}', existingSection(bp))
    const result = await this.collect(blueprintId, bp, prompt)
    if (result.ok) {
      const parsed = parseTaskSpecs(result.text)
      if (parsed.value) {
        this.createTasks(bp, parsed.value)
        this.applySafe(blueprintId, 'tasks_ready')
        return
      }
      this.deps.blueprints.recordEvent(blueprintId, 'parse_error', { errors: parsed.errors })
    }
    this.applySafe(blueprintId, 'generation_failed')
  }

  private createTasks(bp: Blueprint, specs: BlueprintTaskSpec[]): void {
    specs.forEach((spec, index) => {
      this.deps.tasks.create({
        projectId: bp.projectId,
        title: spec.title,
        intent: spec.intent,
        agentId: bp.agentId,
        blueprintId: bp.id,
        orderIndex: index,
      })
    })
    this.deps.blueprints.recordEvent(bp.id, 'tasks_created', { count: specs.length })
  }

  // Persist the approved PRD into the project (mirrors plan-copy behavior).
  private writePrdToProject(blueprintId: string): void {
    try {
      const bp = this.deps.blueprints.get(blueprintId)
      const project = bp ? this.deps.projects.get(bp.projectId) : undefined
      if (!bp?.prd || !project) return
      const dir = join(project.path, '.founcode', 'blueprints')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, `${bp.id}-PRD.md`), bp.prd)
    } catch (error) {
      this.deps.blueprints.recordEvent(blueprintId, 'prd_write_failed', {
        message: (error as Error).message,
      })
    }
  }

  // ---- step 5: implementation (sequential feeding) ----
  startImplementation(blueprintId: string, advanceMode?: 'manual' | 'auto'): void {
    if (advanceMode) this.deps.blueprints.setAdvanceMode(blueprintId, advanceMode)
    this.apply(blueprintId, 'start_implementation') // TASK_REVIEW -> IMPLEMENTING
    this.startNextTask(blueprintId)
  }

  // Starts the lowest-order task that hasn't finished yet. Returns false
  // when there is nothing left to start (all done).
  startNextTask(blueprintId: string): boolean {
    const tasks = this.deps.tasks.listByBlueprint(blueprintId)
    // A task is "in flight" if it's neither a fresh Backlog nor terminal.
    const active = tasks.find((t) => t.state !== 'BACKLOG' && !isTaskTerminal(t.state))
    if (active) return true // already working one; don't start another
    const next = tasks.find((t) => t.state === 'BACKLOG')
    if (!next) {
      // Nothing queued and nothing active -> blueprint is complete.
      if (tasks.every((t) => isTaskTerminal(t.state))) {
        this.applySafe(blueprintId, 'all_tasks_done')
      }
      return false
    }
    this.deps.blueprints.recordEvent(blueprintId, 'task_started', {
      taskId: next.id,
      order: next.orderIndex,
    })
    this.deps.startTaskPlanning?.(next.id)
    return true
  }

  // Called by the task Orchestrator when a blueprint task settles.
  handleTaskSettled(task: { blueprintId: string | null; state: string }): void {
    if (!task.blueprintId) return
    const bp = this.deps.blueprints.get(task.blueprintId)
    if (bp?.state !== 'IMPLEMENTING') return
    // Auto mode advances on a successful merge; manual waits for the
    // user. A discarded/failed task never auto-advances (user decides).
    if (task.state === 'DONE' && bp.advanceMode === 'auto') {
      this.startNextTask(bp.id)
    } else if (task.state === 'DONE') {
      // Manual: check whether that was the last one.
      const tasks = this.deps.tasks.listByBlueprint(bp.id)
      if (tasks.every((t) => isTaskTerminal(t.state))) {
        this.applySafe(bp.id, 'all_tasks_done')
      }
    }
  }

  // FAILED -> IDEA, then restart the flow appropriate to the mode.
  retry(blueprintId: string): void {
    this.apply(blueprintId, 'retry')
    this.start(blueprintId)
  }

  // Recovery: generative states orphaned by a restart cannot resume.
  recoverOrphans(): void {
    const genStates: BlueprintState[] = ['IDEA', 'STRUCTURING', 'GENERATING_PRD', 'DECOMPOSING']
    for (const bp of this.deps.blueprints.list()) {
      if (!genStates.includes(bp.state)) continue
      this.deps.blueprints.recordEvent(bp.id, 'crash_recovery', { orphanedState: bp.state })
      this.applySafe(bp.id, 'generation_failed')
    }
  }

  private async collect(blueprintId: string, bp: Blueprint, prompt: string): Promise<GenResult> {
    const adapter = this.deps.registry.get(bp.agentId)
    const project = this.deps.projects.get(bp.projectId)
    if (!adapter || !project) return { ok: false, text: '' }

    const controller = new AbortController()
    this.active.set(blueprintId, controller)
    const timeout = setTimeout(() => controller.abort(), GEN_TIMEOUT_MS)
    const parts: string[] = []
    let exitCode = -1
    let resultText: string | undefined

    try {
      for await (const event of adapter.run({
        cwd: project.path,
        prompt,
        mode: 'read',
        abortSignal: controller.signal,
      })) {
        this.deps.broadcastEvent({ blueprintId, event })
        if (event.type === 'text') parts.push(event.content)
        else if (event.type === 'done') {
          exitCode = event.exitCode
          if (event.resultText !== undefined) resultText = event.resultText
        }
      }
    } finally {
      clearTimeout(timeout)
      this.active.delete(blueprintId)
    }
    if (controller.signal.aborted) return { ok: false, text: '' }
    return { ok: exitCode === 0, text: resultText ?? parts.join('\n') }
  }
}

function isTaskTerminal(state: string): boolean {
  return state === 'DONE' || state === 'DISCARDED'
}

// Splits a chat response into the conversational reply and an optional
// regenerated artifact (after the ===STRUCTURE=== / ===PRD=== delimiter).
function splitChatReply(
  text: string,
  phase: 'structure' | 'prd',
): { reply: string; updated: string | null } {
  const delimiter = phase === 'structure' ? '===STRUCTURE===' : '===PRD==='
  const idx = text.indexOf(delimiter)
  if (idx === -1) return { reply: text.trim(), updated: null }
  return {
    reply: text.slice(0, idx).trim() || 'Updated.',
    updated: text.slice(idx + delimiter.length).trim(),
  }
}

// For extend mode, tells the generative agent to analyze the existing
// repo first and scope the spec/tasks to the remaining work.
function existingSection(bp: Blueprint): string {
  if (bp.mode !== 'extend') return ''
  return [
    '## Existing project',
    'This repository ALREADY contains a partially-built project. Before answering, explore it with your Read, Glob, and Grep tools to understand what exists (structure, routes/pages, data models, dependencies).',
    'The idea/goal below is what the user wants to ADD or COMPLETE. Build the spec around EXTENDING the current code — do not re-plan work that is already done, and prefer the existing stack and conventions.',
    '',
  ].join('\n')
}

function techPrefText(bp: Blueprint): string {
  return bp.techPref.mode === 'manual' && bp.techPref.stack
    ? `User specified stack: ${bp.techPref.stack}`
    : 'Let the AI recommend the best stack.'
}

function answersText(answers: BlueprintAnswer[] | null): string {
  if (!answers?.length) return '(no answers provided)'
  return answers.map((a) => `- ${a.question}\n  → ${a.answer ?? '(skipped)'}`).join('\n')
}
