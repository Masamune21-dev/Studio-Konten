# Konfigurasi brand

Semua yang khusus brand (nama, akun sosial, karakter, profil, logo, aturan tambahan) ada di satu folder. Kode Studio, skrip, dan skill tidak menulis nama brand apa pun; semuanya dibaca dari sini.

| Folder | Isi |
|---|---|
| `brand.example/` | Brand contoh fiktif **CONTOH FIBER** yang ikut repo |
| `brand/` | Brand kamu sendiri. **Tidak ikut git.** Kalau ada, dipakai menggantikan `brand.example/` |

Mulai dengan menyalin contoh:

```bash
cp -R brand.example brand
```

Setelah mengubah `brand/`, mulai ulang server Studio.

## Isi folder

```
brand/
├── brand.mjs          konfigurasi utama (wajib)
├── profile.md         profil brand awal (fakta untuk AI)
├── skill.md           aturan khusus brand untuk skill video-tiktok
├── template/          (opsional) file yang menimpa template setiap proyek baru
└── public-pages/      (opsional) salinan halaman TikTok milikmu yang sudah diisi
```

## `brand.mjs`

Modul JavaScript yang mengekspor satu objek (`export default { … }`).

| Kolom | Contoh | Dipakai untuk |
|---|---|---|
| `name` | `"CONTOH FIBER"` | Nama brand di prompt, label sampul, dashboard |
| `account` | `"akun TikTok CONTOH FIBER, penyedia internet fiber lokal"` | Kalimat pembuka prompt ide ("Kamu content strategist …") |
| `product` | `"internet rumah"` | Ide di luar pilar brand tidak dipaksa nyambung ke produk ini |
| `pillar` | `{ name, hint }` | Pilar konten khusus brand (satu-satunya pilar promosi) |
| `social` | `{ tiktok: "akun", instagram: "akun" }` | Ajakan follow, halaman Komentar (akun TikTok pemilik komentar); tanpa `@` |
| `outfit` | `"seragam CONTOH FIBER"` | Catatan gambar karakter dan teks dashboard |
| `image.negative` | `"brand logos other than CONTOH FIBER"` | Tambahan negative prompt gambar karakter |
| `characters` | lihat di bawah | Karakter anime host video |
| `hostRules` | `"Pembagian peran host: …"` | Siapa membawakan topik apa (prompt ide dan job video) |
| `voices` | `"Setiap karakter yang bicara punya suara sendiri: …"` | Suara Gemini TTS per karakter (prompt job video) |
| `hosts` | `{ explain, ask, remind }` | Karakter di galeri sampul (yang menjelaskan, bertanya, mengingatkan) |
| `legacyTtsUrl` | `""` | Server TTS lama untuk `engine` selain `gemini` (atau `TTS_API_URL` di `.env`) |

### Karakter

Kunci karakter (mis. `bayu`) dipakai di nama file gambar `public/img/<kunci>-<pose>.png`, di `voices` naskah (`"who": "bayu"`), dan di pemeriksaan wajah/crop. Pakai huruf kecil tanpa spasi.

```js
characters: {
  bayu: {
    name: "Bayu",                    // nama yang tampil dan diucapkan
    role: "teknisi lapangan",        // peran singkat (masuk ke prompt)
    hint: "Laki-laki · teknisi",     // label di halaman Media
    en: "a cheerful young Indonesian man, … wearing … uniform",  // tampilan, bahasa Inggris
    legs: "khaki work trousers, brown work boots",                // untuk gambar seluruh badan
    waist: "khaki work trousers",                                 // untuk gambar setengah badan
    work: "holding a cable reel and a tester",                    // pose "Sedang kerja"
  },
}
```

Tips: beri setiap karakter satu ciri siluet yang jelas (topi, kacamata, warna baju) supaya mudah dibedakan di scene ramai. Gambar karakter dibuat dari **Media › Gambar anime › Karakter**, lalu **Mulut bicara** untuk animasi bicara.

## `profile.md`

Isi awal **Pengaturan › Profil brand** untuk database baru. Setelah itu yang dipakai adalah isi di Pengaturan (bisa diedit dari dashboard). AI hanya boleh memakai fakta yang tertulis di profil.

Profil dibagi bagian dengan judul `=== NAMA ===`. Beberapa bagian dipakai terpisah oleh kode, jadi pertahankan namanya:

| Bagian | Dipakai saat |
|---|---|
| `=== IDENTITAS ===` | Semua ide dan video (siapa brand ini) |
| `=== NADA & GAYA ===` | Ide di luar pilar brand (gaya bahasa akun) |
| `=== KANAL RESMI ===` | Ajakan follow di Edit video dan video non-promosi |
| `=== ATURAN WAJIB ===` | Video non-promosi yang menyebut brand |

Bagian lain (paket, harga, cara daftar, pembayaran, wilayah, sudut cerita, …) bebas; seluruh profil dikirim untuk ide dan video pilar brand.

## `skill.md`

Aturan tambahan untuk Claude Code saat membuat video: catatan karakter, suara yang sudah dipilih, akun resmi, hal yang pernah dikoreksi, larangan khusus. `SKILL.md` menyuruh agen membaca file ini sebelum mulai, dan isinya menang kalau bertentangan dengan aturan umum.

## `template/` (opsional)

File di sini disalin ke setiap proyek baru, menimpa file template dengan path yang sama (`scripts/new-project.mjs`). Yang biasanya diisi:

| File | Isi |
|---|---|
| `public/img/logo.webp` | Logo brand (dipakai kartu logo di scene promo) |
| `src/components/logoGlyphs.ts` | Garis logo dalam bentuk vektor untuk label seri sampul. Tanpa file ini label memakai nama brand sebagai teks. Ekspor yang dibutuhkan: `BASE` (garis dasar huruf, piksel gambar logo lebar 600) dan `GLYPHS: { id, outer, holes }[]` |
| `src/components/cover-modes.json` | Mode sampul: warna, label seri, pilar per mode (nama mode `promo` biasanya diganti nama brand) |
| `pronunciation.json` | Ejaan TTS per suara (mis. nama brand, singkatan) |
| `src/script.json` | Contoh naskah promo brand (dibaca agen sebagai contoh gaya) |
| `public/img/…` | Foto lain yang sering dipakai (kantor, produk) |

Proyek yang sudah dibuat tidak berubah; file brand hanya berlaku untuk proyek baru.

## `public-pages/` (opsional)

Aplikasi TikTok membutuhkan halaman Ketentuan, Privasi, dan callback login di domain https. Templatenya ada di `studio/public-pages/` (isi placeholder `[NAMA BRAND]`, `[NAMA PERUSAHAAN]`, `domainkamu.com`); simpan versi yang sudah diisi (dan file verifikasi domain dari TikTok) di sini, lalu unggah ke domainmu.
