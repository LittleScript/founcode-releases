import type { AgentInfo } from '../../shared/types'
import type { AgentAdapter } from './AgentAdapter'
import { AntigravityAdapter } from './antigravity/AntigravityAdapter'
import { ClaudeCodeAdapter } from './claude/ClaudeCodeAdapter'
import { CodexAdapter } from './codex/CodexAdapter'
import { OpenCodeAdapter } from './opencode/OpenCodeAdapter'

export class AgentRegistry {
  private adapters = new Map<string, AgentAdapter>()

  // Default = production agents. The Mock agent is dev-only; main
  // registers it explicitly when the app is unpackaged.
  constructor(adapters?: AgentAdapter[]) {
    for (const adapter of adapters ?? [
      new ClaudeCodeAdapter(),
      new OpenCodeAdapter(),
      new CodexAdapter(),
      // Gemini CLI was retired by Google on 2026-06-18; Antigravity is
      // its successor.
      new AntigravityAdapter(),
    ]) {
      this.adapters.set(adapter.id, adapter)
    }
  }

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.id, adapter)
  }

  get(id: string): AgentAdapter | undefined {
    return this.adapters.get(id)
  }

  async listInstalled(): Promise<AgentInfo[]> {
    const infos: AgentInfo[] = []
    for (const adapter of this.adapters.values()) {
      const detection = await adapter.detect()
      infos.push({
        id: adapter.id,
        displayName: adapter.displayName,
        installed: detection.installed,
        version: detection.version,
      })
    }
    return infos
  }
}
