// All ipcMain handlers live here, keyed by the shared IPC contract.
// Phase 0: app:ping + app:info only; project/task handlers land in Phase 1.

import { app, ipcMain } from 'electron'
import type { IpcInvokeMap } from '../../shared/ipc-contract'
import { type Database, getSchemaVersion } from '../store/db'

function handle<C extends keyof IpcInvokeMap>(
  channel: C,
  handler: (
    args: IpcInvokeMap[C]['args'],
  ) => IpcInvokeMap[C]['result'] | Promise<IpcInvokeMap[C]['result']>,
): void {
  ipcMain.handle(channel, (_event, args) => handler(args))
}

export function registerIpcHandlers(db: Database, dbPath: string): void {
  handle('app:ping', () => 'pong')

  handle('app:info', () => ({
    version: app.getVersion(),
    schemaVersion: getSchemaVersion(db),
    dbPath,
  }))
}
