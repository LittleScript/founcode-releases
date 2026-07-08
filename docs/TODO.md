# TODO — Founcode

Checklist implementasi, urut per fase. Satu fase harus **selesai + lolos exit criteria** sebelum lanjut.
Konvensi: `[ ]` belum, `[x]` selesai, `[~]` sedang dikerjakan, `[-]` dibatalkan/ditunda.

Basis: PRD v1.0 + TDD v1.0. Terakhir diperbarui: 3 Juli 2026.

---

## Fase 0 — Scaffold & Fondasi

- [x] Init repo git + `.gitignore` (node, electron, `.founcode/`)
- [x] Scaffold electron-vite (React + TS template) — *manual scaffold (create CLI interaktif); electron-vite 5 + vite 7 + electron 43 + react 19 + ts 6*
- [x] Setup Tailwind CSS (v4, @theme tokens), Biome, Vitest
- [x] Struktur folder sesuai TDD §3 (main/preload/renderer/shared; prompts/ menyusul di Fase 2)
- [x] Electron hardening: contextIsolation, sandbox, CSP, windowOpenHandler deny (TDD §7.1)
- [x] IPC contract skeleton (`shared/ipc-contract.ts`) + contextBridge preload dengan channel allowlist
- [x] SQLite init + sistem migrasi + migration 001 (skema TDD §5.1) — *pakai `node:sqlite`, bukan better-sqlite3 (lihat TDD §2)*
- [x] Window shell: layout dasar app (sidebar + board 7 kolom), dark theme default
- [x] GitHub repo private `LittleScript/founcode` + push pertama

**Exit criteria:** `npm run dev` membuka window; `npm test` hijau; DB terbuat di userData dengan skema v1.
**Status 3 Jul 2026: TERPENUHI** — window tampil (IPC connected, schema v1 di footer), 5 unit test pass, typecheck & lint bersih, `%APPDATA%\founcode\founcode.db` terverifikasi berisi semua tabel. Repo: github.com/LittleScript/founcode (private).

## Fase 1 — Project & Task Management (F1)

- [x] ProjectRepo + TaskRepo + ArtifactRepo (CRUD, unit test)
- [x] IPC: `project:add` (folder picker + validasi folder adalah repo git), `project:list`
- [x] IPC: `task:create`, `task:list` (+ `task:get`, `dialog:selectFolder`)
- [x] UI: Onboarding page (welcome → add project pertama)
- [x] UI: Task Board (kolom per state, card task, create task dialog)
- [x] UI: Task Detail page (skeleton — tab Plan / Log / Diff / Verify)
- [x] TaskStateMachine: definisi state + transisi legal + tabel `task_events` (unit test SEMUA transisi ilegal ditolak — exhaustive 135 pasangan state×aksi)

**Exit criteria:** bisa add project nyata, buat task, task muncul di board; state machine 100% tercakup unit test.
**Status 4 Jul 2026: TERPENUHI** — diverifikasi manual oleh Koko (add project → create task → muncul di Backlog → detail page). 21 unit test pass.

## Fase 2 — Agent Layer + Fase PLAN (F2, F5)

- [x] Interface `AgentAdapter` + tipe `AgentEvent` (TDD §4.1)
- [x] `MockAgentAdapter` (untuk dev & test tanpa CLI asli; marker `[mock:invalid]`/`[mock:fail]`)
- [x] `AgentRegistry`: deteksi agen terinstal (`claude --version`)
- [x] `ClaudeCodeAdapter.detect()` + `run()` — spawn headless, parse stream-json → AgentEvent, abort/kill process tree (Windows `taskkill /T`). *Catatan: prompt via stdin; resolve .exe > .cmd (where mengembalikan sh shim duluan); read-only via `--allowedTools Read Glob Grep` BUKAN plan mode (bajak format output)*
- [x] Integration test adapter vs Claude Code CLI asli (env-gated `FOUNCODE_IT=1`; 2/2 pass)
- [x] Template `prompts/plan.md` (format Founcode Plan, larangan menulis file)
- [x] Orchestrator: aksi `startPlanning` → jalankan agen read-only → simpan artefak plan
- [x] Plan parser: validasi struktur format Founcode Plan (unit test: plan valid, cacat, kosong)
- [x] Auto re-prompt 1x jika plan tidak sesuai format (TDD §8)
- [x] UI: Plan Reviewer — render markdown, edit inline, tombol Approve / Request Re-plan (dengan feedback) + Retry untuk FAILED
- [x] IPC streaming `task:event` → Log Viewer real-time (log store global, tahan pindah tab; progress elapsed+activity saat PLANNING)

