# CLAUDE.md — Founcode

Instruksi untuk Claude Code di project ini. Baca ini dulu sebelum kerja.

## Apa ini

**Founcode** — desktop app Windows-first (Electron + React + TypeScript) yang mengorkestrasi AI coding agents (Claude Code dulu, lalu Codex/Gemini/OpenCode). Pipeline produk: **Blueprint → Plan → Execute → Verify → Merge** (Blueprint = Idea→PRD→Task Graph, Fase 5 aktif). Produk komersial 21Kent, model freemium ($0 free / ~$10 Pro via Lemon Squeezy/Paddle). Kompetitor utama: Traycer (belum support Windows + tak menggarap greenfield idea→app — itu celah kita).

## Dokumen sumber kebenaran (docs/)

| Dokumen | Isi | Kapan dibaca |
|---|---|---|
| `docs/PRD.md` | Requirement produk, fitur P0/P1/P2, out-of-scope, pricing | Sebelum menambah/mengubah fitur |
| `docs/TDD.md` | Arsitektur, adapter pattern, state machine, skema DB, IPC contract, security | Sebelum menulis kode |
| `docs/TODO.md` | Checklist per fase + exit criteria | **Setiap awal sesi** — kerjakan item teratas yang belum selesai |
| `docs/PLANNING.md` | Milestone + status, strategi rilis, keputusan terbuka | Saat planning / ragu prioritas |
| `docs/COMPETITORS.md` | Peta kompetitor & positioning verification-first | Sebelum keputusan produk/pricing |
| `docs/BLUEPRINT-DESIGN.md` | Desain fitur Blueprint/Spec Studio (Idea→PRD→Tasks), Fase 5 aktif | Saat mengerjakan Blueprint (B1–B5) |
| `docs/USER-GUIDE.md` | Panduan pakai lengkap untuk end user | Saat mengubah UX — jaga tetap akurat |
| `docs/DEVELOPMENT.md` | Setup dev, peta arsitektur, testing, **gotcha yang sudah memakan korban** | Sesi pertama + saat kena jebakan aneh |

## Ritual sesi kerja

1. Baca `docs/TODO.md` → temukan fase aktif & item berikutnya.
2. Kerjakan item sesuai desain di TDD. Jangan improvisasi arsitektur — kalau TDD tidak cocok dengan kenyataan, diskusikan dengan Koko dulu, lalu update TDD.
3. Selesai → centang di TODO.md → commit (kode + update TODO dalam commit yang sama).
4. Ide baru? Masuk P1/P2 di TODO.md — JANGAN jadi P0 baru tanpa persetujuan Koko.

## Aturan keras

- **Scope MVP terkunci.** PRD §5.4 (out of scope) adalah hukum. Tidak ada fitur baru di P0.
- **Satu fase selesai penuh (exit criteria) sebelum fase berikutnya.**
- **Renderer tidak pernah menyentuh Node/filesystem** — semua lewat IPC contract (`src/shared/ipc-contract.ts`).
- **Semua transisi state task lewat Orchestrator** — tidak ada jalur pintas.
- **Dev pakai MockAgentAdapter** — CLI/kredit asli hanya untuk integration test & QA.
- **Bahasa komunikasi dengan Koko: Indonesia.** Kode, komentar, dan commit message: Inggris.

## Konvensi teknis

- TypeScript strict. Biome untuk lint/format. Vitest untuk unit test.
- State machine & parser WAJIB punya unit test sebelum dianggap selesai.
- Commit message: conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Struktur folder: lihat TDD §3 — jangan menyimpang tanpa update TDD.

## Gotcha kritis (detail di docs/DEVELOPMENT.md §6)

- electron-vite dev TIDAK restart main saat `src/main/**` berubah — restart manual, awas proses agen yatim.
- Zustand selector dilarang alokasi baru (`?? []`) — menyebabkan window blank (infinite re-render).
- Read-only planning = `--allowedTools Read Glob Grep`, JANGAN `--permission-mode plan`.
- Untuk sesi testing user: jalankan dev app DETACHED (`Start-Process cmd /c "npm run dev"`) supaya tidak mati saat background task session dibersihkan.

## Konteks pemilik

Koko (21Kent) — solo founder, paralel mengerjakan TracFi, PRIMS, dll. Sesi kerja bisa terputus berminggu-minggu; dokumen di `docs/` + TODO.md yang selalu ter-update adalah satu-satunya jembatan antar sesi. Jaga selalu akurat.
