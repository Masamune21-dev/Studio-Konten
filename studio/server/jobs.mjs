import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { OUTPUT, ROOT, RESULTS } from "./config.mjs";
import { all, get, parse, run, setting } from "./db.mjs";
import { cleanTags } from "./llm.mjs";
import { describeLook } from "./looks.mjs";
import { ttsStatus } from "./tts.mjs";
import { pillarNote, profileSections } from "./content.mjs";
import { BRAND, socialList } from "../../scripts/brand.mjs";

// One Claude Code job at a time: video work is heavy (TTS quota, rendering).
let current = null; // { id, child }
const listeners = new Set();
export const onEvent = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const emit = (e) => listeners.forEach((fn) => fn(e));

const SYSTEM = `Kamu dijalankan otomatis dari dashboard "Studio Konten" tanpa user yang bisa menjawab. Jangan bertanya balik: ambil keputusan sendiri mengikuti skill video-tiktok dan memori. Kerjakan di ${ROOT}. Selalu akhiri dengan menulis file hasil JSON yang diminta.`;

const resultFile = (jobId) => path.join(RESULTS, `job-${jobId}.json`);

const resultContract = (jobId, yt = false) =>
  yt
    ? `
Di akhir, tulis file ${resultFile(jobId)} berisi JSON:
{"title": "<judul YouTube, maksimal 70 karakter>", "video": "<path absolut mp4 final, di ${OUTPUT}/<slug>-yt.mp4>", "project_dir": "<path absolut proyek>", "caption": "<deskripsi YouTube 2–5 baris: isi singkat + ajakan like/subscribe/komentar, tanpa hashtag>", "hashtags": ["#..."] (3–5), "duration_s": <angka>, "notes": "<hal yang perlu dicek user, singkat>"}`
    : `
Di akhir, tulis file ${resultFile(jobId)} berisi JSON:
{"title": "...", "video": "<path absolut mp4 final, di ${OUTPUT}/<slug>.mp4>", "project_dir": "<path absolut proyek>", "caption": "<caption TikTok siap tempel, tanpa hashtag>", "hashtags": ["#..."] (maksimal 5), "duration_s": <angka>, "notes": "<hal yang perlu dicek user, singkat>"}`;

// The YouTube (16:9) version of a finished TikTok video: same project, narration and timing.
const landscapeRules = (projectDir, portraitPath) => `Aturan versi YouTube (lihat bagian "Versi YouTube" di skill video-tiktok):
- JANGAN membuat suara baru: jangan jalankan npm run vo, vo:reuse, atau samples, dan jangan memanggil Gemini TTS. Pakai public/vo, src/vo-durations.json, dan src/vo-turns.json yang sudah ada, jadi naskah, timing, dan subtitle sama dengan versi TikTok.
- Versi TikTok (komposisi Video, src/scenes*.tsx, ${portraitPath}) jangan diubah dan jangan dirender ulang.
- Kalau ${projectDir} belum punya src/VideoWide.tsx, komposisi VideoWide di src/index.ts, atau skrip render:yt, pasang dulu dari template skill.
- Tulis layout landscape 1920×1080 untuk SETIAP scene di src/scenesWide.tsx: pakai ulang gambar, karakter, palet, dan gaya visual yang sama, tapi tata ulang untuk layar lebar (bukan versi TikTok yang diperkecil). Cek still tiap scene dengan komposisi VideoWide sebelum render.
- Scene s01 (sampul): kalau proyek punya src/components/Cover.tsx, susun versi lebarnya dari CoverFrame, CoverTitle, CoverViz, dan CoverHost yang sama (tata letak 16:9 otomatis: judul di kiri, host di kanan), mode dan label seri tetap.
- Sebelum render, npm run check:crop -- --wide harus lolos (karakter tidak boleh terpotong di pinggir; lihat still di out/crop-yt/).
- Render dengan npm run render:yt → ${OUTPUT}/<slug>-yt.mp4 (keras suara ikut dinormalkan).
- Setelah render, jalankan npm run qa -- --yt. Setiap ✗ wajib diperbaiki (render ulang, qa lagi) sampai tidak ada ✗; ✗ "Frame 0 sudah terisi" pada video yang versi TikTok-nya juga gagal frame 0 cukup dilaporkan di notes. Ringkas ⚠ yang tersisa di notes.`;

// Anime character cut-outs made in the Media page replace the hand-drawn SVG characters.
const MOUTH_NAMES = { closed: "tutup", mid: "setengah", open: "buka" };
const characterAssets = () =>
  all("SELECT id, path, note FROM media WHERE char IS NOT NULL AND cutout = 1 AND mouth_of IS NULL ORDER BY id DESC LIMIT 80")
    .filter((m) => fs.existsSync(m.path))
    .map((m) => {
      const mouths = all("SELECT mouth, path FROM media WHERE mouth_of = ?", m.id).filter((f) => fs.existsSync(f.path));
      const lips = mouths.length ? `\n  frame mulut (posisi identik, ganti sesuai keras suara): ${mouths.map((f) => `${MOUTH_NAMES[f.mouth] ?? f.mouth}=${f.path}`).join(", ")}` : "";
      return `- ${m.path}${m.note ? ` (${m.note})` : ""}${lips}`;
    })
    .join("\n");

