# PLANNING — Founcode

Roadmap, milestone, dan strategi eksekusi. Basis: PRD v1.0, TDD v1.0, TODO.md.
Terakhir diperbarui: 3 Juli 2026.

---

## 1. Prinsip Eksekusi

1. **MVP keras.** Tidak ada fitur P1/P2 yang disentuh sebelum v1.0 rilis. PRD §5.4 (out of scope) adalah hukum.
2. **Satu fase selesai penuh sebelum fase berikutnya.** Exit criteria di TODO.md bersifat wajib, bukan saran.
3. **Mock dulu, CLI asli belakangan.** UI & orchestrator dikembangkan terhadap MockAgentAdapter — kredit API hanya terbakar di integration test & QA.
4. **Setiap sesi kerja Claude Code:** baca CLAUDE.md → cek TODO.md → kerjakan item teratas yang belum selesai → update TODO.md → commit.

---

## 2. Milestone & Estimasi

Estimasi dalam **sesi kerja efektif** (1 sesi ≈ setengah hari fokus dengan bantuan Claude Code), bukan tanggal kalender — menyesuaikan ritme Koko yang paralel dengan TracFi/PRIMS/dll.

| Milestone | Isi | Estimasi | Kumulatif |
|---|---|---|---|
| **M0 — Fondasi** | Fase 0 selesai: scaffold, hardening, DB, IPC skeleton | 3–4 sesi | ~4 |
| **M1 — Board hidup** | Fase 1 selesai: project & task management, state machine teruji | 4–5 sesi | ~9 |
| **M2 — Plan bekerja** ⭐ | Fase 2 selesai: Claude Code adapter + fase Plan end-to-end | 6–8 sesi | ~17 |
| **M3 — Execute bekerja** | Fase 3 selesai: worktree + eksekusi + diff viewer | 5–6 sesi | ~23 |
| **M4 — Siklus penuh** ⭐⭐ | Fase 4 selesai: verify + merge; **dogfooding dimulai** | 5–6 sesi | ~29 |
| **M5 — Siap jual** | Fase 5 selesai: license, installer, QA | 5–7 sesi | ~36 |
| **M6 — Launch v1.0** 🚀 | Fase 6: landing page, rilis, marketing push | 3–4 sesi | ~40 |

**Checkpoint kritis:**
- **M2** adalah validasi teknis terbesar (integrasi CLI headless). Jika Claude Code headless ternyata tidak memadai untuk fase Plan read-only, arsitektur perlu ditinjau — deteksi dini di sini, bukan di M4.
- **M4** = momen dogfooding: mulai pakai Founcode untuk mengembangkan Founcode sendiri. Feedback loop terbaik sebelum launch.

---

## 3. Strategi Dogfooding

Mulai M4, semua task pengembangan Founcode sendiri dijalankan lewat Founcode (Plan → Execute → Verify). Manfaat:
- Menemukan friksi UX sebelum user pertama.
- Menghasilkan konten marketing otentik ("Founcode built with Founcode").
- Menguji resilience (crash recovery, cancel, dsb.) secara alami.

---

## 4. Strategi Rilis & Distribusi

### Pra-launch (selama M0–M5)
- Build in public di X/Twitter — progress screenshot, bukan janji.
- Kumpulkan waitlist via landing page sederhana (bisa dibangun kapan saja, tidak blocking).

### Launch v1.0 (M6)
- GitHub Releases (installer) + landing page dengan link beli Pro.
- Product Hunt launch.
- Komunitas: r/ClaudeAI, r/ChatGPTCoding, komunitas dev Indonesia (grup Telegram/Discord), Hacker News (Show HN).
- Angle utama pitch: **"Traycer-style Plan-Execute-Verify, native di Windows, mulai gratis."**

### Post-launch
- Ritme rilis: patch mingguan bila perlu, minor 2–4 minggu.
- P1 (multi-agent adapters) segera setelah v1.0 stabil — memperluas pasar ke pengguna Codex/Gemini.

---

## 5. Keputusan yang Masih Terbuka (dengan deadline keputusan)

| Keputusan | Deadline | Catatan |
|---|---|---|
| Fitur unik ketiga (diferensiasi #3, PRD §4) | Sebelum M6 | Brainstorm ulang setelah dogfooding M4 — insight nyata akan muncul dari pemakaian |
| Lemon Squeezy vs Paddle | Awal Fase 5 | Bandingkan fee, payout ke Indonesia, dukungan subscription |
| Nama domain | Sebelum M6 | Cek founcode.com / .dev / .app |
| Harga final Pro | Sebelum M6 | Range terkunci $8–12/bln |
| Code signing cert | Post-revenue | SmartScreen warning diterima di awal |

---

## 6. Risiko Eksekusi (pelengkap PRD §9)

| Risiko | Sinyal dini | Respons |
|---|---|---|
| Integrasi headless Claude Code lebih rapuh dari perkiraan | M2 molor > 10 sesi | Tinjau ulang: opsi fallback = mode interaktif via PTY, atau fokus flag/versi CLI tertentu |
| Scope creep dari ide-ide baru | TODO.md bertambah item P0 baru | Semua ide baru masuk P1/P2 di TODO.md, bukan P0 — tinjau saat M4 |
| Terbelah fokus dengan project lain (TracFi go-live, PRIMS) | > 2 minggu tanpa commit | Tidak apa-apa — dokumen ini + CLAUDE.md memastikan sesi berikutnya langsung tahu konteks; jangan restart dari nol |
| Burnout solo founder | — | Milestone kecil, rayakan M2 & M4; dogfooding bikin progress terasa |

---

## 7. Definisi Sukses per Horizon

- **30 hari pertama post-launch:** 1.000 download, 300 aktivasi (≥1 siklus penuh), ≥10 pelanggan Pro.
- **90 hari:** konversi 3–5%, retensi minggu-4 ≥ 25%, P1 multi-agent rilis.
- **12 bulan:** Founcode = revenue stream berkelanjutan di ekosistem 21Kent; keputusan go/no-go untuk fitur tim (P2) berdasarkan permintaan user berbayar.
