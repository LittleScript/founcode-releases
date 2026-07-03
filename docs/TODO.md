# TODO â€” Founcode

Checklist implementasi, urut per fase. Satu fase harus **selesai + lolos exit criteria** sebelum lanjut.
Konvensi: `[ ]` belum, `[x]` selesai, `[~]` sedang dikerjakan, `[-]` dibatalkan/ditunda.

Basis: PRD v1.0 + TDD v1.0. Terakhir diperbarui: 3 Juli 2026.

---

## Fase 0 â€” Scaffold & Fondasi

- [x] Init repo git + `.gitignore` (node, electron, `.founcode/`)
- [x] Scaffold electron-vite (React + TS template) â€” *manual scaffold (create CLI interaktif); electron-vite 5 + vite 7 + electron 43 + react 19 + ts 6*
- [x] Setup Tailwind CSS (v4, @theme tokens), Biome, Vitest
- [x] Struktur folder sesuai TDD Â§3 (main/preload/renderer/shared; prompts/ menyusul di Fase 2)
- [x] Electron hardening: contextIsolation, sandbox, CSP, windowOpenHandler deny (TDD Â§7.1)
- [x] IPC contract skeleton (`shared/ipc-contract.ts`) + contextBridge preload dengan channel allowlist
- [x] SQLite init + sistem migrasi + migration 001 (skema TDD Â§5.1) â€” *pakai `node:sqlite`, bukan better-sqlite3 (lihat TDD Â§2)*
- [x] Window shell: layout dasar app (sidebar + board 7 kolom), dark theme default
- [x] GitHub repo private `LittleScript/founcode` + push pertama

**Exit criteria:** `npm run dev` membuka window; `npm test` hijau; DB terbuat di userData dengan skema v1.
**Status 3 Jul 2026: TERPENUHI** â€” window tampil (IPC connected, schema v1 di footer), 5 unit test pass, typecheck & lint bersih, `%APPDATA%\founcode\founcode.db` terverifikasi berisi semua tabel. Sisa: push GitHub.

## Fase 1 â€” Project & Task Management (F1)

- [ ] ProjectRepo + TaskRepo + ArtifactRepo (CRUD, unit test)
- [ ] IPC: `project:add` (folder picker + validasi folder adalah repo git), `project:list`
- [ ] IPC: `task:create`, `task:list`
- [ ] UI: Onboarding page (welcome â†’ add project pertama)
- [ ] UI: Task Board (kolom per state, card task, create task dialog)
- [ ] UI: Task Detail page (skeleton â€” tab Plan / Log / Diff / Verify)
- [ ] TaskStateMachine: definisi state + transisi legal + tabel `task_events` (unit test SEMUA transisi ilegal ditolak)

**Exit criteria:** bisa add project nyata, buat task, task muncul di board; state machine 100% tercakup unit test.

## Fase 2 â€” Agent Layer + Fase PLAN (F2, F5)

- [ ] Interface `AgentAdapter` + tipe `AgentEvent` (TDD Â§4.1)
- [ ] `MockAgentAdapter` (untuk dev & test tanpa CLI asli)
- [ ] `AgentRegistry`: deteksi agen terinstal (`claude --version`)
- [ ] `ClaudeCodeAdapter.detect()` + `run()` â€” spawn headless, parse stream-json â†’ AgentEvent, abort/kill process tree (Windows `taskkill /T`)
- [ ] Integration test adapter vs Claude Code CLI asli (prompt trivial)
- [ ] Template `prompts/plan.md` (format Founcode Plan, larangan menulis file)
- [ ] Orchestrator: aksi `startPlanning` â†’ jalankan agen read-only â†’ simpan artefak plan
- [ ] Plan parser: validasi struktur format Founcode Plan (unit test: plan valid, cacat, kosong)
- [ ] Auto re-prompt 1x jika plan tidak sesuai format (TDD Â§8)
- [ ] UI: Plan Reviewer â€” render markdown, edit inline, tombol Approve / Request Re-plan (dengan feedback)
- [ ] IPC streaming `task:event` â†’ Log Viewer real-time di Task Detail

**Exit criteria:** intent nyata pada repo nyata menghasilkan plan terstruktur yang bisa diedit & di-approve di UI; cancel di tengah planning membunuh proses agen bersih.

## Fase 3 â€” Fase EXECUTE (F3)

