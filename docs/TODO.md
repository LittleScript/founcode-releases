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

## Fase 6 — Licensing, Packaging, Polish (F6)

- [ ] Keputusan final: Lemon Squeezy vs Paddle (bandingkan fee + dukungan merchant Indonesia) → buat produk & tier
- [ ] `LicenseService`: activate, re-validasi 24 jam, offline grace 7 hari, simpan via safeStorage
- [ ] Enforcement Free tier di Orchestrator: 1 task aktif, 1 project, auto-advance = Pro (+ unit test)
- [ ] UI: Settings page (license, pilihan agen default, tema) + upgrade prompt yang sopan
- [ ] electron-builder: NSIS installer + portable zip, icon & branding Founcode
- [ ] electron-updater + repo GitHub Releases publik
- [ ] E2E Playwright: alur penuh dengan MockAgentAdapter
- [ ] QA manual di Windows 11 VM bersih (checklist §QA di bawah)
- [ ] README.md publik + docs singkat cara pakai

**Exit criteria:** installer terpasang di VM bersih; free tier enforced; license activation bekerja; auto-update dari release draft bekerja.

## Fase 7 — Launch (v1.0)

- [ ] Landing page founcode (nama domain: riset & beli) — bisa pakai skill build-premium-website
- [ ] Harga final Pro tier (PRD §7: target $8–12/bln, harus < $20)
- [ ] Rilis v1.0.0 di GitHub Releases + Lemon Squeezy/Paddle live
- [ ] Post launch: Product Hunt, X/Twitter, r/ClaudeAI, komunitas dev Indonesia
- [ ] Setup kanal feedback (GitHub Issues publik / Discord)

## P1 — Fast Follow (setelah v1.0, JANGAN dikerjakan lebih awal)

- [ ] Adapter OpenAI Codex CLI
- [ ] Adapter Gemini CLI
- [ ] Adapter OpenCode
- [ ] Parallel tasks (multi-task EXECUTING bersamaan) untuk Pro
- [ ] Template plan per jenis task (bugfix/feature/refactor)
- [ ] Riwayat & pencarian task

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
