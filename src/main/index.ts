import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import { createServices, registerIpcHandlers } from './ipc/handlers'
import { openDatabase } from './store/db'

// E2E tests point the app at a throwaway data dir (must happen before
// app is ready).
if (process.env.FOUNCODE_USER_DATA) {
  app.setPath('userData', process.env.FOUNCODE_USER_DATA)
}

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
  const services = createServices(
    db,
    join(app.getPath('userData'), 'worktrees'),
    join(app.getPath('userData'), 'license.bin'),
  )
  services.orchestrator.recoverOrphans()
  services.blueprintOrchestrator.recoverOrphans()
  registerIpcHandlers(db, dbPath, services)
  createWindow()

  // License re-validation: at startup and every 6 hours (internally it
  // only contacts the vendor when the last check is older than a day).
  void services.license.revalidate()
  setInterval(() => void services.license.revalidate(), 6 * 60 * 60 * 1000)

  // Auto-update from GitHub Releases (packaged builds only). Failures are
  // non-fatal — the app must never be blocked by the updater.
  if (app.isPackaged) {
    import('electron-updater')
      .then((m) => {
        // electron-updater is CJS; under bundler interop its exports can
        // land on .default instead of the namespace object.
        const autoUpdater = m.autoUpdater ?? m.default?.autoUpdater
        if (!autoUpdater) throw new Error('electron-updater interop: autoUpdater not found')
        return autoUpdater.checkForUpdatesAndNotify()
      })
      .catch((error) => console.error('[updater]', error))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
