// Chat-first home (v1.1 C1): the discussion layer in front of — and
// alongside — the P-E-V pipeline. The assistant sees the live workspace
// (projects, blueprints, task states), discusses, and proposes actions
// the user triggers as chips. It can steer a RUNNING blueprint too:
// pause auto-advance, queue a new idea as a task, start the next task.

import homeTemplate from '../../../prompts/chat/home.md?raw'
import type { ChatAction, ChatMessage, ChatSession } from '../../shared/chat-types'
import { parseSlashSkill } from '../../shared/skills-types'
import type { AgentEvent } from '../../shared/types'
import type { AgentRegistry } from '../agents/AgentRegistry'
import { skillSection } from '../skills/skillPacks'
import type { BlueprintRepo } from '../store/repositories/BlueprintRepo'
import type { ChatRepo } from '../store/repositories/ChatRepo'
import type { ProjectRepo } from '../store/repositories/ProjectRepo'
import type { SettingsRepo } from '../store/repositories/SettingsRepo'
import type { TaskRepo } from '../store/repositories/TaskRepo'
import { parseChatReply } from './chatActions'

export const CHAT_TIMEOUT_MS = 5 * 60 * 1000
const HISTORY_LIMIT = 30

export interface ChatDeps {
  chat: ChatRepo
  projects: ProjectRepo
  tasks: TaskRepo
  blueprints: BlueprintRepo
  registry: AgentRegistry
  settings: SettingsRepo
  // cwd for sessions not bound to a project (agent still needs one).
  fallbackCwd: string
  broadcastEvent: (p: { sessionId: string; event: AgentEvent }) => void
  // Nudges the renderer to reload messages/sessions.
  pingUpdated: (sessionId: string) => void
  // Pipeline bridges (wired in createServices).
  startNextTask: (blueprintId: string) => void
}

export class ChatOrchestrator {
  private active = new Map<string, AbortController>()

  constructor(private deps: ChatDeps) {}

  createSession(projectId?: string | null): ChatSession {
    const defaults = this.deps.settings.get()
    return this.deps.chat.createSession({
      projectId,
      agentId: defaults.defaultAgentId,
      model: defaults.defaultModel || null,
    })
  }

  isBusy(sessionId: string): boolean {
    return this.active.has(sessionId)
  }

  listSessions(): ChatSession[] {
    return this.deps.chat.listSessions().map((s) => ({ ...s, busy: this.active.has(s.id) }))
  }

  listMessages(sessionId: string): ChatMessage[] {
    return this.deps.chat.listMessages(sessionId)
  }

  deleteSession(sessionId: string): void {
    this.deps.chat.deleteSession(sessionId)
  }

  // User pressed stop — abort the in-flight reply for this session.
  stop(sessionId: string): void {
    this.active.get(sessionId)?.abort()
  }

  abortAll(): void {
    for (const controller of this.active.values()) controller.abort()
  }

  updateSession(
    sessionId: string,
    patch: {
      agentId?: string
      model?: string
      title?: string
      projectId?: string | null
      pinned?: boolean
    },
  ): ChatSession {
    this.deps.chat.updateSession(sessionId, patch)
    const session = this.deps.chat.getSession(sessionId)
    if (!session) throw new Error(`Chat session not found: ${sessionId}`)
    return { ...session, busy: this.active.has(sessionId) }
  }

  send(sessionId: string, content: string): void {
    const session = this.deps.chat.getSession(sessionId)
    if (!session) throw new Error(`Chat session not found: ${sessionId}`)
    if (this.active.has(sessionId))
      throw new Error('The assistant is still replying — wait for it to finish.')

    const isFirst = this.deps.chat.listMessages(sessionId).length === 0
    this.deps.chat.addMessage(sessionId, 'user', content)
    if (isFirst) this.deps.chat.setTitle(sessionId, content.split('\n')[0] ?? content)
    this.deps.pingUpdated(sessionId)

    // "/debug why does login loop" -> apply the debug skill pack.
    const { skillId, rest } = parseSlashSkill(content)
    void this.runReply(session, skillId ? rest || content : content, skillId)
  }

  private async runReply(
    session: ChatSession,
    message: string,
    skillId: string | null = null,
  ): Promise<void> {
    const sessionId = session.id
    const adapter = this.deps.registry.get(session.agentId)
    if (!adapter) {
      this.deps.chat.addMessage(sessionId, 'assistant', `(agent not available: ${session.agentId})`)
      this.deps.pingUpdated(sessionId)
      return
    }

    const history = this.deps.chat
      .listMessages(sessionId)
      .slice(-HISTORY_LIMIT)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    const prompt =
      homeTemplate
        .replace('{{context}}', this.buildContext(session))
        .replace('{{history}}', history || '(new conversation)')
        .replace('{{message}}', message) + skillSection(skillId)

    const project = session.projectId ? this.deps.projects.get(session.projectId) : undefined
    const cwd = project?.path ?? this.deps.projects.list()[0]?.path ?? this.deps.fallbackCwd

    const controller = new AbortController()
    this.active.set(sessionId, controller)
    // Second ping now that busy=true is observable via listSessions.
    this.deps.pingUpdated(sessionId)
    const timeout = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)
    const parts: string[] = []
    let exitCode = -1
    let resultText: string | undefined
    let lastError: string | undefined