**Exit criteria:** intent nyata pada repo nyata menghasilkan plan terstruktur yang bisa diedit & di-approve di UI; cancel di tengah planning membunuh proses agen bersih.
**Status 4 Jul 2026: TERPENUHI** — diverifikasi manual Koko dengan Claude Code asli setelah fix render-loop (blank window) & fix plan mode.

## Fase 3 — Fase EXECUTE (F3)

- [x] `WorktreeManager`: create/commitAll/getDiff/remove (integration test dengan repo git temporer; auto-commit hasil agen supaya branch lengkap)
- [x] Guard: worktree di userData, branch `founcode/task-<id>`, repo user tidak tersentuh (teruji: HEAD & status repo user tak berubah)
- [x] Template `prompts/execute.md` (implementasi persis sesuai plan; `FOUNCODE_BLOCKED:` jika plan tak bisa diikuti)
- [x] Orchestrator: `approvePlan` → create worktree → jalankan agen (write mode: acceptEdits + Bash) di worktree; timeout 30 menit
- [x] Streaming log eksekusi ke UI + tombol Stop di header Task Detail (semua state aktif)
- [x] Simpan diff sebagai artefak setelah agen selesai (+ event `empty_diff` bila kosong)
- [x] UI: Diff Viewer per file (collapsible, warna +/-) di Task Detail
- [x] Crash recovery: `recoverOrphans()` saat startup — task PLANNING/EXECUTING/VERIFYING yatim → FAILED + Retry; worktree stale dibersihkan saat create ulang

**Exit criteria:** plan approved dieksekusi di worktree terisolasi; diff akurat tampil di UI; folder project user tetap bersih; stop membunuh proses dengan bersih.
**Status kode 4 Jul 2026: selesai, 49 unit/integration test pass. Menunggu verifikasi manual E2E dengan Claude Code asli.**

## Fase 4 — Fase VERIFY + Finalisasi (F4)

- [x] Template `prompts/verify.md` (kriteria dari plan + diff + deteksi test runner; output format Founcode Verdict)
- [x] Verdict parser (JSON dalam fence terakhir; unit test + auto-retry 1x jika unparseable; fallback raw → REVIEW, user memutuskan)
- [x] Orchestrator: eksekusi selesai → spawn sesi agen BARU untuk verify (mode `verify`: Read/Glob/Grep/Bash — bisa run test, tak bisa edit)
- [x] Loop perbaikan: verdict fail → `fix_instructions` balik ke Execute (worktree DIPAKAI ULANG, bukan dari nol), max 2 iterasi (`retry_count` + migration 002 `base_ref`), lalu FAILED
- [x] UI: Verify Report (badge verdict, kriteria pass/fail/warning + note, hasil test, full report collapsible)
- [x] `WorktreeManager.merge()`: merge `--no-ff` ke branch user; repo kotor ditolak; konflik → abort total + pesan jelas (tidak pernah auto-resolve/partial)
- [x] UI: aksi finalisasi Merge / Send back (dengan feedback) / Discard + cleanup worktree & branch setelah DONE/DISCARDED
- [x] Tulis salinan plan approved ke `<project>/.founcode/plans/` + ignore via `.git/info/exclude` (tidak menyentuh .gitignore user)

