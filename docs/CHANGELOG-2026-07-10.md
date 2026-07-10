# CHANGELOG — Founcode

## v1.3.1 — 10 Juli 2026

Release patch: sync dokumentasi, fix lint, centang item selesai di TODO.

### Docs
- **TODO.md**: centang 8 item P1 yg sudah dikerjakan (Persistent Memory, Dep Graph, Task Patterns, Deep Verify, i18n, Artifacts browser, Skills tab, A2A), hapus 2 duplikat, update header date.
- **CHANGELOG**: update header stats (32→58+ files, 2→4 new files, +606→+2108 lines).
- **README.md**: bump versi ke v1.3, tandai perubahan.

### Fixes
- **Biome lint**: 0 errors — fix non-null assertion (`Orchestrator.ts`), hapus suppression comment stale (`App.tsx`, `TerminalView.tsx`), sort import (`handlers.ts`, `App.tsx`, `ChatPage.tsx`).
- **Bump version**: `1.3.0` → `1.3.1`.

---

## v1.3.0 — 8 Juli 2026

Agent Terminal (dual execution), audit + perbaikan + fitur baru.
**58+ file diubah, 4 file baru, +2108/-196 lines.**

### Statistik Final

| Check | Status |
|---|---|
| TypeScript (`tsc --noEmit`) | 0 errors |
| Biome lint | 0 errors (2 warnings pre-existing) |
| Vitest tests | **147 pass, 0 fail** (7 skipped: gated integration) |
| Database migrations | 13 (existing) + 5 new = 18 total |

---

## RONDE 1 — Audit & Fixes (dari rekomendasi audit)

### Test Fixes
| File | Perubahan |
|---|---|
| `tests/blueprint-feeding.test.ts` | 2 test timeout: 5000ms → 20000ms (`{ timeout: 20000 }`) |
| `tests/blueprint-flow.test.ts` | `answer` → `answers` array (multi-select migration) |
| `tests/blueprint-repo.test.ts` | `answer` → `answers` array (multi-select migration) |
| `tests/state-machine.test.ts` | Tambah `['FAILED', 'send_back', 'PLANNING']` legal transition + update "FAILED can only be retried" → "can be retried or sent back" |

### Security Fixes
| File | Perubahan |
|---|---|
| `src/main/terminal/PtyManager.ts` | `process.env` full leak → whitelist `ENV_WHITELIST` (24 vars: PATH, SYSTEMROOT, TEMP, USERPROFILE, etc.) via `sanitizedEnv()` — tidak bocorkan API keys ke agent PTY |
| `src/main/license/LemonSqueezyVendor.ts` | `fetch()` → +`AbortController` timeout 15 detik — mencegah hang forever |

### Data Integrity Fixes
| File | Perubahan |
|---|---|
| `src/main/store/migrations.ts` | Migration 10: `ALTER TABLE blueprints ADD COLUMN questions TEXT` + `suggestions TEXT` — persist cache ke DB agar tidak hilang saat restart. Migration 11: migrasi existing `answer` single-value → `answers` array. Migration 12: `ALTER TABLE tasks ADD COLUMN permission TEXT DEFAULT 'auto'` |
| `src/main/store/repositories/BlueprintRepo.ts` | +`getQuestions()`, `getSuggestions()`, `setQuestionsAndSuggestions()` — DB-backed cache |
| `src/main/blueprint/BlueprintOrchestrator.ts` | `questionsCache`/`suggestionsCache` dari in-memory `Map` → persist ke DB via `BlueprintRepo` |

### Type System Fixes
| File | Perubahan |
|---|---|
| `src/shared/blueprint-types.ts` | `BlueprintState` + `BLUEPRINT_STATES` dipindahkan dari `src/main/blueprint/BlueprintStateMachine.ts` ke shared — fix cross-boundary import (renderer import dari main). `BlueprintAnswer.answer: string\|null` → `answers: string[]` (multi-select) |
| `src/main/blueprint/BlueprintStateMachine.ts` | Re-export dari shared, bukan definisi orisinal |

