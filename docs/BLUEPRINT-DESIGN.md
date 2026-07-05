# Design — Blueprint (Spec Studio)

**Idea → PRD → Task Graph → build.** The greenfield front-end that feeds Founcode's Plan → Execute → Verify pipeline.

| | |
|---|---|
| Versi | 1.0 (draft untuk approval) |
| Tanggal | 5 Juli 2026 |
| Status | **Menunggu approval Koko sebelum implementasi** |
| Keputusan | Dibangun sebagai bagian v1.0 (sebelum rilis) — resequence: ini Fase 5, licensing jadi Fase 6, launch Fase 7 |
| Inspirasi | ngodingpakeai.com (PRD generator lokal) + insight "task next" dari Koko |

---

## 1. Kenapa

Founcode saat ini menggarap **belah kanan** funnel: sudah ada task → Plan → Execute → Verify → Merge. Ada asumsi tersembunyi: user sudah punya repo dan sudah tahu mau bikin apa.

Blueprint menggarap **belah kiri** yang hilang:

```
[ IDE mentah ]                                          [ pipeline yang sudah ada ]
     │
 chat singkat → 5 pertanyaan → Structure Map → PRD.md → Task Graph → [ tiap task: Plan→Execute→Verify→Merge ]
 (non-teknis)   (klarifikasi)  (peta fitur)   (dokumen)  (N task)      ↑ mesin Founcode sekarang
```

Hasilnya: **dari ide kosong sampai aplikasi terverifikasi, dalam satu tool, Windows-native.** Tidak ada kompetitor (Traycer/Nimbalyst/dll) yang menggarap greenfield idea→app — mereka semua butuh codebase yang sudah ada. Ini melompatkan positioning Founcode dan membuka pasar non-technical founder + indie yang baru mulai.

**Prinsip inti (insight Koko):** agen membaca **PRD dulu** sebagai konteks bersama, lalu mengerjakan task **satu per satu** (`task next`) — bukan semua task sekaligus. Menyuapkan semua task = context rot = agen bingung, kualitas jeblok. Founcode memang sudah "satu task fokus dalam satu waktu"; Blueprint tinggal menghasilkan task graph-nya secara otomatis.

## 2. Terminologi (penting — hindari kebingungan)

- **Blueprint** = spec tingkat PRODUK: ide + PRD + peta fitur + daftar task. Satu blueprint per inisiatif.
- **Plan** = spec tingkat TASK: langkah implementasi untuk satu task (yang sudah ada di Founcode).

Pipeline lengkap: **Blueprint → (banyak task) → tiap task: Plan → Execute → Verify → Merge.**

## 3. Alur Pengguna (6 langkah, cocok dengan bar progres ngodingpakeai)

```
Idea ──► Questions ──► Structure ──► PRD ──► Tasks ──► Implement
        (AI tanya)    (peta fitur)  (dokumen) (task graph) (P-E-V berurutan)
```

1. **Idea** — layar chat. User jelaskan ide dengan bahasa awam (contoh: "aplikasi booking padel untuk customer pilih lapangan, admin cek slot & konfirmasi bayar"). Plus pilihan **tech preference**: "Biarkan AI pilih" atau "Pilih sendiri" (stack picker).
2. **Questions** — AI menghasilkan ~5 pertanyaan klarifikasi (pilihan ganda + opsi "lewati"). User jawab. Contoh: "Hal pertama yang harus berhasil dilakukan user di kunjungan pertama?"
3. **Structure** — AI menghasilkan **peta fitur**: Produk → Fase/Fitur → Sub-fitur → Task. User review, edit, terima. (visual node-tree ala gambar 1)
4. **PRD** — AI menulis `PRD.md` (+ arsitektur, skema DB, tech stack) ke dalam project. User bisa **revisi via chat** ("ganti database ke Postgres", "tambah fitur X").
5. **Tasks** — AI mendekomposisi PRD jadi task granular berurutan dengan prioritas. Ini menjadi **task Founcode biasa** di kolom Backlog, terhubung ke blueprint, punya `order_index`.
6. **Implement** — user mulai. Task diumpankan **berurutan** ke pipeline P-E-V: task[0] jalan → setelah DONE (merged), task[1] mulai (auto atau klik "Next task"). Setiap agen membaca PRD dulu sebagai konteks, lalu satu task-nya.

