# Founcode

**Trust what your agents ship.** The Windows-first desktop orchestrator for AI coding agents — chat-first front door, verification-first pipeline.

> Private source. Public releases & downloads: [LittleScript/founcode-releases](https://github.com/LittleScript/founcode-releases)

## What it does (v1.2)

```
Chat → Blueprint → Plan → Execute → Verify → Merge
```

- **Chat-first home** — a persistent AI chat that sees the live workspace (projects, blueprints, task states, PRDs) and bridges into the pipeline via action chips: turn a discussion into a Blueprint, queue a mid-flight idea into a running build, pause/resume auto-advance.
- **Blueprint** — idea → clarifying questions → node-graph structure → PRD → ordered task graph. Greenfield, extend-existing, and document-existing modes.
- **P-E-V pipeline** — read-only planning you approve, execution in an isolated git worktree, independent verification (build + tests) before review, one-click merge. State machines everywhere, exhaustively tested.
- **Multi-agent, free** — Claude Code, OpenCode (75+ providers incl. DeepSeek/GLM/Qwen/Ollama, live model catalog from the CLI), Codex, Antigravity. Per-chat and per-task agent+model switching. Keys stay in each CLI, never in Founcode.
- **10 built-in skills** — Design, Research, Debug, TDD, Security Review, Architecture, Refactor, Performance, Documentation, Code Review. Per task or `/slash` in chat.
- **Foundry** — a global browser for everything the pipeline produced (plans, diffs, verdicts, logs).
- **Local-first** — SQLite in `%APPDATA%`, no accounts, no telemetry, works offline. Pro via Lemon Squeezy license key (7-day offline grace).
- Dark & light themes, NSIS installer, production auto-update (verified end-to-end).

## Docs

| Doc | Contents |
|---|---|
| `docs/PRD.md` | Product requirements, tiers, out-of-scope |
| `docs/TDD.md` | Architecture: adapters, state machines, DB schema, IPC |
| `docs/TODO.md` | Phase checklists — **read first every session** |
| `docs/PLANNING.md` | Milestones & release strategy |
| `docs/USER-GUIDE.md` | End-user manual |
| `docs/DEVELOPMENT.md` | Setup + hard-won gotchas |

## Development

```powershell
npm install
npm run dev        # detached: Start-Process cmd /c "npm run dev"
npm test           # 140 unit tests
npm run test:e2e   # Playwright UI smoke (needs npm run build first)
npm run dist       # icons + build + NSIS installer -> release/
```

- Integration tests against real CLIs are gated: `FOUNCODE_IT=1 npx vitest run tests/<name>.integration.test.ts`.
- Releasing: bump version → `npm run dist` → `gh release create vX.Y.Z --repo LittleScript/founcode-releases <installer + blockmap + latest.yml + zip>`. Shipped apps auto-update.

© 2026 21Kent — All rights reserved.
