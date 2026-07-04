# COMPETITORS — Founcode

Analisis kompetitif landscape orchestrator AI coding agents.
Riset: 4 Juli 2026. Tinjau ulang sebelum M6 (launch) — pasar ini bergerak sangat cepat.

---

## 1. Peta Pasar

Pasar "agent orchestration" meledak: **120+ tools** terdaftar di awesome-agent-orchestrators, terbagi 4 kategori — parallel runners (~50), personal assistants (~30), multi-agent swarms (~30), autonomous loopers (~8). Mayoritas gratis/open-source.

**Sinyal penting — pasar sedang konsolidasi:**
- **Vibe Kanban** (27.3k★, tool paling populer di kategori ini): Bloop shutdown April 2026, project **sunsetting** → puluhan ribu user akan kehilangan tool-nya.
- **Crystal** deprecated Feb 2026 → pivot jadi Nimbalyst.
- Kesimpulan: churn user tinggi; banyak yang sedang mencari pengganti. Timing masuk pasar bagus, tapi bukti juga bahwa monetisasi kategori ini sulit — kebanyakan mati karena tidak ada revenue.

## 2. Kompetitor Langsung (head-to-head)

| | **Traycer** | **Nimbalyst** (ex-Crystal) | **Vibe Kanban** | **agent-deck** | **Conductor** | **Founcode** |
|---|---|---|---|---|---|---|
| Bentuk | Desktop app | Desktop + iOS companion | Web/CLI (`npx`) | TUI (Go+tmux) | Desktop (Mac) | Desktop app |
| **Windows native** | ❌ coming soon | ✅ | ⚠️ via npx/browser | ❌ WSL saja | ❌ Mac only | ✅ **first-class** |
| Plan approval gate | ✅ core | ❌ | ❌ | ❌ | ❌ | ✅ **core** |
| **Verify independen** | ✅ core | ❌ | ❌ | ❌ | ❌ | ✅ **core + verdict parseable + fix loop** |
| Worktree isolation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kanban/board | ✅ | ✅ | ✅ core | ❌ | ❌ | ✅ |
| Multi-agent | ✅ (4) | ✅ (2) | ✅ (10!) | ✅ (4+) | ✅ (2) | ⏳ 1 → 4 (P1) |
| Agent-to-agent | ✅ | ❌ | ❌ | ⚠️ Conductor bot | ❌ | ⏳ P2 |
| Harga | $20–100/bln | Free (teams TBD) | Free OSS | Free OSS | Free | Free + Pro $8–12 |
| Traction | 550K tasks, 240K install | naik (ex-Crystal) | 27.3k★ (sunsetting) | 425★ | populer di Mac | — |

## 3. Analisis per Kompetitor Kunci

### Traycer — kompetitor metodologi
Satu-satunya yang punya Plan→Execute→Verify eksplisit sebagai metodologi. Kekuatan: brand "spec-driven development", traction besar. Kelemahan yang bisa kita serang: (1) belum ada Windows, (2) mahal ($20 entry vs kita $8–12), (3) berat/enterprise-feel untuk solo dev.

### Nimbalyst — kompetitor platform
Satu-satunya desktop GUI lain yang Windows native. Kekuatan: multi-platform + iOS companion + 7 visual editors. Kelemahan yang membedakan kita: dia adalah **session manager** (jalankan & pantau banyak sesi), bukan **quality gate** — tidak ada plan approval, tidak ada verifikasi independen. Gratis untuk individual = tekanan pada free tier kita.

### Vibe Kanban — pelajaran & peluang
27.3k★ membuktikan permintaan besar untuk "board + agents". Sunsetting-nya membuktikan board saja tidak cukup untuk bertahan secara bisnis. Peluang: user-nya butuh rumah baru; format task board kita familiar bagi mereka.

### agent-deck / Claude Squad / dst (TUI camp)
Power user terminal, Linux/macOS. Bukan target pasar kita — biarkan.

## 4. Kesimpulan Strategis

### Positioning Founcode dipertajam
Kategori pasar terbagi dua:
1. **Session managers** (Nimbalyst, Vibe Kanban, Conductor, Claude Squad…): menjawab *"apa yang sedang dikerjakan agen-agenku?"* — SUDAH PENUH & GRATIS.
2. **Quality gates** (Traycer, Founcode): menjawab *"bisakah saya percaya hasil agen ini?"* — hanya 2 pemain, dan satunya tidak ada di Windows.

> **Founcode = verification-first orchestrator.** Kita TIDAK bersaing sebagai session manager. Pilar produk: plan yang di-approve manusia + verifikasi independen dengan verdict terstruktur + fix loop terbatas. Itu yang tidak dimiliki semua tool gratis.

### Tiga pilar diferensiasi (revisi dari PRD §4)
1. **Verification-first** (dipromosikan jadi pilar #1, sebelumnya "fitur unik TBD" — riset ini menjawabnya): verdict parseable per kriteria, deteksi & eksekusi test runner, fix loop max 2x. Tidak ada kompetitor Windows yang punya ini.
2. **Windows-first** (tetap, tapi bukan satu-satunya — Nimbalyst juga di Windows).
3. **Harga masuk akal untuk solo dev**: Free tier fungsional penuh + Pro $8–12 (vs Traycer $20; vs Superset Pro $15).

### Implikasi eksekusi
- **Fase 4 (Verify) adalah fase pembeda produk** — beri porsi kualitas tertinggi, jangan dikompromikan demi kecepatan.
- **Kecepatan tetap kritis**: Traycer bisa rilis Windows kapan saja; saat itu terjadi, kita harus sudah punya user base awal.
- **Free tier harus genuinely useful** (bukan crippled) karena pembanding user adalah tool gratis — value berbayar datang dari parallel tasks & unlimited projects, bukan dari menyandera fitur inti.
- **Ide P2 baru**: importer task dari Vibe Kanban (menangkap user telantar) — masuk backlog, JANGAN sekarang.

## 5. Risiko Baru yang Tercatat

| Risiko | Likelihood | Respons |
|---|---|---|
| Nimbalyst menambah fitur verify | Sedang | Kecepatan + fokus: verify kita lebih dalam (verdict + fix loop), bukan checkbox |
| Traycer rilis Windows sebelum kita launch | Sedang-tinggi | Harga & kesederhanaan tetap membedakan; target rilis M6 tidak boleh molor jauh |
| Kategori dikomoditisasi gratis (pola Vibe Kanban) | Tinggi untuk session mgmt | Justru validasi strategi kita: monetisasi di quality gate, bukan board |
| Claude Code menambah verify native | Rendah-sedang | Multi-agent hedge (P1) + verify lintas-agen tetap netral vendor |

---

*Sumber: nimbalyst.com/blog (perbandingan 10 tools), github.com/andyrewlee/awesome-agent-orchestrators, github.com/BloopAI/vibe-kanban, github.com/traycerai/traycer, github.com/asheshgoplani/agent-deck, traycer.ai — diakses 4 Jul 2026.*
