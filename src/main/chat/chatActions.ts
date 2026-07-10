// Parses the assistant reply: prose + optional ===ACTIONS=== JSON tail.
// Invalid/unknown actions are dropped, never fatal — the reply text
// always survives.

import type { ChatAction } from '../../shared/chat-types'

const MARKER = '===ACTIONS==='
const KNOWN = new Set([
  'create_task',
  'add_task_to_blueprint',
  'pause_auto',
  'resume_auto',
  'start_next',
  'blueprint_from_idea',
  'open_project',
  'a2a_ask',
  'a2a_handoff',
  'a2a_notify',
])

export function parseChatReply(raw: string): { reply: string; actions: ChatAction[] } {
  const index = raw.indexOf(MARKER)
  if (index === -1) return { reply: raw.trim(), actions: [] }

  const reply = raw.slice(0, index).trim()
  const tail = raw
    .slice(index + MARKER.length)
    .replace(/```(json)?/g, '')
    .trim()

  try {
    const parsed = JSON.parse(tail) as unknown
    if (!Array.isArray(parsed)) return { reply, actions: [] }
    const actions = parsed
      .filter(
        (a): a is ChatAction =>
          typeof a === 'object' && a !== null && KNOWN.has((a as { type?: string }).type ?? ''),
      )
      .slice(0, 3)
    return { reply, actions }
  } catch {
    return { reply, actions: [] }
  }
}
