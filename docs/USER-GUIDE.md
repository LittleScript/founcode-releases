# Panduan Pengguna — Founcode

Panduan lengkap memakai Founcode dari nol sampai siklus penuh Plan → Execute → Verify.
Versi dokumen: 4 Juli 2026 (mencakup Fase 0–3; fase Verify menyusul).
*Catatan: versi Inggris untuk publik dibuat saat launch (Fase 6).*

---

## 1. Apa Itu Founcode?

Founcode adalah desktop app Windows yang mengubah AI coding agent (Claude Code, dan nantinya Codex/Gemini/OpenCode) menjadi alur kerja engineering yang disiplin. Alih-alih "prompt lalu berharap", setiap pekerjaan melewati tiga fase bergerbang:

```
┌─────────┐      ┌──────────┐      ┌──────────┐
│  PLAN    │ ───► │ EXECUTE  │ ───► │  VERIFY  │
│          │      │          │      │          │
│ Agen     │      │ Agen     │      │ Agen     │
│ analisis │      │ kerja di │      │ BARU cek │
│ repo,    │      │ worktree │      │ hasil vs │
│ buat     │      │ terisolasi│     │ plan +   │
│ rencana. │      │ (repo-mu │      │ jalankan │
│ KAMU     │      │ tak      │      │ test.    │
│ approve. │      │ tersentuh)│     │ KAMU     │
│          │      │          │      │ merge.   │
└─────────┘      └──────────┘      └──────────┘
```

**Tiga jaminan inti:**
1. **Tidak ada kode ditulis sebelum kamu menyetujui rencananya.**
2. **Semua eksekusi terjadi di git worktree terisolasi** — folder project dan branch-mu tidak pernah disentuh sampai kamu sendiri yang merge.
3. **Hasil diverifikasi secara independen** sebelum sampai ke branch-mu *(fase Verify — segera hadir)*.

---

## 2. Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| Windows 10/11 | Platform utama |
| Git | Harus ada di PATH (`git --version` jalan di terminal) |
| Claude Code CLI | Terinstal & sudah login (`claude --version` jalan). Founcode memakai langganan Claude-mu — tidak ada biaya tambahan dari Founcode |
| Project berupa repo git | Folder project yang mau dikerjakan harus repo git (`git init` bila belum) |

> **Mock Agent** tersedia bawaan untuk mencoba seluruh alur TANPA agen asli dan tanpa biaya — pilih "Mock Agent (testing)" saat membuat task.

## 3. Menjalankan Founcode

**Saat ini (masa pengembangan):** buka terminal di folder `Desktop\Founcode`, jalankan:
```
npm run dev
```
Window Founcode terbuka otomatis. Biarkan terminal tetap terbuka selama app dipakai.

**Nanti (setelah rilis):** installer `Founcode-Setup-x.y.z.exe` — tinggal install dan buka seperti app biasa.

## 4. Langkah Pertama: Daftarkan Project

1. Saat pertama dibuka, muncul layar **Welcome** → klik **"Add your first project"**.
2. Pilih folder project (harus repo git — Founcode menolak folder tanpa `.git`).
3. Project muncul di sidebar kiri. Klik **"+ Add project"** untuk menambah project lain; klik nama project untuk berpindah.

## 5. Membuat Task

1. Klik **"+ New Task"** di kanan atas board.
2. Isi:
   - **Title** — judul singkat, mis. "Add dark mode toggle".
   - **Intent** — jelaskan dalam bahasa natural APA yang kamu inginkan dan MENGAPA. Makin jelas intent, makin baik rencananya. Contoh: *"Users should be able to toggle dark mode from the settings page. Persist the choice and apply it app-wide on startup."*
   - **Agent** — pilih Claude Code (untuk kerja nyata) atau Mock Agent (untuk mencoba alur).
3. Klik **Create Task** → task muncul di kolom **Backlog**.

## 6. Fase PLAN — Rencana Sebelum Kode

1. Klik kartu task → halaman Task Detail terbuka di tab **Plan**.
2. Klik **▶ Start Planning**. Agen menganalisis repo dalam **mode read-only** (hanya boleh membaca file — dijamin tidak menulis apa pun).
3. Selama berjalan kamu melihat: spinner + **waktu berjalan + aktivitas terakhir**; detail streaming ada di tab **Log**. Planning biasanya 1–5 menit tergantung ukuran repo. Bisa dibatalkan kapan saja (**Cancel**).
4. Selesai → task pindah ke **Awaiting Approval** dan plan tampil dengan struktur baku:

   | Seksi | Isi |
   |---|---|
   | **Summary** | Apa yang akan diubah & mengapa |
   | **Files Touched** | Tabel file yang disentuh + aksi + alasan |
   | **Implementation Steps** | Langkah granular berurutan |
   | **Risks & Notes** | Risiko, asumsi, keputusan |
   | **Verification Criteria** | Checklist terukur yang akan dicek fase Verify |

5. Kamu punya empat pilihan:
   - **✓ Approve Plan** — setujui, lanjut ke eksekusi.
   - **Edit** — ubah plan langsung (markdown), lalu **✓ Approve Edited Plan**. Plan hasil edit tetap divalidasi strukturnya.
   - **↻ Request Re-plan** — tulis feedback ("jangan sentuh file X", "tambahkan juga Y") → agen membuat plan baru dengan mempertimbangkan feedbackmu.
   - **Discard** — buang task.

