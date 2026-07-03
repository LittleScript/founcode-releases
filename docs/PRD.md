# PRD — Founcode

**Product Requirements Document**

| | |
|---|---|
| **Produk** | Founcode — Desktop Orchestrator untuk AI Coding Agents |
| **Versi Dokumen** | 1.0 |
| **Tanggal** | 3 Juli 2026 |
| **Owner** | Koko (21Kent) |
| **Status** | Approved — basis untuk TDD & implementasi |

---

## 1. Ringkasan Eksekutif

Founcode adalah **desktop app Windows-first** yang menjadi lapisan orkestrasi di atas AI coding agents (Claude Code, OpenAI Codex, Gemini CLI, OpenCode). Founcode tidak menghasilkan kode sendiri — ia memaksa alur kerja terstruktur **Plan → Execute → Verify** pada agen-agen tersebut, sehingga hasil AI coding bisa dipercaya, bukan sekadar "kelihatan benar".

**Analogi:** kalau Claude Code adalah developer, Founcode adalah tech lead yang membuat rencana, menyerahkan pekerjaan, dan memverifikasi hasilnya.

---

## 2. Problem Statement

### Masalah yang dipecahkan

1. **"Prompt-and-pray"** — developer memberi instruksi ke AI agent, menerima kode, dan berharap benar. Tidak ada plan yang bisa direview sebelum kode ditulis, tidak ada verifikasi sistematis setelahnya.
2. **Kode AI "kelihatan benar tapi tidak jalan"** — keluhan #1 pengguna AI coding tools. Tanpa loop verifikasi, bug halus lolos ke produksi.
3. **Konteks hilang antar sesi/agen** — setiap sesi agent mulai dari nol; tidak ada artefak plan yang persisten dan bisa diserahkan antar agen.
4. **Tooling orkestrasi tidak tersedia di Windows** — Traycer (pemain utama) belum support Windows; agent-deck hanya via WSL. Mayoritas developer dunia memakai Windows.

### Bukti pasar

- Traycer: 550K tasks dibuat, 240K install di Open VSX — permintaan terbukti ada.
- Kategori "agent orchestrator" berkembang cepat di 2025–2026 (Shipyard, Composio agent-orchestrator, dll).
- Tidak ada pemain yang menggarap Windows native secara serius.

---

## 3. Target Pengguna

### Persona utama (MVP)

| Persona | Deskripsi | Kebutuhan |
|---|---|---|
| **Solo developer / freelancer** | Sudah berlangganan Claude Pro/Max atau ChatGPT Plus, pakai Claude Code / Codex CLI harian, kerja di Windows | Workflow terstruktur tanpa bayar mahal; hasil AI yang bisa dipercaya untuk project klien |
| **Indie hacker / small SaaS builder** | Membangun produk sendiri dengan bantuan AI, sering multi-project | Plan yang bisa direview sebelum agen mengubah banyak file; verifikasi sebelum deploy |

### Persona sekunder (post-MVP)

- Tim kecil (2–5 dev) yang butuh visibilitas atas pekerjaan agen.
- Non-technical founder yang butuh guardrails saat memakai AI agent.

### Bukan target (MVP)

- Enterprise (butuh SSO, audit, on-prem — di luar scope).
- Pengguna yang tidak punya AI agent CLI sama sekali.

---

## 4. Positioning & Diferensiasi

### Kompetitor

| | Traycer | agent-deck (Go/TUI) | AgentDeck (hardware) | **Founcode** |
|---|---|---|---|---|
| Bentuk | Desktop app | TUI terminal | Hardware surface | **Desktop app** |
| Windows | Coming soon | WSL saja | Bridge saja | **Native first-class** |
| Core loop | Plan-Execute-Verify | Session mgmt | Physical control | **Plan-Execute-Verify** |
| Harga masuk | $20/bln | Gratis (OSS) | Gratis (OSS) | **Lebih murah dari Traycer** |
| BYOA gratis | Ya | Ya | Ya | **Ya** |

### Tiga pilar diferensiasi

