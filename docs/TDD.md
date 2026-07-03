# TDD — Founcode

**Technical Design Document**

| | |
|---|---|
| **Versi** | 1.0 |
| **Tanggal** | 3 Juli 2026 |
| **Basis** | PRD v1.0 (docs/PRD.md) |
| **Status** | Approved — basis implementasi |

---

## 1. Arsitektur Tingkat Tinggi

```
┌─────────────────────────────────────────────────────────────┐
│                     ELECTRON APP (Founcode)                  │
│                                                              │
│  ┌───────────────────┐   IPC (typed)   ┌──────────────────┐ │
│  │  RENDERER (React) │◄───────────────►│  MAIN (Node.js)  │ │
│  │                   │                 │                  │ │
│  │  - Task Board     │                 │  - Orchestrator  │ │
│  │  - Plan Reviewer  │                 │  - AgentAdapters │ │
│  │  - Log Viewer     │                 │  - WorktreeMgr   │ │
│  │  - Diff Viewer    │                 │  - Store (SQLite)│ │
│  │  - Verify Report  │                 │  - LicenseService│ │
│  └───────────────────┘                 └────────┬─────────┘ │
│                                                 │            │
└─────────────────────────────────────────────────┼────────────┘
                                                  │ child_process.spawn
                                    ┌─────────────┼─────────────┐
                                    ▼             ▼             ▼
                              claude -p      codex exec     gemini -p
                              (headless)     (P1)           (P1)
                                    │
                                    ▼
                          Git worktree per task
                          (branch founcode/task-<id>)
```

**Prinsip arsitektur:**
1. **Semua proses agen & git di Main process** — Renderer murni UI, tidak pernah menyentuh filesystem/proses.
2. **Adapter pattern untuk agen** — satu interface, banyak implementasi; menambah agen baru = menulis satu adapter, nol perubahan di orchestrator/UI.
3. **Event-driven** — adapter menghasilkan event ternormalisasi; UI subscribe via IPC stream. Format output CLI apa pun diterjemahkan ke event internal yang stabil.
4. **Local-first** — semua data di SQLite + file lokal. Satu-satunya network call: validasi license.

---

## 2. Tech Stack

| Layer | Pilihan | Alasan |
|---|---|---|
| Shell | **Electron 33+** | Node.js penuh di main process untuk process management; ekosistem matang di Windows |
| Build | **electron-vite** + **electron-builder** | HMR saat dev; NSIS installer untuk Windows |
| UI | **React 18 + TypeScript** | Keahlian existing Koko |
| Styling | **Tailwind CSS** | Kecepatan; konsisten dengan project 21Kent lain |
| State (renderer) | **Zustand** | Ringan, tanpa boilerplate |
| DB | **better-sqlite3** (main process) | Sinkron, cepat, zero-config, tanpa server |
| IPC | **contextBridge + typed channels** (`electron-toolkit` pattern) | Keamanan (contextIsolation on) + type safety |
| Git ops | **simple-git** + CLI git langsung untuk worktree | Worktree butuh git CLI; simple-git untuk query |
| Markdown render | **react-markdown + remark-gfm** | Render plan & laporan verifikasi |
| Diff viewer | **react-diff-viewer-continued** (atau parse `git diff` sendiri) | Tampilan diff per file |
| Testing | **Vitest** (unit) + **Playwright** (E2E via `_electron`) | Standar modern |
| Lint/format | **Biome** | Satu tool, cepat |

**Prasyarat mesin user:** Windows 10/11, `git` di PATH, minimal satu agen CLI terinstal (Claude Code untuk v1.0).

---

## 3. Struktur Project

```
Founcode/
├── docs/                      # PRD, TDD, TODO, PLANNING
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # Entry, window management
│   │   ├── orchestrator/      # State machine task (jantung app)
│   │   │   ├── Orchestrator.ts
│   │   │   └── TaskStateMachine.ts
│   │   ├── agents/            # Adapter layer
│   │   │   ├── AgentAdapter.ts        # Interface + tipe event
│   │   │   ├── AgentRegistry.ts       # Deteksi & registrasi agen terinstal
│   │   │   ├── claude/ClaudeCodeAdapter.ts
│   │   │   └── (codex/, gemini/, opencode/ — P1)
│   │   ├── git/
│   │   │   └── WorktreeManager.ts
│   │   ├── store/
│   │   │   ├── db.ts          # Init better-sqlite3 + migrations
│   │   │   └── repositories/  # ProjectRepo, TaskRepo, ArtifactRepo
│   │   ├── license/
│   │   │   └── LicenseService.ts
│   │   └── ipc/
│   │       └── handlers.ts    # Semua ipcMain handler (typed)
│   ├── preload/
│   │   └── index.ts           # contextBridge — API permukaan renderer
│   ├── renderer/              # React app
│   │   ├── App.tsx
│   │   ├── stores/            # Zustand
│   │   ├── pages/             # Board, TaskDetail, Settings, Onboarding
│   │   └── components/        # PlanReviewer, LogViewer, DiffViewer, VerifyReport
│   └── shared/
│       ├── types.ts           # Tipe yang dipakai main + renderer
│       └── ipc-contract.ts    # Definisi channel IPC (single source of truth)
├── prompts/                   # Template prompt untuk fase Plan/Execute/Verify
│   ├── plan.md
│   ├── execute.md
│   └── verify.md
├── tests/
├── electron-builder.yml
└── package.json
```