    try {
      for await (const event of adapter.run({
        cwd,
        prompt,
        mode: 'read',
        model: session.model ?? undefined,
        abortSignal: controller.signal,
      })) {
        this.deps.broadcastEvent({ sessionId, event })
        if (event.type === 'text') parts.push(event.content)
        if (event.type === 'error') lastError = event.message
        if (event.type === 'done') {
          exitCode = event.exitCode
          resultText = event.resultText
        }
      }
      if (controller.signal.aborted) {
        this.deps.chat.addMessage(sessionId, 'assistant', '⏹ Stopped.')
        return
      }
      const raw = (resultText ?? parts.join('\n')).trim()
      if (exitCode !== 0 || !raw) {
        // Tell the user WHY (CLI missing, auth, crash) — not just "try again".
        this.deps.chat.addMessage(
          sessionId,
          'assistant',
          lastError ? `⚠ ${lastError.slice(0, 500)}` : '(no response — try again)',
        )
      } else {
        const { reply, actions } = parseChatReply(raw)
        this.deps.chat.addMessage(sessionId, 'assistant', reply || '(empty reply)', actions)
      }
    } catch (error) {
      this.deps.chat.addMessage(sessionId, 'assistant', `(error: ${(error as Error).message})`)
    } finally {
      clearTimeout(timeout)
      this.active.delete(sessionId)
      this.deps.pingUpdated(sessionId)
    }
  }

  // Executes main-side actions; renderer-side ones (blueprint_from_idea,
  // open_project) are handled by the UI directly.
  runAction(_sessionId: string, action: ChatAction): { ok: boolean; message: string } {
    try {
      switch (action.type) {
        case 'create_task': {
          if (!this.deps.projects.get(action.projectId)) throw new Error('Unknown project')
          const task = this.deps.tasks.create({
            projectId: action.projectId,
            title: action.title,
            intent: action.intent,
            agentId: this.deps.settings.get().defaultAgentId,
            model: this.deps.settings.get().defaultModel || null,
          })
          return { ok: true, message: `Task created: ${task.title}` }
        }
        case 'add_task_to_blueprint': {
          const bp = this.deps.blueprints.get(action.blueprintId)
          if (!bp) throw new Error('Unknown blueprint')
          const siblings = this.deps.tasks.listByBlueprint(bp.id)
          const nextIndex = siblings.reduce((max, t) => Math.max(max, (t.orderIndex ?? -1) + 1), 0)
          const task = this.deps.tasks.create({
            projectId: bp.projectId,
            title: action.title,
            intent: action.intent,
            agentId: bp.agentId,
            model: bp.model,
            blueprintId: bp.id,
            orderIndex: nextIndex,
          })
          this.deps.blueprints.recordEvent(bp.id, 'task_added_via_chat', { taskId: task.id })
          return { ok: true, message: `Queued into "${bp.title}" as task #${nextIndex + 1}` }
        }
        case 'pause_auto': {
          this.deps.blueprints.setAdvanceMode(action.blueprintId, 'manual')
          return {
            ok: true,
            message: 'Auto-advance paused — nothing new starts after the current task.',
          }
        }
        case 'resume_auto': {
          this.deps.blueprints.setAdvanceMode(action.blueprintId, 'auto')
          return { ok: true, message: 'Auto-advance resumed.' }
        }
        case 'start_next': {
          this.deps.startNextTask(action.blueprintId)
          return { ok: true, message: 'Next task started.' }
        }
        default:
          return { ok: false, message: `Action not handled in main: ${action.type}` }
      }
    } catch (error) {
      return { ok: false, message: (error as Error).message }
    }
  }

  private buildContext(session: ChatSession): string {
    const projects = this.deps.projects.list()
    if (projects.length === 0) return 'No projects registered yet — a blank workspace.'

    const lines: string[] = []
    for (const project of projects) {
      const focus = project.id === session.projectId ? ' (CURRENT FOCUS)' : ''
      lines.push(`### Project "${project.name}"${focus} — id: ${project.id}`)
      lines.push(`Path: ${project.path}`)

      const blueprints = this.deps.blueprints.list(project.id)
      for (const bp of blueprints) {
        lines.push(
          `- Blueprint "${bp.title}" — id: ${bp.id}, state: ${bp.state}, advance: ${bp.advanceMode}`,
        )
      }

      const tasks = this.deps.tasks.list(project.id)
      if (tasks.length > 0) {
        const byState = new Map<string, number>()
        for (const t of tasks) byState.set(t.state, (byState.get(t.state) ?? 0) + 1)
        lines.push(`- Tasks: ${[...byState.entries()].map(([s, n]) => `${n} ${s}`).join(', ')}`)
        const live = tasks.filter((t) =>
          ['PLANNING', 'EXECUTING', 'VERIFYING', 'AWAITING_APPROVAL', 'REVIEW'].includes(t.state),
        )
        for (const t of live.slice(0, 8)) {
          lines.push(`  - [${t.state}] "${t.title}" — id: ${t.id}`)
        }
      }

      if (project.id === session.projectId) {
        const withPrd = blueprints.find((b) => b.prd)
        if (withPrd?.prd) {
          lines.push('', '#### PRD excerpt (current focus project)', withPrd.prd.slice(0, 1500))
        }
      }
      lines.push('')
    }
    return lines.join('\n')
  }
}