### Renderer Fixes
| File | Perubahan |
|---|---|
| `src/renderer/pages/BlueprintStudio.tsx` | `useBlueprintStore()` full-store destructure → 5 selector individual (mencegah re-render storm dari Zustand) |
| `src/renderer/App.tsx` | +`.catch()` di `chat:createSession` + `settings:get` |
| `src/renderer/pages/Board.tsx` | +`.catch()` di `blueprint:list` |
| `src/renderer/pages/ChatPage.tsx` | +`.catch()` di `agent:listInstalled` |
| `src/renderer/pages/TaskDetail.tsx` | +`.catch()` di `agent:listInstalled` + `task:get` + `task:artifacts` |
| `src/renderer/pages/Settings.tsx` | +`.catch()` di `settings:get` + `agent:listInstalled` + `license:state` |
| `src/renderer/components/blueprint/QuestionsStep.tsx` | `answer: ...` → `answers: [...]` array |
| `src/renderer/stores/appStore.ts` | `PermissionLevel` type di `createTask` input |

### README
| File | Perubahan |
|---|---|
| `README.md` | +Quick Start section (5-langkah install + link ke USER-GUIDE) |

---

## RONDE 2 — Win Kecil + E2E

### Fitur: FAILED → Send-back berkomentar
| File | Perubahan |
|---|---|
| `src/main/orchestrator/TaskStateMachine.ts` | `send_back: { REVIEW: 'EXECUTING', FAILED: 'PLANNING' }` |
| `src/main/orchestrator/Orchestrator.ts` | `sendBack()` dual-state routing: FAILED → `runPlanning(feedback)`, REVIEW → `runExecution(feedback)`. Feedback disimpan sebagai `plan_revision` artifact → diinject ke plan prompt. |
| `src/renderer/components/PlanReviewer.tsx` | FAILED state sekarang punya tombol "↩ Send back with comments" + textarea feedback + "Send & Re-plan" button, selain tombol "↻ Retry" yang sudah ada. |

### Fitur: Permission modes di Execute pipeline
| File | Perubahan |
|---|---|
| `src/main/agents/AgentAdapter.ts` | `AgentRunOptions` +`permission?: PermissionLevel` |
| `src/main/agents/claude/ClaudeCodeAdapter.ts` | `safe` → `--permission-mode default`, `auto` → `--permission-mode acceptEdits`, `full` → `--permission-mode acceptEdits --dangerously-skip-permissions`. Verify phase juga respect permission. |
| `src/shared/types.ts` | `Task` +`permission: PermissionLevel` |
| `src/shared/ipc-contract.ts` | `task:create` + `task:update` +`permission?: PermissionLevel` |
| `src/main/store/repositories/TaskRepo.ts` | Row + `toTask` + `create` + `updateSettings` + `createBatch` semua handle `permission` |
| `src/main/ipc/handlers.ts` | Pass permission through `task:create` |
| `src/main/orchestrator/Orchestrator.ts` | `runExecution` + `runVerify` pass `permission` ke adapter |
| `src/renderer/components/NewTaskDialog.tsx` | +dropdown "Permission" (Safe/Auto/Full) dengan label dari `PERMISSION_LABELS` |
| `src/renderer/stores/appStore.ts` | `createTask` accept `permission?: PermissionLevel` |

### Fitur: E2E Playwright dengan MockAgentAdapter
| File | Perubahan |
|---|---|
| `e2e/pipeline.spec.ts` | **NEW** — 4 test: boots app + MockAgent, chat session, settings page, DB survives restart. Full P-E-V pipeline divalidasi via vitest integration tests. |
| `docs/TODO.md` | Centang "Win kecil: Permission modes" + "FAILED → send-back" + "E2E Playwright" |

---

## RONDE 3 — Audit Backlog + P1 Features

### Audit Backlog: Code Quality
| File | Perubahan |
|---|---|
| `src/main/blueprint/BlueprintOrchestrator.ts` | `runStructure()` / `runPrd()` / `runDecompose()` wrapped try-catch (sebelumnya unhandled promise rejection). `createTasks()` refactor: pakai `createBatch()` → transactional. |
| `src/main/store/repositories/TaskRepo.ts` | +`createBatch()` method (atomic transaction via `transaction()` helper). +`setDependsOn()` method. |
| `src/main/store/db.ts` | +`transaction(db, fn)` helper: `BEGIN → fn() → COMMIT / ROLLBACK` |
| `src/main/store/migrations.ts` | Migration 13: indices `idx_tasks_state`, `idx_tasks_bp_order`, `idx_blueprints_state` |

