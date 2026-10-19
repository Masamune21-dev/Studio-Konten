// Even loudness for the final MP4s. Measures integrated loudness (EBU R128 / ITU-R BS.1770, via
// ffmpeg's loudnorm in measure-only mode), applies one linear gain to reach TARGET LUFS, and catches
// the few peaks that would pass the ceiling with a 5 ms look-ahead limiter (Remotion's ffmpeg has no
// alimiter, and loudnorm's own dynamic mode would flatten the whole voice). The video stream is
// copied untouched; only the audio is re-encoded (AAC 320k).
//   npm run render / render:yt      run this automatically on ../output/<project>[-yt].mp4
//   node ../scripts/loudness.mjs [--yt]           from a project folder
//   node scripts/loudness.mjs output/*.mp4        any files
//   … --check                                     measure only
// Social platforms play speech at about -14 LUFS (YouTube normalises to it); before this step the
// videos ranged from -15 to -20 LUFS, so some sounded clearly quieter than the next video in the feed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (name, dflt) => Number(args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? dflt);
const TARGET = opt("target", -14); // LUFS
const TP = opt("tp", -1.5); // dBTP, checked on the final AAC
const CEILING = TP - 0.5; // sample-peak ceiling for the limiter; AAC adds a little overshoot
// A file within these limits counts as done, so running this again does not re-encode it.
const ok = (m, loose = 0.5) => Math.abs(m.I - TARGET) <= loose && m.TP <= TP + 0.3;
const checkOnly = args.includes("--check");
let files = args.filter((a) => !a.startsWith("--"));
if (!files.length) files = [path.resolve("..", "output", `${path.basename(process.cwd())}${args.includes("--yt") ? "-yt" : ""}.mp4`)];

const ffmpeg = (...a) => {
  const r = spawnSync("npx", ["remotion", "ffmpeg", "-hide_banner", "-nostats", ...a], { encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(r.stderr.split("\n").filter((l) => l && !l.includes("macOS")).slice(-3).join(" | "));
  return r.stderr;
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "loudness-"));
const scratch = (name) => path.join(tmp, name);

// loudnorm prints its measurement as JSON on stderr; the decoded audio itself is thrown away.
function measure(file) {
  const log = ffmpeg("-i", file, "-vn", "-af", `loudnorm=I=${TARGET}:TP=${TP}:print_format=json`, "-c:a", "pcm_s16le", "-y", scratch("measure.wav"));
  const j = JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));
  return { I: Number(j.input_i), TP: Number(j.input_tp) };
}

function readWav(file) {
  const b = fs.readFileSync(file);
  let ch = 2, rate = 48000, data = null;
  for (let o = 12; o + 8 <= b.length; o += 8 + b.readUInt32LE(o + 4) + (b.readUInt32LE(o + 4) & 1)) {
    const id = b.toString("ascii", o, o + 4);
    if (id === "fmt ") (ch = b.readUInt16LE(o + 10)), (rate = b.readUInt32LE(o + 12));
    if (id === "data") {
      data = b.subarray(o + 8, o + 8 + b.readUInt32LE(o + 4));
      break;
    }
  }
  const x = new Float32Array(data.length / 2);
  for (let i = 0; i < x.length; i++) x[i] = data.readInt16LE(i * 2) / 32768;
  return { x, ch, rate };
}

function writeWav(file, y, ch, rate) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + y.length * 2, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * ch * 2, 28);
  h.writeUInt16LE(ch * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(y.length * 2, 40);
  const d = Buffer.alloc(y.length * 2);
  for (let i = 0; i < y.length; i++) d.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(y[i] * 32768))), i * 2);
  fs.writeFileSync(file, Buffer.concat([h, d]));
}

