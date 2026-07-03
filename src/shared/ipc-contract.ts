// IPC contract — single source of truth for every channel crossing the
// main/renderer boundary. Renderer never touches Node; everything goes
// through these typed channels. TDD §6.

import type { AgentEvent, AppInfo, Project, Task, TaskState } from './types'

// ---- invoke (request/response) ----

export interface IpcInvokeMap {
  'app:ping': { args: undefined; result: 'pong' }
  'app:info': { args: undefined; result: AppInfo }
  // Phase 1:
  'project:add': { args: { path: string }; result: Project }
  'project:list': { args: undefined; result: Project[] }
  'task:create': {
    args: { projectId: string; title: string; intent: string; agentId: string }
    result: Task
  }
  'task:list': { args: { projectId?: string }; result: Task[] }
}

export type IpcInvokeChannel = keyof IpcInvokeMap

export const IPC_INVOKE_CHANNELS: readonly IpcInvokeChannel[] = [
  'app:ping',
  'app:info',
  'project:add',
  'project:list',
  'task:create',
  'task:list',
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
