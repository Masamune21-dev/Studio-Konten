// Cari titik potong antar-scene yang benar di take penuh tanpa kuota TTS baru:
// pecah take di setiap jeda, transkripsikan tiap potongan lewat router,
// mencocokkan potongan ke scene (kemiripan kata, pemrograman dinamis), lalu tulis waktunya ke
// script.json → voices.<who>.cuts. Setelah itu jalankan `npm run vo:reuse`.
// Kalimat yang tidak ada di take dilaporkan (perlu `npm run vo` ulang).
// Dari folder proyek: node --env-file=../.env ../scripts/fixcuts.mjs [who] [--dry]
// (who bawaan = pembicara pertama di "voices" script.json)
import fs from "node:fs";
import { BAD, hear, pool } from "./router-audio.mjs";

// Without a name: the first speaker in src/script.json "voices".
const firstVoice = () => {
  try {
    return Object.keys(JSON.parse(fs.readFileSync("src/script.json", "utf8")).voices ?? {})[0];
  } catch {
    return undefined;
  }
};
const who = process.argv.find((a) => !a.startsWith("--") && !a.endsWith(".mjs") && a !== process.argv[0]) ?? firstVoice();
if (!who) throw new Error("Sebutkan pembicaranya: node ../scripts/fixcuts.mjs <who>");
const dry = process.argv.includes("--dry");
const script = JSON.parse(fs.readFileSync("src/script.json", "utf8"));
const scenes = script.scenes.filter((s) => (s.who ?? who) === who);
const buf = fs.readFileSync(`out/vo-full-${who}.wav`);
let p = 12, fmt, data;
while (p < buf.length - 8) {
  const id = buf.toString("ascii", p, p + 4), size = buf.readUInt32LE(p + 4);
  if (id === "fmt ") fmt = { rate: buf.readUInt32LE(p + 12) };
  if (id === "data") { data = buf.subarray(p + 8, p + 8 + size); break; }
  p += 8 + size + (size % 2);
}
const n = data.length / 2;
const WIN = Math.round(fmt.rate * 0.025);
const quiet = [];
for (let w = 0; w * WIN < n; w++) {
  let sum = 0;
  for (let i = w * WIN; i < Math.min(n, (w + 1) * WIN); i++) { const v = data.readInt16LE(i * 2) / 32768; sum += v * v; }
  quiet.push(Math.sqrt(sum / WIN) < 0.012);
}
// Pauses ≥ 0.22 s → split points at their middle.
const pauses = [];
for (let w = 0, start = -1; w <= quiet.length; w++) {
  if (w < quiet.length && quiet[w]) { if (start < 0) start = w; continue; }
  if (start >= 0) { const len = (w - start) * 0.025; if (len >= 0.22 && start > 0 && w < quiet.length) pauses.push({ at: ((start + w) / 2) * 0.025, len }); start = -1; }
}
const bounds = [0, ...pauses.map((x) => x.at), n / fmt.rate];
const segs = [];
for (let i = 0; i < bounds.length - 1; i++) segs.push({ a: bounds[i], b: bounds[i + 1] });