**Exit criteria:** siklus penuh Plan → Execute → Verify → Merge berhasil pada task nyata di repo nyata dengan Claude Code asli, di Windows 11.
**Status 4 Jul 2026: TERPENUHI (M4 tercapai)** — E2E otomatis dengan Claude Code ASLI lolos (`tests/full-cycle.integration.test.ts`, 86 detik: plan 23s → execute 27s → verify ~35s → merge bersih; verdict pass; repo user bersih; worktree+branch ter-cleanup). 64 unit/integration test + 1 full-cycle E2E. Dogfooding via UI = langkah berikutnya.

## Fase 5 — Blueprint / Spec Studio (Idea → PRD → Task Graph)

Corong greenfield yang menyuapi pipeline P-E-V. Desain lengkap: `docs/BLUEPRINT-DESIGN.md`.
Keputusan (5 Jul): nama **Blueprint**; sequential feeding **manual + auto (toggle user pilih)**.

**B1 — Data & state machine**
- [ ] Migration 003: tabel `blueprints` + kolom `blueprint_id`/`order_index` di `tasks`
- [ ] BlueprintRepo (CRUD, JSON blobs untuk answers/structure/prd)
- [ ] BlueprintStateMachine: IDEA→QUESTIONS→STRUCTURING→STRUCTURE_REVIEW→GENERATING_PRD→PRD_REVIEW→DECOMPOSING→TASK_REVIEW→IMPLEMENTING→DONE (unit test exhaustive transisi)

**B2 — Generative runner & parser**
- [ ] `Orchestrator.runGeneration()` — jalur agen menghasilkan DATA (bukan kode), tanpa worktree
- [ ] Parser: questions/structure/tasks (JSON dalam fence, pola verdict parser, 1x auto re-prompt, fallback raw)
- [ ] Prompt `prompts/blueprint/{questions,structure,prd,tasks,revise}.md`
- [ ] MockAgent mode blueprint (deterministik untuk dev/test) + unit test alur generatif

**B3 — UI Idea → Questions → Structure → PRD** ✅ (5 Jul)
- [x] Entry "✦ New from Idea" di board; Blueprint Studio full-screen + StepRail 6 langkah (stepper animasi)
- [x] Idea input + tech preference (auto / manual stack picker) + contoh + agent picker
- [x] Questions (chip pilihan ganda + Other + skip) → jawab
- [x] Structure map (kolom fitur→sub-fitur, prioritas) → review/terima
- [x] PRD viewer (markdown split-pane) + revisi via chat → tulis `PRD.md` ke project
- [x] GeneratingView dengan peek streaming log; IPC + blueprintStore + wiring main (recoverOrphans)

**Status B3: kode selesai, verify/build hijau. Menunggu tes manual Koko (Mock lalu Claude asli).**

**B4 — Tasks → Implement (sequential feeding)** ✅ (5 Jul)
- [x] Dekomposisi PRD → task Founcode dengan `blueprint_id` + `order_index` (Backlog) — dari B2
- [x] PRD disuntik sebagai konteks ke prompt Plan tiap task (+ daftar task selesai) via `getPlanContext`
- [x] Sequential feeding: `startImplementation`→task[0]; manual/auto advance (auto = task berikutnya mulai sendiri setelah merge; review gate manusia TETAP ada)
- [x] UI: TasksStep start beneran; BlueprintBanner di board (progress bar + "Start next task" manual / indikator working / Complete); badge `#N` urutan di kartu task
- [x] Wiring callback dua arah Orchestrator↔BlueprintOrchestrator (onTaskSettled / startTaskPlanning)

**Status B4: kode selesai, 96 test pass (7 baru: feeding manual/auto, PRD context). Menunggu tes manual Koko.**

**B5 — Greenfield & polish** ✅ (5 Jul)
- [x] Greenfield: `createGreenfieldRepo` (folder + git init + identity lokal + README/.gitignore + commit awal) + IPC `project:createGreenfield` + entry di NewBlueprintDialog & Onboarding
- [x] Task blueprint auto-approve plan (gerbang manusia = review PRD + merge; via `shouldAutoApprovePlan`)
- [x] Crash recovery blueprint (recoverOrphans di startup — dari B2/B3)
- [x] E2E: idea → PRD → task graph → build & merge task pertama, greenfield, Claude Code asli (gated FOUNCODE_IT)

