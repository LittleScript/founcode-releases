import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import { createServices, registerIpcHandlers } from './ipc/handlers'
import { openDatabase } from './store/db'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0f14',
    title: 'Founcode',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Hardening — TDD §7.1. Renderer has zero Node access.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  win.on('ready-to-show', () => win.show())

  // External links open in the OS browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    // Dev aid: surface renderer console + load failures in the terminal,
    // otherwise a renderer crash is just a silent blank window.
    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
    })
    win.webContents.on('did-fail-load', (_event, code, desc, url) => {
      console.error(`[renderer] failed to load ${url}: ${code} ${desc}`)
    })
    win.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[renderer] process gone: ${details.reason}`)
    })
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const dbPath = join(app.getPath('userData'), 'founcode.db')
  const db = openDatabase(dbPath)
  const services = createServices(db, join(app.getPath('userData'), 'worktrees'))
  services.orchestrator.recoverOrphans()
  services.blueprintOrchestrator.recoverOrphans()
  registerIpcHandlers(db, dbPath, services)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