---

## 4. Komponen Inti

### 4.1 AgentAdapter (interface)

Kontrak yang harus dipenuhi setiap adapter. Semua output CLI dinormalisasi ke `AgentEvent`.

```typescript
// src/main/agents/AgentAdapter.ts

export type AgentEvent =
  | { type: 'text';       content: string }                    // output tekstual
  | { type: 'tool_use';   name: string; detail: string }       // agen memakai tool (edit file, run cmd)
  | { type: 'file_change';path: string; kind: 'create'|'edit'|'delete' }
  | { type: 'error';      message: string }
  | { type: 'done';       exitCode: number; costUsd?: number };

export interface AgentRunOptions {
  cwd: string;              // worktree path (atau repo path untuk plan read-only)
  prompt: string;           // prompt lengkap (sudah dirakit orchestrator)
  readOnly: boolean;        // fase Plan = true (agen dilarang menulis)
  abortSignal: AbortSignal; // untuk cancel dari UI
}

export interface AgentAdapter {
  readonly id: string;                       // 'claude-code' | 'codex' | ...
  readonly displayName: string;
  detect(): Promise<{ installed: boolean; version?: string }>;
  run(opts: AgentRunOptions): AsyncIterable<AgentEvent>;
}
```

### 4.2 ClaudeCodeAdapter (v1.0)

- **Deteksi:** `claude --version` via spawn; parse versi.
- **Eksekusi:** `claude -p "<prompt>" --output-format stream-json --verbose` di `cwd` worktree.
  - `stream-json` memberi event JSON per baris → diparse jadi `AgentEvent`.
  - Fase Plan: tambah flag pembatas tool (mode read-only / permission mode plan) supaya agen tidak menulis file.
- **Lifecycle:** spawn dengan `windowsHide: true`; kill process tree saat abort (pakai `taskkill /pid /T /F` di Windows).
- **Catatan risiko:** flag CLI Claude Code bisa berubah antar versi → adapter menyimpan `supportedVersionRange`, dan CI menjalankan smoke test terhadap CLI asli.

### 4.3 Orchestrator & Task State Machine

Satu-satunya komponen yang tahu urutan fase. State disimpan di SQLite sehingga app crash/restart bisa resume.

```
                    ┌──────────┐
                    │ BACKLOG  │
                    └────┬─────┘
                  start planning
                         ▼
                    ┌──────────┐   plan gagal    ┌────────┐
                    │ PLANNING ├────────────────►│ FAILED │
                    └────┬─────┘                 └────────┘
                   plan selesai                       ▲
                         ▼                            │
                 ┌────────────────┐                   │
        re-plan  │ AWAITING_      │                   │
       ◄─────────┤ APPROVAL       │                   │
                 └────┬───────────┘                   │
                   approve                            │
                         ▼                            │
                    ┌──────────┐  eksekusi gagal      │
                    │EXECUTING ├──────────────────────┤
                    └────┬─────┘                      │
                  eksekusi selesai                    │
                         ▼                            │
                    ┌──────────┐  verdict: failed     │
                    │VERIFYING ├──────────────────────┘
                    └────┬─────┘         (opsi: kirim balik ke EXECUTING
                   verdict: pass          dengan catatan perbaikan, max 2x)
                         ▼
                    ┌──────────┐   user merge / discard
                    │  REVIEW  ├──────────────► DONE / DISCARDED
                    └──────────┘
```

**Aturan state machine:**
- Transisi hanya lewat `Orchestrator.transition(taskId, action)` — tidak ada jalur pintas.
- Setiap transisi dicatat di tabel `task_events` (audit trail).
- `EXECUTING → VERIFYING` loop perbaikan otomatis maksimal **2 iterasi**, setelah itu wajib intervensi user (mencegah infinite loop bakar kredit).

### 4.4 WorktreeManager

