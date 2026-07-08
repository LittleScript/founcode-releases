# Agent Terminal — Design (v1.3 headline)

Status: **DESIGN — awaiting Koko's decisions (marked ⬥ below).** No code yet.

## The problem it solves

Founcode's pipeline is a **bounded batch**: plan → execute once → verify → capped fix loop → stop and ask the human. Deliberate (verification-first, anti credit-burn). But it means an agent can't iterate freely to solve a messy problem the way it does in a terminal — it "fails" instead of adapting.

What power users want (Koko): the agent running **live in a terminal**, like Claude Code in PowerShell — it works, it *asks*, you answer, you steer, with permission modes (accept-edits / auto / plan / yolo / skip). 

**Decision (locked):** Founcode offers BOTH. Pipeline stays for verified builds; Agent Terminal is a second execution mode for interactive work. Same worktree-isolation thesis underneath.

## Execution model

Today's adapters spawn with **piped stdio + collect-then-return** (one-shot). Interactive needs the opposite: a **long-lived process attached to a pseudo-terminal**, streaming both ways.

- **Frontend:** [xterm.js](https://xtermjs.org) renders the agent's native TUI faithfully (ANSI, colors, prompts) — the same stack VS Code's integrated terminal uses.
- **Backend:** a real PTY so CLIs detect a TTY and enable their interactive mode. On Windows that's **ConPTY**, driven by `node-pty`.

✅ **Decision 1 — RESOLVED (8 Jul, T0 spike): go path (a), `node-pty`.**

Spike result: `node-pty` **loads and runs in Electron 43** (Node 24, ABI **148**). Spawned `cmd.exe`, wrote a command, captured real terminal output *with* ANSI control sequences (`[?25l…`). Crucially it worked **despite an ABI mismatch** (system Node ABI 137 vs Electron ABI 148) → node-pty ships **N-API prebuilds** (ABI-stable across Node versions). That means **no electron-rebuild, no VS Build Tools** — the same "zero build tools" property that made us pick node:sqlite. The native-module objection is void.

**Packaging TODO (validate in T2's packaged build):**
- add `node-pty` as a real dependency (externalized via `externalizeDepsPlugin`, already how main deps work),
- `asarUnpack` the native binary (`**/node-pty/**/*.node`) in electron-builder so it's loadable from the packaged app,
- keep `npmRebuild: false` (prebuilds are N-API, no rebuild needed),
- confirm the `.node` loads in the INSTALLED app, not just dev.

(Rejected: (b) pipe-only — many CLIs gate interactive prompts on `isatty`; (c) external terminal window — loses the embedded feel.)

## Adapter surface

Add an optional capability to `AgentAdapter`:

```ts
interface InteractiveAgent {
  supportsInteractive: true
  launchInteractive(opts): { command: string; args: string[]; cwd: string }
}
```

The orchestrator, given a PTY, wires `pty.onData → renderer`, `renderer input → pty.write`, `pty.onExit → settle`. Agents that don't implement it simply don't offer Terminal mode.

Per-agent interactive launch (to validate in the spike):
| Agent | Interactive command | YOLO / skip |
|---|---|---|
| Claude Code | `claude` (no `-p`) | `--dangerously-skip-permissions` |
| OpenCode | `opencode` (TUI) | `--agent build` + provider config |
| Codex | `codex` (interactive) | `--sandbox danger-full-access` |
| Antigravity | `av` | (per its flags) |

## Permission modes (also back-ports to the pipeline)

A single Founcode enum mapped to each CLI's flags — used by BOTH Terminal and the batch Execute phase:

| Founcode level | Meaning | Claude | Codex | Antigravity |
|---|---|---|---|---|
| **Safe** | read-only / plan | `--permission-mode plan` | `--sandbox read-only` | `--approval-mode default` |
| **Auto-edit** (default) | edit files, ask on risky | `--permission-mode acceptEdits` | `--sandbox workspace-write` | `--approval-mode auto` |
| **Full access** | run anything, no prompts | `--dangerously-skip-permissions` | `--sandbox danger-full-access` | `--approval-mode yolo` |

⬥ **Decision 2 — default level.** Recommend **Auto-edit** as default (matches today), Full access opt-in per task with a clear warning. Full access is *safer here than in a bare terminal* because it runs inside an isolated worktree.

## How Terminal coexists with the pipeline

⬥ **Decision 3 — where the agent works.**
- **(a) Isolated worktree + "Verify & merge when done"** *(recommended)* — freedom during the session, discipline at the gate. The transcript + final diff can still go through Verify and the merge review. Keeps our thesis; the terminal is "supervised freedom."
- **(b) Directly in the repo** — like opening a terminal in the folder. What some power users expect, but no safety net; only behind an explicit toggle.

Proposed: default (a); (b) as an advanced opt-in.

**UI shape:** a task gains an execution-mode choice at start — **Pipeline (verified)** or **Terminal (interactive)** — plus a standalone "Open Terminal" from a project. Terminal mode replaces the Plan/Log/Diff/Verify tabs with a live xterm; "Verify & merge" button appears when the session ends.

## Chat-in-log

In Terminal mode the log *is* the terminal: the composer at the bottom writes to the agent's stdin. "Discuss in the log" = just typing. No separate chat plumbing.

## Persistence & lifecycle

- Process lives in **main**, survives view switches (like our current runs).
- Transcript logged to an artifact (kind `terminal`) so it's in Foundry afterward.
- `before-quit` already aborts all runs — extend to kill PTYs. No detached sessions (keep simple for v1.3).

## Gating

⬥ **Decision 4 — Free or Pro?** Multi-agent is free (locked earlier). Terminal is a *mode*, so core Terminal = Free. Candidate Pro lever: **multiple concurrent terminals** (parallel), consistent with "parallel capacity = Pro."

## Decisions — ALL RESOLVED (Koko approved 8 Jul)

1. ✅ **node-pty** (path a) — T0 spike proved it loads in Electron 43 via N-API prebuilds, no build tools
2. ✅ default permission level = **Auto-edit**
3. ✅ **worktree-isolated + merge-gate** default; repo-direct is an advanced opt-in
4. ✅ Terminal core **Free**, parallel terminals **Pro**

## Rough build phases (after decisions)

- T0: node-pty spike (does it load in Electron 43?) + xterm render smoke
- T1: interactive adapter surface + Claude Code interactive launch
- T2: PTY orchestrator + xterm UI + input wiring + kill on quit
- T3: permission-mode enum wired into BOTH terminal & pipeline execute
- T4: worktree isolation + "Verify & merge when done" gate
- T5: other agents' interactive launches + transcript artifact + tests