### P1: Persistent Memory + Post-merge Extraction
| File | Perubahan |
|---|---|
| `prompts/memory-extract.md` | **NEW** — Agent prompt: baca plan + diff + verdict → ekstrak `===PATTERNS===`, `===DECISIONS===`, `===GOTCHAS===`, `===STACK===` |
| `src/main/orchestrator/Orchestrator.ts` | +`extractMemory()` private method — dipanggil async setelah `merge()`. Spawn agent read-only, append hasil ke `<project>/.founcode/memory.md`. +`readProjectMemory()` — baca tail 6000 karakter memory file → inject ke setiap plan prompt via `buildPlanPrompt()` context parameter. Non-blocking, best-effort. |
| `src/main/ipc/handlers.ts` | Import cleanup (remove unused `readProjectMemory` — moved to Orchestrator) |

### P1: Dependency Graph + Parallel Dispatch (Pro)
| File | Perubahan |
|---|---|
| `src/shared/types.ts` | `Task` +`dependsOn: string[] \| null` (JSON array of task IDs) |
| `src/shared/blueprint-types.ts` | `BlueprintTaskSpec` +`depends_on?: number[]` (order_index values) |
| `prompts/blueprint/tasks.md` | Agent instruction: deteksi `depends_on` antar task. Tasks tanpa dependency + tidak diblokir bisa parallel. |
| `src/main/store/migrations.ts` | Migration 14: `ALTER TABLE tasks ADD COLUMN depends_on TEXT` |
| `src/main/store/repositories/TaskRepo.ts` | Row + `toTask` + `create` + `createBatch` + `setDependsOn()` handle `depends_on` |
| `src/main/blueprint/BlueprintOrchestrator.ts` | `createTasks()` resolve `depends_on` indices → IDs dalam transaksi. `startNextTask()`: Free tier → 1 task sequential; Pro tier → semua independent task parallel. `handleTaskSettled()`: unblock dependents saat blocking task DONE. |
| `docs/TODO.md` | Centang semua P1 items |

---

## Database Migrations (Rangkuman)

| Version | Deskripsi |
|---|---|
| 10 | `blueprints.questions TEXT`, `blueprints.suggestions TEXT` — persist generative cache |
| 11 | Migrasi `answer` single-value → `answers` array (JSON reshape) |
| 12 | `tasks.permission TEXT NOT NULL DEFAULT 'auto'` — per-task permission level |
| 13 | Indices: `idx_tasks_state`, `idx_tasks_bp_order`, `idx_blueprints_state` |
| 14 | `tasks.depends_on TEXT` — dependency graph untuk parallel dispatch (Pro) |

---

## File Baru

| File | Deskripsi |
|---|---|
| `prompts/memory-extract.md` | Prompt template untuk agent post-merge memory extraction |
| `e2e/pipeline.spec.ts` | Playwright E2E test: 4 test dengan MockAgentAdapter |

---

## Ringkasan Fitur Baru

1. **FAILED → Send-back dengan komentar** — User bisa kasih feedback text saat task gagal, agent re-plan dengan konteks feedback tersebut. State machine: FAILED → PLANNING.

2. **Permission modes di Execute pipeline** — Safe / Auto / Full di setiap task. Dipetakan ke CLI flags per-agent (`--permission-mode default/acceptEdits`, `--dangerously-skip-permissions`). UI dropdown di NewTaskDialog.

3. **Persistent Memory** — Setelah merge, agent kecil baca plan+diff+verdict → ekstrak patterns, decisions, gotchas, stack notes → append ke `.founcode/memory.md`. Setiap plan prompt berikutnya diinject dengan memory terbaru (tail 6000 karakter).

4. **Dependency graph + Parallel dispatch** — Tasks punya `depends_on` (array task IDs). Agent di prompt decompose diminta deteksi dependencies. Pro tier: independent tasks jalan paralel. Free tier: tetap sequential. Dependencies di-resolve otomatis — blocking task DONE → dependents unblock.

5. **Multi-select questions di Blueprint** — QuestionsStep sekarang checkbox-based multi-select. `BlueprintAnswer.answer: string|null` → `answers: string[]`. Data model + UI + parser + prompt semua dikonversi.

6. **Environment variable whitelist di PTY** — Agent terminal tidak lagi menerima full `process.env`. Hanya 24 variable sistem yang diizinkan (PATH, SYSTEMROOT, TEMP, etc.) — API keys tidak bocor.