const wav = (a, b) => {
  const body = data.subarray(Math.round(a * fmt.rate) * 2, Math.round(b * fmt.rate) * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + body.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(fmt.rate, 24);
  h.writeUInt32LE(fmt.rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(body.length, 40);
  return Buffer.concat([h, body]);
};
const PROMPT = "Transkripsikan audio pendek ini kata per kata (bahasa Indonesia, istilah jaringan). Balas hanya transkripnya.";

// Transcripts are cached per take (size + segment bounds), so a re-run costs nothing.
const cacheFile = `out/fixcuts-${who}.json`;
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};
const takeKey = `${data.length}`;
// A few pieces at a time (router-audio.mjs); each transcript is cached as soon as it arrives.
await pool(segs, async (s) => {
  const key = `${takeKey}:${s.a.toFixed(2)}-${s.b.toFixed(2)}`;
  s.text = cache[key] && !BAD.test(cache[key]) ? cache[key] : await hear(wav(s.a, s.b), "wav", PROMPT, 5);
  if (s.text) (cache[key] = s.text), fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
});
for (const [i, s] of segs.entries()) console.log(`[${i}] ${s.a.toFixed(2)}–${s.b.toFixed(2)}  ${s.text || "gagal ditranskripsi"}`);

// Deterministic matching: split the segments into one contiguous group per scene so that
// the word overlap (F1) between each group's transcript and the scene text is maximal.
const NUM = { 0: "nol", 1: "satu", 2: "dua", 3: "tiga", 4: "empat", 5: "lima", 6: "enam", 7: "tujuh", 8: "delapan", 9: "sembilan", 10: "sepuluh" };
const words = (t) =>
  String(t ?? "")
    .toLowerCase()
    .replace(/\d+/g, (d) => ` ${NUM[d] ?? d.split("").map((c) => NUM[c]).join(" ")} `)
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
const f1 = (a, b) => {
  if (!a.length || !b.length) return 0;
  const bag = new Map();
  for (const w of b) bag.set(w, (bag.get(w) ?? 0) + 1);
  let hit = 0;
  for (const w of a) if (bag.get(w) > 0) (hit++, bag.set(w, bag.get(w) - 1));
  return (2 * hit) / (a.length + b.length);
};
const target = scenes.map((sc) => [words(sc.vo), words(sc.say ?? sc.vo)]);
const solve = (list) => {
  const segWords = list.map((x) => words(x.text));
  const group = (i, j) => segWords.slice(i, j).flat();
  const score = (k, i, j) => Math.max(...target[k].map((t) => f1(group(i, j), t)));
  const S = list.length, K = scenes.length;
  const best = Array.from({ length: K + 1 }, () => new Array(S + 1).fill(-Infinity));
  const from = Array.from({ length: K + 1 }, () => new Array(S + 1).fill(-1));
  best[0][0] = 0;
  for (let k = 1; k <= K; k++)
    for (let j = k; j <= S; j++)
      for (let i = k - 1; i < j; i++) {
        if (best[k - 1][i] === -Infinity) continue;
        const v = best[k - 1][i] + score(k - 1, i, j);
        if (v > best[k][j]) (best[k][j] = v), (from[k][j] = i);
      }
  const starts = [];
  for (let k = K, j = S; k > 0; k--) {
    const i = from[k][j];
    starts.unshift(i);
    j = i;
  }
  const per = scenes.map((_, k) => score(k, starts[k], k + 1 < K ? starts[k + 1] : S));
  return { total: best[K][S], starts, per };
};

// A short piece the router keeps refusing is merged with its left or right neighbour and
// transcribed again; whichever merge matches the scenes better wins.
const transcribe = async (a, b) => {
  const key = `${takeKey}:${a.toFixed(2)}-${b.toFixed(2)}`;
  if (cache[key] && !BAD.test(cache[key])) return cache[key];
  const text = await hear(wav(a, b), "wav", PROMPT, 5);
  if (text) (cache[key] = text), fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
  return text;
};
for (let i = segs.findIndex((x) => !x.text); i >= 0; i = segs.findIndex((x) => !x.text)) {
  // Both merges are asked at the same time.
  const pairs = [i - 1, i + 1].filter((j) => j >= 0 && j < segs.length).map((j) => [Math.min(i, j), Math.max(i, j)]);
  const texts = await Promise.all(pairs.map(([lo, hi]) => transcribe(segs[lo].a, segs[hi].b)));
  const variants = [];
  pairs.forEach(([lo, hi], k) => {
    const text = texts[k];
    if (!text) return;
    const list = [...segs.slice(0, lo), { a: segs[lo].a, b: segs[hi].b, text }, ...segs.slice(hi + 1)];
    variants.push({ list, total: solve(list).total, label: `[${lo}+${hi}] ${text}` });
  });
  if (!variants.length) break;
  const pick = variants.sort((x, y) => y.total - x.total)[0];
  console.log(`gabung ${pick.label}`);
  segs.splice(0, segs.length, ...pick.list);
}
const unknown = segs.filter((x) => !x.text).length;
if (unknown) {
  console.log(`${unknown} potongan gagal ditranskripsi; coba lagi nanti (router sibuk)`);
  process.exit(3);
}
const { starts, per } = solve(segs);
const S = segs.length, K = scenes.length;
const ends = starts.slice(1).map((i) => i - 1);
scenes.forEach((sc, k) => console.log(`${sc.id} ← [${starts[k]}–${(k + 1 < K ? starts[k + 1] : S) - 1}] cocok ${(per[k] * 100).toFixed(0)}%`));
const weak = scenes.filter((_, k) => per[k] < 0.55).map((sc) => sc.id);
if (weak.length) {
  console.log(`HILANG/tidak cocok di take: ${weak.join(", ")} — perlu npm run vo ulang`);
  process.exit(2);
}
const cuts = ends.map((e) => Math.round(segs[e].b * 100) / 100);
console.log(`cuts ${who}:`, cuts.join(" "));
if (!dry) {
  script.voices[who].cuts = cuts;
  fs.writeFileSync("src/script.json", JSON.stringify(script, null, 2));
  console.log("ditulis ke src/script.json; jalankan npm run vo:reuse");
}
