import type { AgentInfo } from '../../shared/types'
import type { AgentAdapter } from './AgentAdapter'
import { ClaudeCodeAdapter } from './claude/ClaudeCodeAdapter'
import { CodexAdapter } from './codex/CodexAdapter'
import { GeminiAdapter } from './gemini/GeminiAdapter'
import { MockAgentAdapter } from './mock/MockAgentAdapter'
import { OpenCodeAdapter } from './opencode/OpenCodeAdapter'

export class AgentRegistry {
  private adapters = new Map<string, AgentAdapter>()

  constructor(adapters?: AgentAdapter[]) {
    for (const adapter of adapters ?? [
      new ClaudeCodeAdapter(),
      new OpenCodeAdapter(),
      new CodexAdapter(),
      new GeminiAdapter(),
      new MockAgentAdapter(),
    ]) {
      this.adapters.set(adapter.id, adapter)
    }
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