**Exit criteria:** dari ide bahasa awam → PRD tervalidasi → task graph → minimal 1 task terbangun & ter-merge lewat P-E-V, pada project greenfield, dengan Claude Code asli di Windows 11.
**Status 5 Jul 2026: TERPENUHI (M5 tercapai)** — E2E "Quote API" greenfield lolos (214 detik): questions 17s → structure 12s → PRD 8601 char/36s → 10 task terdekomposisi rapi → task#1 auto-plan→execute→verify→merge; repo greenfield berisi server.js+package.json+README+.gitignore, bersih. 99 unit/integration test + 2 full E2E (task tunggal + blueprint greenfield).

**B6 — Brownfield (project existing)** ✅ (5 Jul)
- [x] 3 mode blueprint (migration 004 `mode`): `greenfield` (baru), `extend` (repo existing + tujuan → analisis kode → PRD current+target → task = sisa kerja), `document` (repo existing → retro-PRD, skip questions/structure)
- [x] State machine: aksi `generate_prd_direct` (IDEA→GENERATING_PRD untuk document) + `finish` (PRD_REVIEW→DONE) — exhaustive test
- [x] Prompt: `{{existing_section}}` di questions/structure/prd/tasks (extend = suruh agen eksplor repo dulu, scope ke sisa kerja) + `document-prd.md` (reverse-engineer PRD dari kode)
- [x] BlueprintOrchestrator: `start()` routing per mode, `generateDocumentPrd`, `finish()`, existingSection helper
- [x] UI: NewBlueprintDialog pilih Extend/Document untuk current project (idea optional di document); StepRail mode-aware (document = Analyze→PRD→Build); PrdStep tombol "Save PRD & finish" + "Continue → build"; label document-aware
- [x] 3 test baru (document skip, finish→DONE tanpa task, extend full flow); 102 test pass

**Status B6: kode selesai. Menunggu tes manual Koko (Mock + Claude asli pada repo existing).**

**B7 — Enhancement Blueprint** ✅ (5 Jul, permintaan Koko)
- [x] B7.1: pertanyaan **multi-select** (chip checkbox + all/clear + other) + agen **usulkan 2–4 ide segar** (opt-in chip, ide diterima masuk sebagai jawaban tambahan); `blueprint:getSuggestions`
- [x] B7.2: **structure jadi node-graph** (React Flow / @xyflow/react) ala n8n/gambar 1 — Product→Feature→Sub-feature, pan/zoom/fit-view, node Mission-Control
- [x] B7.3: **panel chat diskusi** di Structure & PRD (migration 005 `blueprint_messages`) — user tanya/minta ubah real-time; agen balas & **regenerate artefak in-place** (delimiter ===STRUCTURE===/===PRD===) tanpa ubah state; prompt `chat.md`, `blueprint:chat`/`messages`
- [x] Setting AI (model dropdown, dsb.) DITUNDA ke Fase 6 (Settings page) — keputusan Koko
- [x] 109 test pass (4 baru: suggestions parse, chat Q&A, chat change)

## Fase 6 — Licensing, Packaging, Polish (F6)