> Jika agen menghasilkan plan dengan format salah, Founcode otomatis meminta koreksi satu kali. Kalau masih salah, teks mentah tetap ditampilkan supaya kamu bisa merapikannya lewat Edit.

## 7. Fase EXECUTE — Eksekusi Terisolasi

Setelah Approve, otomatis:

1. Founcode membuat **git worktree** khusus task di `%APPDATA%\founcode\worktrees\<task-id>` pada branch `founcode/task-<id>` — **sepenuhnya di luar folder project-mu**.
2. Agen bekerja di worktree itu dengan instruksi keras: *implementasikan persis sesuai plan; kalau plan tak bisa diikuti, berhenti dan lapor* (bukan improvisasi).
3. Pantau progres real-time di tab **Log**: teks agen, tool yang dipakai (⚙), file yang diubah (±).
4. **■ Stop** di header menghentikan agen kapan saja — proses dibunuh bersih, worktree dibersihkan, task jadi Discarded.
5. Selesai → seluruh perubahan di-commit ke branch task, task pindah ke **Verifying**, dan tab **Diff** menampilkan perubahan per file (hijau = tambah, merah = hapus).

**Yang TIDAK akan pernah dilakukan Founcode:** menyentuh branch-mu, push ke remote, atau auto-resolve konflik.

## 8. Fase VERIFY & Finalisasi *(segera — Fase 4)*

Setelah eksekusi, agen **baru dengan konteks bersih** akan:
- Memeriksa diff terhadap setiap **Verification Criteria** di plan,
- Mendeteksi & menjalankan test suite project,
- Mengeluarkan laporan: ✅ pass / ⚠️ pass with warnings / ❌ fail per kriteria.

Verdict fail dikirim balik ke Execute untuk diperbaiki otomatis (maksimal 2 putaran), lalu keputusan kembali ke kamu: **Merge** ke branch-mu, **Send back** dengan catatan, atau **Discard**.

## 9. Memahami Status Task

| Status | Arti | Aksi yang tersedia |
|---|---|---|
| **Backlog** | Baru dibuat | Start Planning |
| **Planning** | Agen sedang menganalisis & menyusun plan | Cancel |
| **Awaiting Approval** | Plan siap direview | Approve / Edit / Re-plan / Discard |
| **Executing** | Agen mengerjakan di worktree | Stop |
| **Verifying** | Menunggu/menjalani verifikasi | Stop |
| **Review** | Terverifikasi, menunggu keputusanmu | Merge / Send back / Discard *(Fase 4)* |
| **Done** | Selesai & di-merge | — |
| **Failed** | Ada kegagalan (lihat tab Log) | ↻ Retry (kembali ke Backlog) |
| **Discarded** | Dibuang (disembunyikan dari board) | — |

## 10. Lokasi Data

| Data | Lokasi |
|---|---|
| Database (task, plan, log, diff) | `%APPDATA%\founcode\founcode.db` |
| Worktrees eksekusi | `%APPDATA%\founcode\worktrees\` |
| Repo project-mu | Tidak pernah ditulis apa pun oleh Founcode |

Semua data 100% lokal. Tidak ada server Founcode; kode-mu tidak pernah meninggalkan mesinmu (kecuali via agen yang kamu pilih, sesuai kebijakan agen itu sendiri).

## 11. Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| "Claude Code CLI not found" | Pastikan `claude --version` jalan di terminal baru. Install/login ulang Claude Code bila perlu |
| Planning terasa lama tanpa kabar | Buka tab **Log** — selama ada aktivitas baru, agen bekerja. Ada indikator "last activity Xs ago" di tab Plan. Timeout otomatis 15 menit |
| Task tertinggal di Planning/Executing setelah app ditutup paksa | Buka ulang app — recovery otomatis menandainya **Failed** dengan opsi Retry |
| Plan formatnya berantakan | Klik **Edit**, rapikan seksi yang kurang, lalu Approve Edited Plan |
| Eksekusi gagal dengan pesan `FOUNCODE_BLOCKED` | Agen menemukan plan tak bisa diikuti (file berubah/hilang). Baca alasannya di Log, lalu Retry → re-plan |
| Folder project "kotor" setelah pakai Founcode | Tidak mungkin dari Founcode — eksekusi terjadi di worktree terpisah. Cek `git status` untuk memastikan; laporkan bila terjadi |

## 12. FAQ

**Q: Apakah Founcode mengirim kode saya ke server?**
Tidak. Founcode local-first tanpa server. Kode hanya diproses agen yang kamu pilih di mesinmu sendiri.

**Q: Berapa biaya per task?**
Founcode sendiri tidak menagih per task. Konsumsi berasal dari langganan/API agen-mu (mis. langganan Claude). Biaya per run tampil di akhir Log bila tersedia.

**Q: Bisakah beberapa task jalan bersamaan?**
Arsitekturnya siap (worktree per task), UI paralel menyusul di v1.x. Free tier: 1 task aktif.

**Q: Bagaimana kalau saya tidak setuju dengan plan?**
Itu justru inti Founcode — Edit langsung, atau Request Re-plan dengan feedback. Tidak ada kode ditulis sampai kamu puas dengan rencananya.
