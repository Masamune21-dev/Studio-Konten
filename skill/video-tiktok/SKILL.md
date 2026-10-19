---
name: video-tiktok
description: Bikin video TikTok/Reels/Shorts vertikal (9:16) dari nol sampai MP4 jadi — riset topik, naskah santai, storyboard, voice over Gemini TTS (suara Puck), visual motion graphics dari kode (termasuk adegan 3D Three.js), subtitle per kata, render Remotion, plus versi YouTube landscape (16:9) dari video yang sudah jadi tanpa membuat suara baru. Gunakan skill ini setiap kali user minta "buatkan video", "video TikTok/Reels/Shorts tentang X", video promosi repo/produk/aplikasi, video explainer, "versi YouTube/landscape" dari video yang ada, atau mau revisi video yang dibuat dengan alur ini (ganti suara, naskah, pengucapan, subtitle, scene) — walaupun user tidak menyebut Remotion atau TTS. Juga untuk mengedit rekaman yang diupload user (job "Edit video" dari Studio, "editin video ini", potong, subtitle otomatis Whisper, judul, ikon sosmed/jaringan, ajakan follow) dan untuk ikon/SVG/grafik animasi di video. Bukan untuk video generatif AI (Sora/Veo).
---

# Video TikTok (Remotion + Gemini TTS)

Alur ini disusun bersama pemilik akun setelah banyak iterasi. Hasilnya video vertikal 1080×1920, 60 fps, ±60–80 detik, dengan narasi santai, visual motion graphics, dan subtitle per kata. Balas user dalam Bahasa Indonesia santai, dan kerjakan semuanya sendiri — user ingin tinggal menerima video jadi lalu memberi revisi.

**`<ROOT>`** = folder repo Studio Konten (dua folder di atas skill ini: `<ROOT>/skill/video-tiktok`); job dari Studio menyebut path lengkapnya. **Brand:** semua yang khusus brand (nama, karakter dan perannya, suara, akun sosial, logo, profil) ada di `<ROOT>/brand/`, atau `<ROOT>/brand.example/` kalau folder itu belum ada. **Baca `brand/skill.md` sebelum mulai**: aturan dan catatan khusus brand di sana menambah (dan kalau bertentangan, menang atas) aturan umum di file ini.

## Gaya rumah (sudah dipilih user — jangan diubah tanpa diminta)

| Aspek | Pilihan |
|---|---|
| Suara | Gemini TTS, voice **Puck**, style `santai dan semangat, seperti kreator TikTok Indonesia yang ngobrol sama temannya`. Kalau ada dua karakter, suaranya **harus gantian sesuai yang bicara**, memakai suara per karakter dari brand (`voices` di `brand/brand.mjs`, juga tertulis di prompt job). Karakter yang belum punya suara pilihan memakai suara lain yang jelas beda dan disebut di notes supaya user bisa menggantinya — lihat "Dialog dua suara" |
| Naskah | Gaya ngobrol santai: "nah", "deh", "...", tanda seru; naskah formal terdengar kaku. **Jangan buka video dengan "Bro"** (user bosan, 2026-10-06) dan jangan meniru pembuka video sebelumnya: variasikan hook (pertanyaan langsung ke "kamu", fakta/angka mengejutkan, situasi sehari-hari, layar/notifikasi yang dikenal, kalimat salah satu karakter). "Bro" boleh sesekali di tengah, bukan kebiasaan. |
| Pengucapan | Istilah teknis dieja lewat `pronunciation.json` (mis. ONU → `onu`, supaya diucapkan satu kata, bukan O-N-U) |
| Subtitle | Poppins ExtraBold 58px, putih, kata yang sedang diucapkan diberi kotak biru `#0ea5e9`. URL/kata >22 huruf yang berisi "/" otomatis dipecah dua supaya tidak keluar layar |
| Visual | **Tipografis, satu identitas** (6 Okt 2026: latar berganti per scene supaya tidak monoton gelap; 19 Okt 2026: satu palet brand + tiga font untuk semua video, karena palet/font yang diacak per video membuat grid profil "kaya ngga konsisten"): tiap scene punya latar warna sendiri **dari palet brand** (`design.ts` → `THEMES`: cream, cobalt, sun, night, white, coral, mint), transisi bervariasi yang halus + gerak kamera secukupnya (langkah 6c dan 6e), judul raksasa + aksen + label, marquee, teks outline raksasa, tekstur grain. **Scene pertama = sampul** dengan kerangka tetap (lihat "Sampul & tampilan") |
| Karakter | **Anime PNG** dari Studio Konten (Media → Gambar anime), satu set per karakter brand (`characters` di `brand/brand.mjs`), dengan 3 frame mulut untuk bicara (`components/Anime.tsx`). Kartun SVG `Character.tsx` hanya cadangan |
| Ikon | **Emoji tetap dilarang**, dan ikon garis polos/stok tidak boleh jadi visual utama (user 6 Okt: "masih kelihatan icon AI"). Sejak 16 Okt 2026 user minta aset ikon sosmed, ikon jaringan, dan SVG yang bagus: ikon **Lucide** boleh, tapi selalu dalam gaya rumah lewat `IconTile` (ubin 2.5D warna tema + tergambar) atau di dalam grafik SVG, sebagai pendukung teks/ilustrasi; logo platform (**Simple Icons**) hanya untuk menyebut platform atau ajakan follow. Objek utama tetap ilustrasi buatan sendiri (`Props.tsx`, anime, 3D). Lihat "Ikon & SVG". Panah/centang dari font (→ ✓) boleh. |

Kenapa ini penting: user sudah menolak suara Edge TTS (Ardi kaku, Andrew/Brian beraksen), naskah formal, gaya subtitle lain, dan visual yang monoton gelap. Mengulang pilihan lama membuang kuota dan kesabaran user.

## Aturan FYP (sejak 7 Okt 2026)