- `createForTask(projectPath, taskId)` → `git worktree add <dataDir>/worktrees/<taskId> -b founcode/task-<taskId>`.
- Worktree di **luar** repo user (di app data dir) supaya tidak mengotori folder project.
- `getDiff(taskId)` → `git diff <base>...HEAD` di worktree.
- `merge(taskId)` → merge branch ke branch asal user (fast-forward jika bisa; kalau konflik → surface ke UI, user menyelesaikan manual).
- `cleanup(taskId)` → `git worktree remove` + hapus branch (setelah DONE/DISCARDED).
- **Guard:** validasi repo bersih sebelum merge; tidak pernah `push` otomatis; tidak pernah menyentuh branch user tanpa aksi eksplisit.

### 4.5 Fase Plan/Execute/Verify — Prompt Assembly

Template prompt di `prompts/*.md`, dirakit orchestrator dengan variabel:

- **plan.md** — input: intent user + info project. Instruksi: analisis codebase, hasilkan plan dalam **format Founcode Plan** (lihat §5.3). Larangan keras: jangan menulis/mengubah file.
- **execute.md** — input: plan yang di-approve (verbatim). Instruksi: implementasikan persis sesuai plan; jika plan tidak bisa diikuti, berhenti dan laporkan alasannya (jangan improvisasi di luar plan).
- **verify.md** — input: plan + `git diff` hasil eksekusi + daftar kriteria verifikasi dari plan. Instruksi: periksa kesesuaian per kriteria, deteksi & jalankan test suite (`package.json` scripts / pytest / dll), keluarkan laporan dalam **format Founcode Verdict** (JSON di dalam fence — parseable).

### 4.6 LicenseService

- Aktivasi: user tempel license key → validasi ke API Lemon Squeezy/Paddle → simpan hasil + timestamp di file ter-enkripsi (electron `safeStorage`).
- Re-validasi background tiap 24 jam; **offline grace 7 hari** sebelum downgrade ke Free.
- Enforcement di Orchestrator (bukan UI): Free = tolak start task kedua saat ada task aktif, tolak project kedua.
- Prinsip: enforcement lunak & jujur — app tidak pernah menyandera data user.

---

## 5. Data Model

### 5.1 Skema SQLite

```sql
CREATE TABLE projects (
  id          TEXT PRIMARY KEY,        -- nanoid
  name        TEXT NOT NULL,
  path        TEXT NOT NULL UNIQUE,    -- absolute path folder git
  created_at  INTEGER NOT NULL
);

CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  title       TEXT NOT NULL,
  intent      TEXT NOT NULL,           -- deskripsi natural language dari user
  agent_id    TEXT NOT NULL,           -- 'claude-code' | ...
  state       TEXT NOT NULL,           -- enum state machine §4.3
  branch      TEXT,                    -- founcode/task-<id>
  worktree    TEXT,                    -- absolute path worktree
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE artifacts (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES tasks(id),
  kind        TEXT NOT NULL,           -- 'plan' | 'plan_revision' | 'diff' | 'verify_report' | 'log'
  content     TEXT NOT NULL,           -- markdown / JSON / raw log
  created_at  INTEGER NOT NULL
);

CREATE TABLE task_events (              -- audit trail transisi & aksi
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     TEXT NOT NULL REFERENCES tasks(id),
  event       TEXT NOT NULL,           -- 'state_change' | 'user_action' | 'agent_error' | ...
  detail      TEXT,                    -- JSON
  created_at  INTEGER NOT NULL
);

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL
);
```

Migrations: file SQL bernomor di `src/main/store/migrations/`, dijalankan saat app start, versi tercatat di `settings('schema_version')`.

### 5.2 Lokasi data

- DB & worktrees: `%APPDATA%/founcode/` (`app.getPath('userData')`).
- Salinan plan yang di-approve juga ditulis ke `<project>/.founcode/plans/<taskId>.md` — visible di repo user, bisa di-commit (opsional, default gitignored).

### 5.3 Format Founcode Plan (artefak inti)

Markdown dengan struktur wajib (divalidasi parser sebelum bisa di-approve):

```markdown
# Plan: <judul task>

## Ringkasan
<1-3 paragraf: apa & mengapa>

## File yang Disentuh
| File | Aksi | Alasan |
|------|------|--------|
| src/foo.ts | edit | ... |

## Langkah Implementasi
1. <langkah granular, per file, urut>

## Risiko & Catatan
- <risiko, asumsi, keputusan yang diambil>

## Kriteria Verifikasi
- [ ] <kriteria terukur yang akan dicek fase Verify>
- [ ] Semua test existing tetap pass
```

### 5.4 Format Founcode Verdict (output Verify)

Laporan markdown + blok JSON parseable:

```json
{
  "verdict": "pass" | "pass_with_warnings" | "fail",
  "criteria": [ { "criterion": "...", "status": "pass|fail|warning", "note": "..." } ],
  "tests": { "detected": true, "command": "npm test", "passed": 38, "failed": 0 },
  "fix_instructions": "..."   // hanya jika fail — jadi input loop perbaikan
}
```