- [ ] `WorktreeManager`: create/getDiff/cleanup (integration test dengan repo git temporer)
- [ ] Guard: worktree di userData, branch `founcode/task-<id>`, repo user tidak tersentuh
- [ ] Template `prompts/execute.md` (implementasi persis sesuai plan; stop & lapor jika plan tak bisa diikuti)
- [ ] Orchestrator: `approvePlan` â†’ create worktree â†’ jalankan agen (write mode) di worktree
- [ ] Streaming log eksekusi ke UI + tombol Stop/Cancel
- [ ] Simpan diff sebagai artefak setelah agen selesai
- [ ] UI: Diff Viewer per file di Task Detail
- [ ] Crash recovery: task EXECUTING yatim saat app restart â†’ FAILED + opsi retry (TDD Â§8)

**Exit criteria:** plan approved dieksekusi di worktree terisolasi; diff akurat tampil di UI; folder project user tetap bersih; stop membunuh proses dengan bersih.

## Fase 4 â€” Fase VERIFY + Finalisasi (F4)

- [ ] Template `prompts/verify.md` (kriteria dari plan + diff + deteksi test runner; output format Founcode Verdict)
- [ ] Verdict parser (JSON dalam fence; unit test + auto-retry 1x jika unparseable)
- [ ] Orchestrator: eksekusi selesai â†’ spawn sesi agen BARU untuk verify
- [ ] Loop perbaikan: verdict fail â†’ kirim `fix_instructions` balik ke Execute, max 2 iterasi, lalu wajib intervensi user
- [ ] UI: Verify Report (per kriteria pass/fail/warning, hasil test, verdict badge)
- [ ] `WorktreeManager.merge()`: merge branch task ke branch user (konflik â†’ surface ke UI, tidak pernah auto-resolve)
- [ ] UI: aksi finalisasi Merge / Send back / Discard + cleanup worktree setelah DONE/DISCARDED
- [ ] Tulis salinan plan approved ke `<project>/.founcode/plans/` (opsional, default gitignored)

**Exit criteria:** siklus penuh Plan â†’ Execute â†’ Verify â†’ Merge berhasil pada task nyata di repo nyata dengan Claude Code asli, di Windows 11.

## Fase 5 â€” Licensing, Packaging, Polish (F6)

- [ ] Keputusan final: Lemon Squeezy vs Paddle (bandingkan fee + dukungan merchant Indonesia) â†’ buat produk & tier
- [ ] `LicenseService`: activate, re-validasi 24 jam, offline grace 7 hari, simpan via safeStorage
- [ ] Enforcement Free tier di Orchestrator: 1 task aktif, 1 project (+ unit test)
- [ ] UI: Settings page (license, pilihan agen default, tema) + upgrade prompt yang sopan
- [ ] electron-builder: NSIS installer + portable zip, icon & branding Founcode
- [ ] electron-updater + repo GitHub Releases publik
- [ ] E2E Playwright: alur penuh dengan MockAgentAdapter
- [ ] QA manual di Windows 11 VM bersih (checklist Â§QA di bawah)
- [ ] README.md publik + docs singkat cara pakai

**Exit criteria:** installer terpasang di VM bersih; free tier enforced; license activation bekerja; auto-update dari release draft bekerja.

## Fase 6 â€” Launch (v1.0)

- [ ] Landing page founcode (nama domain: riset & beli) â€” bisa pakai skill build-premium-website
- [ ] Harga final Pro tier (PRD Â§7: target $8â€“12/bln, harus < $20)
- [ ] Rilis v1.0.0 di GitHub Releases + Lemon Squeezy/Paddle live
- [ ] Post launch: Product Hunt, X/Twitter, r/ClaudeAI, komunitas dev Indonesia
- [ ] Setup kanal feedback (GitHub Issues publik / Discord)

## P1 â€” Fast Follow (setelah v1.0, JANGAN dikerjakan lebih awal)

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
- [ ] Siklus penuh P-E-V pada repo nyata â†’ merge sukses
- [ ] Cancel di setiap fase â†’ tidak ada proses zombie (cek Task Manager)
- [ ] Tutup paksa app saat EXECUTING â†’ restart â†’ recovery benar
- [ ] Free tier: task kedua ditolak dengan pesan upgrade yang jelas
- [ ] Offline penuh: app tetap jalan, grace period license benar
- [ ] Repo user: tidak ada file sampah, branch sampah, atau perubahan tak diminta