Video yang sudah jadi tidak masuk FYP. Saat dicek: semuanya 63–78 detik, kalimat pembuka butuh 4–8 detik sebelum masuk ke inti, **frame pertama hampir kosong** (latar polos, teks dan karakter baru masuk setelah ±0,7 detik), penutupnya ajakan daftar/WA, dan sebagian besar video membahas layanan brand yang hanya relevan untuk pelanggan lokal. FYP menilai berapa lama orang menonton (dibanding durasi), tonton ulang, share, save, dan komentar; jumlah follower bukan faktor. Maka:
- **Frame 0 sudah penuh**: teks hook dan visual utama (karakter/objek) sudah terlihat di frame pertama. Animasi boleh bergerak, tapi jangan masuk dari layar kosong. Cek still `--frame=0` scene pertama.
- **Sampul konsisten, isinya berganti** (19 Okt 2026, menggantikan aturan 16 Okt). 16 Okt user bilang "perasaan templatenya sama semua" (#39/#40 sama-sama kartu komentar + dua kartu angka gelap), lalu pembuka dibuat beda-beda total: tata letak, sisi dan ukuran karakter, palet, font. 19 Okt user melihat grid profil dan bilang "desain kita kok jelek ya, kaya ngga konsisten". Jadi sekarang kerangka sampul **tetap** (label seri, posisi dan font judul, host kanan bawah dengan tinggi sama, palet brand; bagian "Sampul & tampilan"), dan yang berganti adalah **zona visual di tengah**: layar aplikasi/game/HUD, angka raksasa, HP/voucher/router, kartu OTP/notifikasi, objek 3D, kartu komentar, plus pose dan ekspresi host. Sebelum menyusun s01, lihat still frame 0 tiga video terakhir (`out/qa/f0.jpg` di proyeknya; prompt job menyebut path-nya) dan pakai jenis visual yang berbeda dari ketiganya. Balasan komentar menampilkan komentarnya lewat `CoverComment`.
- **Hook ≤2 detik**, langsung menyebut masalah atau janji ("Lupa password WiFi? HP kamu nyimpen."). Hindari pembuka lambat ("Pernah nggak…", "Siapa sih…", "Tengah malam begini…") dan jeda "..." panjang di scene pertama.
- **Durasi = target dari job** (pilihan user di modal Buat video: 20/30/45/60/90 detik, bawaan 60 sejak 9 Okt 2026, atau **Bebas**). Ada target: penuhi dengan isi, yaitu lebih banyak poin, contoh, atau scene, bukan dengan memperlambat suara. **Bebas** (tanpa target, sejak 18 Okt 2026; user: "bisa lebih dari 60 detik"): panjang mengikuti isi dan boleh lebih dari 60 detik. Jangan membuang poin penting atau memadatkan naskah supaya muat 60 detik, tapi jangan juga memanjangkan dengan scene kosong atau pengulangan. QA hanya mencatat durasinya (⚠ baru di atas 3 menit, batas YouTube Shorts). Satu payoff jelas, tanpa scene "perkenalan" yang tidak perlu.
- **Tempo bicara wajar: ±2–2,4 kata per detik**, seperti video lama yang disetujui user (1,8–2,4). Koreksi user 9 Okt 2026: video firewall 3,2 kata/dtk (27,9 dtk) "jadi kaya ngomong cepet". Jangan menulis "cepat"/"tempo cepat"/"bertempo cepat" di `style` suara, jangan memakai `tighten` dengan `tempo` > 1, dan jangan memadatkan naskah supaya muat di durasi pendek. `npm run qa` memberi ⚠ di atas 2,5 dan ✗ di atas 2,7 kata/dtk.
- **Pemicu interaksi**: alasan untuk simpan ("simpan, pasti kepake"), kirim ke teman ("kirim ke grup keluarga"), atau komentar (pertanyaan, kuis, "nomor berapa yang kamu banget?"). Satu cukup, taruh di akhir.
- **Penutup tanpa iklan**: punchline, pemicu komentar, atau kembali ke kalimat pembuka (loop). Logo kecil boleh; ajakan daftar/WA/website hanya untuk pilar brand, maksimal ±2 detik.
- **Kata kunci** topik diucapkan dan tertulis di layar (transkrip otomatis dan teks layar dipakai TikTok untuk pencarian dan relevansi).
- Musik: video tidak punya musik latar (tidak ada aset berlisensi). Sarankan user menambahkan sound yang sedang ramai dengan volume kecil di aplikasi TikTok saat posting (mode draf). **Efek suara** (klik, ketik, tap, whoosh, pop, notif…) sudah ikut di dalam video sejak 10 Okt 2026, lihat langkah 6b.

## Langkah kerja

### 1. Siapkan proyek
```bash
SLUG=nama-topik   # kebab-case
node <ROOT>/scripts/new-project.mjs $SLUG   # salin template + file brand (brand/template/) + src/brand.ts
cd <ROOT>/$SLUG
```
Efek suara (`public/sfx/*.wav`) tidak masuk git; `remotion.config.ts` membuatnya otomatis saat render/still pertama kalau belum ada (atau jalankan `npm run sfx`).

**Jangan `npm install` di folder proyek.** Semua proyek memakai satu `node_modules` bersama di `<ROOT>/` (Remotion, React, TypeScript, plus Chrome headless di `node_modules/.remotion`); Node, `npx`, dan `npm run` menemukannya dengan naik ke folder induk. `remotion.config.ts` di template mengarahkan Remotion ke Chrome bersama dan mematikan cache webpack, jadi tidak ada `node_modules` yang tumbuh di folder proyek. Butuh paket baru? Tambahkan di `<ROOT>/package.json` lalu `npm install` di sana. Kalau `node_modules` bersama belum ada (mis. setelah clone baru): `cd <ROOT> && npm install`.

**Skrip suara dan cek juga dipakai bersama** (sejak 7 Okt 2026): `<ROOT>/scripts/` (`generate-vo.mjs`, `generate-vo-gemini.mjs`, `gemini-tts.mjs`, `lexicon.mjs`, `check-vo.mjs`, `sample-gemini.mjs`, `check-crop.mjs`; sejak 19 Okt `fixcuts.mjs` dan `router-audio.mjs` (transkripsi 4 sekaligus + cache untuk `check` dan `fixcuts`); sejak 16 Okt juga `transcribe.mjs` dan `qa-edit.mjs` untuk Edit video). `npm run vo`/`check`/`check:crop` di proyek memanggil `../scripts/…` dengan folder proyek sebagai cwd, jadi proyek tidak punya salinan skrip itu. Skrip sekali pakai khusus satu proyek boleh ditaruh di `scripts/` proyek dan meng-import `../../scripts/gemini-tts.mjs` dst. **Mengubah skrip bersama berarti mengubah semua proyek**: perubahan harus kompatibel ke belakang (fitur baru lewat opsi di script.json, bukan mengubah perilaku bawaan), dan sebelum dipakai buktikan dengan salinan APFS (`cp -cR <proyek> _verify-<proyek>` di folder video): hash `public/vo/*.wav` + `src/vo-*.json` setelah `vo:reuse` harus sama sebelum dan sesudah perubahan di semua proyek, lalu hapus salinannya.

API key ada di `<ROOT>/.env` (dibaca otomatis lewat `../.env`): `GEMINI_API_KEY`, `ROUTER_BASE_URL`, `ROUTER_API_KEY`. Jangan tulis ulang atau tampilkan isinya di chat.

### 2. Riset dan aset
Pahami topiknya dulu (README repo, situs produk, dokumen dari user). Kumpulkan gambar asli (screenshot repo/produk) ke `public/img/` — screenshot sungguhan jauh lebih meyakinkan daripada ilustrasi. Catat ukuran tiap gambar; `PanShot` butuh `imgW`/`imgH` yang benar (lihat `IMG_SIZE` di `src/scenes.tsx`). Lihat gambarnya dengan Read untuk memilih titik zoom yang menarik (angka, grafik), bukan area kosong; beda `zoom` antar titik `pan` cukup ±1,1–1,25× (langkah 6e).

### 3. Naskah + storyboard → `src/script.json`
Contoh gaya terbaru: `references/example-script-brand.json` (promo brand contoh). Contoh lama bergaya gelap dengan screenshot: `references/example-script.json`. Strukturnya:
- `brand`, `engine: "gemini"`, `voice: "Puck"`, `style`
- `scenes[]`: `id` (s01…), `kind`, `theme` (kunci `THEMES`; jangan pakai warna yang sama dua scene berturut-turut), `onscreen` (teks besar di layar), `vo` (narasi = subtitle), plus field per jenis (`places`, `nodes`, `apps`, `stats`, `chips`, `cta`, `image`)

Alur yang terbukti nyambung untuk video promosi/brand: **hook masalah** (s01) → **perkenalan** → 5–7 **fitur**, masing-masing satu scene dengan satu visual → **cara mulai** → **CTA**. Tiap narasi 1–2 kalimat (±4–8 detik). Jumlah scene mengikuti target durasi (±60 detik ≈ 8–10 scene; durasi Bebas: sebanyak poin yang memang perlu); setiap scene tetap punya isi, jangan menambah scene kosong demi durasi. Setiap scene harus punya satu pesan, dan visualnya menunjukkan pesan itu.

**Konten edukasi umum (bukan promosi).** Sejak 7 Okt 2026 sebagian besar ide berasal dari pilar umum (Setting & tips perangkat, AI & tools, Dunia teknologi, Keamanan digital, Produktivitas & life hack, Edukasi internet); hanya pilar brand yang promosi. User ingin akun ini terasa sebagai akun teknologi yang berguna, bukan iklan. Kalau prompt job menyebut pilar umum atau topiknya bukan layanan brand:
- Jangan membahas paket, harga, cara daftar, atau keunggulan brand, dan jangan memaksa topiknya nyambung ke produk brand. Karakter tetap jadi host, sesuai pembagian perannya (`hostRules` di `brand/brand.mjs`, juga tertulis di prompt job; aturan tambahan di `brand/skill.md`). Penutupnya cukup ajakan follow/save/share (logo kecil boleh).
- Alur yang cocok: hook (masalah atau fakta mengejutkan) → konteks singkat → langkah/penjelasan (satu visual per langkah) → rangkuman satu kalimat → ajakan follow/save. Ikuti bentuk idenya (tutorial, mitos-fakta, perbandingan, sketsa…), jangan pakai alur promosi "perkenalan → fitur → cara daftar".
- Fakta harus akurat. Fitur aplikasi/AI, menu pengaturan, versi OS, dan berita cepat berubah: riset dulu di web (WebSearch/WebFetch), utamakan sumber resmi, cek tanggalnya, tulis sumbernya di `notes`. Ide bertanda "perlu riset" wajib dicek. Jangan mengarang angka statistik.
- Tampilan aplikasi atau menu pengaturan digambar sebagai mockup sederhana bertanda "ilustrasi tampilan"; nama menu ditulis sesuai sumber, tanpa menyalin logo resmi aplikasi lain. Kalau langkah berbeda antar merek/versi, sebutkan ("di sebagian HP namanya …").

Jenis scene **`cover`** (sampul siap pakai dari `components/Cover.tsx`, field `judul`/`angka`/`ekor`/`komentar`/`chips`/`host`) ada di semua pustaka scene: `Video.tsx` memakainya kalau `SCENES` proyek tidak punya `cover`. Jenis scene di template `src/scenes.tsx` (gaya baru): `hook` (tiga baris teks muncul dari balik garis + karakter bingung), `intro` (dua kata raksasa masuk dari kiri/kanan + logo + dua karakter melambai), `coverage` (daftar tempat bertumpuk geser + pin + polaroid foto + marquee miring), `backbone` (teks ala terminal mengetik + node dan garis data berdenyut), `ecosystem` (bento grid ubin warna-warni), `team` (dua kata raksasa + dua karakter yang bergantian bicara), `stats` (angka raksasa menghitung + garis bawah), `offer` (harga raksasa + chip bergantian + karakter bersorak), `cta` (logo + tagline serif + tiga karakter + tombol). Untuk video **edukasi/tips/cerita lapangan** ada pustaka scene kedua: salin `references/scenes-edu.tsx` jadi `src/scenes.tsx` **dan** `references/scenesMore.tsx` jadi `src/scenesMore.tsx` (keduanya memakai `components/Type.tsx`, `Props.tsx`, `PropsExtra.tsx`). Isinya: `poleHook` (tiang + kotak ODP), `acronym` (singkatan raksasa → kepanjangan), `splitter` (1 kabel → banyak rumah), `chain` (jalur bertahap dengan garis berdenyut), `odpMap` (peta ODP, satu jadi merah + kartu alarm), `warning`, `modemHook` / `modemLights` (modem dengan lampu POWER/PON/LOS), `cards`, `compare`, `checklist`, `cta2` (follow/save/share + WA opsional, `cast` untuk memilih karakter); dari scenesMore: `cabinetHook`, `mythFact` (MITOS dicoret per baris → kartu FAKTA + ilustrasi), `bands` (2,4 vs 5 GHz), `devices` (bandwidth dibagi + panduan paket), `clockHook` (jam 02:14 + notifikasi alarm), `nocAlert` (panel ONU berubah LOS), `route` (rute kantor → titik putus), `splice` (mesin splicer menyambung), `meter` (power meter → Aman), `lightsBack` (rumah menyala satu per satu). Blok bangunan ada di `components/Kinetic.tsx`: `Reveal`, `Marquee`, `Outline`, `Chip`, `Kicker` (nomor + garis + label editorial), `Backdrop` (warna + grain). Konten di dalamnya masih dari video contoh — **sesuaikan dengan topik baru**, dan buat jenis scene baru kalau perlu. Untuk topik software/repo, `components/ui.tsx` masih menyediakan `PanShot` (screenshot pan/zoom); bungkus dengan `Backdrop` supaya ikut gaya baru.

**Karakter anime (utamakan ini):** PNG transparan karakter brand ada di `<ROOT>/media/*-ai-*.png` (dibuat dari Studio Konten → Media → Gambar anime; isi/pose ada di nama file dan catatan media). Pose yang punya tombol "Mulut bicara" juga punya `<nama>-mulut-closed.png`, `-mulut-mid.png`, `-mulut-open.png`: gambar identik kecuali mulutnya. Cara pakai:
- Salin ke `public/img/` dengan nama `<who>-<pose>.png` (who = kunci karakter di `src/brand.ts`, mis. `sari-hp.png`) dan frame mulutnya `sari-hp-mulut-closed.png` dst.
- Pakai `Anime` dari `components/Anime.tsx`: `<Anime scene duration poses={[{ at: 0, src: "sari-hp", mouths: true }]} height style from />`. Pembicara dibaca dari awalan nama file; komponen hanya menggerakkan (bergoyang pelan mengikuti keras frasa + ganti mulut ±10×/detik mengikuti suku kata) karakter yang sedang giliran bicara menurut `src/vo-turns.json`, yang lain cuma napas pelan. **Jangan** pakai `useTalk` untuk karakter yang tidak bicara — user langsung protes kalau karakter cewek ikut gerak saat suara cowok. Keras suara di `Anime` diukur RMS langsung dari WAV; **jangan** kembali ke `visualizeAudio` untuk gerak badan: ia hanya membaca ±1 md audio per frame, nilainya hampir acak, dan user menilai karakternya "geter" (13 Okt 2026).
- Pose ekspresif (mis. `kaget` dengan mulut "O"): beri `rest: "base"` di pose itu (`{ at: 0, src: "raka-kaget", mouths: true, rest: "base" }`) supaya saat diam yang tampil gambar asli, bukan frame mulut tertutup yang tersenyum. Ini juga berlaku untuk pose `bingung`, `sedih`, `tertawa`, dan `kesal`: frame "tutup" semuanya senyum tipis, jadi tanpa `rest: "base"` wajah bingung/sedih berubah jadi tersenyum setiap jeda bicara. Pose tambahan sejak 8 Okt 2026 untuk konten umum: Menjelaskan, Mengingatkan (telunjuk ke atas, cocok untuk tips keamanan), Bingung, Tertawa, Percaya diri, Minta maaf; daftar pose ada di halaman Media Studio.
- Pose yang dibutuhkan belum ada? Buat lewat dashboard (mode Karakter / Variasi), lalu "Mulut bicara". Wajah kecil (seluruh badan) tetap bisa: generator mengedit area wajah yang diperbesar.
- Pastikan warna baju/rambut tidak sama dengan latar scene.
- **Karakter harus utuh di dalam frame** (diminta user 7 Okt 2026: karakter yang terpotong setengah di pinggir terlihat tidak estetik). Siku, ujung jari, atau ujung rambut yang lewat sedikit masih wajar; badan, wajah, atau kepala tidak boleh terpotong. Bagian bawah boleh terpotong karena pose setengah badan memang berdiri di tepi bawah. Hitung posisi dari **badan**, bukan dari kotak gambar: di pose `tunjuk` badan ada di satu sisi PNG dan lengan menjulur ke sisi lain, jadi `right: -120` pada pose menunjuk ke kiri membuang hampir seluruh badan dan yang tersisa cuma lengan. Offset negatif `left`/`right` sebaiknya tidak lebih dari ±40 px, dan pada pose `tunjuk` (sisi badan) ±10 px. Selalu buktikan dengan `npm run check:crop` (langkah 6).

**Dialog dua suara:** di `script.json` isi `voices` (`{"bayu": {"voice": "Puck", "style": "..."}, "sari": {"voice": "Leda", "style": "ramah, ceria dan santai, seperti CS cewek muda Indonesia..."}}`, kunci = kunci karakter brand), lalu tiap scene diberi `"who": "bayu"` atau `"sari"` sesuai karakter yang tampil. Scene dengan dua karakter yang gantian bicara pakai `"turns": [{"who": "bayu", "vo": "..."}, {"who": "sari", "vo": "..."}]` (isi `vo` = gabungan turns untuk subtitle/cek). Scene tanpa karakter boleh siapa saja, tapi buat alurnya seperti ngobrol (balasan Sari dibuka "Iya, ..." dsb.). `npm run vo` membuat **satu request per suara** lalu menulis `src/vo-turns.json`; subtitle otomatis per giliran. Contoh lengkap: `references/example-dialog-script.json` dan `references/example-dialog-scenes.tsx` (video "jam 8 malam": dialog dua karakter, karakter anime dengan frame mulut, ilustrasi `Scenery`).

**Ilustrasi pendukung anime:** supaya cocok dengan karakter, ganti ikon/vektor datar dengan ilustrasi anime dari Studio Konten → Media → mode Bebas (rumah malam, jalan tol, ruang server, NOC, ruang keluarga, orang main HP…), lalu tampilkan dengan `<Scenery src duration style />` (kartu sudut bulat + geser-zoom sangat pelan, 2→6%) dari `components/Anime.tsx` atau sebagai latar redup. Tetap tipografis: ilustrasi menemani teks besar, bukan menggantikannya. Cek gambar dulu — model kadang menggambar logo merek (mis. Apple di laptop); hapus lewat mode Variasi.

**Adegan 3D:** kalau brief menyebut "Adegan 3D" atau topiknya tentang bumi/satelit/sinyal/aliran data/benda yang lebih jelas kalau diputar, jadikan 1–2 scene inti adegan 3D dengan `components/ThreeKit.tsx` (lihat bagian "Adegan 3D" di bawah).

**Karakter animasi** (`src/components/Character.tsx`): `who` = `tech` (teknisi helm kuning + rompi oranye reflektif), `cs` (CS berhijab teal + headset), `user` (pelanggan kaos coral). Props: `mood` (happy/excited/sad/neutral/surprised/curious), `pose` (idle/wave/point/thumbs/phone/cheer/headset), `flip`, `width`, `seed` (supaya gerak idle tidak kembar), dan `talk={useTalk(scene.id)}` untuk lip-sync. Kalau dua karakter bicara bergantian dalam satu scene, bagi `talk` berdasarkan frame (lihat scene `team`). Cek desain dan pose cepat dengan `npx remotion still Sheet out/sheet.jpg --scale=0.6`. Pastikan warna pakaian/hijab tidak sama dengan latar scene (hijab biru hilang di latar cobalt — makanya teal).

Tunjukkan naskah ke user dalam tabel singkat sebelum membuat suara kalau topiknya sensitif atau ambigu; kalau jelas, langsung jalan.

### 4. Pengucapan
Cek `pronunciation.json` bagian `"Puck"`. Tambahkan istilah baru yang kemungkinan salah ucap (singkatan yang harus dibaca sebagai kata, merek). Subtitle tetap memakai ejaan asli; hanya teks ke TTS yang diganti. Kalau user bilang ada kata yang aneh, buat beberapa varian ejaan dan biarkan user memilih dengan telinganya — model transkripsi tidak bisa menilai lafal (ia "membetulkan" ejaan).

### Sampul & tampilan (sistem sampul, sejak 19 Okt 2026)
**Kenapa:** sampai 18 Okt tiap video mengacak palet (6 pilihan) dan set font (5 pilihan, total 12 font), dan pembukanya sengaja dibuat beda tata letak, sisi, dan ukuran karakter. Di grid profil TikTok hasilnya terlihat seperti belasan akun berbeda; user: "desain kita kok jelek ya, kaya ngga konsisten gitu". Sekarang identitasnya dikunci, isinya yang berganti. Proyek lama tetap memakai `design.ts`-nya sendiri; jangan ubah video lama kecuali diminta.

**Satu palet, tiga font.** `src/design.ts` hanya punya palet brand (navy `#0B1B3A`, kertas `#F3EFE6`, kobalt `#2B50FF`, biru brand `#1F4FD8`, cyan `#3BD5F5`, kuning `#FFD23F`, koral `#FF5A4D`) dan tiga font: `display` = Bricolage Grotesque 800 (judul, angka), `serif` = Instrument Serif miring (ekor pertanyaan, kata kedua), `label` = Space Grotesk (label, satuan, data); kode/OTP/IP pakai `mono` dari theme.ts. Jangan memuat font lain dan jangan membuat palet sendiri di scenes (konstanta `CYAN = "#22E4FF"` dsb.): pakai `K`, `THEMES`, `t.fg`, `t.accent`. Nama tema scene tetap (cream, cobalt, sun, night, white, coral, mint) dan boleh berganti antar scene; `cobalt`, `night`, `coral` = latar gelap/teks terang, sisanya latar terang/teks gelap. **Teks di atas latar wajib memakai `t.fg` / `t.accent`**, bukan warna K mentah; kartu putih/krem boleh memakai `K.ink`.

**Mode sampul** (`"look": { "mode": "…", "tag": "…" }` di script.json; daftar di `components/cover-modes.json`, sumber yang sama untuk design.ts, `npm run qa`, dan Studio):
| mode | latar sampul | aksen | dipakai untuk |
|---|---|---|---|
| `hitungan` | navy | cyan + kuning | angka vs angka: Mbps, GB, ping, baterai, harga (pilar Edukasi internet, Dunia teknologi; juga pilar lain kalau sampulnya perbandingan angka) |
| `tips` | kertas | kobalt + koral | setting HP/router, aplikasi, AI, life hack |
| `aman` | navy | koral + kuning | penipuan, password, OTP, privasi, hoaks |
| `promo` | biru brand | kuning + cyan | pilar brand (layanan, daftar, bayar, tim) |
`tag` = label seri setelah wordmark: `HITUNGAN`, `TIPS`, `AI`, `AMAN`, `BALAS KOMEN` (video balasan komentar), `INFO`, `TIM`. Job dari Studio sudah menentukan mode dan tag di prompt; mode "otomatis" boleh diganti ke `hitungan` kalau sampulnya perbandingan angka, pilihan user jangan diganti. `theme` s01 = tema mode (night / cream / cobalt).

**Scene pertama = sampul.** Frame 0 adalah gambar yang tampil di grid profil, dan grid memotongnya 3:4 (yang terlihat hanya y 240–1680 dari 1920) dengan angka views di kiri bawah. Kerangkanya tetap (`components/Cover.tsx`, galeri: `npx remotion still AsetSampul out/aset-sampul.png`):
1. **Label seri** kiri atas (x 72, y 288): wordmark brand (garis logo dari `components/logoGlyphs.ts` kalau brand punya, kalau tidak nama brand sebagai teks) + "· TAG" dalam warna mode. Otomatis dari `CoverFrame`.
2. **Judul** ≤ 5 kata mulai y 384, Bricolage 800 (128–190 px, bawaan 162), satu kata aksen (`<Acc>`), ekor pertanyaan serif miring (`<Tail>`), angka raksasa lewat `<Big unit="Mbps">433</Big>`. Judul membungkus sendiri; pakai `CoverStack` kalau visual harus mengikuti tinggi judul.
3. **Zona visual** (`CoverViz`, x 72, lebar ±540, sampai y 1500): satu-satunya bagian yang bebas: HP, voucher, router, kartu OTP, layar aplikasi, objek 3D, angka vs angka, `CoverComment` untuk balasan komentar. Teks di sini minimal ±40 px; jenisnya beda dari sampul tiga video terakhir.
4. **Host** (`CoverHost`) selalu kanan bawah, tinggi 840 px, sudah tampil di frame 0; ganti orang, pose, dan ekspresinya, bukan posisinya. Pose yang menunjuk ke kiri cocok; pose yang menunjuk ke kanan pakai `flip`.
5. **Kosongkan** pojok kiri bawah (x 0–400, y 1530–1680, angka views TikTok) dan 240 px teratas/terbawah (terpotong di grid). Tidak ada kartu komentar di paling atas lagi.

Cara cepat: `"kind": "cover"` dengan `judul` (`*kata*` = aksen, `~kata~` = aksen kedua), `angka`, `ekor`, `komentar` atau `chips`, dan `host`. Visual khusus: tulis scene sendiri dari `CoverFrame` + `CoverTitle`/`CoverStack` + `CoverViz` + `CoverHost`. Animasi s01 tetap boleh (kata kunci menyala saat diucapkan lewat `Highlight`, elemen visual bergerak, `sorot`), tapi kerangka di atas sudah lengkap di frame 0 dan masih sama di detik 1. Versi YouTube memakai komponen yang sama; di 16:9 tata letaknya otomatis (judul kiri, host kanan).

Wajib cek still semua scene, dan frame 0 dengan `npx remotion still Video out/f0.png --frame=0 --scale=0.35`; `npm run qa` memeriksa "Sampul konsisten" dan "Font & warna brand" (langkah 7b).

### 5. Voice over (1 request per suara)
```bash
npm run vo                     # gemini-3.8-flash-tts, 1 request per suara (semua kalimat suara itu sekaligus)
npm run vo -- --only=sari     # rekam ulang satu suara saja (mis. setelah ganti voice Sari)
GEMINI_TTS_MODEL=gemini-3.8-flash-lite-tts npm run vo   # kalau kuota Flash habis
npm run vo:reuse               # potong ulang out/vo-full.wav tanpa memakai kuota
npm run check                  # transkripsi tiap scene lewat router (4 sekaligus; scene yang audionya tidak berubah diambil dari cache out/check-vo.json, --fresh = tanya ulang)
```
Opsi di `script.json` untuk suara yang bandel (semuanya berlaku juga saat `vo:reuse`, jadi tidak perlu kuota baru):
- **`say` per scene/turn**: teks yang dibacakan TTS kalau beda dengan subtitle `vo` dan kamus `pronunciation.json` tidak cukup (kamus tidak peka huruf besar/kecil, jadi "Mbps" dan "MBps" tidak bisa dibedakan di sana).
- **`voices.<who>.cuts`**: `[detik, …]` perkiraan awal tiap jeda antar-kalimat (satu per batas), dipasangkan ke jeda terdekat. Pakai kalau pemotong otomatis memilih jeda di tengah kalimat (`npm run check` menunjukkan kalimat pindah scene). Lihat waktu jedanya dari take penuh di `out/vo-full-<who>.wav`. Proyek lama memakai bentuk `"cuts": {"<who>": [detik pasti, …]}` di tingkat atas; keduanya masih didukung.
- **`voices.<who>.tighten`**: `true` (= `{"pause": 0.35, "tempo": 1}`) hanya memendekkan hening panjang di dalam kalimat ke 0,35 dtk, tanpa mempercepat. Pakai untuk suara yang berjeda panjang (mis. **Charon**). Sampai 9 Okt 2026 bawaannya `pause 0.22, tempo 1.07` dan beberapa video memakai tempo 1.08–1.12; gabungan itu (plus style "tempo cepat") membuat narasi terlalu cepat, jadi `tempo` > 1 jangan dipakai lagi. Pengganti `tighten.py` lama; waktu giliran dialog ikut benar.

Kuota gratis Gemini TTS hanya ±10 request/hari **per model** (reset tengah malam waktu Pasifik ≈ 14.00/15.00 WIB). Setiap request dicatat `../scripts/gemini-tts.mjs` (skrip bersama) ke `<ROOT>/studio/data/tts-usage.jsonl`, dan dashboard Studio Konten menampilkan sisa kuotanya di Pengaturan (ringkasnya di modal Buat video). Ada key cadangan `GEMINI_API_KEY_2` di `.env` (project Google lain = kuota sendiri): skrip otomatis pindah ke key berikutnya kalau satu key ditolak "per day"; kalau prompt job bilang model utama habis, pakai `GEMINI_TTS_MODEL=gemini-3.8-flash-lite-tts`. Karena kuota itu, makanya seluruh narasi dibuat sekali lalu dipotong di jeda antar-scene. Skrip menolak hasil yang terpotong (model kadang berhenti di tengah) tanpa merusak file lama. Kalau `npm run check` menunjukkan kalimat penutup pendek ("Keren, kan?") pindah ke scene berikutnya, itu tanda potongan salah — jalankan `vo:reuse` setelah memperbaiki, bukan generate ulang. Router `ag/gemini-3.8-flash` kadang kena batas; beri jeda lalu ulangi.

### 6. Visual dan pengecekan frame
Sesuaikan `src/scenes.tsx` dengan topik. Zona aman layar (1080×1920):
- kicker: y ±200 · teks besar/visual: y 250–1400 · subtitle: y ≥ 1430 · sisakan bawah ±300px dan kanan ±150px untuk UI TikTok

Render still **frame 0** (harus sudah penuh, lihat Aturan FYP) dan satu still per scene di ±75% durasinya, lalu **lihat gambarnya** sebelum render penuh — ini menangkap teks yang tumpang tindih, zoom ke area kosong, atau elemen yang terpotong:
```bash
npx remotion still Video out/stills/s01.jpg --frame=<n> --image-format=jpeg --scale=0.5
```
Hitung frame: tiap scene = 6 + ceil(durasi_vo × 30) + 12 frame (lihat `src/Video.tsx`). Shell-nya zsh: `for p in $VAR` TIDAK memecah per spasi — tulis daftar frame langsung di loop (`for p in s01:109 s02:294 ...`).

**Cek karakter terpotong (wajib sebelum render final):**
```bash
npm run check:crop              # versi TikTok
npm run check:crop -- --wide    # versi YouTube (VideoWide)
```
Skrip ini merender dua frame tiap scene, mengukur porsi piksel karakter (bagian PNG yang tidak transparan) yang keluar dari tepi kiri, kanan, atau atas, lalu menyimpan still di `out/crop/` (`out/crop-yt/` untuk versi YouTube). Batasnya dikalibrasi dengan user: ≤15% wajar, 15–30% "cukup terpotong" (lihat still-nya dan geser kalau mengganggu), >30% atau kepala terpotong = ✗ dan skrip keluar dengan kode 1. Video dengan potongan paling parah 27% dinilai normal, 36–62% "kelihatan banget". Setiap ✗ wajib diperbaiki (geser masuk, perkecil, atau pindah sisi), lalu jalankan lagi sampai lolos, dan lihat still-nya: karakter yang digeser masuk jangan sampai menutupi teks atau visual penting. Pengukuran ada di `components/CropCheck.tsx` (aktif hanya lewat input prop `checkCrop`) dan hanya mengenali gambar bernama `img/<kunci karakter>-*.png` (kunci dari `src/brand.ts`); karakter dengan nama lain tidak terukur, jadi tetap pakai pola nama itu.

Chrome headless sudah ada di `node_modules/.remotion` bersama; kalau Remotion mulai mengunduh Chrome atau muncul folder `node_modules` di proyek, berarti `remotion.config.ts` belum tersalin atau perintah tidak dijalankan dari folder proyek.

### 6b. Efek suara (SFX, sejak 10 Okt 2026)
User minta video punya suara aksi yang **bervariasi**: klik saat pointer mengklik, ketikan keyboard saat teks diketik, tap saat jari mengetuk HP, dan suara lain sesuai aksi di layar. Semua suara **disintesis dari kode** oleh `../scripts/sfx.mjs` (osilator + noise + filter, seed tetap): tidak ada unduhan, tidak ada lisensi, hasilnya selalu sama. 26 jenis, 2–12 varian per jenis, ke `public/sfx/<nama>-<i>.wav` + `src/sfx.json` (panjang tiap varian). Keras suaranya sudah ditakar terhadap narasi Gemini: ketikan ±15 dB di bawah suara, hentakan/lonceng ±7–10 dB di bawah. Video "Lupa Password WiFi" setelah diberi SFX tetap −14,2 LUFS / TP −1,9, sama dengan aslinya.

| Jenis (`s`) | Untuk | Jenis | Untuk |
|---|---|---|---|
| `click` (4) | pointer mouse mengklik | `tap` (4) | jari mengetuk layar HP |
| `key` (12), `space`, `enter` | keyboard laptop (dipilih otomatis per huruf) | `softkey` (6) | keyboard HP |
| `whoosh` (6) | ganti scene (otomatis), benda besar melintas | `swipe` (4) | kartu/panel geser masuk |
| `pop` (6) | elemen muncul (chip, kartu, ikon) | `blip` (4) | muncul ringan / naik, centang kecil |
| `tick` (4) | angka menghitung, jam | `ding` (4) | poin penting, jawaban |
| `notif` (4) | notifikasi HP | `success` (3) | berhasil, tersambung, lunas |
| `error` (3) | salah, ditolak, gagal | `alarm` (2) | alarm NOC, LOS, peringatan |
| `thud` (3) | angka/kata raksasa menghentak | `riser` (2) | menuju momen (pakai `end`) |
| `shutter` (2) | foto, screenshot | `switch` (3) | sakelar/toggle setelan |
| `send` / `receive` (3) | pesan terkirim / masuk | `glitch` (3) | diretas, data rusak, penipuan |
| `scribble` (3) | coretan spidol (MITOS dicoret) | `sparkle` (3) | AI, fitur baru, "ajaib" |
| `buzz` (2) | HP bergetar | | |

**Suara rekaman berlisensi (sejak 16 Okt 2026, diminta user: "yang bagus, umum dipakai, gratis").** 18 jenis dari Mixkit (*Sound Effects Free License*: gratis untuk komersial termasuk TikTok/YouTube, tanpa wajib kredit, file tidak boleh dibagikan ulang mentah). File asli di `<ROOT>/media/sfx-mixkit/` (README berisi judul, ID, lisensi). `sfx.mjs` (tabel `RECORDED`) memotong hening dan menyamakan levelnya dengan suara sintetis (300 ms terkeras −22 … −30 dBFS, 4–13 dB di bawah narasi). Masing-masing satu varian; pakai seperti suara lain (`<Sfx s="boom" />`, `"sfx": [{ "s": "laugh", "kata": … }]`). Dengarkan semuanya di `uji-sfx-mixkit/out/galeri-rekaman.mp4`.

| Jenis (`s`) | Untuk | Jenis | Untuk |
|---|---|---|---|
| `boom` | bas dalam: kaget, reveal besar | `impact` | whoosh + boom sinematik (1,8 dtk) |
| `scratch` | goresan piringan hitam: "tunggu dulu…" | `trombone` | terompet sedih: gagal, tebakan salah |
| `wrong` | buzzer salah jawab (kuis) | `correct` | bel jawaban benar (kuis) |
| `laugh` | tawa penonton (4 dtk) | `applause` | tepuk tangan singkat (4 dtk) |
| `crickets` | jangkrik: hening canggung (4 dtk) | `drumroll` | drum roll sebelum jawaban (5,2 dtk, pakai `end`) |
| `rimshot` | "ba-dum-tss" habis lelucon | `boing` | pantulan kartun |
| `fall` | siulan jatuh: angka/kecepatan anjlok | `coins` | uang, hemat, harga |
| `honk` | klakson badut: salah konyol | `suspense` | sengat suspense kartun |
| `bell` | bel resepsionis "ting!" | `dizzy` | pusing, burung berputar |

Suara rekaman lebih "berwarna" dari suara sintetis, jadi **paling banyak 1–3 per video**, di momen lucu/kuis/kaget, dan sesuai nada topiknya: jangan tawa, badut, atau trombon di topik penipuan/keamanan atau gangguan pelanggan. `laugh`/`applause`/`crickets`/`drumroll` panjang: taruh di jeda narasi, jangan di bawah kalimat penting.

Cara pakai (`components/Sfx.tsx`; frame = frame scene, sama dengan `useCurrentFrame()` di komponen scene):
- **Otomatis:** `Video.tsx` memutar suara transisi di setiap pergantian scene (whoosh/swipe/glitch/hentakan sesuai jenis transisinya, langkah 6c). Pustaka scene sudah bersuara: template `backbone` (ketikan), `ecosystem` (pop per ubin), `stats` (tik saat angka menghitung), `offer` (hentakan harga + pop chip); `scenes-edu` `odpMap` (alarm), `cards` (swipe), `checklist` (pop); `scenesMore` `mythFact` (coretan + swipe), `clockHook` (getar + notif), `nocAlert` (alarm), `meter` (berhasil), `lightsBack` (blip tiap rumah menyala).
- **Satu aksi:** `<Sfx s="pop" at={f} />` di frame yang sama dengan animasinya (kartu mulai muncul, tombol ditekan). `end={f}` membuat suara selesai tepat di frame itu (untuk `riser`). `volume` 0–1 (bawaan 1, sudah ditakar).
- **Ketikan:** `const t = useTyping("daftar.contohfiber.example", a, b)` lalu tampilkan `{t.text}` dan taruh `{t.sfx}` di scene. Satu suara per huruf, spasi = `space`, `\n` = `enter`; untuk HP `useTyping(text, a, b, { s: "softkey" })`. Animasi ketik yang sudah ada dengan rumus sendiri: `<SfxTrain count={(x) => jumlahHurufDiFrame(x)} from={a} to={b} text={teks} />` memakai rumus yang sama, jadi suara pasti sinkron. Langkah yang terlalu rapat (<2 frame) digabung supaya tidak jadi dengung; `SfxTrain s="tick"` untuk penghitung angka.
- **Pointer/jari:** `<Pointer keys={[{ at, x, y }, { at, x, y, click: true }, …]} />` (mouse) atau `touch` (jari HP). Pointer tiba di target tepat di frame `at`, lalu menekan (mengecil + riak) dengan `click`/`tap`. **x/y wajib dihitung dari konstanta tata letak yang sama dengan yang menggambar targetnya** dan dicek dengan still tepat di setiap frame klik (lihat "Hal yang sudah dicoba dan gagal": seri MikroTik dihapus karena pointer meleset). Mockup yang punya jari/kursor sendiri: cukup tambahkan `<Sfx s="tap" at={t.at} />` di frame tekannya.
- **Dari script.json** (berlaku otomatis untuk versi TikTok dan YouTube): `"sfx": [{ "s": "ding", "kata": "gratis" }, { "s": "pop", "t": 1.2 }]` per scene. `kata` = saat subtitle menyorot kata itu (kemunculan pertama; `"ke": 2` untuk yang kedua); `t` = detik sejak narasi mulai (bisa ditambahkan ke `kata` sebagai geseran); `v` = volume. Kata yang tidak ada di narasi menghentikan render, jadi salah ketik langsung ketahuan.
- **Pengaturan per video** di script.json: `"sfx": false` (mati semua), `{ "volume": 0.7 }` (semua lebih pelan), `{ "wipe": false }` (tanpa suara transisi).

Aturan:
- **Satu suara untuk satu aksi yang terlihat.** Jangan beri suara pada setiap `Reveal` teks atau gerak kecil; yang bersuara adalah klik, ketik, tap, sesuatu muncul/masuk, angka menghitung, momen penting. Paling banyak ±2 suara bersamaan, dan jangan menumpuk suara ber-nada (`ding`, `notif`, `success`) dalam 0,5 dtk.
- Variasi sudah otomatis (varian dipilih dari id scene + frame, keras suara sedikit diacak, varian sama tidak diputar dua kali berturut-turut di ketikan). Jangan memaku `variant` kecuali user minta satu suara tertentu.
- Suara tidak boleh lebih keras dari narasi: jangan pakai `volume` > 1 dan jangan menaikkan level di `sfx.mjs` tanpa mengukur ulang dengan `npm run loudness -- --check`.
- Versi YouTube: isyarat dari script.json dan whoosh ikut otomatis; `<Sfx>`/`useTyping`/`Pointer` di komponen TikTok harus ditulis juga di komponen `scenesWide.tsx` dengan frame yang sama.
- Cek sinkron: still di frame setiap klik/tap (pointer menempel di target). Kalau ragu suara benar-benar ada, render audio saja (`npx remotion render Video out/a.wav --codec=wav`, ±10 dtk) lalu cari lonjakan energi di detik yang diharapkan.
- Tetap tanpa SFX meme yang merupakan potongan acara TV/film/lagu (vine-boom asli, spongebob, price-is-right, dll., termasuk "meme soundboard" seperti myinstants): hak cipta tidak jelas dan akun ini akun bisnis. Rasa yang sama didapat dari suara rekaman berlisensi di atas (`boom`, `scratch`, `trombone`, `laugh`, …). Suara rekaman baru dari internet hanya dari pustaka berlisensi jelas (Mixkit, Pixabay, Freesound CC0), dengan izin user per unduhan (sebut nama file, sumber, ukuran); simpan di `media/sfx-mixkit/` (atau folder per sumber) + catat di README-nya, lalu tambahkan baris di `RECORDED`. Jenis sintetis baru: tambahkan resep di `SOUNDS` di `scripts/sfx.mjs` (skrip bersama: jenis lama jangan diubah supaya proyek lain tidak berubah bunyi), jalankan `npm run sfx` di proyek, lalu dengarkan lewat galeri `uji-sfx/`.
- Proyek yang dibuat sebelum 16 Okt 2026 malam belum mengenal suara rekaman: jalankan `npm run sfx` di folder proyek (menulis ulang `public/sfx/` + `src/sfx.json`; suara sintetis lama tetap identik byte per byte).
- Proyek sebelum 10 Okt 2026 belum punya SFX. Kalau revisinya minta efek suara: salin `src/components/Sfx.tsx` dari template; salin `src/Video.tsx` (butuh juga `components/Edit.tsx` dan `Captions.tsx` baru, langkah 6c) dan `remotion.config.ts` kalau isinya masih sama dengan versi template sebelumnya (kalau sudah diubah, tambahkan bagian `SfxScope`/`Sfx`/`SceneSfx` dan blok sfx di config secara manual); di `components/Captions.tsx` jadikan `timeWords` dan `Word` `export`; tambahkan `"sfx": "node ../scripts/sfx.mjs"` di package.json; `npm run sfx`; lalu pasang suara di scene. Galeri dan contoh: `uji-sfx/` (komposisi `Galeri`, dan `Video` = Lupa Password WiFi + SFX).

### 6c. Editing: transisi, kamera, penekanan, ritme (sejak 10 Okt 2026)
User minta skill editing dan cara edit di-upgrade. Sampai 9 Okt setiap scene masuk dengan wipe naik yang sama, gambar diam selama narasi, dan subtitle tidak membedakan angka/kata kunci. Diukur di 23 video jadi: 5–9 dtk tanpa perubahan visual itu umum (Firewall 8,7 dtk, Mbps 8 dtk, Lupa Password 6,8 dtk). Semua lapisan editing ada di `components/Edit.tsx` + `src/Video.tsx` dan berlaku otomatis untuk versi TikTok dan YouTube.

**Transisi** (`"transisi"` per scene = cara scene itu masuk; kosong = otomatis dari enam transisi (wipe, slide, bars, push, iris, stairs), acak dengan seed dari narasi, tidak sama dua kali berturut-turut). Semua 15 frame (0,5 dtk) dengan easing lembut (sejak 16 Okt 2026; sebelumnya 0,4 dtk dan push di 60 fps melompat ±124 px per frame di puncaknya, sekarang ±94). Setiap transisi membawa suaranya sendiri.

| Nama | Gerak | Pakai untuk |
|---|---|---|
| `wipe` | naik dengan garis aksen | netral, pergantian topik |
| `slide` | scene baru menutup dari samping, yang lama bergeser sedikit dan meredup | langkah berikutnya, lanjutan cerita |
| `bars` | tiga blok warna (aksen, aksen muda, latar baru) menyapu dari samping | ganti topik dengan energi, pengganti crossfade |
| `cut` | tanpa animasi (tidak otomatis) | **match cut**: scene baru mulai dari bentuk scene lama lewat `Handoff` (langkah 6f) |
| `fade` | larut silang + naik sedikit (tidak otomatis sejak riset 16 Okt: crossfade terasa generik) | hanya kalau diminta / momen sangat tenang |
| `push` | scene baru mendorong yang lama ke samping | perbandingan, "sebaliknya" |
| `iris` | lingkaran membuka dari tengah | fokus ke satu hal, jawaban |
| `stairs` | tangga dari samping | daftar, poin baru |
| `zoom` | masuk sedikit lebih dalam, 94→100% (tidak otomatis) | detail, "di balik layar"; paling banyak 1× per video |
| `whip` | geser cepat + blur (tidak otomatis) | pindah tempat/waktu yang tiba-tiba |
| `flash` | kilat putih (tidak otomatis) | reveal/payoff, angka besar |
| `glitch` | strip rusak + geser warna (tidak otomatis) | peretasan, penipuan, error |

Daftar di tingkat atas (`"transisi": ["slide", "bars", "iris"]`) membatasi pilihan otomatis untuk satu video. Satu transisi per pergantian scene; jangan menambah transisi di dalam scene.

**Kamera** (hanya isi scene; subtitle tidak ikut bergerak). Sejak 16 Okt 2026 user minta **"kurangi efek zoom"**: video 13–15 Okt berisi 7–9 punch-in per video (kebanyakan ditambahkan supaya lolos cek ritme), ditambah drift 3% di setiap scene, transisi zoom yang terbang menembus scene, dan Ken Burns 14% di `Scenery`, jadi layar terasa terus-menerus nge-zoom. Sekarang:
- Drift pelan otomatis **1,5%** sepanjang scene (dulu 3%). `"kamera": { "drift": 0 }` mematikan drift tapi isyarat tetap jalan; `"kamera": false` mematikan semuanya.
- **Punch-in zoom hanya untuk 1–3 momen terpenting per video** (angka kunci, payoff), maksimal 1 per scene: `"zoom": [{ "kata": "gratis", "x": 0.5, "y": 0.42, "lama": 1.5, "s": "swipe" }]`. Skala bawaan **1,08**, dibatasi **1,12** (nilai lebih besar dipotong). Masuk 12 frame dengan ease-out, tahan `lama` dtk (bawaan 1,5), keluar 15 frame; dulu menyentak dalam 4 frame. Zoom yang bertumpuk digabung, jadi tidak ada lompatan balik ke 1×. `x`/`y` = titik fokus (porsi frame 9:16) **dihitung dari tata letak elemen yang disorot**, sama seperti pointer; `xw`/`yw` untuk versi YouTube.
- **Sorot** (pengganti zoom): `"sorot": [{ "kata": "27", "x": 0.5, "y": 0.353, "w": 0.92, "h": 0.08, "lama": 1.5, "s": "blip" }]`. Sekeliling area meredup 50% dan garis aksen (warna `accent` tema scene) tergambar mengelilinginya dalam ±0,6 dtk; kamera diam dan subtitle tetap terang. `x`/`y` = tengah area, `w`/`h` = ukurannya (porsi frame; bawaan 0,7 × 0,22), dihitung dari konstanta tata letak elemennya (mis. baris tabel di `top: 450 + i * 160`, tinggi 136 → baris ke-2 `y` = (450 + 160 + 68) / 1920 = 0,353); `xw`/`yw`/`ww`/`hw` untuk 16:9. Cek ritme menghitungnya sebagai beat. Satu sorot dalam satu waktu; jangan untuk area yang sedang bergerak besar.
- **Guncang** untuk pernyataan keras: `"guncang": [{ "kata": "putus", "kuat": 1, "s": "thud" }]`. Jarang, 1–2 per video.
- `npm run qa` punya pemeriksaan **Zoom secukupnya**: ⚠ di atas 3 punch-in, lebih dari 1 per scene, skala > 1,12, transisi `zoom` lebih dari 1×, atau drift > 2%; ✗ di atas 5 punch-in (proyek dari template sebelum 16 Okt 2026 cukup ⚠).
- Zoom mendorong karakter di tepi keluar frame. `check:crop` ikut mengukur puncak setiap zoom/guncangan. Kalau karakter terpotong, geser fokus ke arah karakter atau kecilkan skala (uji: fokus kiri 1,15× → karakter terpotong 25%; fokus x 0,8, 1,1× → 5%).
- Cek bidikan semua isyarat sekaligus: `npm run frames -- --isyarat` (setiap zoom/sorot/guncang di titik penuhnya; daftar scene + frame tercetak di terminal).

**Subtitle menghindari wajah** (`components/Faces.ts` + `Captions.tsx`, sejak 10 Okt 2026, diminta user): wajah dicari langsung dari PNG karakter (`img/<kunci karakter>-*.png`), yaitu area kulit di bawah rambut/topi yang segaris dengan puncak kepala, berukuran dari pita dahi–mata supaya tangan di dagu tidak ikut. Sudah dicek manual di 55 pose. Setiap baris subtitle memilih tempat: tetap di rumahnya (y 1430) kalau tidak kena wajah (jarak aman 32 px); kalau kena, pindah ke sisi yang kosong di ketinggian yang sama (lebar ≥460 px, boleh jadi dua baris); kalau tidak ada, turun ke bawah dagu (maks. y 1700) atau naik ke atas kepala (min. y 900). Keputusan memakai posisi tata letak (tanpa napas, miring, animasi masuk, atau kamera) dan pose dasar (bukan frame mulut), jadi tetap sama sepanjang satu baris dan tidak berkedip. Karakter yang baru masuk di tengah scene sudah dihindari sejak awal baris. Wajah hanya dicari di scene subtitle itu sendiri (`data-scene` di `SceneFrame`).
- Video seri Claude Code (10 Okt pagi, karakter kecil di pojok bawah) punya **31 baris subtitle yang menutupi wajah**; dengan penghindaran 38 baris digeser ke samping dan tidak ada yang menutupi wajah.
- `npm run check:crop` sekarang juga merender tengah setiap baris subtitle dan melaporkan "subtitle vs wajah" (berapa digeser, ke mana; turun/naik dicetak frame-nya). Baris yang tetap menutupi wajah = ✗, dan di `npm run qa` muncul sebagai "Subtitle tidak menutupi wajah". Perbaikannya: geser atau kecilkan karakter supaya ada sisi kosong. `--tanpa-geser` menunjukkan keadaan tanpa penghindaran (untuk membandingkan).
- Saat menata karakter, usahakan wajah di atas y ±1380 atau di sisi kiri/kanan (bukan di tengah bawah), supaya subtitle cukup bergeser sedikit.

**Penekanan subtitle:** angka (harga, kecepatan, tanggal) otomatis berwarna. Tambah `"tekan": ["gratis", "5 hari"]` per scene untuk 1–3 kata kunci; jangan semua kata.

**Timing subtitle dan angka** (template sejak 16 Okt 2026 malam): TTS tidak memberi waktu per kata, jadi `timeWords` (`Captions.tsx`) membagi durasi narasi menurut panjang *ucapan* tiap kata. Angka dihitung sepanjang bacaan Indonesianya ("1201" = seribu dua ratus satu, juga "1.600", "12,5", "02:14", "40-an", "100%", "5G", "2,4 GHz", "Rp50.000"; "USB 2.0" = "USB dua"), dan titik dua dihitung jeda seperti titik. Dulu "433" dihitung 3 huruf, sehingga di scene penuh angka subtitle, `sayAt`/`wordTimes`, dan isyarat `kata` (zoom/sorot/guncang/sfx) mendahului suara. Tulis angka di `vo` sebagai angka (ejaan bunyinya di `say`); satuan lain yang dibaca panjang tambahkan ke `UNIT` di `Captions.tsx`. Proyek sebelum itu memakai `Captions.tsx`-nya sendiri: kalau revisinya soal subtitle angka, salin bagian `SATUAN` sampai `timeWords` dari template lalu cek `npm run frames -- --isyarat` (isyarat `kata` ikut bergeser ke ucapan sebenarnya).

**Prinsip ritme** (pegangan saat menyusun scene):
- **Beat setiap ≤3 dtk**: sesuatu yang baru terlihat. Urutan pilihan: (1) elemen/kartu baru yang masuk bertahap mengikuti ucapan, (2) perubahan keadaan (angka berganti, warna, centang, stempel, bar tumbuh), (3) `sorot`, (4) ganti layar/pecah scene, karakter masuk atau ganti pose, (5) punch-in zoom, paling akhir dan paling banyak ±3 per video. Narasi yang panjang di satu layar dipecah dengan elemen bertahap, bukan dibiarkan diam dan bukan ditambal zoom.
- Animasi kecil (mulut, napas, kursor berkedip, ketikan huruf kecil) **bukan beat**. Terminal yang mengetik panjang perlu punch-in ke perintahnya atau sorotan.
- Payoff: `riser` berakhir tepat di momen (`<Sfx s="riser" end>`), lalu `flash`/`thud`/punch-in.
- Hook: gerak terlihat di detik pertama (frame 0 tetap penuh).
- Variasi: jangan mengulang jenis beat yang sama tiga kali berturut-turut (mis. tiga sorot ke tiga baris). Selingi dengan elemen masuk, perubahan keadaan, atau ganti layar.

**Cara edit (review sebelum kirim):**
1. Setelah visual: `npm run frames -- --transisi` → `out/frames.png` (frame 0 + 3 frame di dalam setiap transisi). Lihat sekali, pastikan setiap transisi bersih dan tidak ada scene kosong di tengah potongan. Untuk klik: `npm run frames -- <frame…>` atau `-- s03` (6 frame tersebar); untuk zoom/sorot/guncang: `npm run frames -- --isyarat`.
2. Setelah render: `npm run qa` (atau `npm run ritme`). Baca **filmstrip `out/qa/ritme.png`** (1 petak per detik; bilah hijau = beat, merah = diam) dan angka "diam terlama". ✗ ≥ 6,5 dtk wajib diperbaiki; ⚠ ≥ 4 dtk diperbaiki kalau bisa tanpa mengulang beat yang sama, kalau tidak sebutkan di notes.
3. Perbaiki bagian merah: tambah elemen bertahap, perubahan keadaan, `sorot`, atau pecah scene; `zoom` hanya kalau videonya belum punya 3. Render ulang dan QA lagi.

Proyek sebelum 10 Okt 2026 belum punya lapisan ini. Untuk menambahkannya: salin `components/Edit.tsx`, `components/Faces.ts`, `components/Captions.tsx` (kalau masih sama dengan template lama; kalau gaya subtitlenya diubah, tambahkan `emph` dan `emphasised` secara manual), dan `src/Video.tsx` (kalau masih sama dengan template; butuh juga `components/Sfx.tsx` dan langkah 6b); tambahkan skrip `ritme`/`frames` di package.json. Contoh lengkap: `uji-sfx/` (komposisi `Video` = Lupa Password dengan transisi, kamera, zoom, penekanan, SFX; `GaleriEdit` = 8 transisi + kamera).

### 6d. 60 fps (bawaan sejak 11 Okt 2026)
Video baru dirender **60 fps** (diminta user, yang merasa 30 fps "agak delay"): gerak transisi, zoom, dan elemen yang lewat jadi lebih halus. `"fps": 30` di `src/script.json` kalau butuh render cepat. Kode scene **tetap ditulis dalam frame 30 fps** (delay, durasi, isyarat SFX, `useIn`, `WIPE`): `components/Time.tsx` menggantikan `useCurrentFrame`, `useVideoConfig`, dan `Sequence` dari Remotion supaya di 60 fps setiap animasi dihitung dua kali per frame logis. Konsekuensinya:
- **Selalu import ketiga hook itu dari `./components/Time`** (atau `./Time` di dalam `components/`), bukan dari `"remotion"`. Hook dari `"remotion"` langsung akan berjalan dua kali lebih cepat di 60 fps. API lain (`interpolate`, `spring`, `Audio`, `OffthreadVideo`, `random`) tetap dari `"remotion"`; `spring` diberi `fps` dari `useVideoConfig` milik Time (30).
- Di 30 fps hasilnya identik piksel per piksel dengan sebelum lapisan ini (dicek di 4 frame demo). Di 60 fps: render ±2,1× lebih lama (Lupa Password 1:40 → 3:30), file ±20% lebih besar, suara identik (korelasi 1,0, geser 0 ms), setiap frame transisi berbeda (tidak ada frame dobel).
- `qa`, `check:crop`, dan `frames` otomatis mengalikan frame hitungan dengan `fps/30`. Nomor frame yang diketik manual di `npm run frames -- <frame>` adalah frame asli video (di 60 fps = detik × 60).
- Overlay HyperFrames untuk video 60 fps dirender dengan `--fps 60`.
- Proyek sebelum 11 Okt 2026 tetap 30 fps (tanpa `OUT_FPS` di `theme.ts`). Untuk menjadikannya 60 fps: salin `components/Time.tsx`, tambahkan `OUT_FPS` di `theme.ts` dan `fps: OUT_FPS` + `durationInFrames` dikali `OUT_FPS / FPS` di `index.ts` (lihat template), lalu pindahkan import ketiga hook di semua file `src/` ke Time (cukup dengan skrip kecil yang mengganti import).

### 6e. Gerak halus (motion, sejak 16 Okt 2026)
User minta gerak video lebih halus dan efek zoom dikurangi. Yang membuat gerak terasa kasar di template sebelumnya: transisi 0,4 dtk, punch-in yang menyentak dalam 4 frame, pegas berdamping rendah (pustaka scene meminta damping 9–13, jadi elemen memantul 20–27% sebelum diam; `Chip` juga berayun 8°), kartu/teks besar yang membesar dari nol (`scale(0 → 1)`), ganti pose karakter yang langsung tukar gambar lalu memantul 94→100%, subtitle membesar 85→100% di setiap baris, dan grain latar yang berganti tiap frame (warna polos "mendidih", bitrate habis untuk derau). Semua sudah diperbaiki di komponen bersama template; aturan di bawah untuk scene yang ditulis sendiri.

**Preset `components/Motion.ts`** (pakai ini, bukan angka acak per scene; frame logis 30 fps):
- Easing: `EASE.out` (masuk: cepat lalu mendarat pelan), `EASE.inOut` (pindah A→B), `EASE.in` (keluar), `EASE.sine` (drift pelan).
- Durasi `DUR`: `quick` 8, `enter` 15, `move` 18, `big` 24, `stagger` 5.
- Pegas `SPRING`: `smooth` (tanpa pantulan), `soft` (±1%, teks/panel/karakter), `pop` (±9%, chip/badge/stempel).
- Helper: `ramp(f, delay, dur, easing)` / `useRamp(delay, dur)` → 0..1 tanpa pantulan; `useSpringIn(delay, SPRING.soft)`; `enterStyle(p, { from, dist, scale })` → opacity + naik/geser (+ skala ≥ 0,9); `float(f, amp, period)` untuk elemen diam yang perlu tetap hidup tanpa zoom.
- Bawaan yang sudah diubah: `useIn` (`Kinetic.tsx`) berdamping minimal 15, `Chip`/`LogoCard` muncul dari 85% + fade, `Reveal` 15 frame `EASE.out`, karakter `Anime` masuk dengan damping 18, `Scenery` geser-zoom 2→6% (dulu 4→14%) tanpa pop skala, `PanShot` masuk tanpa skala.

**Aturan gerak:**
- **Masuk = fade + geser pendek (30–60 px)**, `DUR.enter`, `EASE.out`. Skala hanya bumbu (0,85–0,95 → 1). **Jangan `scale(0 → 1)`** untuk kartu, panel, teks besar, atau foto: terbaca sebagai zoom. Pop dari kecil hanya untuk benda kecil (pin, titik, badge sampai ±200 px).
- **Tanpa pantulan besar**: `SPRING.soft`/`pop` (damping ratio ≥ 0,6). Teks tidak bergoyang atau berputar setelah mendarat.
- **Gerak besar butuh waktu**: menyeberang layar ≥ 18 frame (`DUR.move`), satu layar penuh ≥ 24 frame; makin jauh jaraknya, makin panjang durasinya.
- **Bertahap, bukan serentak**: daftar/kartu berjarak `DUR.stagger` atau mengikuti kata yang diucapkan (`cue`/`turnAt`); satu fokus gerak dalam satu waktu.
- **Tidak ada yang muncul/hilang/lompat dalam 1 frame** (`opacity: ok ? 1 : 0`, teks yang berganti lalu mengubah tinggi panel). Beri `ramp` 8–15 frame; panel yang isinya berubah diberi ukuran tetap (`minHeight`, lebar kolom) supaya tidak melompat saat teks membungkus. Pengecualian yang disengaja: ketikan huruf (`useTyping`), angka menghitung, frame mulut.
- **Keluar lebih cepat dari masuk** (8–12 frame, `EASE.in`), selesai sebelum transisi scene.
- **Diam yang hidup tanpa zoom**: `float` beberapa px, marquee, napas karakter, atau drift kamera bawaan; jangan Ken Burns besar. `PanShot`: beda `zoom` antar titik ±1,1–1,25×.
- **Karakter**: ganti pose (`poses` dengan beberapa `at`) sekarang larut 6 frame + turun 10 px, bukan tukar langsung. Tetap satu pose per kalimat/ide, jangan ganti pose terus-menerus.
- **Latar**: `Backdrop` memakai grain diam; `grain="live"` kalau memang ingin grain bergerak, `grain={false}` tanpa grain. Uji 16 Okt (video Download 4 GB): MP4 25,5 MB vs 31,6 MB, render 60 fps 1:44.
- **Subtitle**: baris baru naik 14 px + 95→100% (dulu 85→100%); kotak biru kata aktif tidak berubah.

**Cek:** `npm run qa` punya dua pemeriksaan baru, **Zoom secukupnya** (dari script.json, langkah 6c) dan **Gerak halus (tanpa patah)**: MP4 diambil 30 frame/dtk, lalu dicari area ≥ 10 petak (±72 px per petak) yang berubah total dalam satu frame sementara frame sebelum dan sesudahnya tenang, di luar jendela transisi. Hasilnya ⚠ dengan scene + detik (heuristik, tidak pernah ✗): lihat frame-nya (`npm run frames -- <detik × 60>`) lalu beri animasi atau ukuran tetap. Dikalibrasi di video Download 4 GB: satu temuan asli (panel "nyata" melompat lebih tinggi di 43,5 dtk karena label "lebih lama" membungkus jadi dua baris); ketikan angka (3–8 petak) tidak terhitung.

**Proyek sebelum 16 Okt 2026** tetap memakai gerak lama (komponennya salinan sendiri, tidak ikut berubah). Untuk memakai gerak baru saat revisi: kalau `src/Video.tsx` dan `components/Edit.tsx`, `Kinetic.tsx`, `Anime.tsx`, `Captions.tsx`, `ui.tsx`, `Type.tsx` masih sama dengan proyek lain dari periode yang sama (mis. `cmp src/components/Edit.tsx ../kabel-kalah-wifi/src/components/Edit.tsx`), salin semuanya + `components/Motion.ts` dari template, kurangi `zoom` jadi ≤ 3 (ganti sisanya dengan `sorot` atau elemen baru), dan ganti `"transisi": "zoom"`/`"whip"` yang tidak bermakna. Dicoba 16 Okt di salinan `download-4gb-berapa-menit`: ketujuh file identik dengan template lama, 7 zoom → 2 zoom + 3 sorot, ritme tetap lolos (8,4 → 7,3 beat per 10 dtk, tanpa layar diam ≥ 4 dtk).

### 6f. Motion design playbook (riset 16 Okt 2026)
User melihat video motion graphic buatan Claude milik orang lain yang bagus dan minta riset lagi. Ringkasan riset:
- Skill Remotion untuk agen diluncurkan 20 Jan 2026; demonya ±6 juta tayangan dalam dua hari. Kumpulan contoh terpopuler (motion-graphics.org: showreel 15 dtk 2,3 jt, video musik 4 jt, film peluncuran) punya ciri sama: **15–30 dtk; tipografi, warna, dan bentuk sederhana sebagai daya tarik; transisi yang tumbuh dari scene sebelumnya** (bentuk berubah jadi scene berikutnya, gerak kamera, kesinambungan) **bukan crossfade/blur-in; gerak mengikuti ketukan suara.** Brief terbaik menyebut tekniknya ("typography, shape play, camera moves, colour shifts") dan melarang "crossfades, blur-ins, glows, particles, holds longer than 1s".
- Benchmark 16 skill video (11 Okt 2026): skill resmi Remotion andal tapi hasil bawaannya mirip baseline generik, jadi butuh arahan desain sendiri; yang paling khas memakai satu objek/kamera berkelanjutan ("setiap beat tumbuh dari beat sebelumnya"), loop kritik/standar kualitas, dan audit variasi.
- Tipografi kinetik untuk retensi: animasikan hanya kata kunci (angka, kata kerja, hasil), sinkron dengan ucapan, 3–7 kata per layar, satu keluarga huruf, warna sorotan sedikit; label + panah untuk tutorial, urutan angka bertahap untuk data. Gerak terasa hidup kalau ada tiga lapis: utama, sekunder (menyusul), ambient (latar tidak pernah beku).

**Aturan** (berlaku untuk setiap video baru, di samping 6c dan 6e):
1. **Tiga lapis per scene.** Gerak utama = pesannya (judul, angka, diagram). Sekunder = pendukung yang menyusul 3–6 frame (label, chip, panah). Ambient = `AccentShapes`, `float`, marquee, napas karakter, drift kamera. Tidak ada frame yang beku lebih dari ±1 dtk.
2. **Kesinambungan.** Minimal 1–2 pergantian scene per video berupa **match cut**: scene berikutnya `"transisi": "cut"` dan mulai dengan `<Handoff from={kotakTerakhir} to={…}>` (pill/kartu/lingkaran scene lama tumbuh jadi latar atau kartu scene baru). Elemen lain scene lama keluar dulu (≤ 12 frame, `EASE.in`) supaya frame terakhir scene lama = frame pertama scene baru. Konstanta kotaknya dipakai bersama oleh kedua scene. Pergantian lain otomatis (`bars` menggantikan `fade`).
3. **Tipografi kinetik.** Judul/kalimat kunci pakai `KineticText` dengan `times={wordTimes(scene, teks)}` (kata mendarat persis saat diucapkan dan disorot subtitle); `emph` 1–3 kata (angka, kata kerja, hasil), `marker`/`Highlight` paling banyak satu per scene. Jangan menganimasikan setiap kata dengan efek berbeda.
4. **Angka bergerak.** Angka kunci pakai `CountUp` (`roll` = digit berputar ala odometer, format id-ID: 12,5 / 1.600). Perbandingan → `Bars`/`Gauge`; sebelum → sesudah → `WordSwap`. Konten "angka vs angka" adalah pemenang FYP akun ini (memori 14 Okt).
5. **Kamera tanpa zoom.** Scene diagram/ilustrasi berlapis boleh `Parallax` + `Layer depth` (pan ≤ 160 px, kedalaman 0,2 latar … 1 depan; sisakan margin supaya lapisan depan tidak keluar frame di akhir pan). Zoom tetap maks ±3 per video.
6. **Warna di ketukan.** `ColorShift` (latar mekar dari satu titik ke warna baru) maks 1 per scene, pada momen penting; warna dari palet brand (`K` / `THEMES`).
7. **Suara di setiap beat.** Kata kunci mendarat, angka berhenti, handoff, ganti scene → satu SFX (langkah 6b); payoff = `riser` berakhir tepat di momen lalu `ding`/`thud`.
8. **Dilarang:** crossfade/blur-in sebagai transisi bawaan, kilau/partikel berlebih, teks bergoyang/berputar, semua kata dianimasikan, elemen muncul/hilang dalam 1 frame, layar diam tanpa lapisan ambient, frame akhir yang berantakan.

**Daftar periksa sutradara** (lihat still + `npm run frames -- --transisi` sebelum render): gerak terlihat di detik pertama dan frame 0 penuh · tiap scene punya tiga lapis · ≥ 1 match cut yang mulus (frame terakhir = frame pertama) · hanya kata kunci yang ditekan · angka kunci berputar/menghitung · tidak ada crossfade · tidak ada yang muncul/hilang 1 frame · SFX di tiap beat · frame terakhir rapi dan mudah diingat.

**`components/MotionKit.tsx`:**
- `sayAt(scene, "kata", nth?)`, `wordTimes(scene, "frasa")` → frame scene saat diucapkan (timing sama dengan subtitle, juga untuk dialog `turns`); salah ketik = render berhenti. Ganti helper `cue` buatan sendiri per proyek.
- `Handoff from to delay dur` (kotak `{x, y, w, h, r, color, rot}`, `fullBox(W, H, warna)`), anak-anaknya muncul setelah bentuk tiba.
- `KineticText text times|at+step by="word|char" mode="rise|pop|drop" emph accent marker style align`; `kineticBig(size, warna)` = gaya huruf display.
- `Highlight at color` (stabilo menyapu di belakang kata), `CountUp to at dur decimals prefix suffix roll`, `WordSwap words at[]`.
- `Parallax pan from to` + `Layer depth`, `AccentShapes t seed count delay`, `ColorShift base shifts=[{at, color, x, y}]`.
- Contoh lengkap 10 dtk: `npx remotion render AsetMotion out/aset-motion.mp4` (`src/Aset.tsx`: kata berurutan + counter berputar → match cut pill jadi latar → parallax, stabilo, colour shift → `bars` → gauge, dengan SFX). Contoh match cut:
```tsx
const PILL = { x: 70, y: 1180, w: 560, h: 150, r: 75 };          // dipakai scene A dan B
// scene A: pill tetap, teks lain keluar di frame duration-14 … duration-4
// scene B ("transisi": "cut"): dasarnya warna latar scene A, lalu pill tumbuh jadi latar scene B
<AbsoluteFill style={{ background: THEMES.cobalt.bg }}>
  <Handoff from={{ ...PILL, color: THEMES.cobalt.accent }} to={fullBox(W, H, t.bg)} dur={DUR.big}>
    {/* isi scene B */}
  </Handoff>
</AbsoluteFill>
```
Scene sebelum `cut` otomatis tanpa drift kamera (`Video.tsx`), jadi bentuknya tidak bergeser di titik potong; jangan beri zoom/sorot di ±0,5 dtk terakhirnya. Cek dengan `npm run frames -- <frame terakhir scene A> <frame pertama scene B>`: kedua still harus identik.

### 7. Render dan kirim
```bash
npx tsc -p . && npm run render      # → <ROOT>/output/<slug>.mp4
npx remotion ffprobe -v error -show_entries format=duration -of csv=p=0 ../output/$SLUG.mp4
```
`npm run render` (dan `render:yt`) otomatis menyamakan keras suara MP4 ke **−14 LUFS** setelah render (`../scripts/loudness.mjs`: satu gain linear + limiter look-ahead untuk puncak di atas −2 dBFS; stream video disalin tanpa encode ulang). Baris terakhirnya harus berbunyi `… → -14.x LUFS …`; kalau `GAGAL`, file asli tidak diubah, jadi baca pesannya. Kalau render dijalankan langsung dengan `npx remotion render`, jalankan `npm run loudness` sesudahnya. Cek saja tanpa mengubah: `npm run loudness -- --check`. Semua MP4 final dikumpulkan di `<ROOT>/output/<slug>.mp4` (nama = nama folder proyek); `out/` di proyek hanya untuk bahan antara (take suara penuh, still, `check.txt`). Revisi merender ulang ke file yang sama. Kirim MP4 ke user dengan SendUserFile (display: render). Kalau diminta caption TikTok: maksimal **5 hashtag** (batas TikTok menurut user), campur merek, topik, dan lokal. Render ±3,5 menit untuk video 60 detik di 60 fps (±1,7 menit kalau `"fps": 30`). Peringatan "macOS older than 15" aman diabaikan.

### 7b. QA sebelum dikirim (wajib)
```bash
npm run qa -- --durasi=60      # setelah npm run render; --durasi = target dari job (⚠ di bawah 85% / di atas 120%); juga cek tempo bicara (✗ > 2,7 kata/dtk)
npm run qa                     # job dengan durasi Bebas: tanpa --durasi, durasi hanya dicatat (⚠ di atas 3 menit)
npm run qa -- --yt             # versi YouTube
npm run qa -- --transkrip      # sekalian transkripsi tiap klip lewat router (lebih lama)
npm run qa:edit                # proyek Edit video (src/edit.json), lihat langkah 9
```
`../scripts/qa.mjs` memeriksa: TypeScript; suara per scene lengkap dan ujung klipnya hening (bunyi "dret"); **subtitle tidak menutupi wajah** (langkah 6c); **zoom secukupnya** (langkah 6c); **gerak halus** (tanpa elemen yang muncul/lompat dalam 1 frame, langkah 6e); **ritme** (bagian tanpa perubahan visual: ⚠ ≥4 dtk, ✗ ≥6,5 dtk, filmstrip `out/qa/ritme.png`, lihat langkah 6c); **frame 0 sudah terisi** (kepadatan detail frame 0 dibanding scene 1 saat penuh: ≥60% ✓, 35–60% ⚠, <35% ✗); **sampul konsisten** (proyek dengan `components/Cover.tsx`: `look.mode` terisi, s01 memakai `kind: "cover"`/`CoverFrame`, latar frame 0 = warna mode, label seri terlihat di kiri atas, judul terlihat; ✗ kalau salah satunya gagal; ⚠ kalau pojok angka views, 240 px teratas, atau bagian bawah kiri di luar potongan terisi, atau `theme` s01 beda dengan mode); **font & warna brand** (⚠ untuk font yang dimuat sendiri, `fontFamily` berupa teks, atau lebih dari 6 warna di scenes yang jauh dari palet brand); hook selesai diucapkan ±2 dtk; durasi; karakter terpotong (`check:crop`); dan kalau MP4 sudah ada: durasinya sama dengan timeline, tidak lebih tua dari sumber, keras suara −14 LUFS. **Setiap ✗ wajib diperbaiki**, lalu render dan QA lagi sampai tidak ada ✗. ⚠ boleh tersisa asal disebut di `notes`. Hasilnya `out/qa/report.json` (`out/qa-yt/` untuk versi YouTube) plus still frame 0 dan tiap scene, yang tampil di kartu video Studio. Ambang frame 0 dikalibrasi 8 Okt 2026: video sebelum aturan FYP 0–20% (frame 0 berisi latar kosong, meja polos, atau ilustrasi tanpa teks hook), video FYP 86–95%.

### 8. Versi YouTube (landscape 16:9)
Dipakai oleh job **Versi YouTube** dari Studio (tombol di kartu video, atau centang "Sekalian buat versi YouTube" saat membuat video), atau kalau user minta versi YouTube. Tujuannya satu naskah dan satu suara untuk dua format, supaya kuota Gemini tidak terpakai dua kali.

**Jangan membuat suara baru.** Jangan jalankan `npm run vo`, `vo:reuse`, atau `samples`. Versi YouTube memakai `public/vo/`, `src/vo-durations.json`, dan `src/vo-turns.json` yang sudah ada, jadi naskah, timing, dan subtitle identik dengan versi TikTok. Versi TikTok (komposisi `Video`, `src/scenes*.tsx`, mp4-nya) jangan diubah atau dirender ulang.

Infrastruktur di template (sejak 7 Okt 2026; ketujuh proyek lama sudah dipasangi):
- `src/Video.tsx` mengekspor `Timeline`: urutan scene, transisi, kamera, audio, efek suara, dan subtitle dipakai bersama. `Video` memakai `SCENES`, `VideoWide` memakai `SCENES_WIDE`. Titik fokus punch-in zoom versi YouTube diisi lewat `xw`/`yw` di isyarat `zoom` (tata letaknya beda dengan 9:16).
- `src/VideoWide.tsx`: komposisi `VideoWide` 1920×1080 (didaftarkan di `src/index.ts`). Scene dicari di `SCENES_WIDE[scene.id]`, lalu `SCENES_WIDE[scene.kind]`; kalau belum ada, scene TikTok ditampilkan di tengah dengan warna temanya (cadangan supaya render tidak pecah, **bukan hasil akhir**).
- `src/scenesWide.tsx`: tempat komponen landscape, props sama (`{ scene, duration }`).
- `components/Captions.tsx` membaca ukuran frame: di 16:9 subtitle pindah ke pita bawah (y ±865), baris lebih panjang, huruf 0,9×.
- `npm run render:yt` → `<ROOT>/output/<slug>-yt.mp4`.
- Proyek dari template lama: salin lima file itu dari template (`src/Video.tsx`, `src/VideoWide.tsx`, `src/index.ts`, `src/theme.ts`, `src/components/Captions.tsx`) kalau isinya belum diubah dari template, salin `src/scenesWide.tsx` kalau belum ada, dan tambahkan skrip `render:yt` di package.json.

Menata scene landscape (wajib untuk **setiap** scene sebelum render final):
- Zona aman: margin 96 px kiri-kanan, 60 px atas. Kicker di y ±70, konten di y 120–830, subtitle di y ±865–1000. Jangan taruh teks penting di bawah y 840; karakter boleh lewat di belakang subtitle.
- Pola dasar dua kolom: judul/teks di kiri (x 120–1000) dan visual/karakter di kanan (x 1000–1800), dibalik di scene berikutnya supaya tidak monoton. Dialog: satu karakter di kiri, satu di kanan, teks di tengah. Daftar/kartu/timeline dijajarkan mendatar, bukan ditumpuk.
- Tinggi frame cuma 1080, jadi huruf raksasa ±0,75–0,85× versi TikTok. Karakter setengah badan tinggi ±820–950 px, menempel bawah, dengan fade bawah yang sama.
- Ilustrasi `Scenery`/latar anime cocok dijadikan latar penuh 16:9. `Marquee`/`Outline` dibentangkan selebar 1920.
- Scene s01 (sampul): kalau proyek punya `components/Cover.tsx`, susun ulang dari `CoverFrame`, `CoverTitle`, `CoverViz`, `CoverHost` yang sama; di 16:9 tata letaknya otomatis (label y 84, judul x 96–1060, host kanan bawah 900 px). Scene `kind: "cover"` tanpa versi lebar tampil sebagai cadangan potret di tengah.
- Pakai ulang gambar, karakter, palet, mode sampul (`look`), tema per scene, dan animasi yang sama; animasi tetap mengikuti timing narasi (`turnAt`, `LEAD_IN`). Kalau perlu mengubah helper bersama, pastikan still versi TikTok tidak berubah.
- Cek still dengan komposisi `VideoWide` di frame yang sama dengan versi TikTok (timeline-nya sama): `npx remotion still VideoWide out/stills-yt/s01.jpg --frame=<n> --image-format=jpeg --scale=0.5`.
- Jalankan `npm run check:crop -- --wide` dan perbaiki setiap ✗ (karakter di layar lebar juga harus utuh; ruang samping lebih lega, jadi tidak ada alasan memotong).
- Render: `npx tsc -p . && npm run render:yt` (ikut dinormalkan ke −14 LUFS seperti versi TikTok); durasinya harus sama dengan versi TikTok. Lalu `npm run qa -- --yt` dan perbaiki ✗.
- Hasil untuk Studio: judul YouTube (maks 70 karakter), deskripsi YouTube 2–5 baris (isi + ajakan like/subscribe/komentar, tanpa hashtag), dan 3–5 hashtag.

### 9. Edit video upload (rekaman user, sejak 16 Okt 2026)
Dipakai oleh job **Edit video** dari Studio (halaman Edit video: user upload rekaman, menulis instruksi, mencentang pilihan cepat, memilih format dan durasi) atau kalau user minta "editin video ini". Yang diedit **rekaman user sendiri**: jangan membuat narasi Gemini TTS, karakter, atau scene animasi baru kecuali diminta. Semua aturan FYP tetap berlaku (frame 0 penuh, hook ≤ 2 dtk, tanpa iklan di luar pilar brand).

**Alur:**
1. Proyek dari template seperti langkah 1 (nama folder = slug judul). Salin rekaman: `mkdir -p public/footage && cp -c <path dari job> public/footage/<nama-pendek>.mp4` (`cp -c` = salinan APFS, tidak memakan ruang).
2. Cek ukuran, orientasi, fps, durasi: `npx remotion ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate -of compact public/footage/<nama>.mp4`. Rekaman HP berdiri sering 1080×1920 atau berotasi; lihat satu frame (`npx remotion ffmpeg -ss 2 -i … -frames:v 1 out/f.png`, lalu Read) supaya tahu isi dan letak wajah.
3. **Transkrip:** `npm run transcribe` (Whisper lokal `medium` di `<ROOT>/tools/whisper`, sudah terpasang; ±10–20 dtk per menit rekaman). Hasil: `src/footage-words.json` (waktu per kata) dan `out/transcript-<nama>.txt` berisi kalimat bertimestamp + **jeda yang diukur dari audio** dengan titik potong aman ("potong di 12.39"). Waktu kata Whisper bersambung tanpa celah, jadi skrip menarik tepi kata ke suara sebenarnya; selalu potong di tengah jeda yang tercantum, jangan di tengah kata. Rekaman tanpa suara → kata kosong, edit dari gambar saja.
4. Baca transkripnya, pilih bagian sesuai instruksi user: buang salah ucap, pengulangan, jeda panjang, pembuka yang lambat; susun ulang kalau kalimat terkuat ada di tengah (jadikan hook). Tanpa target durasi: secukupnya isi, biasanya 20–60 dtk.
5. Tulis `src/edit.json` (contoh lengkap di kepala `src/Footage.tsx`):
   - `format`: `portrait` (komposisi `Edit`, 1080×1920) atau `landscape` (`EditWide`, 1920×1080).
   - `sources` (kunci → file di `public/`) dan `segments` `[{ src, from, to, fit, x, y, speed, volume, fade }]` dalam detik rekaman. Suara asli ikut, dengan fade 50 ms di setiap potongan (tanpa bunyi klik).
   - `fit`: `fill` (dipotong memenuhi layar; fokus `x`/`y` 0..1 ke wajah/objek) untuk rekaman yang orientasinya sama dengan hasil; `blur` (seluruh gambar di atas salinan buram) untuk rekaman rebah di 9:16; `card` (kartu di warna tema, ruang judul di atas) untuk tutorial layar/screenshot. Variasikan `x`/`y` atau `fit` antar potongan supaya ada beat.
   - `captions` (bawaan true; **false kalau rekaman sudah punya subtitle tertanam**), `tekan` (1–3 kata kunci berwarna), `koreksi` untuk ejaan yang salah dengar (`{"kontoh fiber": "CONTOH FIBER", "penagi": "penagih"}`; nama brand dari profil brand). Subtitle muncul per kata dari waktu Whisper dan hilang 0,8 dtk setelah orang berhenti bicara. Penghindar wajah hanya mengenali karakter anime, jadi atur `fit`/`y` supaya wajah orang di rekaman berada di atas y ±1400 (9:16).
   - `overlays` (waktu `t` = detik video jadi, atau `kata` = saat kata itu diucapkan, `lama` detik, `s` = efek suara saat muncul): `judul` (hook; `"t": 0` langsung tampil penuh di frame 0), `teks` (pil label, `color`), `ikon` (`IconTile` Lucide + `label`), `logo` (logo platform), `follow` (ajakan follow: `items` `[{ brand, handle }]` dari `social` di brand / profil brand → KANAL RESMI), `panah` (`from`/`to` porsi frame), `jaringan` (`nodes` + `broken`), `gauge` (`value`, `max`, `unit`), `nama` (lower third nama + `role`). Posisi `x`/`y` = porsi frame; jangan menutupi wajah atau tulisan penting di rekaman.
   - `zoom` / `sorot` / `guncang` / `sfx`: sama dengan langkah 6c (zoom maks ±3, skala ≤ 1,12).
6. Cek: `npm run frames -- --comp=Edit 0 <frame…>` (frame asli, detik × 60; `--comp=EditWide` untuk 16:9) dan `npm run frames -- --comp=Edit --isyarat`. Frame 0 harus sudah berisi judul + gambar, overlay pas di tempatnya, subtitle tidak menutupi wajah.
7. Render: `npm run render:edit` → `<ROOT>/output/<slug>.mp4` (atau `npm run render:edit:yt` → `<slug>-yt.mp4`), ikut dinormalkan ke −14 LUFS. 60 fps bawaan; `"fps": 30` di `src/script.json` kalau rekamannya panjang dan perlu cepat.
8. QA: `npm run qa:edit` (`-- --durasi=N` kalau ada target): TypeScript, sumber & potongan dalam batas klip, transkrip ada, durasi, zoom, still frame 0 + tiap potongan (tampil di kartu Studio), MP4 sesuai edit, ritme, gerak patah di luar potongan (patah dari rekamannya sendiri boleh, sebut di notes), keras suara. Perbaiki setiap ✗.
9. File hasil job: JSON yang sama dengan video biasa + `"orientation": "portrait" | "landscape"`.

Uji 16 Okt 2026 (`uji-edit/`): rekaman 16:9 tanpa subtitle (47 dtk, video Penagih Nota tanpa teks) → 9:16 25,7 dtk: 3 potongan di tengah jeda, `blur`, judul di frame 0, ikon nota, logo WhatsApp, pil "Tanpa nota = jangan bayar", 1 zoom, ajakan follow; `koreksi` membetulkan nama brand dan dua kata lain yang salah dengar. Transkripsi 11 dtk, render ±1,5 menit, QA lolos (⚠ ritme 4 dtk dan patah dari transisi di rekaman aslinya).

## Teknik Remotion lanjutan (rujukan resmi)

`references/remotion/` berisi panduan resmi Remotion (dari remotion-dev/skills, versi 4.0.533; lihat README di sana). Buka file yang relevan sebelum memakai tekniknya, supaya API-nya benar:

| Mau membuat | Baca | Paket |
|---|---|---|
| Transisi lain di luar 10 transisi bawaan `components/Edit.tsx` (langkah 6c), mis. flip/clock wipe | `markup/transitions.md` | `@remotion/transitions` |
| Kilau cahaya (light leak) di pergantian scene atau momen "wow" | `markup/light-leaks.md` | `@remotion/effects` |
| Motion blur pada gerakan cepat (teks/objek masuk) | `markup/motion-blur.md` | `@remotion/motion-blur` |
| Sorotan teks gaya coretan tangan (lingkari, garis bawah, stabilo) untuk angka/harga | `markup/text-highlights.md` | `@remotion/rough-notation` |
| Efek visual lain (RGB shift dll.) | `markup/effects.md` | `@remotion/effects` |
| Efek suara | **bagian 6b** (pustaka sintetis sendiri, bukan `markup/sfx.md`) | — |
| Visualisasi suara (bar/gelombang mengikuti narasi) | `markup/audio-visualization.md` | `@remotion/media-utils` (sudah terpasang) |
| Timing, sequencing, ukur teks agar tidak terpotong | `markup/timing.md`, `sequencing.md`, `measuring-text.md` | — |
| Caption/transkripsi | `captions/` | `@remotion/captions` |

Aturan:
- Paket dipasang di `<ROOT>` dengan versi **sama persis** dengan `remotion` (`npm i @remotion/<paket>@<versi remotion>`), bukan di folder proyek.
- Abaikan bagian rujukan yang menyuruh membuka Remotion Studio untuk preview atau tidak merender; alur skill ini tetap render sampai MP4 dan cek still.
- **SFX dari pustaka sendiri** (`components/Sfx.tsx`, langkah 6b): suara sintetis plus 18 suara rekaman Mixkit berlisensi di `media/sfx-mixkit/`, bukan dari remotion.media atau unduhan lain tanpa izin user. Jangan pakai SFX meme yang merupakan potongan acara TV/film/lagu (vine-boom asli, spongebob, price-is-right, dll.): akun bisnis, risiko hak cipta.
- Efek tambahan melayani pesan, bukan hiasan: maksimal 1–2 teknik baru per video, tetap tipografis, dan cek still sesudahnya.

## Blok HyperFrames sebagai overlay (opsional, uji 11 Okt 2026)
[HyperFrames](https://github.com/heygen-com/hyperframes) (HeyGen, Apache-2.0) merender HTML + GSAP jadi video, mirip Remotion tapi berbasis HTML. Remotion tetap mesin utama; HyperFrames hanya dipakai untuk **membuat elemen** dari katalognya (392 blok/komponen: kartu follow, lower third, notifikasi bertumpuk, grafik, judul kinetik) yang dirender **transparan** lalu ditempel di scene Remotion.
- Terpasang terpisah di `<ROOT>/uji-hyperframes/` (punya `node_modules` sendiri, FFmpeg statis, ffprobe & Chrome headless milik Remotion, telemetri mati). Selalu jalankan lewat `./hf.sh` di folder itu. Proyek HyperFrames-nya di `uji-hyperframes/hf/`.
- Alur: `./hf.sh catalog --json` (cari) → `cd hf && ../hf.sh add <blok> --no-clipboard` → sesuaikan teks di `hf/compositions/<blok>.html` (nama, handle, bahasa Indonesia; **jangan angka karangan** seperti jumlah follower, dan jangan logo merek lain) → `../hf.sh lint` → `../hf.sh render . -c compositions/<blok>.html --format webm -o renders/<nama>.webm` (VP9 + alpha, kecil; `--format mov` = ProRes 4444, ±150× lebih besar, sama-sama jalan).
- Di Remotion: salin ke `public/hf/`, lalu `<Sequence from={…}><OffthreadVideo src={staticFile("hf/<nama>.webm")} transparent muted /></Sequence>`; geser/skalakan dengan `AbsoluteFill` + `transform` (kartu bawaan sering di y 1590+, zona tombol TikTok). Suara aksi tetap dari `<Sfx>` di frame yang sama dengan jadwal animasi blok (baca `tl.to(…, waktu)` di HTML-nya).
- Contoh jadi: blok `tiktok-follow` (tombol "Ikuti" → "Mengikuti", akun dari `social` di brand). Render blok ±10 dtk; render video tidak melambat.
- Blok memuat GSAP dan Google Fonts dari CDN saat render, jadi butuh internet.
- **Musik latar dari HyperFrames tidak dipakai:** HyperFrames hanya me-mix (musik mengecil di bawah narasi, potong sesuai ketukan); sumber musiknya harus file sendiri, MusicGen lokal (Python + torch, bobot modelnya non-komersial), atau cloud HeyGen (API key). Musik tetap ditambahkan user di aplikasi TikTok.

## Ikon & SVG (`components/Icons.tsx`, `Svg.tsx`, sejak 16 Okt 2026)
Lihat semua pilihan dulu: `npx remotion still AsetIkon out/aset-ikon.png` (86 ikon jaringan/teknologi + 35 logo platform, berlabel nama) dan `npx remotion still AsetSvg out/aset-svg.png --frame=300` (kit SVG; `npx remotion render AsetSvg out/aset-svg.mp4` untuk gerakannya). Read gambarnya sebelum memilih.

**Ikon (`Icons.tsx`):**
- `<IconTile name="router" t={t} size={180} delay label="Router" />` = gaya rumah: ubin 2.5D (muka warna `t.accent`, sisi lebih gelap, kilap putih, bayangan), ikon tergambar garis demi garis, masuk dengan pop lembut. Opsi `bg`/`fg`, `round`, `dim` (abu-abu: mati/offline). Ini cara utama memakai ikon.
- `<Ico name="wifi-off" size color stroke draw />` = ikon Lucide polos (2.100+ nama, `lucide.dev/icons`; nama kebab-case). `draw` 0..1 untuk animasi tergambar. Nama salah → render berhenti dan menyebut nama yang mirip. `NET_ICONS` = daftar yang sudah dicek.
- `<BrandBadge brand="whatsapp" size />`, `<BrandIcon brand color />`, `<FollowBar items={[{ brand: "tiktok", handle: "@akunbrand" }]} t top title />`: logo Simple Icons (CC0) di `brandIcons.ts` (dibuat `scripts/brand-icons.mjs`; tambah logo: `npm pack simple-icons@16.32.0`, ekstrak, jalankan skrip dengan slug baru). **Merek dagang pemiliknya:** hanya untuk menyebut platform atau ajakan follow/share, warna asli atau putih/hitam polos, tidak digambar ulang, tidak digabung jadi logo baru, tidak menyiratkan kerja sama. Akun brand: `social` di `brand/brand.mjs` (juga profil brand → KANAL RESMI).
- `<NetFlow nodes={[{ icon: "smartphone", label: "HP" }, …]} t top left width size broken={1} />`: alur perangkat → router → OLT → internet, garis putus-putus tergambar lalu paket berjalan; `broken` = sambungan ke-i putus (merah + ✕, node sesudahnya redup). Titik tengah node: `flowPoint(i, n, opts)` (untuk `sorot`/pointer).

**SVG (`Svg.tsx`, di dalam `<Svg>` overlay seukuran frame, koordinat px komposisi):** `DrawPath` (path apa saja tergambar, `head` = kepala panah ikut ujung), `Arrow` (lengkung A→B, pengganti kursor untuk menunjuk), `FlowLine` (paket data/sinyal/uang berjalan di path; `broken`), `Gauge` (speedometer: jarum menyapu ke `value`, angka menghitung; cocok untuk konten "angka vs angka" kecepatan yang terbukti FYP), `Donut`, `Bars` (bar mendatar tumbuh + angka; perbandingan), `SignalBars`, `WifiWaves` (`pulse`), `Ripple` (ping/notif/tap), `Morph` (bentuk ke bentuk; kedua path harus berstruktur sama).

**Cara membuat SVG yang bagus** (berlaku juga untuk prop baru di `Props.tsx`):
- Satu bahasa visual: garis membulat (`strokeLinecap/Join="round"`), tebal garis seragam per ukuran, warna hanya dari tema (`t.fg`/`t.accent`/`t.bg`, `K` untuk kartu putih), kesan 2.5D = muka + sisi lebih gelap (`shade(warna, -0.3)`) + kilap putih tipis + bayangan lembut.
- Gerak dari frame dengan preset `Motion.ts`: tergambar (`pathLength={1}` + `strokeDasharray`/`evolvePath`), tumbuh, berjalan di path (`getPointAtLength`), bukan pop skala dari nol.
- Label yang menempel pada titik di path: hitung posisinya dengan `@remotion/paths` (`getPointAtLength`, `getTangentAtLength`) dari path yang sama, jangan tebakan.
- Teks panjang tulis sebagai HTML di atas SVG (font tema, mudah dibaca); teks di dalam SVG cukup angka/label pendek dengan `fontFamily={display|label}`.
- Hindari filter berat (blur besar, banyak `feGaussianBlur`) yang dianimasikan di 60 fps; additive glow hanya di latar gelap.
- Array/path yang dipakai tiap frame dihitung sekali (konstanta modul atau `useMemo`).
- Cek still di awal, tengah animasi, dan setelah selesai; semua di zona aman langkah 6.

**Kapan pakai apa:** istilah/benda disebut sekilas → `IconTile` kecil di samping teks; alur/jalur/penyebab → `NetFlow` atau `FlowLine`; angka kecepatan/ping/kuota → `Gauge` atau `Bars`; menunjuk bagian layar/mockup → `Arrow` atau `sorot`; platform disebut → `BrandBadge`; penutup → `FollowBar`; benda utama video (modem, kabel, ODP) → ilustrasi `Props.tsx`/anime/3D, bukan ikon.

## Ilustrasi pengganti ikon (`components/Props.tsx`)
Setiap objek digambar untuk konteksnya, bukan simbol umum. Pakai lewat `PROPS[key]` (field `prop` di script.json) atau import langsung:
- Jaringan/lapangan: `olt` (rak OLT, LED berkedip), `fiber` (gulungan patch cord kuning), `odp` (closure di tiang + kabel drop), `connector` (SC/APC hijau), `bent` (kabel tertekuk di sela pintu), `cut` (kabel putus, serat kaca berkilau), `modem`, `house` / `<House variant lit>` (rumah genteng, warna dinding bervariasi)
- Mockup aplikasi: `billing` (kartu QR + centang), `nms` (donat status + bar), `gateway` (router dengan port), `pulse` (sparkline), `geo` (peta + geofence + pin), `stock` (tumpukan kardus)
- Penanda: `<CautionTape text>` (pita kuning-hitam, pengganti ⚠️), `<AlarmPill />` (pengganti 🚨)
- Rumah & lapangan (`PropsExtra.tsx`, kunci `EXTRA_PROPS`): `cabinet`, `floor-good` / `floor-bad` (denah rumah + jangkauan), `phone-bars`, `phone`, `laptop`, `tv`, `wall`, `mirror`, `microwave`, `splicer` (`<Splicer join={0..1}>`), `meter` (`<PowerMeter reading ok>`)

Butuh objek baru? Gambar komponen baru di Props.tsx dengan gaya yang sama (bentuk tebal membulat, sisi samping lebih gelap untuk kesan 2.5D, highlight putih tipis, palet `K`), lalu cek dengan `npx remotion still Sheet out/props.jpg --scale=0.6`. Jangan kembali ke emoji walaupun lebih cepat — user langsung melihatnya sebagai "AI". Foto asli dari user (ODP di tiang, teknisi, kantor) selalu lebih baik lagi kalau tersedia.

## Adegan 3D (`components/ThreeKit.tsx` + `ThreeKitProps.tsx`, sejak 8 Okt 2026)
Template punya kit 3D (Three.js lewat `@remotion/three`; paketnya sudah ada di `node_modules` bersama). User sudah melihat klip uji GPS (`uji-3d-gps/`) dan setuju dengan gayanya.

**Kapan dipakai — otomatis, tidak perlu ditanyakan ke user:**
- brief atau format ide memuat "Adegan 3D", **atau**
- topiknya tentang sesuatu di ruang/orbit atau yang lebih jelas kalau diputar: bumi, satelit, GPS, sinyal yang merambat, aliran data antar perangkat/server, bagian dalam perangkat, perbandingan ukuran.

Cukup 1–2 scene inti (biasanya penjelasan/payoff), bukan seluruh video; scene lain tetap tipografis + anime. Jangan untuk tutorial menu aplikasi (pakai mockup 2D) atau scene yang isinya cuma teks.

**Isi kit:**
- `Stage3D`: kanvas 3D transparan seukuran komposisi, lampu, dan bintang (`stars={false}` untuk mematikan). Kamera dari prop `cam` `{ position, target, fov }` yang dihitung per frame.
- `HoloGlobe`: globe digital (bola navy, garis lintang-bujur cyan, pendar atmosfer). Child-nya ikut berputar. Benua: taruh `<LandDots radius={R} />` (ThreeKitProps) sebagai child dan turunkan `grid` ke ±0,1–0,15. Dibantu `GlobePin` (pin di lat/lon dengan riak), `onSphere(lat, lon, r)`, dan `yawFacing(lat, lon)` (rotasi supaya titik itu menghadap kamera).
- `Satellite` dan `orbit(P, T, radius, w, mid)`: orbit yang melewati titik P di frame `mid`, dengan `.at(f)` dan `.ring()`. `PathLine` untuk orbit/rute tipis.
- `Beam` (tabung bercahaya) dan `Signal` (beam tumbuh dari A ke B, lalu pulsa berjalan): satelit → HP, router → perangkat, server → server.
- `Phone3D`: HP 3D yang layarnya warna atau gambar dari `public/` (ilustrasi anime, mockup aplikasi). `useImageTexture` untuk tekstur lain.
- `Router3D` (router meja tanpa logo, 5 port Ethernet dengan LED berkedip; `glow={{ 1: warna }}` menyorot port, `routerPort(i)` = posisi port), `Laptop3D`, dan `Cable` (kabel padat dari A ke B yang tumbuh lewat `progress`). Dipakai di seri "Belajar MikroTik dari Nol" (colokan ether1/ether2, NAT masquerade laptop → router → internet).
- `toScreen(v, cam, w, h)`: posisi layar sebuah titik 3D, untuk label 2D yang menempel di objek.
- Contoh lengkap: `references/example-3d-gps.tsx` (8 dtk: globe + 3 satelit + sinyal ke kota tujuan + host + kartu teks).

**Prop 3D tambahan (`components/ThreeKitProps.tsx`, 9 Okt 2026).** Semua dari primitif Three.js (tanpa unduhan, tanpa logo), bergerak dari `f` atau nilai 0..1. Contoh adegan 9:16 untuk masing-masing ada di `references/example-3d-props.tsx` (galeri `uji-3d-aset/`, sudah dicek still-nya):

| Prop | Isi dan parameter penting | Cocok untuk |
|---|---|---|
| `Tower3D` + `TOWER.top` | menara BTS rangka merah-putih, 3 antena sektor, parabola, lampu kedip; `glow` | sinyal HP, 4G/5G, BTS palsu |
| `SignalWaves` | gelombang radio menyebar; `arc` (sebagian lingkaran, gaya WiFi), `flat` (di lantai), `reach`, `period` | pancaran BTS/router/perangkat |
| `Car3D` + `CAR.rig` | mobil van tanpa logo, roda berputar (`drive`); `antenna` = rig BTS palsu di atap | BTS palsu/SMS blast |
| `phoneScreen(opts)` → `Phone3D texture` | layar HP dari canvas: jam, label jaringan (4G/2G), bar sinyal, judul app, gelembung chat/SMS (`warn` = garis merah), teks besar | SMS/WA penipuan, notifikasi, progres |
| `LandDots` (+`landPoints`) | benua titik-titik dari data Natural Earth 1:50m (domain publik, ±25 rb titik, jarak 0,7°), child `HoloGlobe` dengan radius yang sama; `highlight` mewarnai titik dalam radius derajat dari lat/lon (beberapa lingkaran kecil untuk satu negara), `px` ukuran titik | peta dunia, menyorot Indonesia/negara |
| `GlobeArc` + `arcPoints`/`routePoints` | busur bercahaya di atas globe (child `HoloGlobe`); tinggi 0,3–0,8 = lalu lintas data, ≈0,01 = menempel permukaan. Dengan `LandDots`, beri titik belok supaya rute laut tidak memotong daratan (contoh `RuteKabel`) | serangan DDoS, data antarkota/negara, rute kabel laut |
| `ServerRack3D` + `RACK` | rak server, LED berkedip; `load` (sibuk, kuning), `alarm` (merah berdenyut) | cloud, data center, server diserang |
| `Chip3D` + `CHIP_BLOCKS` | chip dengan blok CPU/GPU/NPU/memori, jalur emas, tutup logam; `open` (tutup terangkat), `active` (blok menyala) | NPU/AI di HP & laptop, chip baru |
| `TvBox3D` | STB Android generik, jam LED depan, antena; `infected` (merah berkedip) | STB murah/botnet/malware |
| `QrStand3D` | standee QR akrilik ("SCAN UNTUK BAYAR", QR bukan kode asli, tanpa logo QRIS); `sticker` (stiker QR lain ditempel), `peel` (dikelupas) | quishing/QRIS palsu |
| `FiberCore3D` | serat optik tembus pandang, pulsa cahaya memantul di inti, ujung terkupas; `bend` (ditekuk tajam → cahaya bocor, setelah tikungan meredup) | cara kerja fiber, kabel jangan ditekuk |
| `SeaCable3D` + `seaCableTip` | kabel bawah laut terpotong: pelindung plastik, kawat baja terpilin, tembaga, gel, serat warna-warni berkedip | kabel internet bawah laut |
| `Ont3D` + `ONT_LEDS`/`ontLed(i)` | modem ONT putih, LED POWER/PON/LOS/LAN/WLAN; `los` (LOS merah, PON mati, LAN/WLAN tetap nyala) | LOS merah, gangguan fiber |
| `Battery3D` | baterai pouch transparan; `level`, `charging` (petir + percikan), `heat` (partikel panas, tepi merah), `swell` (menggembung) | kesehatan baterai, ngecas sambil main |
| `Cloud3D`, `NeuralNet3D` (+`nnNode`), `Waveform3D` | awan; jaringan saraf dengan gelombang aktivasi (`wave`); gelombang suara batang/cincin | cloud, cara kerja AI, kloning suara |
| `SolarSat3D` + `SOLAR_SAT.laser` | satelit sayap surya besar + modul komputasi menyala | data center AI di orbit, satelit internet |
| `Shield3D`, `Padlock3D` | perisai `ok`/`bad`/`info` (centang/silang, `pop`); gembok `open` | 2FA, OTP, akun aman/dibobol |
| `Floor3D`, `Shadow3D`, `GlowSprite`, `Dust3D`, `GlowPath`, `Rod`, `roundedBox` | lantai grid (latar gelap), bayangan kontak, pendar bulat, partikel melayang, tabung cahaya sepanjang kurva | pelengkap semua adegan |

Catatan pemakaian prop:
- Label nama bagian (CPU, LOS, kawat baja) ditulis sebagai `Tag` 2D lewat `toScreen` dari titik lokal yang diekspor (`CHIP_BLOCKS`, `ontLed`, `TOWER.top`, `CAR.rig`, `seaCableTip`); hitung titik dunia dengan posisi, rotasi, dan skala yang sama dengan prop-nya (lihat `world()` di contoh).
- `Floor3D`, `GlowSprite`, dan `SignalWaves` memakai additive blending: tampil di latar gelap/sedang, hilang di latar putih. Untuk tema terang pakai `Shadow3D` dan warna padat.
- Array untuk `GlobeArc`/`NeuralNet3D layers` harus konstanta modul atau `useMemo`, kalau tidak geometrinya dibangun ulang tiap frame.
- Teks di `phoneScreen` kecil di layar HP 3D; pesan pentingnya tetap ditulis sebagai teks/Tag 2D atau subtitle.
- Benda yang lebar (chip, kabel, globe + halo) mudah terpotong di tepi 9:16: di jarak kamera 9 layar hanya selebar ±1,9 unit dari tengah. Cek still di awal, tengah, akhir.

**Cara pakai:**
- Buat scene baru di `src/scenes.tsx` (daftarkan di `SCENES`). Taruh `<Stage3D>` di dalam `<Backdrop>`, lalu teks, karakter anime, dan kartu sebagai lapisan 2D di atasnya. Subtitle tetap dari `Video.tsx`.
- Semua gerak dihitung dari frame (`useCurrentFrame()`): rotasi, kamera, orbit. Jangan pakai `useFrame`/clock dari R3F, dan acak hanya lewat `random()` Remotion.
- Frame 0 sudah penuh (aturan FYP): objek 3D sudah terlihat di frame 0, hanya bergerak.
- Tata letak 9:16: judul di atas (±120–420 px), objek 3D di tengah, karakter di bawah. Kamera melihat sedikit di bawah objek (`target.y` negatif) supaya objek naik.
- **Benda dekat kamera bergeser jauh di layar.** Di klip uji, satelit sempat naik ke area judul. Tentukan dulu titik layar yang diinginkan, cari posisi 3D-nya (sinar kamera dipotong dengan bola orbit), lalu pilih arah gerak yang paling pelan di layar. Cek still di awal, tengah, dan akhir scene.
- Label pada pin yang menghadap kamera: hitung `toScreen` lalu geser di ruang layar (menggeser sepanjang normal pin tidak mengubah posisinya di layar).
- Versi YouTube: `Stage3D` otomatis 1920×1080; atur ulang kamera dan tata letak 2D di `scenesWide.tsx`.
- Proyek yang dibuat sebelum 8 Okt 2026 belum punya kit ini: salin `src/components/ThreeKit.tsx` dan `remotion.config.ts` dari template kalau revisinya meminta 3D. Proyek sebelum 9 Okt 2026 belum punya `ThreeKitProps.tsx` dan `worldDots.ts`: salin keduanya bersama `ThreeKit.tsx` (Phone3D menerima `texture`, HoloGlobe menerima `grid`) dan `remotion.config.ts` terbaru.
- Render: `remotion.config.ts`, `npm run qa`, dan `npm run check:crop` otomatis memakai GL `angle` kalau ada scene yang mengimpor ThreeKit/ThreeKitProps. Tanpa itu WebGL gagal ("Error creating WebGL context"). File kit sendiri (`ThreeKit*.tsx`) tidak dihitung, jadi proyek tanpa 3D tidak berubah.
- Cek video final dengan mengambil frame dari MP4 (`npx remotion ffmpeg -ss <detik> -i <mp4> -frames:v 1 out/f.png`; ffmpeg bawaan Remotion tidak punya filter `fps`/`scale`) dan pastikan tidak ada frame hitam.

**Batasan:**
- Benua hanya lewat `LandDots` (Natural Earth, diunduh 9 Okt 2026 dengan izin user, dikemas di `components/worldDots.ts` oleh `scripts/world-dots.mjs`). Jangan minta tekstur peta dunia ke generator gambar: DashScope menolaknya (`DataInspectionFailed`). Bumi realistis bertekstur (NASA Blue Marble) belum ada.
- Model 3D dari internet (GLB) belum dipakai; mengunduhnya perlu izin user dan cek lisensi.

## Revisi umum
- **Suara/kata aneh** → ubah `pronunciation.json` atau `vo`, lalu `npm run vo` (pakai kuota) dan render.
- **Durasi/tempo scene, warna, layout, subtitle** → tidak butuh kuota; ubah kode lalu render.
- **Ganti suara** → `npm run samples -- Puck Fenrir Achird`, kirim hasilnya, biarkan user memilih nomor. Untuk suara cewek: `npm run samples -- Leda Zephyr Aoede`, lalu ubah `voices.<who>.voice` dan `npm run vo -- --only=<who>`.
- **Karakter ikut gerak / suara tidak cocok** → cek `who`/`turns` di script.json dan `src/vo-turns.json`.
- **Video hasil Edit video** (ada `src/edit.json` berisi potongan) → ubah `edit.json`, `npm run render:edit` (atau `:yt`), `npm run qa:edit`; jangan membuat narasi baru.
- **Proyek punya versi YouTube** (`output/<slug>-yt.mp4`) → revisi naskah/suara/urutan scene juga harus diterapkan ke `src/scenesWide.tsx` lalu `npm run render:yt`; revisi yang hanya soal tampilan satu format cukup format itu.

## Hal yang sudah dicoba dan gagal
- Menulis arahan gaya di dalam teks → ikut dibacakan. Pakai field `style` (speech_metadata) di Interactions API, sudah ditangani `../scripts/gemini-tts.mjs`.
- Satu request per scene → kuota habis dalam satu video.
- Timestamp dari model audio untuk memotong → meleset ±1 detik.
- Edge TTS / server TTS lama (`TTS_API_URL`) → kaku atau beraksen; hanya dipakai kalau user memintanya (`engine` selain `gemini` memakai `../scripts/generate-vo.mjs` lama dengan MP3).
- Qwen TTS di akun Alibaba user → belum aktif / kuota habis.
- Tidak ada musik latar (tidak ada aset berlisensi); sarankan user menambahkannya di TikTok. Efek suara sudah ada (langkah 6b); musik latar sintetis belum dibuat.
- Tema gelap navy di semua scene → user bilang monoton. Pakai warna berganti per scene.
- Palet (6) dan font (5 set, 12 font) diacak per video, ditambah pembuka yang sengaja beda tata letak dan posisi karakter (6–18 Okt 2026) → grid profil terlihat seperti belasan akun; user: "desain kita kok jelek ya, kaya ngga konsisten". Variasi harus di dalam satu identitas: palet brand + tiga font + kerangka sampul tetap, yang berganti isi zona visual dan pose host (bagian "Sampul & tampilan").
- Take satu suara (pernah terjadi dengan Charon) bisa berisi jeda kosong belasan detik sehingga `vo` gagal dengan "jeda ke-N di …s, padahal perkiraan …s". Isinya biasanya lengkap: transkripsikan take penuh dulu, lalu pendekkan jeda >1,5 dtk jadi ±1 dtk di `out/vo-full-<who>.wav` (simpan aslinya) dan jalankan `vo:reuse` — tidak perlu kuota baru.
- Suara **Charon** dua kali menghasilkan take berisi hening 8–22 detik di antara kalimat, sehingga pemotongan per kalimat gagal. Pendekkan jeda (simpan asli sebagai `out/vo-full-<who>.orig.wav`), lalu `npm run vo:reuse`; jangan langsung generate ulang (kuota). Kalau take-nya normal tapi narasinya lambat dengan jeda panjang di dalam kalimat, cukup `"tighten": true` di `voices.<who>` (lihat langkah 5).
- Bunyi **"dret"** di akhir kalimat terakhir suatu suara **bukan** dari model: WAV Gemini membawa chunk **C2PA** (6.070 byte) setelah chunk `data`, dan kalau file dibaca sampai habis byte itu jadi derau putih ±0,13 dtk. `cutTake` di skrip bersama sudah membaca sepanjang ukuran chunk `data` saja (7 Okt 2026). Setiap kali membaca/menulis ulang WAV Gemini sendiri (mis. memendekkan jeda Charon), ambil hanya isi chunk `data`; menyalin sampai akhir file pernah menanamkan derau itu ke take `kenalan-tim`. Cek cepat: ukuran file harus = 44 + ukuran data (+ chunk C2PA kalau file asli dari Gemini).
- Seri 10 video sekaligus (8 Okt 2026, "Belajar MikroTik dari Nol", suara Puck): 5 dari 10 take bermasalah. Ada yang menyisipkan jeda hening 2–16 dtk antar kalimat, ada yang berhenti sebelum kalimat penutup, dan pemotong otomatis menaruh potongan di tengah kalimat. Yang berhasil tanpa kuota tambahan (skrip bersama di `../scripts/`, jalankan dari folder proyek): `node ../scripts/shorten-gaps.mjs` (jeda >1,5 dtk jadi 1 dtk, hanya isi chunk `data`, ikut memindahkan `voices.<who>.cuts`), lalu `node --env-file=../.env ../scripts/fixcuts.mjs` (pecah take di setiap jeda, transkripsi tiap potongan lewat router dengan cache, cocokkan ke scene dengan kemiripan kata + pemrograman dinamis, tulis `voices.<who>.cuts`), lalu `npm run vo:reuse`. Mencocokkan lewat model bahasa sempat salah menaruh satu kalimat. Router kadang membalas "audio tidak ada" untuk potongan pendek; balasan itu harus ditolak, dan potongannya digabung ke kiri/kanan (pilih yang cocok). Take yang benar-benar kehilangan kalimat tetap harus `npm run vo` ulang (3 dari 10).
- **Pointer/kursor di mockup aplikasi yang tidak pas** (seri MikroTik, 8 Okt 2026): kursor WinBox bergerak ke koordinat tebakan (kolom isian "sekitar tengah", tombol OK di posisi tetap), padahal letak menu, isian, dan tombol berubah menurut isi dialog dan skala mockup. User menilai "pointernya nggak pas sama sekali" dan seluruh seri (10 video) dihapus. Kalau menampilkan kursor yang mengklik, hitung titik tujuannya dari tata letak elemen yang benar-benar diklik (konstanta layout yang sama dengan yang menggambar elemen itu, atau ukur lewat ref), lalu cek still **tepat di frame setiap klik**, bukan still acak per scene. Kalau tidak bisa dipastikan pas, jangan pakai kursor; sorot elemennya saja (garis tepi, kedip, panah tipografis).
- **Punch-in zoom sebagai beat utama** (13–15 Okt 2026: 7–9 per video supaya lolos cek ritme, ditambah drift 3%, transisi zoom, Ken Burns 14%) → user: "kurangi efek zoom" dan minta gerak lebih halus. Beat sekarang dari elemen baru, perubahan keadaan, dan `sorot`; zoom maks ±3 per video, 1,08–1,12×, masuk 0,4 dtk (langkah 6c dan 6e).
- Karakter ditaruh dengan offset negatif besar (`right: -120` s.d. `-150`) supaya "menyembul dari pinggir": di satu video (7 Okt 2026) dua karakter terpotong 36–62% dan user langsung protes. Taruh karakter di dalam frame dan buktikan dengan `npm run check:crop`.
- Proyek yang belum punya `check:crop` (dari arsip lama): salin `src/components/CropCheck.tsx` dan `src/Video.tsx` (kalau isinya masih sama dengan template) dari template, lalu tambahkan skrip `"check:crop": "node ../scripts/check-crop.mjs"` di package.json. Proyek lama yang masih punya salinan skrip sendiri di `scripts/` tetap jalan; untuk pindah ke skrip bersama, samakan `package.json` dengan template lalu hapus salinan yang sama namanya.
- Keras suara: sebelum 7 Okt 2026 malam MP4 keluar apa adanya di −15 s.d. −20 LUFS (Lupa Password −20,3), jadi sebagian video terdengar jauh lebih pelan dari video lain di feed. ffmpeg bawaan Remotion tidak punya `ebur128` dan `alimiter`; `loudnorm` ada tapi mode dinamisnya meratakan seluruh suara, jadi `loudnorm` hanya dipakai untuk mengukur, dan gain + limiter dikerjakan `loudness.mjs`. Jangan menaikkan volume lewat `<Audio volume>` di Remotion (tanpa limiter, bisa clipping).
- Transkripsi router kadang salah membaca angka (110 ribu jadi 100.000). Untuk harga/angka penting, tanyakan ulang secara spesifik sebelum menyimpulkan VO salah.
