// All ipcMain handlers live here, keyed by the shared IPC contract.

import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from 'electron'
import type { IpcEventMap, IpcInvokeMap } from '../../shared/ipc-contract'
import { AgentRegistry } from '../agents/AgentRegistry'
import { MockAgentAdapter } from '../agents/mock/MockAgentAdapter'
import { BlueprintOrchestrator } from '../blueprint/BlueprintOrchestrator'
import { ChatOrchestrator } from '../chat/ChatOrchestrator'
import { createGreenfieldRepo } from '../git/createGreenfieldRepo'
import { WorktreeManager } from '../git/WorktreeManager'
import { LemonSqueezyVendor } from '../license/LemonSqueezyVendor'
import { FREE_LIMITS, LicenseService } from '../license/LicenseService'
import { Orchestrator } from '../orchestrator/Orchestrator'
import { type Database, getSchemaVersion } from '../store/db'
import { ArtifactRepo } from '../store/repositories/ArtifactRepo'
import { BlueprintRepo } from '../store/repositories/BlueprintRepo'
import { ChatRepo } from '../store/repositories/ChatRepo'
import { ProjectRepo } from '../store/repositories/ProjectRepo'
import { SettingsRepo } from '../store/repositories/SettingsRepo'
import { TaskRepo } from '../store/repositories/TaskRepo'

function handle<C extends keyof IpcInvokeMap>(
  channel: C,
  handler: (
    args: IpcInvokeMap[C]['args'],
  ) => IpcInvokeMap[C]['result'] | Promise<IpcInvokeMap[C]['result']>,
): void {
  ipcMain.handle(channel, (_event, args) => handler(args))
}

