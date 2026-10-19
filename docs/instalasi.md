# Instalasi

Panduan memasang Studio Konten dari nol. Setelah selesai, lanjut ke [cara-pakai.md](cara-pakai.md).

## Kebutuhan

| Perangkat lunak | Versi | Keterangan |
|---|---|---|
| macOS | Apple Silicon atau Intel | Sudah diuji di macOS (M1 Pro, RAM 16 GB). Linux kemungkinan jalan, tapi launcher `Studio Konten.command` dan fitur hapus ke Trash khusus macOS. |
| [Node.js](https://nodejs.org) | 22.5 atau lebih baru (disarankan 24) | Butuh `node:sqlite` dan `node --env-file-if-exists` |
| [Claude Code](https://claude.com/claude-code) | terbaru | Pembuat video. Harus sudah login (`claude` bisa dijalankan dari Terminal). |
| Git | apa saja | Untuk clone, dan untuk memasang Whisper otomatis |
| Xcode Command Line Tools | | `xcode-select --install`; dipakai untuk membangun whisper.cpp (fitur Edit video) |

Ruang disk: ±1 GB untuk dependensi, ±1,5 GB lagi kalau memakai Edit video (model Whisper), plus hasil video.

### Kunci API

| Layanan | Wajib? | Dipakai untuk | Biaya |
|---|---|---|---|
| [Google AI Studio](https://aistudio.google.com/apikey) (`GEMINI_API_KEY`) | Ya | Suara narasi Gemini TTS | Gratis ±10 request/hari per model per project Google; 1 video = 1 request per suara |
| Router OpenAI-compatible (`ROUTER_BASE_URL`, `ROUTER_API_KEY`) | Ya, salah satu dari ini atau Anthropic | Ide & caption, terjemahan prompt gambar, posisi mulut karakter, cek suara | Tergantung router; butuh model yang bisa membaca audio dan gambar (mis. Gemini Flash) untuk cek suara dan posisi mulut |
| [Anthropic](https://console.anthropic.com) | Opsional | Ide & caption dengan model Claude langsung (diisi di Pengaturan, bukan `.env`) | Per token |
| [Alibaba Cloud DashScope](https://www.alibabacloud.com/product/model-studio) (`DASHSCOPE_API_KEY`) | Opsional | Gambar karakter anime, latar, dan benda | 100 gambar gratis, lalu ±$0,03/gambar |
| [TikTok for Developers](https://developers.tiktok.com) | Opsional | Kirim video ke draf/inbox TikTok | Gratis; butuh aplikasi TikTok dan domain https untuk halaman callback |

Claude Code memakai langganan Claude kamu sendiri; Studio tidak memakai key Anthropic untuk membuat video.

## Langkah

### 1. Clone dan pasang dependensi

```bash
git clone https://github.com/Masamune21-dev/Studio-Konten.git
cd Studio-Konten
npm install                       # Remotion, React, TypeScript, Chrome headless (±530 MB)
cd studio && npm install && npx vite build && cd ..   # dashboard
```

Semua proyek video memakai satu `node_modules` di folder repo ini. **Jangan** menjalankan `npm install` di folder proyek video.

### 2. Pasang skill untuk Claude Code

Skill `video-tiktok` berisi aturan gaya, langkah kerja, dan template proyek video. Claude Code membacanya dari `~/.claude/skills`, jadi buat symlink (bukan salinan, supaya selalu ikut versi repo):

```bash
mkdir -p ~/.claude/skills
ln -s "$PWD/skill/video-tiktok" ~/.claude/skills/video-tiktok
```

### 3. Isi kunci API

```bash
cp .env.example .env
```

Buka `.env` dan isi minimal `GEMINI_API_KEY` dan router (`ROUTER_BASE_URL`, `ROUTER_API_KEY`). Satu variabel per baris, tanpa komentar di belakang nilai. Router dan key Anthropic juga bisa diisi nanti dari **Pengaturan › Model AI**.

### 4. Siapkan brand

Repo membawa brand contoh fiktif **CONTOH FIBER** di `brand.example/`. Untuk brand sendiri:

```bash
cp -R brand.example brand
```

Lalu ubah `brand/brand.mjs` (nama, akun sosial, karakter, peran, suara) dan `brand/profile.md` (fakta brand). Folder `brand/` tidak ikut git. Penjelasan lengkap: [brand.md](brand.md). Tanpa folder `brand/`, Studio memakai brand contoh.

### 5. Nyalakan Studio

Di macOS: klik dua kali **`Studio Konten.command`**. Server menyala di jendela Terminal dan browser terbuka ke http://localhost:4321. Server hidup selama jendela Terminal itu terbuka; tutup jendelanya atau tekan `Ctrl+C` untuk mematikan. Launcher membangun ulang dashboard kalau sumbernya lebih baru.

Manual (macOS/Linux):

```bash
cd studio
npm start            # server di :4321 (PORT=… untuk port lain)
```

### 6. Cek

1. Buka **Pengaturan › Job video & suara**, klik **Cek koneksi** di kartu kuota suara (memeriksa key Gemini tanpa memakai kuota).
2. Klik **Tes koneksi Claude Code**. Job kecil masuk **Antrian** dan harus selesai dengan catatan "skill ditemukan".
3. Buka **Pengaturan › Model AI**: status router/Anthropic harus "Tersambung · N model". Pilih model untuk ide & caption, lalu **Simpan model**.

## Opsional

- **Akses dari HP:** buka alamat di **Pengaturan › Akses HP** dari HP yang tersambung ke WiFi yang sama, lalu masukkan PIN dari `studio/data/pin.txt`. Di komputer itu sendiri tidak perlu PIN.
- **Edit video (Whisper):** dipasang otomatis saat pertama kali dipakai (`tools/whisper/`, ±1,5 GB). Bisa dipasang lebih dulu dengan `node scripts/transcribe.mjs --install` dari folder proyek video mana pun.
- **Efek suara rekaman:** `scripts/sfx.mjs` membuat 26 jenis efek suara sintetis otomatis. 18 suara rekaman tambahan dari [Mixkit](https://mixkit.co/free-sound-effects/) (lisensi gratis Mixkit, tidak boleh diedarkan ulang, jadi tidak ikut repo) bisa diunduh sendiri ke `media/sfx-mixkit/`; daftar nama filenya ada di `scripts/sfx.mjs`. Tanpa folder itu jenisnya dilewati dengan peringatan.
- **TikTok:** buat aplikasi di TikTok for Developers (produk Login Kit + Content Posting API, scope `user.info.basic,video.upload`). Unggah isi `studio/public-pages/` (isi dulu placeholder `[NAMA BRAND]` dsb.) ke domain https milikmu, pakai `https://domainkamu.com/…/tiktok-callback.html` sebagai Redirect URI, lalu isi Client Key, Client Secret, dan Redirect URI di **Pengaturan › TikTok**.

## Troubleshooting

| Gejala | Langkah |
|---|---|
| `localhost:4321` tidak bisa dibuka | Server mati (jendela Terminal tertutup, komputer restart). Nyalakan lagi lewat launcher. |
| Job gagal "tidak menulis job-N.json" | Claude Code berhenti sebelum selesai (kuota, error). Buka **Log** di Antrian, lalu ulangi atau revisi. |
| Job "gagal: Server dimulai ulang saat job berjalan" | Tunggu; job dipulihkan otomatis begitu file hasilnya muncul. |
| Kuota suara "Habis" | Tunggu reset harian (tengah malam waktu Pasifik), pakai model cadangan, atau tambah `GEMINI_API_KEY_2` dari project Google lain. |
| Kata diucapkan aneh | Tambahkan ejaannya di `pronunciation.json` proyek (atau `brand/template/pronunciation.json` untuk semua proyek baru), lalu `npm run vo`. |
| `Cannot find module 'remotion'` | `npm install` di folder repo (bukan di folder proyek). |
| Remotion mengunduh Chrome ke folder proyek | Perintah dijalankan dari luar folder proyek atau ada `npm install` di folder proyek. Jalankan dari folder proyek, hapus `node_modules` di folder proyek itu. |
| Setelah mengubah `.env` tidak ada efek | Mulai ulang server; `.env` hanya dibaca saat server menyala. |
| Daftar model "Daftar model tidak terbaca" | Base URL/API key router atau key Anthropic belum diisi atau ditolak; lihat pesan di bawah kolom key. |
