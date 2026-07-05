// Owns the Blueprint (Spec Studio) flow: idea -> questions -> structure
// -> PRD -> task graph. Generative runs produce DATA, not code, so they
// need no worktree. Design: docs/BLUEPRINT-DESIGN.md §4.3.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
}

interface GenResult {
  ok: boolean
  text: string
}

export class BlueprintOrchestrator {
  private active = new Map<string, AbortController>()
  private questionsCache = new Map<string, BlueprintQuestion[]>()

  constructor(private deps: BlueprintDeps) {}

  getQuestions(blueprintId: string): BlueprintQuestion[] {
    return this.questionsCache.get(blueprintId) ?? []
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
      try {
        const result = await this.collect(blueprintId, bp, prompt)
        const parsed = result.ok ? parseQuestions(result.text) : null
        if (parsed?.value) {
          this.questionsCache.set(blueprintId, parsed.value)
          this.deps.onQuestions?.(blueprintId, parsed.value)
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

function techPrefText(bp: Blueprint): string {
  return bp.techPref.mode === 'manual' && bp.techPref.stack
    ? `User specified stack: ${bp.techPref.stack}`
    : 'Let the AI recommend the best stack.'
}

function answersText(answers: BlueprintAnswer[] | null): string {
  if (!answers?.length) return '(no answers provided)'
  return answers.map((a) => `- ${a.question}\n  → ${a.answer ?? '(skipped)'}`).join('\n')
}