1. **Windows-first.** Dibangun, diuji, dan dirilis untuk Windows 11 sejak hari pertama. macOS/Linux menyusul.
2. **Lebih murah.** Local-first tanpa server = struktur biaya nol infra → harga bisa di bawah Traycer secara signifikan.
3. **Fitur unik** (akan ditentukan & diperbarui — placeholder resmi: kandidat meliputi integrasi ekosistem lokal, template plan per-stack, verifikasi berbasis test-runner otomatis). *Direvisi bersama Koko sebelum public launch.*

### Value proposition satu kalimat

> "Founcode membuat AI coding agent-mu bekerja seperti tim engineering yang disiplin: rencana dulu, kerjakan, lalu buktikan — semuanya lokal di Windows-mu, tanpa langganan mahal."

---

## 5. Fitur

### 5.1 MVP — P0 (harus ada di v1.0)

#### F1. Project & Task Management
- Register project = folder git lokal di mesin user.
- Task board sederhana (kolom: Backlog → Planning → Awaiting Approval → Executing → Verifying → Done / Failed).
- Setiap task punya: judul, intent (deskripsi natural language), project, agen yang dipakai, status, artefak (plan, diff, laporan verifikasi).

#### F2. Fase PLAN
- User menulis intent → Founcode menjalankan agen dalam **mode headless read-only** untuk menganalisis codebase dan menghasilkan **plan terstruktur** (format markdown standar Founcode: ringkasan, file yang disentuh, langkah per file, risiko, kriteria verifikasi).
- Plan tampil di UI dengan renderer markdown; user bisa **edit langsung, minta revisi (re-plan dengan feedback), atau approve**.
- Plan tersimpan sebagai artefak persisten (SQLite + file `.founcode/plans/`).

#### F3. Fase EXECUTE
- Plan yang di-approve diserahkan ke agen dalam **git worktree terisolasi** (branch `founcode/task-<id>`).
- Output agen di-stream real-time ke UI (log viewer per task).
- User bisa stop/cancel eksekusi kapan saja.
- Selesai eksekusi → diff summary tampil di UI.

#### F4. Fase VERIFY
- Sesi agen **baru** (konteks bersih) menerima: plan + diff hasil eksekusi → memeriksa kesesuaian diff terhadap plan, menjalankan test suite project (jika terdeteksi), dan menghasilkan **laporan verifikasi** (per kriteria: pass/fail/warning + penjelasan).
- Verdict: ✅ Verified / ⚠️ Verified with warnings / ❌ Failed (dengan opsi kirim balik ke Execute dengan catatan perbaikan).
- User melakukan finalisasi: merge branch ke branch kerja, atau discard.

#### F5. Agent Adapter — Claude Code (integrasi penuh v1.0)
- Deteksi otomatis instalasi Claude Code di mesin user.
- Spawn headless (`claude -p` dengan streaming output), manajemen lifecycle proses, parsing event.
- Arsitektur adapter generik sejak awal — adapter lain tinggal implement interface yang sama.

#### F6. Licensing & Freemium
- **Free tier:** 1 task aktif pada satu waktu, 1 project. Tanpa batas waktu.
- **Pro tier (berbayar, target $8–12/bln):** task paralel tak terbatas, project tak terbatas, prioritas fitur baru.
- Validasi license key via Lemon Squeezy/Paddle API dengan offline grace period 7 hari.

### 5.2 P1 — Fast follow (v1.x)

- Adapter: OpenAI Codex CLI, Gemini CLI, OpenCode.
- Parallel tasks dengan monitoring board multi-task.
- Template plan per jenis task (bugfix, feature, refactor).
- Riwayat & pencarian task/plan.

### 5.3 P2 — Roadmap (v2+)

- Agent-to-agent review (agen kedua me-review hasil agen pertama sebelum verify).
- macOS & Linux build.
- Cross-device sync + team workspace (fitur tier atas — model open-core dipertimbangkan).
- Integrasi issue tracker (Linear, Jira, GitHub Issues).

### 5.4 Out of Scope (eksplisit TIDAK dibangun)

