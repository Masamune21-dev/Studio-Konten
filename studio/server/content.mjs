// Content pillars and formats for idea generation. The account should read as a useful
// tech channel for everyday Indonesians, not an ad feed: most ideas are general tech
// content hosted by the brand's characters, and only the "brand" pillar promotes.
import { all, setting } from "./db.mjs";
import { BRAND, hostList } from "../../scripts/brand.mjs";

export const PILLARS = {
  perangkat: { name: "Setting & tips perangkat", hint: "HP Android/iPhone, laptop, router WiFi rumah, smart TV, printer: cara setting, fitur tersembunyi, atasi masalah umum" },
  ai: { name: "AI & tools", hint: "memakai AI (ChatGPT, Gemini, Copilot, dll.) untuk sekolah, kerja, dan UMKM; tips prompt; batasan dan mitos AI; deepfake" },
  teknologi: { name: "Dunia teknologi", hint: "teknologi yang lagi ramai dan cara kerjanya: internet satelit, 5G, chip, baterai, cloud, gadget baru" },
  aman: { name: "Keamanan digital", hint: "modus penipuan online (APK undangan, phishing, minta OTP), password dan 2FA, privasi, hoaks, akun dibajak" },
  produktif: { name: "Produktivitas & life hack", hint: "aplikasi berguna, shortcut, hemat baterai/kuota, foto-video pakai HP, trik Google dan WhatsApp" },
  internet: { name: "Edukasi internet", hint: "cara kerja internet dan WiFi secara umum, istilah (ping, latency, DNS, Mbps vs MBps), mitos internet; tanpa promosi" },
  brand: { name: BRAND.pillar?.name ?? BRAND.name, hint: BRAND.pillar?.hint ?? "layanan dan produk brand; fakta hanya dari profil brand" },
};

const FORMATS = {
  tutorial: "tutorial langkah demi langkah yang bisa langsung dicoba",
  mitos: "mitos vs fakta",
  daftar: "daftar 3–5 hal (tips, fitur, tanda-tanda)",
  salah: "kesalahan umum yang sering dilakukan dan cara benarnya",
  banding: "perbandingan A vs B",
  kenapa: "explainer: kenapa/gimana cara kerjanya",
  sketsa: "sketsa/POV lucu antar karakter yang menyelipkan pelajaran",
  tanya: "tanya-jawab: satu pertanyaan yang sering ditanyakan, dijawab tuntas",
  kasus: "studi kasus: kejadian yang sering dialami orang, lalu solusinya",
  rekomendasi: "rekomendasi: aplikasi/fitur gratis untuk keperluan tertentu",
  fakta: "fakta unik/trivia teknologi yang bikin 'oh gitu'",
  kuis: "kuis/tebak-tebakan dengan hitungan mundur, jawabannya di akhir (memancing komentar dan tonton ulang)",
};

const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
// Least used in the recent ideas first, random among equals.
const byRecentUse = (keys, column) => {
  const recent = all(`SELECT ${column} AS k FROM ideas WHERE ${column} IS NOT NULL ORDER BY id DESC LIMIT 20`).map((r) => r.k);
  const uses = (k) => recent.filter((r) => r === k).length;
  return shuffle(keys).sort((a, b) => uses(a) - uses(b));
};

// One { pillar, format } slot per idea. Without a choice, the brand pillar gets about 1 in 5.
export function planIdeas(count, chosen = []) {
  const picked = chosen.filter((p) => PILLARS[p]);
  let pillars;
  if (picked.length) {
    const order = byRecentUse(picked, "pillar");
    pillars = Array.from({ length: count }, (_, i) => order[i % order.length]);
  } else {
    const brand = Math.floor(count / 5) + (Math.random() < (count % 5) / 5 ? 1 : 0);
    const order = byRecentUse(Object.keys(PILLARS).filter((p) => p !== "brand"), "pillar");
    pillars = shuffle([...Array.from({ length: count - brand }, (_, i) => order[i % order.length]), ...Array(brand).fill("brand")]);
  }
  const formats = byRecentUse(Object.keys(FORMATS), "bentuk");
  return pillars.map((pillar, i) => ({ pillar, format: formats[i % formats.length] }));
}

export const planText = (plan) =>
  plan.map((s, i) => `${i + 1}. Pilar "${s.pillar}" (${PILLARS[s.pillar].name}: ${PILLARS[s.pillar].hint}) · bentuk "${s.format}" (${FORMATS[s.format]})`).join("\n");