---

## 6. Kontrak IPC

Semua channel didefinisikan di `src/shared/ipc-contract.ts` (single source of truth, typed dua arah).

**Invoke (request/response):**

| Channel | Payload → Response |
|---|---|
| `project:add` | `{path}` → `Project` |
| `project:list` | `{}` → `Project[]` |
| `task:create` | `{projectId, title, intent, agentId}` → `Task` |
| `task:startPlanning` | `{taskId}` → `void` |
| `task:approvePlan` | `{taskId, editedPlan?}` → `void` |
| `task:requestReplan` | `{taskId, feedback}` → `void` |
| `task:cancel` | `{taskId}` → `void` |
| `task:merge` / `task:discard` | `{taskId}` → `MergeResult` |
| `agent:listInstalled` | `{}` → `AgentInfo[]` |
| `license:activate` | `{key}` → `LicenseState` |

**Events (main → renderer, stream):**

| Channel | Payload |
|---|---|
| `task:event` | `{taskId, event: AgentEvent}` — log streaming |
| `task:stateChanged` | `{taskId, from, to}` |

Renderer TIDAK punya akses Node (contextIsolation on, nodeIntegration off, sandbox on).

---

## 7. Keamanan

1. **Electron hardening:** contextIsolation, sandbox, CSP ketat, tidak load remote content, `webSecurity` on.
2. **Proses agen:** spawn tanpa shell (`shell: false`) — prompt dikirim via stdin/argumen array, mencegah command injection dari intent user.
3. **Worktree isolation:** agen fase Execute hanya bekerja di worktree; fase Plan read-only.
4. **License key:** disimpan via `safeStorage` (DPAPI di Windows), tidak pernah di plaintext.
5. **Privacy:** kode user TIDAK pernah dikirim ke server Founcode (tidak ada server). Telemetri (jika ada) opt-in, anonim, tanpa isi kode.

---

## 8. Error Handling

| Skenario | Perilaku |
|---|---|
| Agen CLI tidak ditemukan | Onboarding menolak lanjut; instruksi install + link docs |
| Agen crash / exit non-zero | Task → FAILED, stderr tersimpan sebagai artefak log, UI tampilkan aksi retry |
| App crash saat task berjalan | Saat restart: state machine resume dari SQLite; task EXECUTING yang yatim ditandai FAILED dengan opsi retry (worktree masih utuh) |
| Plan tidak sesuai format | Parser tolak → auto re-prompt sekali dengan pesan koreksi → kalau masih gagal, tampilkan raw + user bisa edit manual |
| Verify verdict JSON tidak parseable | Sama: satu auto-retry, lalu fallback tampilkan raw report, user memutuskan manual |
| Merge konflik | Tidak pernah auto-resolve; UI kasih instruksi & tombol buka folder |
| License API down | Grace period berjalan; tidak pernah hard-lock |

---

## 9. Testing Strategy

| Level | Cakupan | Tool |
|---|---|---|
| Unit | State machine (semua transisi legal/ilegal), plan parser, verdict parser, repos | Vitest |
| Integration | ClaudeCodeAdapter vs CLI asli (smoke: detect + run prompt trivial), WorktreeManager vs repo git temporer | Vitest + fixture repo |
| E2E | Alur penuh: create task → plan (agen mock) → approve → execute (mock) → verify → merge | Playwright `_electron` |
| Manual sebelum rilis | Alur penuh dengan Claude Code asli di Windows 11 bersih (VM) | Checklist di TODO.md |

**Mock adapter** (`MockAgentAdapter`) tersedia sejak awal — pengembangan UI & orchestrator tidak tergantung CLI asli / kredit API.

---

## 10. Packaging & Distribusi

- **electron-builder** → NSIS installer (`Founcode-Setup-x.y.z.exe`) + portable zip.
- **Code signing:** MVP rilis tanpa EV cert (SmartScreen warning diterima dulu — didokumentasikan di landing page); EV/OV cert dibeli setelah ada revenue.
- **Auto-update:** electron-updater + GitHub Releases (repo publik khusus release, kode bisa tetap private).
- **Ukuran target:** < 120 MB installer.

---

## 11. Keputusan Teknis Terbuka (ditunda, bukan blocker)

| Topik | Ditunda sampai |
|---|---|
| Detail adapter Codex/Gemini/OpenCode (flag CLI masing-masing) | P1 — riset saat implementasi |
| Telemetri produk (opt-in) | Setelah v1.0 |
| Strategi macOS/Linux build | P2 |
| Pilihan final Lemon Squeezy vs Paddle | Sebelum fase licensing (Fase 5) — bandingkan fee & dukungan merchant Indonesia |
