# Studio Konten

> **English summary.** Studio Konten is a self-hosted dashboard that turns content ideas into finished vertical TikTok/Reels/Shorts videos (and 16:9 YouTube versions) for a brand. It generates ideas and captions with an LLM, then hands each video to [Claude Code](https://claude.com/claude-code), which writes the script, records narration with Gemini TTS, builds motion-graphics scenes in [Remotion](https://www.remotion.dev) (anime host characters, word-level subtitles, 3D scenes, sound effects), renders at 60 fps and runs automatic QA. It can also draw the brand's anime characters (DashScope Qwen-Image), edit uploaded footage with local Whisper subtitles, send drafts to TikTok and track comments. Everything brand-specific lives in one folder (`brand/`), with a fictional example brand included. The UI, prompts and docs are in Indonesian. MIT licensed.

Studio Konten adalah dashboard yang dipasang sendiri untuk membuat konten TikTok sebuah brand dari ide sampai video jadi. AI membuat ide dan caption; **Claude Code** mengerjakan videonya: menulis naskah, membuat suara narasi (Gemini TTS), menyusun scene motion graphics di **Remotion** (karakter anime, subtitle per kata, adegan 3D, efek suara), merender 60 fps, lalu memeriksa hasilnya dengan QA otomatis.

## Fitur

- **Bank ide** dengan pilar konten dan bentuk yang bergiliran, generate ide lewat router LLM atau Anthropic API, caption + 5 hashtag.
- **Video otomatis** 9:16 (TikTok/Reels/Shorts) dan versi **YouTube 16:9** dari narasi yang sama, dengan revisi lewat chat.
- **Karakter anime** brand dibuat dengan AI, termasuk frame mulut untuk animasi bicara.
- **Sistem sampul** konsisten untuk grid profil, pratinjau grid sebelum upload.
- **QA otomatis**: hook ≤ 2 detik, tempo bicara, durasi, ritme visual, karakter terpotong, subtitle menutupi wajah, warna/font brand.
- **Edit video** dari rekaman sendiri: potong, subtitle per kata (Whisper lokal), judul, ikon, ajakan follow.
- **TikTok**: kirim ke draf/inbox, pantau komentar, jadikan komentar ide video balasan.
- **Bisa dibuka dari HP** di jaringan yang sama (PIN).
- **Brand bisa diganti**: nama, karakter, suara, profil, logo, dan aturan ada di folder `brand/`.

## Mulai cepat

```bash
git clone https://github.com/Masamune21-dev/Studio-Konten.git
cd Studio-Konten
npm install
cd studio && npm install && npx vite build && cd ..
mkdir -p ~/.claude/skills && ln -s "$PWD/skill/video-tiktok" ~/.claude/skills/video-tiktok
cp .env.example .env          # isi GEMINI_API_KEY dan router LLM
cp -R brand.example brand     # lalu sesuaikan brand/brand.mjs dan brand/profile.md
```

Nyalakan dengan klik dua kali `Studio Konten.command` (macOS) atau `cd studio && npm start`, lalu buka http://localhost:4321.

Butuh Node.js 22.5+, Claude Code yang sudah login, dan key Gemini. Detailnya di [docs/instalasi.md](docs/instalasi.md).

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [Instalasi](docs/instalasi.md) | Kebutuhan, kunci API, langkah pasang, troubleshooting |
| [Cara pakai](docs/cara-pakai.md) | Alur kerja dan setiap halaman dashboard, perintah Terminal |
| [Arsitektur](docs/arsitektur.md) | Komponen, struktur folder, server dan API, database, siklus job, pipeline video |
| [Konfigurasi brand](docs/brand.md) | Membuat brand sendiri: karakter, suara, profil, logo, aturan |
| [Skill video-tiktok](skill/video-tiktok/SKILL.md) | Instruksi lengkap untuk Claude Code: gaya rumah, langkah kerja, aturan FYP, QA |

## Teknologi

Node.js, Express 5, SQLite (`node:sqlite`), React 19 + Vite; Remotion 4, React Three Fiber; Claude Code; Gemini TTS; DashScope Qwen-Image; router LLM OpenAI-compatible atau Anthropic API; Whisper (whisper.cpp) lokal.

## Lisensi

[MIT](LICENSE). Logo platform di `brandIcons.ts` berasal dari [Simple Icons](https://simpleicons.org) (CC0) dan tetap merek dagang pemiliknya. Efek suara rekaman Mixkit tidak ikut repo (lihat [instalasi](docs/instalasi.md#opsional)).