## 4. Arsitektur

### 4.1 Data (migration 003)

```sql
CREATE TABLE blueprints (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  title       TEXT NOT NULL,
  idea        TEXT NOT NULL,
  tech_pref   TEXT NOT NULL,   -- json: { mode: 'auto'|'manual', stack?: string }
  answers     TEXT,            -- json: [{ question, options, answer|skipped }]
  structure   TEXT,            -- json: feature tree
  prd         TEXT,            -- markdown
  agent_id    TEXT NOT NULL,
  state       TEXT NOT NULL,   -- lihat state machine
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- tasks memperoleh keterkaitan blueprint + urutan
ALTER TABLE tasks ADD COLUMN blueprint_id TEXT;   -- nullable: task manual tetap tanpa blueprint
ALTER TABLE tasks ADD COLUMN order_index INTEGER; -- urutan feeding
```

Pertanyaan, struktur, dan PRD disimpan sebagai JSON/markdown di baris blueprint (bukan tabel terpisah — YAGNI). Artefak per-generasi (log agen) tetap via `artifacts` dengan `blueprint_id` opsional — atau lebih sederhana, disimpan di kolom sendiri.

### 4.2 Blueprint State Machine (terpisah dari Task state machine)

```
IDEA
 └─ generate questions ─► QUESTIONS ─(user answers)─► STRUCTURING
                                                          │ generate map
                                                          ▼
                                                     STRUCTURE_REVIEW ─(accept)─► GENERATING_PRD
                                                                                      │
                                                                                      ▼
                          (revise via chat) ◄──────────────────────────────── PRD_REVIEW
                                                                                      │ accept
                                                                                      ▼
                                                                                DECOMPOSING
                                                                                      │ generate tasks
                                                                                      ▼
                                                                                 TASK_REVIEW ─(start)─► IMPLEMENTING ─► DONE
```

Setiap transisi generatif memanggil agen sekali. Semua state persist di SQLite → bisa resume setelah crash/restart (pola sama dengan task).

### 4.3 Generative agent runs (jalur baru di Orchestrator)

Langkah generasi (questions/structure/prd/tasks) menjalankan agen tapi **menghasilkan DATA, bukan kode** → tidak butuh worktree/diff. Tambah metode ringan `runGeneration()` di Orchestrator yang:
- Menjalankan adapter mode `read` di folder project (atau folder kosong untuk greenfield),
- Menangkap `resultText`, parse jadi struktur (JSON dalam fence, pola sama dengan verdict parser),
- Simpan ke baris blueprint, transisi state, broadcast.

Reuse penuh: `AgentAdapter`, `collect()`, streaming `task:event` (di-key dengan `blueprint:<id>`), auto re-prompt 1x saat parse gagal.

### 4.4 Prompt baru (`prompts/blueprint/`)

| File | Input → Output |
|---|---|
| `questions.md` | idea + tech_pref → 3–6 pertreanyaan klarifikasi (JSON: pertanyaan + opsi + allowSkip) |
| `structure.md` | idea + answers → feature tree (JSON: fase → fitur → sub-fitur) |
| `prd.md` | idea + answers + structure → PRD.md lengkap (markdown; format seperti PRD contoh: Overview, Requirements, Core Features per fase, User Flow, Architecture + mermaid, DB Schema, Tech Stack) |
| `tasks.md` | PRD + structure → daftar task granular (JSON: title, intent, feature, priority, order) |
| `revise.md` | PRD + instruksi user → PRD.md revisi |

### 4.5 Sequential feeding ("task next")

