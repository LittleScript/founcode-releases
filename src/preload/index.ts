// Preload — the only bridge between renderer and main. Channels are
// allowlisted against the shared IPC contract; anything else is rejected.

import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { type FouncodeApi, IPC_EVENT_CHANNELS, IPC_INVOKE_CHANNELS } from '../shared/ipc-contract'

const api: FouncodeApi = {
  invoke: (channel, args) => {
    if (!IPC_INVOKE_CHANNELS.includes(channel)) {
      return Promise.reject(new Error(`Unknown IPC channel: ${channel}`))
    }
    return ipcRenderer.invoke(channel, args)
  },
  on: (channel, listener) => {
    if (!IPC_EVENT_CHANNELS.includes(channel)) {
      throw new Error(`Unknown IPC event channel: ${channel}`)
    }
    const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) =>
      listener(payload as Parameters<typeof listener>[0])
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
  // Drag-and-drop: File objects no longer expose .path in modern
  // Electron; this is the sanctioned way to resolve the real path.
  getPathForFile: (file) => webUtils.getPathForFile(file),
}

contextBridge.exposeInMainWorld('founcode', api)