- [x] **F6.1 Settings page + model AI** (5 Jul): SettingsRepo (key/value di tabel settings), IPC `settings:get/set`; **Settings page** (agen default + model default + placeholder license/tema); **pilihan model per-task/blueprint** (migration 006 `model` di tasks+blueprints; dropdown di New Task & New Blueprint, default dari settings); plumbing `--model` ke ClaudeCodeAdapter (`AgentRunOptions.model`); task blueprint inherit model; 4 test baru (113 total). MODEL_OPTIONS: Default/Opus/Sonnet/Haiku (alias, future-proof)
- [x] **F6.2 Multi-agent adapters** (6 Jul): OpenCode + Codex + Gemini (keputusan Koko — sebelum launch, perkuat free tier). `cliResolver` bersama (exe > real-binary npm > cmd shim; prompt TIDAK PERNAH lewat argv cmd.exe), `TextCliAdapter` base (stdout teks → events + resultText). **OpenCode TERUJI vs CLI asli** (pong 11s) = gateway GLM/DeepSeek/Qwen/Kimi/lokal via `provider/model`. Codex (`exec` + sandbox) & Gemini (`--approval-mode`) sesuai kontrak dokumentasi, unit-tested, validasi nyata menunggu CLI terinstal. `ModelField` per-agen (dropdown Claude, free-text lainnya). 116 test
- [x] **F6.4 Licensing** (6 Jul): keputusan **Lemon Squeezy** (license API native; `LemonSqueezyVendor` siap — tinggal isi STORE_ID/PRODUCT_ID saat Koko buat akun & produk). `LicenseService`: activate, re-validasi 24 jam (interval 6 jam), **offline grace 7 hari**, revoked→downgrade langsung, simpan via safeStorage (DPAPI), file korup→free tanpa crash, dev override `FOUNCODE_TIER=pro`. **Enforcement**: 1 task aktif (`ensureCapacity` di startPlanning+sendBack), 1 project (project:add/createGreenfield), auto-advance=Pro (startImplementation + defensive di handleTaskSettled). UI license di Settings (badge tier, activate/deactivate, indikator grace). 7 test baru (123 total). Sisa: isi STORE_ID/PRODUCT_ID + tes activate nyata setelah akun LS dibuat
- [x] Logo resmi dari Koko dipasang sebagai app icon (`build/logo-source.png` → icon.png; gen-icon.mjs pakai logo resmi bila ada)
- [x] **F6.3 electron-builder: NSIS installer + portable zip** (6 Jul): `npm run dist` → `Founcode-Setup-0.5.0.exe` (100MB, < target 120MB) + zip + latest.yml. Icon generated (`scripts/gen-icon.mjs`, motif F/ + pipeline rail). Deps dirapikan (renderer→devDeps, main externalized via externalizeDepsPlugin). **Smoke test paketan LOLOS** (jalan + DB migrasi di `%APPDATA%\Founcode`). Auto-updater wired (packaged-only, non-fatal)
- [x] **F6.5** (6 Jul): repo publik `founcode-releases` DIBUAT; installer di-rebuild dengan .ico dari logo resmi; **Playwright E2E** (`npm run test:e2e`, `_electron` + `FOUNCODE_USER_DATA` throwaway) — onboarding, dialog blueprint 5 agen, DB fresh; 3/3 pass ~3s; fix versi app (build-time `__APP_VERSION__`)
- [x] **Updater E2E penuh TERBUKTI DI PRODUKSI** (6 Jul): app 1.0.2 → cek GitHub → download v1.1.0 (100MB, sha512 verified) → install → registry 1.1.0. Catatan sejarah: updater ≤1.0.1 mati total (bug interop CJS `{autoUpdater}` destructure); 1.1.0+ pakai dialog eksplisit "Restart now" → `quitAndInstall(true,true)`. Gotcha test: `.VersionInfo` PowerShell DI-CACHE per sesi — verifikasi versi pakai registry uninstall key
- [ ] E2E Playwright: alur penuh dengan MockAgentAdapter
- [ ] QA manual di Windows 11 VM bersih (checklist §QA di bawah)
- [ ] README.md publik + docs singkat cara pakai

**Exit criteria:** installer terpasang di VM bersih; free tier enforced; license activation bekerja; auto-update dari release draft bekerja.

## Fase 7 — Launch (v1.0)