// "=== NAME ===" blocks of the brand profile, by name.
export const profileSections = (names) => {
  const text = setting("brand_profile", "");
  return text
    .split(/\n(?==== )/)
    .filter((block) => names.some((n) => block.startsWith(`=== ${n}`)))
    .join("\n\n");
};

export const IDEA_SYSTEM = `Kamu content strategist ${BRAND.account}. Akun ini ingin jadi akun teknologi yang berguna untuk orang Indonesia sehari-hari, bukan akun iklan: kebanyakan konten membahas teknologi umum, dan hanya pilar "brand" yang membahas layanan ${BRAND.name}.
Aturan:
- Ikuti rencana pilar dan bentuk untuk tiap ide.
- Ide di luar pilar "brand": jangan menyebut paket, harga, cara daftar, atau keunggulan ${BRAND.name}, dan jangan memaksa topiknya nyambung ke ${BRAND.product}. Host-nya tetap karakter ${BRAND.name} (${hostList()}); penutup cukup ajakan follow/save.
${BRAND.hostRules ? `- ${BRAND.hostRules} Kalau menulis host di "format", pilih sesuai pembagian ini.\n` : ""}- Pilar "brand": fakta hanya dari profil brand, patuhi aturan wajibnya.
- Fakta umum harus benar dan tahan lama. Jangan mengarang angka statistik, harga produk lain, atau tanggal. Kalau ide bergantung pada fitur aplikasi/AI, versi OS, atau berita yang bisa berubah, isi "riset": true supaya dicek ulang saat produksi.
- Spesifik dan praktis: penonton bisa langsung mencoba atau dapat satu hal baru. Hindari topik terlalu umum seperti "tips internet cepat".
- Rancang untuk FYP: topik yang relevan untuk orang se-Indonesia (bukan cuma pelanggan lokal); hook yang langsung menyebut masalah/janji dalam ≤2 detik dan sudah terlihat sebagai teks di frame pertama; satu payoff jelas; isi cukup untuk video 45–60 detik dengan tempo bicara santai (±2–2,4 kata per detik, jangan dipadatkan); ada alasan untuk simpan, kirim ke teman, atau komentar (tulis pemicunya di poin terakhir); penutup tanpa iklan, berupa punchline atau kembali ke pembuka. Judul pendek (maks ±60 karakter) dan memuat kata kunci yang dicari orang.
- Variasikan judul: jangan mengulang pola yang sama (misalnya "X? Ini yang Disebut Y!", "Beda atau Sama?", "No Cap!"), dan jangan clickbait palsu.
- Kalau topiknya lebih jelas divisualkan dalam 3D (bumi/satelit/GPS, sinyal yang merambat, aliran data antar perangkat/server, bagian dalam perangkat, perbandingan ukuran), tulis di "format" satu adegan 3D intinya, diawali "Adegan 3D:" (mis. "Adegan 3D: globe berputar, 3 satelit mengirim sinyal ke HP"). Video dibuat otomatis dengan adegan itu. Jangan untuk tutorial menu aplikasi atau topik yang cukup dengan teks. Benda 3D yang sudah siap: globe hologram dengan pin dan busur data, satelit (biasa dan bersayap surya), HP (layar bisa berisi chat/SMS), router, laptop, menara BTS dan gelombang sinyal, mobil dengan rig BTS palsu, rak server, chip dengan blok CPU/GPU/NPU, STB Android, standee QR dengan stiker palsu, serat optik (cahaya bocor kalau ditekuk), kabel bawah laut terpotong, modem ONT dengan LED LOS, baterai (panas/menggembung), awan, jaringan saraf, gelombang suara, perisai, gembok. Benda lain boleh, tapi ini yang paling cepat jadi.
- Bahasa Indonesia santai ala kreator TikTok. Hashtag maksimal 5 (topik dan umum; merek/lokal secukupnya). Balas HANYA JSON valid.`;

// Extra direction for captions and video jobs, by pillar. Unknown/empty pillar: decide from the title.
export const pillarNote = (pillar) => {
  if (pillar === "brand") return "";
  if (PILLARS[pillar])
    return `Pilar konten: ${PILLARS[pillar].name}. Ini konten edukasi umum, BUKAN promosi: jangan membahas paket, harga, cara daftar, atau keunggulan ${BRAND.name}. Karakter ${BRAND.name} tetap jadi host, dan penutupnya cukup ajakan follow/save/share.`;
  return `Tentukan sendiri dari judulnya: kalau bukan tentang layanan ${BRAND.name}, perlakukan sebagai konten edukasi umum, BUKAN promosi (jangan membahas paket, harga, atau cara daftar; penutup cukup ajakan follow/save/share).`;
};