- Model inference sendiri / proxy API key (user pakai agen & langganan sendiri — BYOA murni).
- Editor kode di dalam app (user tetap pakai editor mereka).
- Cloud backend di MVP (kecuali validasi license via pihak ketiga).
- Mobile app.

---

## 6. User Flow Utama (MVP)

```
1. Onboarding    : install Founcode → app deteksi Claude Code → user register project (pilih folder git)
2. Buat task     : user tulis intent ("tambahkan dark mode ke settings page")
3. PLAN          : agen analisis codebase → plan muncul → user review/edit → APPROVE
4. EXECUTE       : agen kerja di worktree terisolasi → log streaming → diff summary
5. VERIFY        : agen baru cek diff vs plan + run tests → laporan verifikasi
6. Finalisasi    : user merge branch / kirim balik untuk perbaikan / discard
```

**Kriteria pengalaman:** dari intent sampai plan siap direview < 3 menit untuk codebase menengah; user tidak pernah perlu menyentuh terminal untuk alur standar.

---

## 7. Monetisasi

| Tier | Harga | Isi |
|---|---|---|
| **Free** | $0 selamanya | 1 task aktif, 1 project, semua fase P-E-V penuh |
| **Pro** | Target **$8–12/bln** (final ditentukan saat launch; harus < Traycer Lite $20) | Unlimited tasks & projects, parallel execution, prioritas support |

- Billing & license key: **Lemon Squeezy atau Paddle** (merchant of record — menangani pajak global, cocok untuk solo founder Indonesia).
- Tidak ada biaya inference yang kita tanggung → margin sehat sejak pelanggan pertama.
- Free tier tetap fungsional penuh (bukan trial) → mesin word-of-mouth.

---

## 8. Success Metrics

### North star
**Jumlah task yang menyelesaikan siklus penuh Plan → Execute → Verify per minggu.**

### Metrik MVP (3 bulan pertama setelah launch)

| Metrik | Target |
|---|---|
| Install (download) | 1.000 |
| Aktivasi (≥1 task selesai full cycle) | 30% dari install |
| Konversi Free → Pro | 3–5% |
| Retensi minggu ke-4 | 25% |
| Crash-free sessions | > 99% |

---

## 9. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| CLI agen berubah format output (breaking) | Adapter rusak | Adapter versioned + integration test terhadap CLI nyata di CI; abstraksi event internal stabil |
| Traycer rilis Windows lebih dulu | Diferensiasi #1 melemah | Kecepatan eksekusi + pilar harga & fitur unik tetap berlaku; local-first tetap lebih murah |
| Vendor agen merilis orkestrasi native | Pasar menyempit | Multi-agen adalah hedge — nilai Founcode justru lintas-vendor |
| Freemium terlalu murah hati → konversi rendah | Revenue lambat | Batas free (1 task aktif) menyakitkan tepat bagi power user; mudah disesuaikan lewat license server |
| Solo founder bandwidth | Scope creep, burnout | PRD ini membatasi MVP keras; P1/P2 tidak dikerjakan sebelum v1.0 rilis |

---

## 10. Keputusan Produk yang Sudah Dikunci

| Keputusan | Nilai | Alasan |
|---|---|---|
| Nama | **Founcode** | Dipilih Koko; bebas konflik (dicek 3 Jul 2026) |
| Bentuk | Desktop app (Electron + React) | Windows-first; Node.js memudahkan manajemen proses CLI |
| Arsitektur | Local-first, tanpa server sendiri | Biaya nol, privacy selling point, tercepat ke market |
| Core loop MVP | Plan → Execute → Verify | Value prop terbukti (Traycer), jawaban atas keluhan #1 AI coding |
| Agen v1.0 | Claude Code (penuh); adapter generik untuk sisanya | Fokus kualitas satu integrasi; Codex/Gemini/OpenCode di P1 |
| Monetisasi | Freemium + subscription via Lemon Squeezy/Paddle | Tanpa infrastruktur billing sendiri |
| Repo | `Desktop\Founcode` | Keputusan Koko |