- [x] **Rilis v1.0.0 PUBLIK** (6 Jul): https://github.com/LittleScript/founcode-releases/releases/tag/v1.0.0 — installer + zip + `latest.yml` (auto-update feed aktif untuk versi berikutnya) + release notes + README publik repo releases (logo, pitch, free-vs-pro, install, FAQ SmartScreen)
- [x] Landing page DIBANGUN (`website/` — static HTML+CSS, Mission Control, hero + rail animasi + pipeline + blueprint + agents + pricing + CTA; zero build step, siap deploy Vercel/Netlify/Pages). SISA: domain (riset & beli — founcode.com/founcode.dev/founcode.app?) + deploy
- [ ] Harga Pro: **$10/bln diusulkan & tercantum di landing** ("Coming soon") — final saat Lemon Squeezy live
- [ ] Lemon Squeezy live: Koko buat akun + store + produk → isi STORE_ID/PRODUCT_ID di `LemonSqueezyVendor.ts` → tes activate nyata
- [x] Kanal feedback: GitHub Issues di founcode-releases (tercantum di README + release notes)
- [ ] Post launch: Product Hunt, X/Twitter, r/ClaudeAI, komunitas dev Indonesia

## v1.1 — CHAT-FIRST + BUILT-IN SKILLS (permintaan Koko 6 Jul, headline berikutnya)

Visi: frontend Founcode = **chat dengan AI** (seperti ChatGPT) sebagai pintu masuk. User diskusi dulu (tanya-tanya project, ide, pengembangan); ketika siap, chat MENGHUBUNGKAN langsung ke pipeline P-E-V (buat blueprint dari diskusi / buat task / buka project). Chat sadar-konteks: melihat daftar project, PRD, status task. Satu app terhubung ke semua fitur.

- [x] **C1–C5 SELESAI — dirilis sebagai v1.1.0 (6 Jul)**: Chat home persisten (migration 007) + action chips (protokol `===ACTIONS===`: blueprint_from_idea/create_task/add_task_to_blueprint/pause_auto/resume_auto/start_next/open_project — bisa STEER blueprint yang sedang jalan) + 6 built-in skills (migration 008 `tasks.skill`, injeksi Plan+Execute, `/slash` di chat, picker di New Task, daftar di Settings) + WorkspaceStrip live (pipeline→chat) + hapus sesi + Agent Setup guide di Settings. Chat E2E Claude asli lolos 6.5s (assistant melihat workspace). 139 test. Release: github .../releases/tag/v1.1.0

## v1.3 — DUAL EXECUTION: Pipeline + Agent Terminal (keputusan Koko 8 Jul)

Founcode menawarkan DUA mode agen: pipeline P-E-V berpagar (build terverifikasi) + **Agent Terminal** interaktif ala PowerShell (agen kerja live, nanya, user setir, permission modes). Desain lengkap: `docs/AGENT-TERMINAL-DESIGN.md`. **4 keputusan SELESAI (Koko approve 8 Jul): node-pty, default Auto-edit, worktree+merge-gate, Terminal Free/parallel Pro.**
- [x] **T0 spike SELESAI (8 Jul)**: `node-pty` MUAT & jalan di Electron 43 (ABI 148) via prebuild N-API — tanpa electron-rebuild/VS Build Tools (properti zero-native seperti node:sqlite). Packaging: asarUnpack `**/node-pty/**/*.node`, real dep externalized, validasi di build paketan (T2)
- [x] **T1 SELESAI (8 Jul)**: node-pty jadi dep resmi + asarUnpack di electron-builder; `PermissionLevel` (safe/auto/full) di shared/settings-types + `PERMISSION_LABELS`; kontrak `InteractiveAgent`/`InteractiveLaunch` + `isInteractive()` di AgentAdapter; **ClaudeCodeAdapter.launchInteractive** (claude tanpa `-p` = REPL live; permission→flag: plan/acceptEdits/dangerously-skip); **PtyManager** (lazy-import node-pty, start/write/resize/kill/killAll, callback onData/onExit). 4 test baru (launch args + PTY integration nyata lolos). 144 test
- [x] **T2 SELESAI (8 Jul)**: TerminalService (resolve adapter→launchInteractive→PtyManager, broadcast data/exit) + IPC `terminal:start/input/resize/kill/list` + event `terminal:data/exit`; **TerminalView xterm.js** (@xterm/xterm+addon-fit, tema phosphor, FitAddon+ResizeObserver, onData→input, terminal:data→write); NewTerminalDialog (agen+model+permission Safe/Auto/Full) dari tombol ▟ Terminal di Board; kill saat quit. **VALIDASI PAKETAN LOLOS**: electron-builder unpack `node-pty` (`win32-x64/pty.node`+`conpty.node` di app.asar.unpacked, OpenConsole.exe ditandatangani); app paketan boot mulus. 144 test. Sesi jalan di project cwd (isolasi worktree = T4)
- [x] **T3 SELESAI (8 Jul)**: `launchInteractive` untuk **keempat agen** (helper `buildInteractiveLaunch` di TextCliAdapter reuse cliResolver) — Terminal tak lagi Claude-only. Codex `--sandbox read-only/workspace-write/danger-full-access`; OpenCode `--agent plan/build`; Antigravity `--approval-mode default/auto/yolo`. 3 test baru (147 total). Fix bonus: ModelPicker popup **anchored absolute** (dulu fixed+math manual → terbang ke pojok); bug `Unknown IPC channel: terminal:start` = preload stale → clean restart. SISA T3: permission enum ke Execute pipeline (per-task) — digabung ke win kecil
- [x] **T4 SELESAI (8 Jul)**: sesi Terminal default jalan di **worktree terisolasi** (WorktreeManager, id `term-*`); toggle "Isolated worktree" di dialog (opsi kerja-langsung-di-repo). Tombol **Finish & review** → commit worktree + diff → layar review (DiffViewer) dengan **Merge into my branch** / **Discard** (guard dirty-tree/konflik dari WorktreeManager). IPC `terminal:finish/merge/discard` + `TerminalReview`. Verification-first terjaga: kebebasan interaktif, disiplin di gerbang merge. 147 test
- [ ] **T5**: transcript artifact + gating Free/Pro paralel
- [ ] **Win kecil (bisa kapan pun)**: permission modes di Execute pipeline + FAILED→send-back berkomentar

