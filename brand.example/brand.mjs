// Brand contoh (fiktif) yang ikut repo. Untuk brand sendiri: salin folder ini ke brand/
// (cp -R brand.example brand), lalu ubah isinya. Folder brand/ tidak ikut git.
// Penjelasan setiap kolom ada di docs/brand.md.

// Seragam semua karakter brand, dipakai di prompt gambar (bahasa Inggris).
const UNIFORM = `the CONTOH FIBER company uniform: teal green polo shirt with orange collar trim, the words "CONTOH FIBER" printed small in white on the left chest`;

export default {
  // Nama brand seperti ditulis di video dan prompt.
  name: "CONTOH FIBER",
  // Satu frasa: akun apa ini (dipakai di prompt ide, setelah "Kamu content strategist …").
  account: "akun TikTok CONTOH FIBER, penyedia internet fiber lokal",
  // Produk utama: ide di luar pilar brand tidak dipaksa nyambung ke sini.
  product: "internet rumah",
  // Pilar konten khusus brand (pilar lain adalah topik teknologi umum).
  pillar: { name: "CONTOH FIBER", hint: "layanan, cara daftar/bayar/lapor gangguan, di balik layar tim teknis; fakta hanya dari profil brand" },
  // Akun sosial media resmi, tanpa @ (kosong = tidak disebut).
  social: { tiktok: "", instagram: "" },
  // Cara menyebut pakaian karakter di dashboard dan catatan gambar.
  outfit: "seragam CONTOH FIBER",
  // Istilah tambahan untuk negative prompt gambar karakter.
  image: { negative: "brand logos other than CONTOH FIBER" },
  // Karakter anime host video. Kunci (bayu, sari, …) dipakai di nama file gambar: <kunci>-<pose>.png.
  characters: {
    bayu: {
      name: "Bayu",
      role: "teknisi lapangan",
      hint: "Laki-laki · teknisi",
      en: `a cheerful young Indonesian man, 27 years old, sturdy build, tan skin, short spiky black hair, friendly grin, wearing a teal hard hat and ${UNIFORM}`,
      legs: "khaki work trousers with a grey tool pouch, brown work boots",
      waist: "grey tool pouch on khaki work trousers",
      work: "holding a small fiber optic cable reel and a cable tester, focused expression",
    },
    sari: {
      name: "Sari",
      role: "CS",
      hint: "Perempuan · CS",
      en: `a kind young Indonesian woman, 24 years old, light warm skin, shoulder-length wavy black hair with a small orange hairpin, bright smile, a thin white headset with a microphone boom, wearing ${UNIFORM}`,
      legs: "dark grey straight trousers, white flat shoes",
      waist: "dark grey straight trousers",
      work: "typing on a laptop while talking through the headset, attentive smile",
    },
    raka: {
      name: "Raka",
      role: "admin jaringan",
      hint: "Laki-laki · admin jaringan",
      en: `a calm young Indonesian man, 26 years old, slim build, light-tan skin, neat side-parted black hair, round silver glasses, wearing ${UNIFORM} under a grey cardigan`,
      legs: "navy chino trousers, grey sneakers",
      waist: "navy chino trousers",
      work: "holding a tablet with a network monitoring dashboard, thoughtful expression",
    },
    dimas: {
      name: "Dimas",
      role: "pelanggan",
      hint: "Laki-laki · pelanggan",
      en: "a lively young Indonesian man, 21 years old, medium brown skin, curly black hair, expressive eyes, wearing a plain mustard yellow hoodie with no print or logo",
      legs: "black jeans, white sneakers",
      waist: "black jeans",
      work: "relaxing on a beanbag while streaming a video on a phone",
    },
  },
  // Aturan siapa yang jadi host untuk topik apa (masuk ke prompt ide dan job video).
  hostRules:
    "Pembagian peran host: Raka (admin jaringan) untuk setting/konfigurasi (HP, laptop, router/WiFi, aplikasi, jaringan), AI, dan teknologi; Bayu (teknisi lapangan) untuk pekerjaan fisik: kabel/fiber, pasang dan survei, letak dan lampu modem/router; Sari (CS) untuk layanan pelanggan, tagihan, dan keamanan/penipuan; Dimas (pelanggan) yang bertanya atau bereaksi.",
  // Suara Gemini TTS per karakter (masuk ke prompt job video).
  voices:
    "Setiap karakter yang bicara punya suara sendiri: Bayu (teknisi lapangan) Puck, Sari (CS) Leda, Raka (admin jaringan) Charon, Dimas (pelanggan) Fenrir (lihat bagian dialog di skill video-tiktok)",
  // Galeri sampul (AsetSampul): siapa yang menjelaskan, bertanya, dan mengingatkan/menyambut.
  hosts: { explain: "raka", ask: "dimas", remind: "sari" },
  // Server TTS lama untuk "engine" selain gemini (kosong = tidak ada; atau isi TTS_API_URL di .env).
  legacyTtsUrl: "",
};