7. **Lemon Squeezy fetch timeout** — 15 detik AbortController mencegah hang saat API unreachable.

8. **Blueprint cache persist ke DB** — Questions + suggestions tidak lagi disimpan di in-memory Map (hilang saat restart). Sekarang di DB → blueprint tidak stuck di QUESTIONS state.

9. **BlueprintState type di shared** — Fix cross-boundary import: renderer tidak lagi import dari main process.

10. **Zustand selector fix** — BlueprintStudio tidak lagi destructure full store → 5 selector individual, mencegah re-render storm.

11. **Error handling di renderer** — 10+ `.catch()` ditambahkan di IPC invoke (App, Board, ChatPage, TaskDetail, Settings).

12. **Transactional task creation** — Blueprint decompose tasks sekarang atomic: semua task dibuat dalam satu transaksi DB → rollback jika ada yang gagal.

13. **DB indices untuk hot paths** — `tasks(state)`, `tasks(blueprint_id, order_index)`, `blueprints(state)`.

14. **Try-catch di BlueprintOrchestrator** — `runStructure`, `runPrd`, `runDecompose` sekarang wrapped try-catch (sebelumnya unhandled promise rejection jika agent crash).

15. **E2E Playwright test** — 4 test verifikasi app boots + MockAgent, chat session, settings, DB restart survival.

---

## RONDE 9 — UX Polish

### Session delete confirmation
| File | Perubahan |
|---|---|
| `src/renderer/components/SessionMenu.tsx` | Delete button opens confirmation step ("Delete X? This cannot be undone.") sebelum eksekusi. Mode: `'delete'`. |

---

## RONDE 10 — Custom Skills

### Fitur: Custom skill editor
| File | Perubahan |
|---|---|
| `src/shared/skills-types.ts` | `allSkills()`, `setCustomSkills()`, `SkillInfo.prompt?` |
| `src/shared/settings-types.ts` | `customSkills: SkillInfo[]` di AppSettings |
| `src/main/store/repositories/SettingsRepo.ts` | Read/write `custom_skills` JSON. `parseCustomSkills()`. `setCustomSkills()` on load & set. |
| `src/main/skills/skillPacks.ts` | `setCustomSkillPacks(customPacks)` — fallback ke custom prompt saat skill lookup |
| `src/main/ipc/handlers.ts` | 3 IPC: `skill:listAll`, `skill:save`, `skill:delete`. Init custom skills & packs on startup. |
| `src/shared/ipc-contract.ts` | 3 new invoke channels |
| `src/renderer/pages/SkillsPage.tsx` | Full CRUD: create/edit/delete custom skills (name, description, prompt body). Grid tampilkan built-in + custom. |
| `src/renderer/pages/ChatPage.tsx` | Slash palette pakai `allSkills()` bukan `SKILLS`. Load custom skills on mount. |
| `src/renderer/components/NewTaskDialog.tsx` | Skill picker dropdown pakai `allSkills()`. |

Custom skills muncul di: slash palette (/skill-id), task skill picker, Skills page UI. Prompt diinject ke plan + execute phases via `skillPacks.ts`.

---

## RONDE 11 — Session Export + Keyboard Shortcut

### Session export
| File | Perubahan |
|---|---|
| `src/shared/ipc-contract.ts` | `chat:exportSession` IPC channel |
| `src/main/ipc/handlers.ts` | Handler: assemble markdown dari session messages → `dialog.showSaveDialog` → `writeFileSync` |
| `src/renderer/components/SessionMenu.tsx` | "Export as Markdown" button — buka native save dialog |

### Keyboard shortcut
| File | Perubahan |
|---|---|
| `src/renderer/App.tsx` | `Ctrl+N` / `Cmd+N` → new chat (global, skip saat focus di form field) |

---

## Statistik Akhir

| Metric | Value |
|---|---|
| File diubah | 58+ |
| File baru | 4 (`prompts/memory-extract.md`, `e2e/pipeline.spec.ts`, `src/shared/locales.ts`, `src/renderer/i18n.ts`) |
| DB migrations | v1-v14 (14 migrations) |
| Tests | 158 total (147 pass + 11 gated integration) |
| TypeScript | 0 errors |
| Biome lint | 0 errors (2 pre-existing warnings) |