## v1.2.0 — SELESAI & DIRILIS (7 Jul)

Rangkuman rilis (di atas v1.1.0 chat-first):
- [x] **IA ala app Claude**: sidebar New chat / Chats / Projects / **Skills & Tools** / Artifacts + Recents + Settings, icon SVG konsisten (lucide-style, currentColor)
- [x] **Artifacts browser**: semua plan/diff/verdict/log lintas project, filter jenis + search, klik → task (`ArtifactRepo.listAll`)
- [x] **Skills & Tools tab** + **10 built-in skills** (+refactor/perf/docs/review), roadmap custom skills & MCP tools tercantum
- [x] **Light theme**: token remap via `[data-theme]` (Tailwind v4 CSS vars), toggle di Settings, instant apply, wordmark auto-darken
- [x] Composer chat ala Claude: container tunggal, [+] attach, agent+model inline (per-sesi), tombol kirim ↑; slash palette `/`; thinking indicator ✦ 5.2s (tempo Claude Code)
- [x] Fix: busy per-sesi (composer disable saat membalas), meta "session started" tak bocor ke bubble, error chat tampilkan penyebab asli, re-detect agen ada spinner
- [x] Drop file & attach ke chat (`@"path"` — agen baca sendiri, termasuk gambar)

## P1 — Fast Follow (setelah v1.0, JANGAN dikerjakan lebih awal)