export function broadcast<C extends keyof IpcEventMap>(channel: C, payload: IpcEventMap[C]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export interface MainServices {
  projects: ProjectRepo
  tasks: TaskRepo
  artifacts: ArtifactRepo
  blueprints: BlueprintRepo
  settings: SettingsRepo
  registry: AgentRegistry
  orchestrator: Orchestrator
  blueprintOrchestrator: BlueprintOrchestrator
  chatOrchestrator: ChatOrchestrator
  license: LicenseService
}

export function createServices(
  db: Database,
  worktreesDir: string,
  licenseFilePath: string,
): MainServices {
  const projects = new ProjectRepo(db)
  const tasks = new TaskRepo(db)
  const artifacts = new ArtifactRepo(db)
  const blueprints = new BlueprintRepo(db)
  const settings = new SettingsRepo(db)
  const registry = new AgentRegistry()
  // Mock agent is for developing/testing Founcode itself — dev builds only.
  if (!app.isPackaged || process.env.FOUNCODE_DEV_AGENTS === '1') {
    registry.register(new MockAgentAdapter())
  }
  const worktrees = new WorktreeManager(worktreesDir)
  const license = new LicenseService(
    new LemonSqueezyVendor(),
    licenseFilePath,
    {
      // DPAPI when available; plaintext fallback keeps the app functional.
      encrypt: (plain) =>
        safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(plain) : Buffer.from(plain),
      decrypt: (blob) => {
        try {
          return safeStorage.isEncryptionAvailable()
            ? safeStorage.decryptString(blob)
            : blob.toString()
        } catch {
          return blob.toString()
        }
      },
    },
    Date.now,
    // FOUNCODE_TIER=pro is honored in dev builds only.
    !app.isPackaged,
  )

  // Mutual reference resolved via closure: the task orchestrator notifies
  // the blueprint orchestrator when a task settles; the blueprint
  // orchestrator asks the task orchestrator to start the next task.
  let blueprintOrchestrator: BlueprintOrchestrator
  const orchestrator = new Orchestrator({
    projects,
    tasks,
    artifacts,
    registry,
    worktrees,
    broadcastStateChange: (change) => broadcast('task:stateChanged', change),
    broadcastAgentEvent: (payload) => broadcast('task:event', payload),
    getPlanContext: (task) => buildBlueprintPlanContext(task, blueprints, tasks),
    onTaskSettled: (task) => blueprintOrchestrator.handleTaskSettled(task),
    shouldAutoApprovePlan: (task) => task.blueprintId !== null,
    getTier: () => license.getTier(),
  })
  blueprintOrchestrator = new BlueprintOrchestrator({
    projects,
    tasks,
    blueprints,
    registry,
    broadcastState: (change) => broadcast('blueprint:stateChanged', change),
    broadcastEvent: (payload) => broadcast('blueprint:event', payload),
    startTaskPlanning: (taskId) => orchestrator.startPlanning(taskId),
    getTier: () => license.getTier(),
  })
  const chatOrchestrator = new ChatOrchestrator({
    chat: new ChatRepo(db),
    projects,
    tasks,
    blueprints,
    registry,
    settings,
    fallbackCwd: worktreesDir,
    broadcastEvent: (payload) => broadcast('chat:event', payload),
    pingUpdated: (sessionId) => broadcast('chat:updated', { sessionId }),
    startNextTask: (blueprintId) => blueprintOrchestrator.startNextTask(blueprintId),
  })
  return {
    projects,
    tasks,
    artifacts,
    blueprints,
    settings,
    registry,
    orchestrator,
    blueprintOrchestrator,
    chatOrchestrator,
    license,
  }
}

// Injects the Blueprint's PRD + a summary of completed sibling tasks into
// a task's plan prompt — the shared context that keeps each agent aware
// of the whole product while it focuses on its one task (anti context-rot).
function buildBlueprintPlanContext(
  task: { blueprintId: string | null; orderIndex: number | null },
  blueprints: BlueprintRepo,
  tasks: TaskRepo,
): string {
  if (!task.blueprintId) return ''
  const bp = blueprints.get(task.blueprintId)
  if (!bp?.prd) return ''
  const siblings = tasks.listByBlueprint(task.blueprintId)
  const done = siblings.filter((t) => t.state === 'DONE')
  const doneList =
    done.length > 0
      ? done.map((t) => `- ${t.title}`).join('\n')
      : '- (none yet — this is the first task)'
  return [
    '## Product context (from the Blueprint PRD)',
    'This task is one step in a larger product. Read this PRD for context, then plan ONLY your task above — do not implement the whole product.',
    '',
    bp.prd,
    '',
    '## Already completed in this product',
    doneList,
  ].join('\n')
}

export function registerIpcHandlers(db: Database, dbPath: string, services: MainServices): void {
  const { projects, tasks } = services

  handle('app:ping', () => 'pong')

  handle('app:info', () => ({
    // app.getVersion() reports Electron's version when unpackaged; the
    // build-time constant is correct everywhere.
    version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : app.getVersion(),
    schemaVersion: getSchemaVersion(db),
    dbPath,
  }))

  handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select a git project folder',
      properties: ['openDirectory'],
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  handle('dialog:selectFiles', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Attach files to the chat',
      properties: ['openFile', 'multiSelections'],
    })
    return result.canceled ? [] : result.filePaths
  })

  const ensureProjectCapacity = () => {
    if (
      services.license.getTier() === 'free' &&
      projects.list().length >= FREE_LIMITS.maxProjects
    ) {
      throw new Error('Free plan supports one project — upgrade to Pro for unlimited projects.')
    }
  }

  handle('project:add', ({ path }) => {
    ensureProjectCapacity()
    if (!existsSync(path)) {
      throw new Error(`Folder does not exist: ${path}`)
    }
    if (!existsSync(join(path, '.git'))) {
      throw new Error('The selected folder is not a git repository (no .git found)')
    }
    const existing = projects.getByPath(path)
    if (existing) {
      throw new Error(`Project already registered: ${existing.name}`)
    }
    return projects.add(basename(path), path)
  })

  handle('project:createGreenfield', ({ parentDir, name }) => {
    ensureProjectCapacity()
    const { path } = createGreenfieldRepo(parentDir, name)
    return projects.add(basename(path), path)
  })

  handle('project:list', () => projects.list())

  handle('task:create', (input) => {
    if (!input.title.trim()) throw new Error('Task title is required')
    if (!input.intent.trim()) throw new Error('Task intent is required')
    if (!services.projects.get(input.projectId)) {
      throw new Error(`Unknown project: ${input.projectId}`)
    }
    const model = input.model ?? services.settings.get().defaultModel
    return tasks.create({ ...input, model })
  })

  handle('settings:get', () => services.settings.get())

  handle('settings:set', (patch) => services.settings.set(patch))

  handle('license:state', () => ({
    ...services.license.getState(),
    tier: services.license.getTier(),
  }))

  handle('license:activate', ({ key }) => services.license.activate(key))

  handle('license:deactivate', () => services.license.deactivate())

  handle('task:list', ({ projectId }) => tasks.list(projectId))

  handle('task:get', ({ taskId }) => tasks.get(taskId) ?? null)

  handle('task:startPlanning', ({ taskId }) => {
    services.orchestrator.startPlanning(taskId)
    return undefined
  })

  handle('task:requestReplan', ({ taskId, feedback }) => {
    services.orchestrator.startPlanning(taskId, feedback)
    return undefined
  })

  handle('task:approvePlan', ({ taskId, editedPlan }) =>
    services.orchestrator.approvePlan(taskId, editedPlan),
  )

  handle('task:cancel', ({ taskId }) => services.orchestrator.cancel(taskId))

  handle('task:retry', ({ taskId }) => services.orchestrator.applyAction(taskId, 'retry'))

  handle('task:merge', ({ taskId }) => services.orchestrator.merge(taskId))

  handle('task:sendBack', ({ taskId, feedback }) =>
    services.orchestrator.sendBack(taskId, feedback),
  )

  handle('task:discard', ({ taskId }) => services.orchestrator.discard(taskId))

  handle('task:artifacts', ({ taskId }) => services.artifacts.listByTask(taskId))

  handle('artifact:listAll', ({ kind }) => services.artifacts.listAll(kind))

  handle('agent:listInstalled', () => services.registry.listInstalled())

  handle('agent:listModels', ({ agentId }) => {
    const adapter = services.registry.get(agentId) as { listModels?: () => string[] } | undefined
    return adapter?.listModels?.() ?? []
  })

  // ---- Blueprint ----
  const bo = services.blueprintOrchestrator

  handle('blueprint:create', (input) => {
    // Document mode reverse-engineers a PRD from existing code, so a goal
    // is optional there; every other mode needs an idea/goal.
    if (input.mode !== 'document' && !input.idea.trim()) throw new Error('Idea is required')
    if (!services.projects.get(input.projectId)) throw new Error('Unknown project')
    const model = input.model ?? services.settings.get().defaultModel
    const bp = services.blueprints.create({ ...input, model })
    bo.start(bp.id) // kick off immediately (routes by mode)
    return bp
  })

  handle('blueprint:get', ({ blueprintId }) => services.blueprints.get(blueprintId) ?? null)

  handle('blueprint:list', ({ projectId }) => services.blueprints.list(projectId))

  handle('blueprint:getQuestions', ({ blueprintId }) => bo.getQuestions(blueprintId))

  handle('blueprint:getSuggestions', ({ blueprintId }) => bo.getSuggestions(blueprintId))

  handle('blueprint:submitAnswers', ({ blueprintId, answers }) => {
    bo.submitAnswers(blueprintId, answers)
    return undefined
  })

  handle('blueprint:acceptStructure', ({ blueprintId, structure }) => {
    bo.acceptStructure(blueprintId, structure)
    return undefined
  })

  handle('blueprint:revisePrd', ({ blueprintId, instructions }) => {
    bo.revisePrd(blueprintId, instructions)
    return undefined
  })

  handle('blueprint:acceptPrd', ({ blueprintId }) => {
    bo.acceptPrd(blueprintId)
    return undefined
  })

  handle('blueprint:finish', ({ blueprintId }) => {
    bo.finish(blueprintId)
    return undefined
  })

  handle('blueprint:chat', ({ blueprintId, phase, message }) => {
    bo.chat(blueprintId, phase, message)
    return undefined
  })

  handle('blueprint:messages', ({ blueprintId, phase }) =>
    services.blueprints.listMessages(blueprintId, phase),
  )

  handle('blueprint:tasks', ({ blueprintId }) => services.tasks.listByBlueprint(blueprintId))

  handle('blueprint:setAdvanceMode', ({ blueprintId, mode }) => {
    services.blueprints.setAdvanceMode(blueprintId, mode)
    return undefined
  })

  handle('blueprint:startImplementation', ({ blueprintId, advanceMode }) => {
    bo.startImplementation(blueprintId, advanceMode)
    return undefined
  })

  handle('blueprint:startNext', ({ blueprintId }) => {
    bo.startNextTask(blueprintId)
    return undefined
  })

  handle('blueprint:retry', ({ blueprintId }) => {
    bo.retry(blueprintId)
    return undefined
  })

  // ---- Chat-first home ----
  const chat = services.chatOrchestrator

  handle('chat:createSession', ({ projectId }) => chat.createSession(projectId))

  handle('chat:listSessions', () => chat.listSessions())

  handle('chat:messages', ({ sessionId }) => chat.listMessages(sessionId))

  handle('chat:send', ({ sessionId, content }) => {
    if (!content.trim()) throw new Error('Message is empty')
    chat.send(sessionId, content.trim())
    return undefined
  })

  handle('chat:runAction', ({ sessionId, action }) => chat.runAction(sessionId, action))

  handle('chat:deleteSession', ({ sessionId }) => {
    chat.deleteSession(sessionId)
    return undefined
  })

  handle('chat:updateSession', ({ sessionId, ...patch }) => chat.updateSession(sessionId, patch))

  handle('chat:stop', ({ sessionId }) => {
    chat.stop(sessionId)
    return undefined
  })

  handle('app:openExternal', ({ url }) => {
    // External links only — never local paths.
    if (!/^https?:\/\//.test(url)) throw new Error('Only http(s) URLs can be opened')
    void shell.openExternal(url)
    return undefined
  })
}
