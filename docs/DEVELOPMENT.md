# Panduan Developer — Founcode

Setup, arsitektur, testing, dan gotcha untuk pengembangan Founcode.
Versi: 4 Juli 2026 (Fase 0–3 selesai).

---

## 1. Setup

```bash
git clone https://github.com/LittleScript/founcode.git
cd founcode
npm install
npm run dev        # buka app (dev mode, HMR renderer)
```

Prasyarat dev: Node 24+, git, Windows 10/11. Claude Code CLI opsional (Mock Agent tersedia untuk semua alur).

## 2. Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan app dev (vite dev server + electron) |
| `npm test` | Semua unit + integration test (tanpa CLI asli) |
| `npm run test:watch` | Vitest watch mode |
| `npm run typecheck` | `tsc --noEmit` untuk config node & web |
| `npm run lint` / `npm run format` | Biome check / format |
| `npm run build` | Production build ke `out/` |
| `FOUNCODE_IT=1 npx vitest run tests/claude-adapter.integration.test.ts` | Integration test vs Claude Code CLI ASLI (pakai kredit — jalankan sadar) |

**Ritual sesi kerja & aturan keras: lihat `CLAUDE.md` di root.** Checklist fase & exit criteria: `docs/TODO.md`.

## 3. Peta Arsitektur (ringkas — detail di TDD.md)

```
src/
├── shared/            # Kontrak lintas proses (SATU-SATUNYA sumber kebenaran)
│   ├── types.ts       #   Domain types + AgentEvent
│   └── ipc-contract.ts#   Semua channel IPC, typed dua arah
├── main/              # Electron main — semua proses, git, DB di sini
│   ├── index.ts       #   Bootstrap: window (hardened), DB, recovery, IPC
│   ├── orchestrator/
│   │   ├── TaskStateMachine.ts  # Transisi legal task (pure, exhaustive-tested)
│   │   ├── Orchestrator.ts      # SATU-SATUNYA pintu ubah state + phase runners
│   │   └── planParser.ts        # Validasi format Founcode Plan + ekstraksi kriteria
│   ├── agents/
│   │   ├── AgentAdapter.ts      # Kontrak adapter (semua agen → AgentEvent)
│   │   ├── AgentRegistry.ts     # Deteksi & lookup agen
│   │   ├── claude/…             # Claude Code headless (stream-json)
│   │   └── mock/…               # Agen palsu deterministik (dev/test)
│   ├── git/
│   │   ├── WorktreeManager.ts   # Isolasi worktree + diff + merge guard repo user
│   │   └── createGreenfieldRepo.ts # Buat repo baru (Blueprint greenfield)
│   ├── blueprint/     #   Fase 5 — lihat §6.5 + TDD §12
│   │   ├── BlueprintStateMachine.ts  # IDEA→…→DONE (pure, exhaustive-tested)
│   │   ├── BlueprintOrchestrator.ts  # Phase runner generatif + sequential feeding
│   │   └── blueprintParsers.ts       # parse questions/structure/tasks
│   ├── store/         #   node:sqlite + migrations (001–005) + repos (Project/Task/Artifact/Blueprint)
│   └── ipc/handlers.ts#   Semua ipcMain.handle + createServices (wiring DI dua-arah)
├── preload/           # contextBridge, allowlist channel dari kontrak
├── renderer/          # React murni — TIDAK pernah menyentuh Node/fs/proses
│   ├── stores/        #   zustand: appStore, logStore, blueprintStore
│   ├── pages/         #   Onboarding, Board, TaskDetail, BlueprintStudio
│   └── components/    #   PlanReviewer, LogViewer, DiffViewer, VerifyReport,
│                      #   blueprint/{StepRail,QuestionsStep,StructureGraph,ChatPanel,…}
prompts/               # Template prompt (?raw): plan/execute/verify + blueprint/*
tests/                 # Vitest — lihat §5
```

**Aliran satu task:** UI → IPC → `Orchestrator.startPlanning()` → transisi state machine → adapter spawn agen (stream `AgentEvent` → broadcast `task:event` ke UI + artefak log) → plan tervalidasi → user approve (atau auto-approve untuk task blueprint) → `runExecution()` → `WorktreeManager.create()` → agen write-mode di worktree → commit + diff → `runVerify()` (agen baru) → REVIEW → user merge.

**Aliran Blueprint:** UI → `blueprint:create` → `BlueprintOrchestrator.start()` (routing per mode) → runner generatif (questions/structure/PRD/tasks, mode `read`, tanpa worktree) → tiap step transisi BlueprintStateMachine + broadcast → `acceptPrd` mendekomposisi jadi task Founcode (`order_index`) → `startImplementation` mengumpankan task satu per satu ke pipeline di atas (PRD disuntik sebagai konteks tiap Plan).

## 4. Keputusan Teknis Penting (jangan dilanggar tanpa update TDD)

1. **`node:sqlite`, bukan better-sqlite3** — zero native module. Alasan & kronologi di TDD §2.
2. **Semua transisi state lewat `Orchestrator.applyAction`** — tidak ada `setState` langsung dari handler/UI.
3. **Prompt agen selalu via stdin**, tidak pernah via argv (injection-safe menembus cmd.exe shim).
4. **Planning read-only = `--allowedTools Read Glob Grep`** — JANGAN `--permission-mode plan` (membajak output ke alur ExitPlanMode, merusak format).
5. **Renderer tanpa Node** — contextIsolation + sandbox on; channel IPC di-allowlist dari `ipc-contract.ts`.
6. **Worktree di userData**, branch `founcode/task-<id>`; tidak pernah push/switch branch user/auto-resolve konflik.