- [x] ~~Adapter OpenAI Codex CLI / Gemini CLI / OpenCode~~ → DITARIK ke F6.2 atas keputusan Koko (selesai 6 Jul; Gemini CLI mati → diganti Antigravity)
- [ ] **v1.1 — Persistent Memory + Post-merge Extraction** (dari analisis Hermes, prioritas #1): `.founcode/memory.md` (pattern kode, keputusan arsitektur, gotcha) + `user.md` (preferensi) di repo user; setelah merge, agent kecil read-mode baca plan+diff+verdict (semua sudah ada di ArtifactRepo) → update memory async; inject ke plan prompt via `getPlanContext` bersama PRD. Fondasi untuk patterns & drift-check
- [ ] **v1.2 — Dependency graph + Parallel dispatch (Pro)** (Hermes #3): decompose prompt hasilkan `depends_on`; task independen jalan paralel (Pro), dependen auto-block; gagal → block children. Pairing natural dengan monetisasi parallel capacity
- [ ] **v1.3 — Task Patterns / self-evolving templates** (Hermes #2): `.founcode/patterns/*.md` dari N task sukses yang mirip → inject sebagai starting point plan (klaim hemat token 30-85%). Butuh data dari v1.1 dulu
- [ ] **"Deep Verify" toggle (Pro)** — MoA multi-agent verification (Hermes #4). DIPUTUSKAN Koko (6 Jul): opsional, Pro-only, BUKAN default (verify standar sudah build+test objektif; MoA = 3x biaya token)
- [ ] **Artifacts browser tab** (inspirasi HermesAgent): view global semua artefak (plan/diff/verdict/log per task, sudah ada di ArtifactRepo) — searchable, filter per jenis & project, klik → task
- [ ] **Skills & Tools tab** (inspirasi HermesAgent): browser skill dengan kategori (saat ini: slash palette + daftar di Settings); nanti + custom skill user (buat/edit skill sendiri, disimpan lokal)
- [ ] Attachment picker "+" di composer chat (Files/Folder/Paste image/URL) melengkapi drag-drop yang sudah ada
- [ ] **Multi-language / i18n** (permintaan Koko 7 Jul): UI English dulu (sudah disapu konsisten); nanti string layer (en/id minimal)
- [ ] Preset env per-agen di Settings (integrasi 9Router tanpa env global)
- [ ] Validasi nyata adapter Codex & Antigravity saat CLI terinstal (integration test gated sudah siap polanya)
- [ ] Riwayat & pencarian task

## Gap vs Traycer (studi 7 Jul — "Nerve Center for Agentic Coding")

Sudah setara: BYO subscription multi-agen ✓, built-in skills ✓, shared context per task (PRD injection) ✓, switch model per chat ✓, local runtimes via OpenCode ✓. Yang BELUM ada di kita:
- [ ] **A2A (agent-to-agent) communication** — agen saling tanya/review/hand-off antar chat/task ("walkie-talkie"). Fondasi kita cocok (chat sessions + action protocol); desain: agen bisa post pesan ke sesi lain / spawn sub-task. Kandidat v1.4
- [ ] **Multiplayer workspaces / cloud sync** — kolaborasi tim + lanjut kerja lintas device. BUTUH backend + akun = bertentangan dengan local-first; posisikan sebagai **cloud opsional** (v2) & justifikasi tier Team
- [ ] **Direct API connector (tanpa CLI)** — user punya API key DeepSeek/OpenAI tapi ogah pasang OpenCode: chat-mode bisa dilayani HTTP langsung (runner sendiri); P-E-V tetap butuh CLI agentic. Kandidat v1.3 (chat-only)
- [ ] Adapter **Cursor** (Traycer punya; cek dulu apakah cursor CLI headless tersedia)
- [ ] **Pricing**: Traycer 5 tier (kami 2). Mereka jual cloud+credits — kami local (2 tier = fitur, bukan kekurangan). Rencana bertahap: Free / **Pro $10** (launch) → + **Pro Annual $96** (2 bln gratis, murni konfigurasi Lemon Squeezy) → + **Team $25/user** saat multiplayer ada → Enterprise nanti. TIDAK meniru credits — kita tak menanggung biaya inference

---

## QA Checklist Manual (sebelum setiap rilis)

- [ ] Install dari NSIS installer di Windows 11 bersih (tanpa dev tools)
- [ ] Onboarding mendeteksi Claude Code; pesan jelas jika tidak terinstal
- [ ] Siklus penuh P-E-V pada repo nyata → merge sukses
- [ ] Cancel di setiap fase → tidak ada proses zombie (cek Task Manager)
- [ ] Tutup paksa app saat EXECUTING → restart → recovery benar
- [ ] Free tier: task kedua ditolak dengan pesan upgrade yang jelas
- [ ] Offline penuh: app tetap jalan, grace period license benar
- [ ] Repo user: tidak ada file sampah, branch sampah, atau perubahan tak diminta
