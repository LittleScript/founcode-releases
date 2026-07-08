import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatSession } from '../shared/chat-types'
import type { AppInfo } from '../shared/types'
import logoUrl from './assets/logo.png'
import wordmarkUrl from './assets/wordmark.png'
import wordmarkDarkUrl from './assets/wordmark-dark.png'
import { HelpMenu } from './components/HelpMenu'
import { SessionMenu } from './components/SessionMenu'
import { ArtifactsPage } from './pages/ArtifactsPage'
import { BlueprintStudio } from './pages/BlueprintStudio'
import { Board } from './pages/Board'
import { ChatPage } from './pages/ChatPage'
import { ChatsPage } from './pages/ChatsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { Settings } from './pages/Settings'
import { SkillsPage } from './pages/SkillsPage'
import { TaskDetail } from './pages/TaskDetail'
import { TerminalView } from './pages/TerminalView'
import { useAppStore } from './stores/appStore'
import { useBlueprintStore } from './stores/blueprintStore'
import { useLogStore } from './stores/logStore'

// One consistent icon set (16px, stroke=currentColor, lucide-style) —
// no more mixed emoji/glyph weights in the nav.
function Icon({ d, filled = false }: { d: string; filled?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  newChat: 'M12 5v14 M5 12h14',
  chats: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  skills:
    'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  artifacts: 'M21 8l-9-5-9 5 9 5 9-5z M3 8v8l9 5 9-5V8 M12 13v8',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
}

function Wordmark({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 pt-5 pb-4 ${collapsed ? 'justify-center px-0' : 'px-4'}`}
    >
      <img src={logoUrl} alt="" className="size-8 shrink-0 rounded-md" />
      {!collapsed && (
        <div className="leading-tight">
          <img src={wordmarkUrl} alt="Founcode" className="wordmark-on-dark h-[15px] w-auto" />
          <img src={wordmarkDarkUrl} alt="Founcode" className="wordmark-on-light h-[15px] w-auto" />
          <div className="mt-1 font-mono text-[9px] text-slate-600 uppercase tracking-[0.2em]">
            plan · exec · verify
          </div>
        </div>
      )}
    </div>
  )
}

// Claude-app-style navigation: New chat / Chats / Projects / Artifacts,
// with recent chats underneath.
function Sidebar({ info }: { info: AppInfo | null }) {
  const view = useAppStore((s) => s.view)
  const goChat = useAppStore((s) => s.goChat)
  const goChats = useAppStore((s) => s.goChats)
  const goProjects = useAppStore((s) => s.goProjects)
  const goSkills = useAppStore((s) => s.goSkills)
  const goArtifacts = useAppStore((s) => s.goArtifacts)
  const openSettings = useAppStore((s) => s.openSettings)
  const tasks = useAppStore((s) => s.tasks)
  const [recents, setRecents] = useState<ChatSession[]>([])

  const reloadRecents = useCallback(async () => {
    const list = await window.founcode.invoke('chat:listSessions', undefined)
    setRecents(list.slice(0, 8))
  }, [])

  useEffect(() => {
    void reloadRecents()
    return window.founcode.on('chat:updated', () => void reloadRecents())
  }, [reloadRecents])

  // Collapse + drag-resize, persisted (Claude-app parity). Width follows
  // the pointer continuously down to 160px; below 100px it snaps to the
  // icon rail — the 100–160 hysteresis zone prevents flip-flopping, and
  // a width transition (only when NOT dragging) smooths the snap.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('fc.sb.collapsed') === '1')
  const [width, setWidth] = useState(() => Number(localStorage.getItem('fc.sb.width')) || 240)
  const [isDragging, setIsDragging] = useState(false)
  const dragging = useRef(false)

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return
      if (e.clientX < 100) {
        setCollapsed(true)
        localStorage.setItem('fc.sb.collapsed', '1')
        return
      }
      if (e.clientX >= 160) {
        const w = Math.min(360, e.clientX)
        setCollapsed(false)
        localStorage.setItem('fc.sb.collapsed', '0')
        setWidth(w)
        localStorage.setItem('fc.sb.width', String(w))
      }
      // 100–160: keep the current mode (hysteresis).
    }
    const up = () => {
      dragging.current = false
      setIsDragging(false)
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  const liveCount = tasks.filter((t) =>
    ['PLANNING', 'EXECUTING', 'VERIFYING'].includes(t.state),
  ).length

  const navItem = (active: boolean) =>
    `flex w-full items-center gap-2.5 rounded-md py-2 text-left text-[13.5px] transition-colors duration-150 ${
      collapsed ? 'justify-center px-0' : 'px-3'
    } ${
      active
        ? 'bg-surface-hover text-slate-100'
        : 'text-slate-400 hover:bg-surface-hover/60 hover:text-slate-200'
    }`

  return (
    <aside
      style={{ width: collapsed ? 56 : Math.max(160, width) }}
      className={`relative flex shrink-0 flex-col border-r border-edge bg-surface-raised/60 ${
        isDragging ? '' : 'transition-[width] duration-200 ease-out'
      }`}
    >
      <Wordmark collapsed={collapsed} />

      <nav className="flex flex-col gap-0.5 px-2">
        <button
          type="button"
          onClick={async () => {
            const session = await window.founcode.invoke('chat:createSession', {})
            goChat(session.id)
          }}
          title="New chat"
          className={`mb-1.5 flex w-full items-center gap-2.5 rounded-md border border-accent/30 py-2 text-left text-[13.5px] text-accent transition-colors hover:border-accent/50 hover:bg-accent/5 ${
            collapsed ? 'justify-center px-0' : 'px-3'
          }`}
        >
          <Icon d={ICONS.newChat} />
          {!collapsed && 'New chat'}
        </button>
        <button
          type="button"
          onClick={goChats}
          title="Chats"
          className={navItem(view.name === 'chats')}
        >
          <Icon d={ICONS.chats} />
          {!collapsed && 'Chats'}
        </button>
        <button
          type="button"
          onClick={goProjects}
          title="Projects"
          className={navItem(
            view.name === 'projects' || view.name === 'board' || view.name === 'task',
          )}
        >
          <Icon d={ICONS.projects} />
          {!collapsed && 'Projects'}
        </button>
        <button
          type="button"
          onClick={goSkills}
          title="Skills & Tools"
          className={navItem(view.name === 'skills')}
        >
          <Icon d={ICONS.skills} />
          {!collapsed && <>Skills &amp; Tools</>}
        </button>
        <button
          type="button"
          onClick={goArtifacts}
          title="Foundry — everything the pipeline has produced"
          className={navItem(view.name === 'artifacts')}
        >
          <Icon d={ICONS.artifacts} />
          {!collapsed && 'Foundry'}
        </button>
      </nav>

      {!collapsed && (
        <>
          <div className="field-label px-4 pt-4">Recents</div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2">
            {recents.map((s) => (
              <div key={s.id} className="group relative">
                <button
                  type="button"
                  onClick={() => goChat(s.id)}
                  title={s.title}
                  className={`w-full truncate rounded-md px-3 py-1.5 pr-7 text-left text-[12.5px] transition-colors ${
                    view.name === 'chat' && view.sessionId === s.id
                      ? 'bg-surface-hover text-slate-100'
                      : 'text-slate-500 hover:bg-surface-hover/60 hover:text-slate-300'
                  }`}
                >
                  {s.pinned && <span className="mr-1 text-[10px] text-slate-600">📌</span>}
                  {s.busy && (
                    <span className="live-dot mr-1.5 inline-block size-1.5 rounded-full bg-accent align-middle" />
                  )}
                  {s.title}
                </button>
                <SessionMenu
                  session={s}
                  onChanged={() => void reloadRecents()}
                  onDeleted={() => {
                    void reloadRecents()
                    if (view.name === 'chat' && view.sessionId === s.id) goChat(null)
                  }}
                />
              </div>
            ))}
          </nav>
        </>
      )}
      {collapsed && <div className="flex-1" />}

      <div className="mt-auto border-t border-edge px-2 py-2">
        {liveCount > 0 && !collapsed && (
          <div className="mb-1 flex items-center gap-2 px-2 font-mono text-[11px] text-accent">
            <span className="live-dot size-1.5 rounded-full bg-accent" />
            {liveCount} agent{liveCount > 1 ? 's' : ''} running
          </div>
        )}
        <button
          type="button"
          onClick={openSettings}
          title="Settings"
          className={`flex w-full items-center gap-2.5 rounded-md py-1.5 text-left text-[13.5px] text-slate-400 transition-colors hover:bg-surface-hover hover:text-slate-200 ${
            collapsed ? 'justify-center px-0' : 'px-3'
          }`}
        >
          <Icon d={ICONS.settings} />
          {!collapsed && 'Settings'}
        </button>
        <HelpMenu collapsed={collapsed} />
        {!collapsed && (
          <div className="px-3 pt-1 font-mono text-[10px] text-slate-600">
            v{info?.version ?? '·'} — schema v{info?.schemaVersion ?? '·'}
          </div>
        )}
      </div>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: resize handle — drag in to collapse, out to expand */}
      <div
        onPointerDown={() => {
          dragging.current = true
          setIsDragging(true)
          document.body.style.cursor = 'col-resize'
        }}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize transition-colors hover:bg-accent/30"
      />
    </aside>
  )
}

function ErrorToast() {
  const error = useAppStore((s) => s.error)
  const clearError = useAppStore((s) => s.clearError)
  if (!error) return null
  return (
    <div className="rise-in fixed right-4 bottom-4 z-50 max-w-md rounded-lg border border-red-900/70 bg-surface-raised shadow-black/50 shadow-xl">
      <div className="flex items-center justify-between border-red-900/40 border-b px-4 py-2">
        <span className="font-medium font-mono text-[11px] text-red-400 uppercase tracking-wider">
          Error
        </span>
        <button
          type="button"
          onClick={clearError}
          aria-label="Dismiss"
          className="rounded px-2 py-0.5 text-slate-400 text-xs transition-colors hover:bg-red-950/40 hover:text-red-300"
        >
          ✕ Close
        </button>
      </div>
      <p className="px-4 py-3 text-slate-200 text-sm leading-snug">{error}</p>
    </div>
  )
}

export default function App() {
  const view = useAppStore((s) => s.view)
  const init = useAppStore((s) => s.init)
  const refreshTasks = useAppStore((s) => s.refreshTasks)
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    init()
    window.founcode.invoke('app:info', undefined).then(setInfo).catch(console.error)
    // Theme applies via the data-theme attribute (tokens remap in CSS).
    window.founcode.invoke('settings:get', undefined).then((s) => {
      document.documentElement.dataset.theme = s.theme
    })
    // Keep the board live: any state change in main refreshes the task list.
    const offState = window.founcode.on('task:stateChanged', () => {
      refreshTasks()
    })
    // Single global subscription: streaming logs survive tab switches.
    const offEvents = window.founcode.on('task:event', ({ taskId, event }) => {
      useLogStore.getState().append(taskId, event)
    })
    // Blueprint streaming + state, keyed the same way (blueprintId).
    const offBpEvents = window.founcode.on('blueprint:event', ({ blueprintId, event }) => {
      useLogStore.getState().append(blueprintId, event)
    })
    const offBpState = window.founcode.on('blueprint:stateChanged', () => {
      useBlueprintStore.getState().refresh()
      refreshTasks()
    })
    // Chat streaming, keyed by sessionId — survives view switches.
    const offChatEvents = window.founcode.on('chat:event', ({ sessionId, event }) => {
      useLogStore.getState().append(sessionId, event)
    })
    return () => {
      offState()
      offEvents()
      offBpEvents()
      offBpState()
      offChatEvents()
    }
  }, [init, refreshTasks])

  // Blueprint Studio is a focused full-screen wizard — no sidebar.
  if (view.name === 'blueprint') {
    return (
      <div className="flex h-screen">
        <BlueprintStudio blueprintId={view.blueprintId} />
        <ErrorToast />
      </div>
    )
  }

  // The terminal takes the full pane (keeps the sidebar for navigation).
  if (view.name === 'terminal') {
    return (
      <div className="flex h-screen">
        <Sidebar info={info} />
        <TerminalView session={view.session} />
        <ErrorToast />
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <Sidebar info={info} />
      {view.name === 'chat' ? (
        <ChatPage sessionId={view.sessionId} />
      ) : view.name === 'chats' ? (
        <ChatsPage />
      ) : view.name === 'projects' ? (
        <ProjectsPage />
      ) : view.name === 'skills' ? (
        <SkillsPage />
      ) : view.name === 'artifacts' ? (
        <ArtifactsPage />
      ) : view.name === 'task' ? (
        <TaskDetail taskId={view.taskId} />
      ) : view.name === 'settings' ? (
        <Settings />
      ) : (
        <Board />
      )}
      <ErrorToast />
    </div>
  )
}