Saat blueprint `IMPLEMENTING`:
- Task dibuat di Backlog dengan `order_index` 0..N.
- Founcode mulai task dengan `order_index` terkecil yang belum selesai, lewat pipeline P-E-V normal.
- **Prompt Plan tiap task menyertakan PRD** sebagai konteks (blok "## Product context") + ringkasan task yang sudah selesai → agen tahu peta besar tapi fokus satu task.
- Saat task DONE (merged): otomatis mulai task berikutnya, atau berhenti dan tunggu klik "Start next task" (toggle **Auto-advance** di UI). Default: manual advance (aman, hemat kredit, sesuai filosofi "sedikit-sedikit").
- Free tier: 1 task aktif (konsisten). Pro: bisa auto-advance / paralel.

### 4.6 Greenfield project creation

Ide baru sering belum punya repo. Blueprint bisa mulai dari:
- **Existing project** (sudah terdaftar) — tambah blueprint ke repo yang ada.
- **New project** — Founcode buat folder + `git init` + commit awal (README dari PRD), lalu daftarkan sebagai project. (v1: minimal — buat folder di lokasi yang user pilih.)

## 5. UI

- **Entry:** tombol "✦ New from Idea" di board (di samping "+ New Task").
- **Blueprint Studio** = view full-screen dengan **bar progres 6 langkah** (Idea · Questions · Structure · PRD · Tasks · Implement) di header, mirip ngodingpakeai.
  - Langkah chat/questions: gaya percakapan.
  - Structure: **node-map** (Produk → Fitur → Sub-fitur → Task) — reuse estetika PipelineRail + panel. v1 bisa tree/kolom sederhana; canvas node mewah bisa menyusul.
  - PRD: markdown viewer + kotak chat revisi.
  - Tasks: daftar task dengan prioritas, tombol "Start Implementation".
  - Implement: kembali ke Board biasa, task-task blueprint tampil dengan penanda urutan + tombol "Next task".
- Konsisten dengan design system "Mission Control" yang baru.

## 6. Scope v1 (jangan lebih)

**Masuk v1:**
- 6 langkah alur penuh (idea → implement) untuk **satu agen** (Claude Code).
- Generate: questions, structure, PRD, tasks — semua parseable + review gate + revisi PRD via chat.
- Sequential feeding dengan manual advance (+ PRD sebagai konteks tiap task).
- Structure map versi tree/kolom (bukan canvas node drag-drop).
- Greenfield: buat folder + git init.

**Ditunda (P1/P2):**
- Canvas node-map interaktif drag-drop.
- Multi-agent paralel mengerjakan blueprint (nyambung ke Multi-Agent Workspace P1).
- Agent-to-agent review antar task.
- Export ZIP (PRD + specs + tasks) — mudah, tapi bukan prioritas vs alur inti.
- Template PRD per jenis app.

## 7. Risiko

| Risiko | Mitigasi |
|---|---|
| Output agen tidak parseable (JSON/struktur) | Pola verdict parser: fence JSON + validasi + 1x auto re-prompt + fallback tampilkan raw untuk edit manual |
| PRD generic/dangkal | Prompt kaya + 5 pertanyaan klarifikasi + gate revisi via chat; contoh PRD padel jadi acuan kualitas |
| Scope membengkak (fitur ini besar) | Scope v1 dikunci di §6; canvas mewah & multi-agent ditunda |
| Task graph terlalu besar/halus | Prompt batasi granularity (task = 1 unit kerja P-E-V wajar); user bisa review/hapus di Task step |
| Greenfield tanpa test → verify lemah | Verify tetap cek kriteria plan; untuk task scaffolding, kriteria = "halaman render / build sukses" |

## 8. Rencana Implementasi (bertahap, tiap tahap diverifikasi)

- **B1 — Data & state machine**: migration 003, blueprint repo, BlueprintStateMachine + unit test.
- **B2 — Generative runner**: `runGeneration()` + parser (questions/structure/prd/tasks) + MockAgent blueprint mode + unit test.
- **B3 — Alur Idea→Questions→Structure→PRD** di UI (Blueprint Studio) dengan review gate + revisi.
- **B4 — Tasks→Implement**: dekomposisi → task Founcode dengan order_index + PRD sebagai konteks plan + sequential feeding + UI.
- **B5 — Greenfield project creation** + polish + E2E dengan Claude asli.

Tiap tahap punya exit criteria di TODO.md (ditambahkan setelah approval).
