// All ipcMain handlers live here, keyed by the shared IPC contract.

import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type { IpcEventMap, IpcInvokeMap } from '../../shared/ipc-contract'
import { Orchestrator } from '../orchestrator/Orchestrator'
import { type Database, getSchemaVersion } from '../store/db'
import { ArtifactRepo } from '../store/repositories/ArtifactRepo'
import { ProjectRepo } from '../store/repositories/ProjectRepo'
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
  orchestrator: Orchestrator
}

export function createServices(db: Database): MainServices {
  const projects = new ProjectRepo(db)
  const tasks = new TaskRepo(db)
  const artifacts = new ArtifactRepo(db)
  const orchestrator = new Orchestrator(tasks, (change) => broadcast('task:stateChanged', change))
  return { projects, tasks, artifacts, orchestrator }
}

export function registerIpcHandlers(db: Database, dbPath: string, services: MainServices): void {
  const { projects, tasks } = services

  handle('app:ping', () => 'pong')

  handle('app:info', () => ({
    version: app.getVersion(),
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

  handle('project:add', ({ path }) => {
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

  handle('project:list', () => projects.list())

  handle('task:create', (input) => {
    if (!input.title.trim()) throw new Error('Task title is required')
    if (!input.intent.trim()) throw new Error('Task intent is required')
    if (!services.projects.get(input.projectId)) {
      throw new Error(`Unknown project: ${input.projectId}`)
    }
    return tasks.create(input)
  })

  handle('task:list', ({ projectId }) => tasks.list(projectId))

  handle('task:get', ({ taskId }) => tasks.get(taskId) ?? null)
}