// Frame 0 of the last three TikTok videos, so the new cover's visual zone differs from theirs.
const recentCovers = () =>
  all("SELECT project_dir FROM videos WHERE project_dir IS NOT NULL AND orientation = 'portrait' ORDER BY id DESC LIMIT 3")
    .map((v) => path.join(v.project_dir, "out/qa/f0.jpg"))
    .filter((f) => fs.existsSync(f));
// The user found the profile grid "jelek, kaya ngga konsisten" (19 Oct 2026): random palettes, fonts,
// opener layouts and host spots. Every new video now follows the cover system.
const coverNote = (look) => {
  const covers = recentCovers();
  const json = look.mode ? `Isi "look": ${JSON.stringify({ mode: look.mode, tag: look.tag })} di script.json` : `Isi "look" (mode dan tag) di script.json`;
  return [
    `Sampul & tampilan (bagian "Sampul & tampilan" di skill; user 19 Okt 2026: grid profil "kaya ngga konsisten"): ${describeLook(look)}. ${json}.`,
    `Satu palet brand dan tiga font dari design.ts (display, serif, label; mono untuk kode) untuk SELURUH video: jangan memuat font lain dan jangan membuat palet sendiri; warna dari K / THEMES / t.fg / t.accent.`,
    `Scene s01 = sampul (frame 0 = gambar di grid profil): "kind": "cover" atau scene sendiri dari CoverFrame + CoverTitle (atau CoverStack) + CoverViz + CoverHost di components/Cover.tsx. Label seri kiri atas, judul ≤ 5 kata dengan satu kata aksen dan ekor pertanyaan serif miring (angka raksasa lewat Big), host di kanan bawah dengan tinggi tetap; pojok kiri bawah (angka views TikTok) dan 240 px teratas/terbawah tetap kosong. Lihat dulu npx remotion still AsetSampul.`,
    `Yang boleh beda antar video hanya zona visual di tengah (HP, voucher, router, kartu OTP, objek 3D, kartu komentar…) dan pose/ekspresi host: jenis visualnya harus beda dari sampul tiga video terakhir${covers.length ? ` (${covers.join(", ")})` : ""}. npm run qa memeriksa "Sampul konsisten" (✗ wajib diperbaiki) dan "Font & warna brand".`,
  ].join("\n");
};

// How the last few videos opened, so a new one does not start the same way.
const recentOpeners = () =>
  all("SELECT project_dir FROM videos WHERE project_dir IS NOT NULL ORDER BY id DESC LIMIT 5")
    .map((v) => {
      try {
        const s = JSON.parse(fs.readFileSync(path.join(v.project_dir, "src/script.json"), "utf8")).scenes?.[0];
        return String(s?.vo ?? s?.turns?.[0]?.vo ?? "").split(/(?<=[.?!])\s/)[0].slice(0, 90);
      } catch {
        return "";
      }
    })
    .filter(Boolean);

// Which Gemini TTS model still has free quota today.
const voiceNote = () => {
  const t = ttsStatus();
  const [flash, lite] = t.models;
  const reset = new Date(t.reset).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
  // scripts/gemini-tts.mjs already moves to the next key when one is spent.
  if (flash.left >= 2) return "";
  if (lite.left >= 2) return `Kuota Gemini TTS ${flash.model} hari ini habis di semua key (${flash.used}/${flash.limit}). Buat suara dengan model cadangan: GEMINI_TTS_MODEL=${lite.model} npm run vo`;
  return `Kuota Gemini TTS hari ini kemungkinan habis untuk kedua model (reset ±${reset} WIB). Coba sekali; kalau ditolak "per day", berhenti dan tulis di notes bahwa suara menunggu kuota.`;
};

// Quick choices on the Edit video page (web/src/App.jsx EDIT_OPTIONS uses the same keys).
const EDIT_OPTIONS = {
  subtitle: "Subtitle per kata dari transkrip Whisper (\"captions\": true); perbaiki ejaan nama/istilah yang salah dengar lewat \"koreksi\".",
  potong: "Potong jeda panjang, salah ucap, pengulangan, dan bagian kosong; potong di tengah jeda yang tercantum di out/transcript-*.txt supaya tidak ada suku kata yang terpotong.",
  judul: "Judul hook di frame pertama (overlay \"judul\" dengan \"t\": 0) yang langsung menyebut masalah/janji videonya.",
  ikon: "Ikon dan grafik saat istilah teknis atau angka disebut: overlay \"ikon\" (Lucide dalam IconTile), \"jaringan\" (alur perangkat → router → internet), \"gauge\" untuk angka kecepatan, \"panah\" ke bagian penting; logo platform (\"logo\") saat aplikasinya disebut.",
  sosmed: "Penutup: ajakan follow dengan logo sosmed (overlay \"follow\"), akunnya dari profil brand (bagian KANAL RESMI di bawah).",
  sfx: "Efek suara pada overlay yang muncul dan momen penting (\"s\" di overlay atau \"sfx\"), pelan di bawah suara rekaman.",
  zoom: "Zoom/sorot halus di 1–3 momen terpenting (maks 3 zoom, skala ≤ 1,12), bukan di setiap kalimat.",
};