// Gain, then a look-ahead limiter: the gain each sample needs is spread over the 5 ms before it
// (sliding minimum + moving average), so it never jumps, and it recovers over ~80 ms.
function gainAndLimit({ x, ch, rate }, gainDb, ceilingDb = CEILING) {
  const gain = 10 ** (gainDb / 20);
  const ceil = 10 ** (ceilingDb / 20);
  const n = x.length / ch;
  const L = Math.round(0.005 * rate);
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let p = 0;
    for (let c = 0; c < ch; c++) p = Math.max(p, Math.abs(x[i * ch + c]));
    need[i] = p * gain > ceil ? ceil / (p * gain) : 1;
  }
  const ahead = new Float32Array(n); // min of need[i … i+L-1]
  const q = [];
  for (let i = n - 1; i >= 0; i--) {
    while (q.length && need[q.at(-1)] >= need[i]) q.pop();
    q.push(i);
    while (q[0] > i + L - 1) q.shift();
    ahead[i] = need[q[0]];
  }
  const rel = Math.exp(-1 / (0.08 * rate));
  const y = new Float32Array(x.length);
  let sum = L; // window of the last L values; those before the start count as 1
  let g = 1, deepest = 1, touched = 0;
  for (let i = 0; i < n; i++) {
    sum += ahead[i] - (i >= L ? ahead[i - L] : 1);
    const t = sum / L;
    g = t < g ? t : t + (g - t) * rel;
    if (g < 0.891) touched++; // more than 1 dB of reduction
    deepest = Math.min(deepest, g);
    for (let c = 0; c < ch; c++) y[i * ch + c] = x[i * ch + c] * gain * g;
  }
  return { y, reduction: 20 * Math.log10(deepest), touched: touched / n };
}

const db = (v) => (v > 0 ? "+" : "") + v.toFixed(1);
let failed = false;
for (const file of files) {
  const name = path.basename(file);
  try {
    if (!fs.existsSync(file)) throw new Error("file tidak ada");
    const before = measure(file);
    if (checkOnly || ok(before)) {
      console.log(`${name}: ${before.I.toFixed(1)} LUFS, TP ${before.TP.toFixed(1)}${checkOnly ? "" : " — sudah pas, tidak diubah"}`);
      if (checkOnly && !ok(before, 1)) failed = true;
      continue;
    }
    ffmpeg("-i", file, "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", "-y", scratch("in.wav"));
    const audio = readWav(scratch("in.wav"));
    // The limiter shaves a little loudness off, so measure once and correct the gain. AAC
    // occasionally overshoots the ceiling by more than the 0.5 dB margin; then try once more
    // with the ceiling 0.5 dB lower (files that pass the first time are unchanged).
    let gainDb, out, after;
    const result = scratch("out.mp4");
    for (const ceilingDb of [CEILING, CEILING - 0.5]) {
      gainDb = TARGET - before.I;
      for (let pass = 0; pass < 2; pass++) {
        out = gainAndLimit(audio, gainDb, ceilingDb);
        writeWav(scratch("out.wav"), out.y, audio.ch, audio.rate);
        const got = measure(scratch("out.wav")).I;
        if (Math.abs(TARGET - got) < 0.2) break;
        gainDb += TARGET - got;
      }
      ffmpeg("-i", file, "-i", scratch("out.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", "-y", result);
      after = measure(result);
      if (ok(after, 1)) break;
    }
    if (!ok(after, 1)) throw new Error(`hasil di luar target (${after.I.toFixed(1)} LUFS, TP ${after.TP.toFixed(1)}); file asli tidak diubah`);
    fs.copyFileSync(result, file);
    const lim = out.reduction < -0.05 ? `, limiter maks ${out.reduction.toFixed(1)} dB, >1 dB di ${(out.touched * 100).toFixed(1)}% sampel` : "";
    console.log(`${name}: ${before.I.toFixed(1)} → ${after.I.toFixed(1)} LUFS (gain ${db(gainDb)} dB${lim}), TP ${before.TP.toFixed(1)} → ${after.TP.toFixed(1)}`);
  } catch (e) {
    failed = true;
    console.error(`${name}: GAGAL — ${e.message}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
if (failed) process.exit(1);
