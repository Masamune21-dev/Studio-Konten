// Pendekkan jeda hening > 1,5 dtk di take Gemini jadi 1 dtk (asli disimpan sebagai
// out/vo-full-<who>.orig.wav), lalu jalankan `npm run vo:reuse`. Hanya isi chunk `data`
// yang dibaca dan ditulis ulang, supaya chunk C2PA tidak jadi bunyi "dret".
// Dari folder proyek: node ../scripts/shorten-gaps.mjs [who] [maxGap=1.5] [keep=1.0]
// (who bawaan = pembicara pertama di "voices" script.json)
import fs from "node:fs";
// Without a name: the first speaker in src/script.json "voices".
const firstVoice = () => {
  try {
    return Object.keys(JSON.parse(fs.readFileSync("src/script.json", "utf8")).voices ?? {})[0];
  } catch {
    return undefined;
  }
};
const who = process.argv[2] ?? firstVoice();
if (!who) throw new Error("Sebutkan pembicaranya: node ../scripts/shorten-gaps.mjs <who>");
const MAX = Number(process.argv[3] ?? 1.5);
const KEEP = Number(process.argv[4] ?? 1.0);
const file = `out/vo-full-${who}.wav`;
const orig = `out/vo-full-${who}.orig.wav`;
if (!fs.existsSync(orig)) fs.copyFileSync(file, orig);
const buf = fs.readFileSync(orig);
let p = 12, fmt, data;
while (p < buf.length - 8) {
  const id = buf.toString("ascii", p, p + 4), size = buf.readUInt32LE(p + 4);
  if (id === "fmt ") fmt = { ch: buf.readUInt16LE(p + 10), rate: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
  if (id === "data") { data = buf.subarray(p + 8, p + 8 + size); break; }
  p += 8 + size + (size % 2);
}
const n = data.length / 2, win = Math.round(fmt.rate * 0.05);
const quiet = [];
for (let w = 0; w * win < n; w++) {
  let sum = 0;
  for (let i = w * win; i < Math.min(n, (w + 1) * win); i++) { const v = data.readInt16LE(i * 2) / 32768; sum += v * v; }
  quiet.push(Math.sqrt(sum / win) < 0.01);
}
const parts = [];
const removed = []; // [from, to] in seconds of the original take
let last = 0, cut = 0, start = -1;
for (let w = 0; w <= quiet.length; w++) {
  if (w < quiet.length && quiet[w]) { if (start < 0) start = w; continue; }
  if (start >= 0) {
    const len = (w - start) * 0.05;
    if (len > MAX) {
      const half = Math.round((KEEP / 2) * fmt.rate);
      const a = start * win + half, b = Math.min(n, w * win) - half;
      parts.push(data.subarray(last * 2, a * 2));
      last = b;
      removed.push([a / fmt.rate, b / fmt.rate]);
      cut += (b - a) / fmt.rate;
    }
    start = -1;
  }
}
parts.push(data.subarray(last * 2));
const body = Buffer.concat(parts);
const h = Buffer.alloc(44);
h.write("RIFF", 0); h.writeUInt32LE(36 + body.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(fmt.ch, 22); h.writeUInt32LE(fmt.rate, 24);
h.writeUInt32LE(fmt.rate * fmt.ch * 2, 28); h.writeUInt16LE(fmt.ch * 2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(body.length, 40);
fs.writeFileSync(file, Buffer.concat([h, body]));
console.log(`${who}: ${(n / fmt.rate).toFixed(1)}s → ${(body.length / 2 / fmt.rate).toFixed(1)}s (jeda dipotong ${cut.toFixed(1)}s), asli: ${orig}`);

// Cut points found by fixcuts.mjs refer to the original take: move them onto the shortened one.
const sp = "src/script.json";
const script = JSON.parse(fs.readFileSync(sp, "utf8"));
const cuts = script.voices?.[who]?.cuts;
if (cuts && fs.existsSync(orig) && !script.voices[who].cutsShortened) {
  const map = (t) => {
    let shift = 0;
    for (const [a, b] of removed) {
      if (t >= b) shift += b - a;
      else if (t > a) return Math.round((a - shift) * 100) / 100;
    }
    return Math.round((t - shift) * 100) / 100;
  };
  script.voices[who].cuts = cuts.map(map);
  script.voices[who].cutsShortened = true;
  fs.writeFileSync(sp, JSON.stringify(script, null, 2));
  console.log(`cuts dipindah: ${cuts.join(" ")} → ${script.voices[who].cuts.join(" ")}`);
}
