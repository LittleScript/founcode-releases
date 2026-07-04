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
│   ├── git/WorktreeManager.ts   # Isolasi worktree + diff + guard repo user
│   ├── store/         #   node:sqlite + migrations + repos (Project/Task/Artifact)
│   └── ipc/handlers.ts#   Semua ipcMain.handle + createServices (wiring DI)
├── preload/           # contextBridge, allowlist channel dari kontrak
└── renderer/          # React murni — TIDAK pernah menyentuh Node/fs/proses
    ├── stores/        #   zustand: appStore (data), logStore (streaming logs)
    ├── pages/         #   Onboarding, Board, TaskDetail
    └── components/    #   PlanReviewer, LogViewer, DiffViewer, dsb.
prompts/               # Template prompt per fase (di-bundle via ?raw)
tests/                 # Vitest — lihat §5
```

**Aliran satu task:** UI → IPC → `Orchestrator.startPlanning()` → transisi state machine → adapter spawn agen (stream `AgentEvent` → broadcast `task:event` ke UI + artefak log) → plan tervalidasi → user approve → `runExecution()` → `WorktreeManager.create()` → agen write-mode di worktree → commit + diff artefak → VERIFYING *(verify runner = Fase 4)*.

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

Aturan: state machine & parser wajib punya unit test SEBELUM dianggap selesai (CLAUDE.md).

## 6. Gotcha Dev (dipelajari dengan air mata)

1. **electron-vite dev hanya HMR renderer.** Perubahan `src/main/**` TIDAK me-restart Electron — restart `npm run dev` manual. Kalau ada agen jalan saat restart, prosesnya jadi yatim → `taskkill /pid <pid> /T /F`.
2. **Zustand selector dilarang alokasi baru** (`s.logs[id] ?? []` = infinite re-render = window BLANK tanpa error). Pakai konstanta stabil (`NO_LINES`).
3. **`where claude` mengembalikan ≥2 entri** di Windows (sh shim tanpa ekstensi + `.cmd`). Selalu pilih `.exe` > `.cmd`; shim tanpa ekstensi tidak spawnable.
4. **PowerShell 5.1 `Set-Content` merusak UTF-8 tanpa BOM** (mojibake em-dash). Edit file docs pakai editor/tool, bukan regex PowerShell.
5. **Kutip ganda dalam `git commit -m` via PowerShell 5.1** memecah argumen — hindari `"` dalam pesan commit.
6. Renderer crash = window blank bisu. Console renderer di-bridge ke terminal dev (lihat `main/index.ts`) — baca situ dulu sebelum menebak.

## 7. Menambah Agen Baru (P1)

1. Buat `src/main/agents/<nama>/<Nama>Adapter.ts` implement `AgentAdapter` (detect + run → `AgentEvent`).
2. Daftarkan di `AgentRegistry` constructor default.
3. Tulis unit test parser output + (opsional) integration test env-gated.
4. Selesai — orchestrator, UI, dan pipeline lain tidak perlu diubah sama sekali.

## 8. Rilis (Fase 5 — belum aktif)

electron-builder NSIS + electron-updater via GitHub Releases. Detail menyusul saat Fase 5.