export function buildPrompt(job) {
  const i = job.input ?? {};
  const brand = setting("brand_profile", "");
  const media = (i.media ?? []).map((m) => `- ${m.path} (${m.kind}${m.note ? `: ${m.note}` : ""})`).join("\n");
  const chars = job.type === "tes" ? "" : characterAssets();
  const charNote = chars
    ? `Aset karakter anime (PNG transparan, ${BRAND.outfit}). Kalau video butuh karakter, pakai gambar ini, JANGAN pakai komponen Character SVG. Salin yang dipakai ke public/img/ proyek, tampilkan dengan <Img>, hidupkan dengan gerak halus (masuk geser/pop, napas naik-turun, sedikit miring saat bicara) dan ganti gambar pose sesuai kalimat. Hanya karakter yang sedang bicara yang bergerak/ganti mulut; yang lain diam. ${BRAND.hostRules ? `${BRAND.hostRules} Kalau brief menyebut host yang bertentangan dengan pembagian ini, ikuti pembagian ini dan sebutkan di notes. ` : ""}${BRAND.voices ?? "Setiap karakter yang bicara punya suara sendiri (lihat bagian dialog di skill video-tiktok)"}:\n${chars}`
    : "";
  if (job.type === "tes") {
    return `Ini tes koneksi dari dashboard, JANGAN membuat atau mengubah video. Cukup cek bahwa skill video-tiktok tersedia (sebut namanya saja), lalu tulis file ${resultFile(job.id)} berisi JSON {"title":"Tes koneksi","video":"","notes":"<ringkasan 1 kalimat: skill ditemukan atau tidak>"}.`;
  }
  if (job.type === "landscape") {
    return `Gunakan skill video-tiktok untuk membuat versi YouTube (landscape 16:9) dari video TikTok yang sudah jadi.
Judul: ${job.title}
Proyek: ${i.project_dir}
Video TikTok sumber: ${i.video_path}

${landscapeRules(i.project_dir, i.video_path)}
${resultContract(job.id, true)}`;
  }
  if (job.type === "edit") {
    const clips = (i.media ?? []).filter((m) => m.kind === "video");
    const pics = (i.media ?? []).filter((m) => m.kind !== "video");
    const format =
      i.format === "landscape"
        ? "YouTube 16:9: \"format\": \"landscape\", komposisi EditWide, render dengan npm run render:edit:yt"
        : i.format === "asli"
          ? "ikuti orientasi rekaman utama (berdiri → 9:16 dengan npm run render:edit, rebah → 16:9 dengan npm run render:edit:yt)"
          : "TikTok 9:16: \"format\": \"portrait\", komposisi Edit, render dengan npm run render:edit";
    const opts = (i.options ?? []).map((k) => EDIT_OPTIONS[k]).filter(Boolean);
    const brand = (i.options ?? []).includes("sosmed") ? profileSections(["KANAL RESMI"]) : "";
    const wide = i.format === "landscape";
    return [
      `Gunakan skill video-tiktok, langkah 9 "Edit video upload", untuk mengedit rekaman yang diupload user dari halaman Edit video di Studio. Yang diedit adalah rekaman user sendiri: jangan membuat narasi Gemini TTS, karakter, atau scene animasi baru kecuali user memintanya.`,
      `Judul: ${job.title}`,
      `Rekaman (salin ke public/footage/ proyek dengan cp -c):\n${clips.map((m) => `- ${m.path}${m.note ? ` (${m.note})` : ""}`).join("\n")}`,
      pics.length ? `Gambar dari user (boleh dipakai sebagai overlay, foto, atau logo di video):\n${pics.map((m) => `- ${m.path}${m.note ? ` (${m.note})` : ""}`).join("\n")}` : "",
      `Format: ${format}.`,
      i.duration ? `Target durasi: ±${i.duration} detik (npm run qa:edit -- --durasi=${i.duration}); pilih bagian terbaik, jangan mempercepat suara.` : "Durasi: ikuti isi; buang bagian yang tidak perlu, jangan dipanjang-panjangkan.",
      `Permintaan user:\n${i.instructions?.trim() || "(tidak ada catatan: buat versi terbaik dan paling enak ditonton dari rekamannya)"}`,
      opts.length ? `Yang dicentang user:\n${opts.map((o) => `- ${o}`).join("\n")}` : "",
      brand ? `Profil brand (akun resmi untuk ajakan follow):\n${brand}` : "",
      `Langkah: buat proyek dari template (nama folder = slug judul), salin rekaman, npm run transcribe, baca out/transcript-*.txt, tulis src/edit.json, cek still dengan npm run frames -- --comp=${wide ? "EditWide" : "Edit"} <frame…> (frame 0 harus sudah berisi judul/visual, overlay tidak menutupi wajah orang di rekaman), render, lalu npm run qa:edit${i.duration ? ` -- --durasi=${i.duration}` : ""} dan perbaiki setiap ✗. Ringkas ⚠ yang tersisa di notes.`,
      `${resultContract(job.id, wide)}\nTambahkan juga "orientation": "portrait" atau "landscape" (format hasilnya) di JSON itu.`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  if (job.type === "revisi") {
    // Videos made outside the dashboard have no session to resume, so point at the project.
    const where = job.session_id ? `yang barusan kamu buat (video: ${i.video_path})` : `di proyek ${i.project_dir} (video: ${i.video_path}); baca src/script.json dan src/scenes*.tsx dulu, pakai skill video-tiktok`;
    // The TikTok and YouTube versions share one project and one narration.
    const format =
      i.orientation === "landscape"
        ? `\nIni versi YouTube 16:9 (komposisi VideoWide, layout di src/scenesWide.tsx). Render ulang dengan npm run render:yt. Jangan membuat suara baru kecuali revisinya memang mengubah narasi; kalau narasi berubah, versi TikTok (${i.sibling_path ?? "komposisi Video"}) ikut berubah, jadi render ulang juga dengan npm run render dan sebutkan di notes.\n`
        : i.sibling_path
          ? `\nVideo ini punya versi YouTube 16:9 dari proyek yang sama (${i.sibling_path}, komposisi VideoWide, src/scenesWide.tsx). Kalau revisi mengubah naskah, suara, urutan, atau isi scene, sesuaikan juga scenesWide dan render ulang versi YouTube dengan npm run render:yt; kalau revisinya hanya soal tampilan TikTok, biarkan versi YouTube.\n`
          : "";
    // Uploads edited on the Edit video page (src/edit.json): other render and QA commands.
    let editNote = "";
    try {
      const e = i.project_dir && JSON.parse(fs.readFileSync(path.join(i.project_dir, "src/edit.json"), "utf8"));
      if (e?.segments?.length) editNote = `\nIni proyek edit rekaman user (langkah 9 di skill, src/edit.json): ubah edit.json, render ulang dengan npm run render:edit${i.orientation === "landscape" ? ":yt" : ""}, lalu npm run qa:edit (bukan check:crop/qa). Jangan membuat narasi baru.\n`;
    } catch {}
    return `Revisi video ${where}.\nPermintaan revisi dari user:\n${i.feedback}\n${editNote}${format}${media ? `\nMedia tambahan dari user:\n${media}\n` : ""}${charNote ? `\n${charNote}\n(Hanya ganti karakter kalau revisinya menyangkut karakter.)\n` : ""}\nSebelum render ulang, jalankan npm run check:crop${i.orientation === "landscape" ? " -- --wide" : ""} dan perbaiki karakter yang terpotong (✗). Render ulang ke file mp4 yang sama, lalu jalankan npm run qa${i.orientation === "landscape" ? " -- --yt" : ""}: perbaiki ✗ yang muncul karena revisi ini atau yang mudah diperbaiki; ✗ lama yang di luar permintaan revisi (mis. frame 0 video yang dibuat sebelum aturan FYP) cukup dilaporkan di notes. Perbarui ${i.orientation === "landscape" ? "judul/deskripsi YouTube" : "caption/hashtag"} kalau perlu.${resultContract(job.id, i.orientation === "landscape")}`;
  }
  const kind = {
    promo: "video promosi",
    edukasi: "video edukasi/tips",
    cerita: "video cerita di balik layar",
    klip: "klip vertikal dari video mentah yang diupload user (langkah 9 \"Edit video upload\" di skill: npm run transcribe dengan Whisper lokal yang sudah terpasang, pilih momen terbaik, tulis src/edit.json, 9:16, subtitle per kata, judul hook, npm run render:edit dan qa:edit)",
  }[i.kind ?? "edukasi"];
  return [
    `Gunakan skill video-tiktok untuk membuat ${kind} TikTok.`,
    `Judul/ide: ${job.title}`,
    i.brief ? `Brief dari user:\n${i.brief}` : "",
    i.duration
      ? `Target durasi: ±${i.duration} detik (pilihan user, wajib dipenuhi: npm run qa -- --durasi=${i.duration} memberi ⚠ di bawah ${Math.round(i.duration * 0.85)} dtk). Penuhi dengan isi (naskah lebih lengkap, lebih banyak poin/scene), bukan dengan memperlambat atau mempercepat suara.`
      : // "Bebas" in Buat video (18 Oct 2026, the user: "bisa lebih dari 60 detik"): no target at all.
        `Durasi bebas (pilihan user, tanpa target): panjang video mengikuti isi dan boleh lebih dari 60 detik. Jangan membuang poin penting atau memadatkan naskah demi muat 60 detik, dan jangan juga memanjangkan dengan scene kosong, pengulangan, atau pembuka yang lambat; setiap scene tetap satu pesan. Jalankan ${i.kind === "klip" ? "npm run qa:edit" : "npm run qa"} tanpa --durasi: durasi hanya dicatat (⚠ baru di atas 3 menit, batas YouTube Shorts).`,
    `Tempo bicara wajar, ±2–2,4 kata per detik seperti video lama yang disetujui user (koreksi 9 Okt 2026: video 3,2 kata/dtk dinilai "ngomong cepet"). Jangan menulis "cepat"/"tempo cepat" di style suara, dan jangan memakai tighten dengan tempo > 1 (bawaan sekarang hanya memendekkan jeda). QA memberi ✗ di atas 2,7 kata/dtk.`,
    `Aturan FYP (bagian "Aturan FYP" di skill): frame pertama sudah penuh (teks hook dan visual utama terlihat di frame 0, bukan latar kosong yang baru terisi); hook terucap dalam ≤2 detik; satu pesan per scene tanpa jeda panjang; penutup tanpa ajakan daftar/iklan panjang (punchline, pemicu komentar, atau loop ke pembuka); kata kunci topik diucapkan dan tertulis di layar.`,
    media ? `Media dari user (pakai kalau relevan, foto/rekaman asli lebih diutamakan daripada ilustrasi):\n${media}` : "",
    charNote,
    // 3D scenes (ThreeKit, since 8 Oct 2026) are picked by the agent from the idea itself.
    i.kind === "klip"
      ? ""
      : `Adegan 3D (bagian "Adegan 3D" di skill): kalau brief/format menyebut "Adegan 3D", atau topiknya tentang bumi/satelit/GPS, sinyal yang merambat, aliran data antar perangkat/server, atau benda yang lebih jelas kalau diputar, jadikan 1–2 scene inti adegan 3D dengan components/ThreeKit.tsx dan prop siap pakai di components/ThreeKitProps.tsx (menara BTS, mobil BTS palsu, layar HP dari canvas, busur di globe, rak server, chip CPU/GPU/NPU, STB Android, standee QR + stiker palsu, serat optik yang bisa ditekuk, kabel bawah laut, modem ONT dengan LED LOS, baterai panas/menggembung, awan, jaringan saraf, gelombang suara, satelit surya, perisai, gembok; contoh: references/example-3d-gps.tsx dan references/example-3d-props.tsx). Scene lain tetap gaya biasa, dan karakter anime tetap jadi host di depan adegan 3D. Topik yang tidak cocok tidak perlu dipaksakan 3D.`,
    // Sound effects (components/Sfx.tsx, since 10 Oct 2026): synthesised, on by default.
    i.kind === "klip"
      ? ""
      : `Efek suara (langkah 6b di skill, diminta user 10 Okt 2026): beri suara pada aksi yang terlihat, dengan jenis yang bervariasi sesuai aksinya: klik saat pointer mengklik (Pointer, titik tujuan dihitung dari tata letak), ketikan saat teks diketik (useTyping/SfxTrain), tap saat jari mengetuk HP, pop/swipe saat kartu muncul, tik saat angka menghitung, notif/success/error/alarm sesuai momennya. Whoosh ganti scene sudah otomatis. Satu suara untuk satu aksi, jangan setiap teks muncul diberi suara.`,
    // Editing layer (components/Edit.tsx, since 10 Oct 2026): transitions, camera, caption emphasis, rhythm check.
    i.kind === "klip"
      ? ""
      : `Editing (langkah 6c di skill, diminta user 10 Okt 2026): transisi antar-scene sudah bervariasi otomatis; pakai "transisi" per scene kalau ada makna (flash untuk reveal/payoff, glitch untuk peretasan/penipuan). Beri beat visual setiap ≤3 detik, utamakan elemen/kartu baru yang masuk bertahap mengikuti ucapan, perubahan keadaan (angka, warna, centang, stempel), "sorot" di script.json (area disorot, sekelilingnya meredup; posisi dihitung dari tata letak elemennya), atau ganti layar; "tekan" 1–3 kata kunci per scene di subtitle. Cek transisi dengan npm run frames -- --transisi dan bidikan zoom/sorot dengan npm run frames -- --isyarat, lalu setelah render baca filmstrip out/qa/ritme.png dari npm run qa: bagian layar diam ✗ (≥6,5 dtk) wajib diperbaiki.`,
    // Motion (components/Motion.ts, Edit.tsx; since 16 Oct 2026): less zoom, smoother movement.
    i.kind === "klip"
      ? ""
      : `Gerak halus dan zoom secukupnya (langkah 6e dan 6c di skill, diminta user 16 Okt 2026: "kurangi efek zoom", gerak lebih smooth): punch-in "zoom" paling banyak ±3 per video dan 1 per scene, hanya untuk momen terpenting (skala bawaan 1,08, maks 1,12), jangan dipakai untuk menambal ritme. Animasi scene pakai preset components/Motion.ts (EASE, DUR, SPRING, ramp, enterStyle): masuk = fade + geser pendek 15 frame, tanpa scale dari 0 untuk kartu/teks besar, tanpa pantulan besar, gerak besar ≥18 frame, tidak ada elemen yang muncul/hilang/lompat dalam 1 frame. npm run qa memeriksa "Zoom secukupnya" dan "Gerak halus (tanpa patah)"; perbaiki ✗ dan sebut ⚠ yang tersisa di notes.`,
    // Motion design playbook (components/MotionKit.tsx; research of the best Claude motion graphics, 16 Oct 2026).
    i.kind === "klip"
      ? ""
      : `Motion design (langkah 6f di skill, hasil riset motion graphic buatan Claude yang paling banyak ditonton): tiap scene punya gerak utama + sekunder + lapisan ambient (AccentShapes/float) sehingga tidak ada frame beku; minimal 1–2 pergantian berupa match cut ("transisi": "cut" + Handoff: pill/kartu scene sebelumnya tumbuh jadi latar/kartu scene berikutnya, elemen lain keluar dulu) dan sisanya transisi otomatis (tanpa crossfade); judul/kalimat kunci pakai KineticText dengan times={wordTimes(scene, teks)} dan hanya 1–3 kata kunci ditekan; angka kunci pakai CountUp roll, perbandingan Bars/Gauge, sebelum→sesudah WordSwap; kamera tanpa zoom lewat Parallax; SFX di setiap beat. Jalankan daftar periksa sutradara di 6f sebelum render. Contoh: npx remotion render AsetMotion.`,
    // Icon & SVG kits (components/Icons.tsx, Svg.tsx; since 16 Oct 2026, asked by the user).
    i.kind === "klip"
      ? ""
      : `Ikon & SVG (bagian "Ikon & SVG" di skill, diminta user 16 Okt 2026): lihat dulu galeri npx remotion still AsetIkon / AsetSvg. Istilah jaringan/teknologi yang disebut → IconTile (ikon Lucide dalam ubin 2.5D gaya rumah, bukan ikon polos), alur perangkat → router → internet → NetFlow, angka kecepatan/ping → Gauge atau Bars, menunjuk → Arrow; logo platform (BrandBadge/FollowBar) hanya untuk menyebut platform atau ajakan follow${socialList() ? ` (${socialList()})` : ""}. Benda utama video tetap ilustrasi Props.tsx/anime/3D, emoji tetap dilarang.`,
    // Cover system (components/Cover.tsx, since 19 Oct 2026): brand palette + three fonts, frame 0 = cover.
    i.look ? coverNote(i.look) : "",
    (() => {
      const openers = recentOpeners();
      return `Pembuka (hook) jangan diawali "Bro" dan jangan mirip pembuka video sebelumnya${openers.length ? `:\n${openers.map((o) => `- "${o}"`).join("\n")}` : "."}`;
    })(),
    voiceNote(),
    i.pillar === "brand" ? "" : pillarNote(i.pillar),
    i.pillar === "brand"
      ? ""
      : `${i.riset ? "Ide ini ditandai PERLU RISET: wajib cek ke web dulu sebelum menulis naskah. " : ""}Fakta umum harus akurat. Untuk fitur aplikasi/AI, versi OS, harga produk lain, atau berita, riset dulu di web (WebSearch/WebFetch), utamakan sumber resmi, cek tanggalnya, dan sebut sumbernya di notes. Jangan mengarang angka statistik. Tampilan aplikasi digambar sebagai mockup bertanda "ilustrasi tampilan", tanpa menyalin logo resmi aplikasi lain. Lihat bagian "Konten edukasi umum" di skill video-tiktok.`,
    !brand
      ? ""
      : i.pillar && i.pillar !== "brand"
        ? `Aturan kalau menyebut ${BRAND.name} (konten ini bukan promosi):\n${profileSections(["IDENTITAS", "KANAL RESMI", "NADA & GAYA", "ATURAN WAJIB"])}`
        : `Profil brand (sumber fakta, jangan mengarang di luar ini; tandai ilustrasi bila perlu):\n${brand}`,
    `Buat proyek baru di ${ROOT}/<slug-singkat> dengan menyalin template skill, tanpa npm install di folder proyek (node_modules dipakai bersama di ${ROOT}). Verifikasi potongan suara dan cek frame sebelum render final, termasuk npm run check:crop (karakter tidak boleh terpotong di pinggir; setiap ✗ wajib diperbaiki); npm run render menulis ke ${OUTPUT}/<slug-singkat>.mp4 dan menormalkan keras suaranya. Setelah render, jalankan npm run qa${i.duration ? ` -- --durasi=${i.duration}` : ""} (skill video-tiktok, bagian QA): setiap ✗ wajib diperbaiki lalu render dan qa lagi sampai tidak ada ✗; ringkas ⚠ yang tersisa di notes.`,
    resultContract(job.id),
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Turn one stream-json event from `claude -p` into a short readable log line.
function describe(ev) {
  if (ev.type === "system" && ev.subtype === "init") return `Mulai sesi (model ${ev.model ?? "-"})`;
  if (ev.type === "assistant") {
    return (ev.message?.content ?? [])
      .map((c) => {
        if (c.type === "text" && c.text.trim()) return c.text.trim().split("\n")[0].slice(0, 300);
        if (c.type === "tool_use") {
          const inp = c.input ?? {};
          const what = inp.description ?? inp.file_path ?? inp.skill ?? inp.command ?? inp.pattern ?? "";
          return `[${c.name}] ${String(what).split("\n")[0].slice(0, 160)}`;
        }
        return null;
      })
      .filter(Boolean)
      .join("\n");
  }
  if (ev.type === "result") return ev.subtype === "success" ? "Selesai." : `Berhenti: ${ev.subtype}`;
  return null;
}

function appendLog(id, line) {
  run("UPDATE jobs SET log = log || ? WHERE id = ?", line + "\n", id);
  emit({ type: "log", jobId: id, line });
}

const jobRow = (id) => parse(get("SELECT * FROM jobs WHERE id = ?", id));
const announce = (id) => emit({ type: "job", job: { ...jobRow(id), log: undefined, prompt: undefined } });

export function enqueue(job) {
  const r = run(
    "INSERT INTO jobs (type, title, input, idea_id, video_id, session_id) VALUES (?, ?, ?, ?, ?, ?)",
    job.type,
    job.title,
    JSON.stringify(job.input ?? {}),
    job.idea_id ?? null,
    job.video_id ?? null,
    job.session_id ?? null,
  );
  const id = Number(r.lastInsertRowid);
  if (job.idea_id) run("UPDATE ideas SET status = 'produksi' WHERE id = ?", job.idea_id);
  announce(id);
  setImmediate(pump);
  return id;
}

// Queue the YouTube version of a finished TikTok video. Errors are meant for the user.
export function enqueueLandscape(videoId) {
  const v = get("SELECT * FROM videos WHERE id = ?", videoId);
  if (!v) throw new Error("Video tidak ada");
  if (v.orientation === "landscape") throw new Error("Ini sudah versi YouTube");
  if (get("SELECT id FROM videos WHERE source_id = ? AND orientation = 'landscape'", v.id)) throw new Error("Versi YouTube video ini sudah ada; pakai Revisi di kartunya");
  if (get("SELECT id FROM jobs WHERE type = 'landscape' AND video_id = ? AND status IN ('antri', 'jalan')", v.id)) throw new Error("Versi YouTube video ini sedang dibuat");
  // Without the cut narration clips the job would have to spend Gemini quota again.
  if (!v.project_dir || !fs.existsSync(path.join(v.project_dir, "src/script.json")) || !fs.existsSync(path.join(v.project_dir, "public/vo")))
    throw new Error("Folder proyek atau potongan suaranya (public/vo) tidak ada, jadi versi YouTube tidak bisa dibuat tanpa suara baru");
  // video_id points at the source while the job runs, so the source cannot be deleted meanwhile.
  return enqueue({ type: "landscape", title: v.title, video_id: v.id, input: { source_id: v.id, video_path: v.path, project_dir: v.project_dir } });
}

export function cancel(id) {
  const job = jobRow(id);
  if (!job) return;
  if (current?.id === id) current.child.kill("SIGTERM");
  else if (job.status === "antri") {
    run("UPDATE jobs SET status = 'batal', finished_at = datetime('now','localtime') WHERE id = ?", id);
    announce(id);
  }
}

function pump() {
  if (current) return;
  const next = get("SELECT id FROM jobs WHERE status = 'antri' ORDER BY id LIMIT 1");
  if (next) start(next.id);
}

function start(id) {
  const job = jobRow(id);
  const prompt = buildPrompt(job);
  run("UPDATE jobs SET status = 'jalan', prompt = ?, started_at = datetime('now','localtime') WHERE id = ?", prompt, id);
  announce(id);

  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--permission-mode", setting("permission_mode", "bypassPermissions"), "--append-system-prompt", SYSTEM];
  const model = setting("claude_model", "");
  if (model) args.push("--model", model);
  if (job.type === "revisi" && job.session_id) args.push("--resume", job.session_id);

  const child = spawn(setting("claude_bin", "claude"), args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.HOME}/.local/node/bin:${process.env.PATH}` } });
  current = { id, child };
  appendLog(id, "Claude Code dijalankan…");

  let buf = "";
  let session = job.session_id;
  let finalText = "";
  child.stdout.on("data", (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const ev = JSON.parse(line);
        if (ev.session_id) session = ev.session_id;
        if (ev.type === "result") finalText = ev.result ?? "";
        const text = describe(ev);
        if (text) appendLog(id, text);
      } catch {
        appendLog(id, line.slice(0, 300));
      }
    }
  });
  child.stderr.on("data", (d) => appendLog(id, "! " + String(d).trim().slice(0, 300)));
  child.on("error", (e) => appendLog(id, "! " + e.message));
  child.on("close", (code, signal) => {
    current = null;
    run("UPDATE jobs SET session_id = ?, result = ? WHERE id = ?", session ?? null, finalText, id);
    if (signal) finish(id, "batal", "Dibatalkan.");
    else collect(id, code);
    pump();
  });
}

function finish(id, status, error) {
  run("UPDATE jobs SET status = ?, error = ?, finished_at = datetime('now','localtime') WHERE id = ?", status, error ?? null, id);
  const job = jobRow(id);
  if (status !== "selesai" && job.idea_id) run("UPDATE ideas SET status = 'ide' WHERE id = ? AND status = 'produksi'", job.idea_id);
  announce(id);
}

// Read the result file Claude was asked to write and register the video.
function collect(id, code) {
  const job = jobRow(id);
  const file = resultFile(id);
  if (!fs.existsSync(file)) return finish(id, "gagal", `Claude selesai (kode ${code}) tapi tidak menulis ${file}.`);
  let r;
  try {
    r = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return finish(id, "gagal", "File hasil tidak valid: " + e.message);
  }
  if (job.type === "tes") {
    appendLog(id, "Tes berhasil: " + (r.notes ?? "hasil terbaca"));
    return finish(id, "selesai");
  }
  if (!r.video || !fs.existsSync(r.video)) return finish(id, "gagal", `Video tidak ditemukan: ${r.video}`);
  const tags = JSON.stringify(cleanTags(r.hashtags));
  let videoId = job.video_id;
  if (job.type === "landscape") {
    const src = get("SELECT * FROM videos WHERE id = ?", job.input?.source_id);
    if (!src) return finish(id, "gagal", "Video TikTok sumbernya sudah tidak ada.");
    const yt = get("SELECT id FROM videos WHERE source_id = ? AND orientation = 'landscape'", src.id);
    const fields = [r.title ?? src.title, r.video, r.caption ?? src.caption ?? "", r.hashtags?.length ? tags : (src.hashtags ?? "[]"), r.duration_s ?? src.duration];
    if (yt) {
      run("UPDATE videos SET title = ?, path = ?, caption = ?, hashtags = ?, duration = ?, updated_at = datetime('now','localtime') WHERE id = ?", ...fields, yt.id);
      videoId = yt.id;
    } else {
      videoId = Number(
        run(
          "INSERT INTO videos (title, path, caption, hashtags, duration, project_dir, job_id, orientation, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'landscape', ?)",
          ...fields,
          src.project_dir,
          id,
          src.id,
        ).lastInsertRowid,
      );
    }
  } else if (job.type === "revisi" && videoId) {
    run("UPDATE videos SET path = ?, caption = COALESCE(?, caption), hashtags = ?, duration = ?, updated_at = datetime('now','localtime') WHERE id = ?", r.video, r.caption ?? null, tags, r.duration_s ?? null, videoId);
    // Both formats share one timeline: if this revision re-rendered the other one too, it has the same length now.
    const v = get("SELECT * FROM videos WHERE id = ?", videoId);
    const sib = v.orientation === "landscape" ? get("SELECT * FROM videos WHERE id = ?", v.source_id) : get("SELECT * FROM videos WHERE source_id = ? AND orientation = 'landscape'", v.id);
    if (sib && r.duration_s && fs.existsSync(sib.path) && fs.statSync(sib.path).mtimeMs > new Date(job.started_at.replace(" ", "T")).getTime())
      run("UPDATE videos SET duration = ?, updated_at = datetime('now','localtime') WHERE id = ?", r.duration_s, sib.id);
  } else if (job.type === "edit") {
    // Edited uploads can come out 16:9; they have no TikTok source video.
    const wide = r.orientation === "landscape" || (r.orientation !== "portrait" && job.input?.format === "landscape");
    videoId = Number(
      run(
        "INSERT INTO videos (title, path, project_dir, caption, hashtags, duration, job_id, orientation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        r.title ?? job.title,
        r.video,
        r.project_dir ?? path.join(ROOT, path.basename(r.video, ".mp4").replace(/-yt$/, "")),
        r.caption ?? "",
        tags,
        r.duration_s ?? null,
        id,
        wide ? "landscape" : "portrait",
      ).lastInsertRowid,
    );
  } else {
    videoId = Number(
      run(
        "INSERT INTO videos (title, path, project_dir, caption, hashtags, duration, idea_id, job_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        r.title ?? job.title,
        r.video,
        r.project_dir ?? (path.dirname(r.video) === OUTPUT ? path.join(ROOT, path.basename(r.video, ".mp4")) : path.dirname(path.dirname(r.video))),
        r.caption ?? "",
        tags,
        r.duration_s ?? null,
        job.idea_id ?? null,
        id,
      ).lastInsertRowid,
    );
    if (job.idea_id) run("UPDATE ideas SET status = 'selesai', video_id = ? WHERE id = ?", videoId, job.idea_id);
  }
  run("UPDATE jobs SET video_id = ? WHERE id = ?", videoId, id);
  if (r.notes) appendLog(id, "Catatan: " + r.notes);
  finish(id, "selesai");
  // "Sekalian versi YouTube" from the create form: queue it now that the TikTok video exists.
  if (job.type === "video" && job.input?.wide) {
    try {
      appendLog(id, `Versi YouTube masuk antrian (job #${enqueueLandscape(videoId)}).`);
    } catch (e) {
      appendLog(id, "Versi YouTube tidak dibuat: " + e.message);
    }
  }
  emit({ type: "refresh" });
}

// A server restart does not kill the claude child (it keeps running detached),
// so jobs cut off this way are marked and picked up once their result file appears.
const ORPHAN = "Server dimulai ulang saat job berjalan.";
run("UPDATE jobs SET status = 'gagal', error = ? WHERE status = 'jalan'", ORPHAN);
function recoverOrphans() {
  for (const { id } of all("SELECT id FROM jobs WHERE status = 'gagal' AND error = ?", ORPHAN)) {
    if (fs.existsSync(resultFile(id))) {
      appendLog(id, "Hasil ditemukan setelah server dimulai ulang, dipulihkan.");
      collect(id, 0);
    }
  }
}
export const resume = () => {
  recoverOrphans();
  setInterval(recoverOrphans, 30000);
  pump();
};