## 5. Testing

| File | Cakupan | Butuh |
|---|---|---|
| `state-machine.test.ts` | SEMUA 135 pasangan state×aksi (exhaustive) | — |
| `repos.test.ts` | CRUD repos + Orchestrator.applyAction | — |
| `plan-parser.test.ts` | Validasi format plan + ekstraksi kriteria | — |
| `planning-flow.test.ts` | Alur planning penuh via Mock (happy/invalid/fail/cancel/replan) | — |
| `worktree-manager.test.ts` | Worktree vs repo git temporer + guard repo user | git |
| `execution-flow.test.ts` | Approve→execute→diff→VERIFYING + cancel + recovery | git |
| `claude-adapter.test.ts` | Parser stream-json line | — |
| `claude-adapter.integration.test.ts` | CLI Claude Code ASLI (detect + run) | `FOUNCODE_IT=1` + kredit |
| `db.test.ts` | Migrations, idempotensi, FK | — |
| `blueprint-state-machine.test.ts` | Semua state×aksi blueprint (exhaustive) | — |
| `blueprint-repo.test.ts` | BlueprintRepo CRUD + JSON blobs + FK | — |
| `blueprint-parsers.test.ts` | parse questions(+suggestions)/structure/tasks | — |
| `blueprint-flow.test.ts` | Alur generatif penuh + document/extend/finish/chat | — |
| `blueprint-feeding.test.ts` | Sequential feeding manual/auto + PRD context | git |
| `greenfield.test.ts` | createGreenfieldRepo + build task pertama | git |
| `blueprint-e2e.integration.test.ts` | Blueprint E2E dgn Claude asli | `FOUNCODE_IT=1` |

Aturan: state machine & parser wajib punya unit test SEBELUM dianggap selesai (CLAUDE.md). Total: **109 unit/integration + 3 E2E gated**.

## 6. Gotcha Dev (dipelajari dengan air mata)

1. **electron-vite dev hanya HMR renderer.** Perubahan `src/main/**` TIDAK me-restart Electron — restart `npm run dev` manual. Kalau ada agen jalan saat restart, prosesnya jadi yatim → `taskkill /pid <pid> /T /F`.
2. **Zustand selector dilarang alokasi baru** (`s.logs[id] ?? []` = infinite re-render = window BLANK tanpa error). Pakai konstanta stabil (`NO_LINES`).
3. **`where claude` mengembalikan ≥2 entri** di Windows (sh shim tanpa ekstensi + `.cmd`). Selalu pilih `.exe` > `.cmd`; shim tanpa ekstensi tidak spawnable.
4. **PowerShell 5.1 `Set-Content` merusak UTF-8 tanpa BOM** (mojibake em-dash). Edit file docs pakai editor/tool, bukan regex PowerShell.
5. **Kutip ganda dalam `git commit -m` via PowerShell 5.1** memecah argumen — hindari `"` dalam pesan commit.
6. Renderer crash = window blank bisu. Console renderer di-bridge ke terminal dev (lihat `main/index.ts`) — baca situ dulu sebelum menebak.
7. **`git commit -m @'…'@` (here-string) sering pecah** kalau pesan panjang/ada tanda kutip → tulis pesan ke file lalu `git commit -F <file>`.
8. **Dev app untuk sesi testing: jalankan DETACHED** (`Start-Process cmd /c "npm run dev" -WindowStyle Minimized`) supaya tak ikut mati saat background task session Claude Code dibersihkan.
9. **Sesi terhubung ke `founcode:gen=*` marker**: MockAgent me-route output blueprint dari marker di prompt (jangan hapus marker dari `prompts/blueprint/*`).

## 6.5 Arsitektur Blueprint (Fase 5)

Detail penuh: TDD §12. Ringkas:
- **Runner generatif** (`BlueprintOrchestrator`) menjalankan agen mode `read` untuk menghasilkan DATA (questions/structure/PRD/tasks) — **tanpa worktree**. Parser pola verdict (fence JSON + validasi + auto-retry).
- **3 mode**: greenfield / extend (analisis kode existing) / document (retro-PRD). Diinjeksi ke prompt via `{{existing_section}}` / `{{goal_section}}`.
- **Sequential feeding**: task graph → Backlog dengan `order_index`; diumpankan satu per satu; task blueprint auto-approve plan (`shouldAutoApprovePlan`); PRD disuntik via `getPlanContext`. Callback dua-arah Orchestrator↔BlueprintOrchestrator via closure di `createServices`.
- **Chat** (`blueprint_messages`, migration 005): diskusi real-time di Structure/PRD; agen regenerate artefak via delimiter `===STRUCTURE===`/`===PRD===`.
- **Node-graph**: React Flow (`@xyflow/react`) di `StructureGraph.tsx`.

## 7. Menambah Agen Baru (P1)

1. Buat `src/main/agents/<nama>/<Nama>Adapter.ts` implement `AgentAdapter` (detect + run → `AgentEvent`).
2. Daftarkan di `AgentRegistry` constructor default.
3. Tulis unit test parser output + (opsional) integration test env-gated.
4. Selesai — orchestrator, UI, dan pipeline lain tidak perlu diubah sama sekali.

## 8. Rilis (Fase 5 — belum aktif)

electron-builder NSIS + electron-updater via GitHub Releases. Detail menyusul saat Fase 5.
