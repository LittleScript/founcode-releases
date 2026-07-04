// IPC contract — single source of truth for every channel crossing the
// main/renderer boundary. Renderer never touches Node; everything goes
// through these typed channels. TDD §6.

import type { AgentEvent, AgentInfo, AppInfo, Artifact, Project, Task, TaskState } from './types'

// ---- invoke (request/response) ----

export interface IpcInvokeMap {
  'app:ping': { args: undefined; result: 'pong' }
  'app:info': { args: undefined; result: AppInfo }
  'dialog:selectFolder': { args: undefined; result: string | null }
  'project:add': { args: { path: string }; result: Project }
  'project:list': { args: undefined; result: Project[] }
  'task:create': {
    args: { projectId: string; title: string; intent: string; agentId: string }
    result: Task
  }
  'task:list': { args: { projectId?: string }; result: Task[] }
  'task:get': { args: { taskId: string }; result: Task | null }
  'task:startPlanning': { args: { taskId: string }; result: undefined }
  'task:requestReplan': { args: { taskId: string; feedback: string }; result: undefined }
  'task:approvePlan': { args: { taskId: string; editedPlan?: string }; result: Task }
  'task:cancel': { args: { taskId: string }; result: Task }
  'task:retry': { args: { taskId: string }; result: Task }
  'task:merge': { args: { taskId: string }; result: Task }
  'task:sendBack': { args: { taskId: string; feedback: string }; result: Task }
  'task:discard': { args: { taskId: string }; result: Task }
  'task:artifacts': { args: { taskId: string }; result: Artifact[] }
  'agent:listInstalled': { args: undefined; result: AgentInfo[] }
}

export type IpcInvokeChannel = keyof IpcInvokeMap

export const IPC_INVOKE_CHANNELS: readonly IpcInvokeChannel[] = [
  'app:ping',
  'app:info',
  'dialog:selectFolder',
  'project:add',
  'project:list',
  'task:create',
  'task:list',
  'task:get',
  'task:startPlanning',
  'task:requestReplan',
  'task:approvePlan',
  'task:cancel',
  'task:retry',
  'task:merge',
  'task:sendBack',
  'task:discard',
  'task:artifacts',
  'agent:listInstalled',
]

// ---- events (main -> renderer stream) ----

export interface IpcEventMap {
  'task:event': { taskId: string; event: AgentEvent }
  'task:stateChanged': { taskId: string; from: TaskState; to: TaskState }
}

export type IpcEventChannel = keyof IpcEventMap

export const IPC_EVENT_CHANNELS: readonly IpcEventChannel[] = ['task:event', 'task:stateChanged']

// ---- API surface exposed on window.founcode by the preload ----

export interface FouncodeApi {
  invoke<C extends IpcInvokeChannel>(
    channel: C,
    args: IpcInvokeMap[C]['args'],
  ): Promise<IpcInvokeMap[C]['result']>
  on<C extends IpcEventChannel>(channel: C, listener: (payload: IpcEventMap[C]) => void): () => void
}
