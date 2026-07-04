// Global agent-event log, keyed by task. Lives outside the components
// so streaming lines survive tab switches and page navigation. Fed by a
// single task:event subscription in App.tsx.

import { create } from 'zustand'
import type { AgentEvent } from '../../shared/types'

export interface LogLine {
  key: number
  kind: 'text' | 'tool' | 'file' | 'error' | 'done'
  content: string
  at: number
}

const MAX_LINES_PER_TASK = 2000
let nextKey = 0

export function toLine(event: AgentEvent): LogLine | null {
  const at = Date.now()
  switch (event.type) {
    case 'text':
      return { key: nextKey++, kind: 'text', content: event.content, at }
    case 'tool_use':
      return { key: nextKey++, kind: 'tool', content: `⚙ ${event.name} ${event.detail}`, at }
    case 'file_change':
      return { key: nextKey++, kind: 'file', content: `± [${event.kind}] ${event.path}`, at }
    case 'error':
      return { key: nextKey++, kind: 'error', content: `✖ ${event.message}`, at }
    case 'done':
      return {
        key: nextKey++,
        kind: 'done',
        content: `— finished (exit ${event.exitCode}${event.costUsd !== undefined ? `, $${event.costUsd.toFixed(4)}` : ''}) —`,
        at,
      }
  }
}

interface LogState {
  logs: Record<string, LogLine[]>
  append: (taskId: string, event: AgentEvent) => void
}

// Stable empty reference: selectors must NOT allocate a fresh array per
// call (`?? []` in a selector = new snapshot every render = infinite
// re-render loop and a blank window).
export const NO_LINES: LogLine[] = []

export const useLogStore = create<LogState>((set) => ({
  logs: {},
  append: (taskId, event) => {
    const line = toLine(event)
    if (!line) return
    set((s) => {
      const existing = s.logs[taskId] ?? []
      const next = existing.length >= MAX_LINES_PER_TASK ? existing.slice(1) : existing
      return { logs: { ...s.logs, [taskId]: [...next, line] } }
    })
  },
}))
