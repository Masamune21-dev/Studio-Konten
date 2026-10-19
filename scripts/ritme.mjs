// Editing rhythm of a rendered MP4: where the picture changes (a "beat": a cut, a card popping in,
// a zoom, a new screen) and where it sits still for too long while the narration keeps going.
// Viewers swipe away from a frame that has not changed for a few seconds, so the edit needs a
// visible beat every ~2–3 s. Also draws a filmstrip (one tile per second) for reviewing the edit.
//   npm run ritme                   ../output/<project>.mp4 → out/ritme.png (+ summary)
//   npm run ritme -- --yt           YouTube version
//   node scripts/ritme.mjs <mp4…>   any files; --json prints the numbers only
// Measure: frames at 6 fps, 135×240 (240×135 landscape), luminance; a beat is a sample that differs
// from the one 0.5 s earlier by more than BEAT (mean absolute difference, 0–255) over the picture,
// or by more than LOCAL in its third most-changed tile, above the subtitle band (captions change all
// the time and would count as motion). Thresholds: docs/04 "Ritme".
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const wide = args.includes("--yt");
const jsonOnly = args.includes("--json");
let files = args.filter((a) => !a.startsWith("--"));
const own = !files.length;
if (own) files = [path.resolve("..", "output", `${path.basename(process.cwd())}${wide ? "-yt" : ""}.mp4`)];

export const RATE = 6; // samples per second
export const BEAT = 9; // mean |Δluma| over 0.5 s, whole picture: a cut, a new screen, a zoom
export const LOCAL = 25; // mean |Δluma| over 0.5 s in the third most-changed tile: something new appears
const TILE = 15; // px at 135×240 ≈ 120 px in the video
export const STILL_WARN = 4; // seconds without a beat → ⚠ (calibrated on 23 videos, docs/04 "Ritme")
export const STILL_FAIL = 6.5; // seconds without a beat → ✗ in npm run qa

const probe = (file) => {
  const r = spawnSync("npx", ["remotion", "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], { encoding: "utf8" });
  const [w, h] = r.stdout.split("\n").filter((l) => /^\d+,\d+/.test(l))[0].split(",").map(Number);
  return { w, h };
};

// Minimal PNG decoder (8-bit RGB/RGBA, as written by ffmpeg) → packed RGB.
export function decodePng(buf) {
  let pos = 8, w, h, type;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString("ascii", pos + 4, pos + 8);
    const d = buf.subarray(pos + 8, pos + 8 + len);
    if (name === "IHDR") [w, h, type] = [d.readUInt32BE(0), d.readUInt32BE(4), d[9]];
    else if (name === "IDAT") idat.push(d);
    pos += 12 + len;
  }
  const ch = type === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(w * h * 3);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const cur = new Uint8Array(stride);
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = raw[y * (stride + 1) + 1 + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) px[(y * w + x) * 3 + k] = cur[x * ch + k];
    prev = cur;
  }
  return px;
}

export function analyse(file) {
  const { w: W0, h: H0 } = probe(file);
  const land = W0 > H0;
  const [w, h] = land ? [240, 135] : [135, 240];
  // Remotion's ffmpeg has no pipe output and no rawvideo muxer, so the frames go through small PNGs.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ritme-"));
  const r = spawnSync("npx", ["remotion", "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", file, "-an", "-vf", `scale=${w}:${h}`, "-r", String(RATE), "-c:v", "png", "-pix_fmt", "rgb24", "-f", "image2", path.join(tmp, "%05d.png")], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr.split("\n").filter((l) => l && !l.includes("macOS")).slice(-2).join(" | "));
  const frames = fs.readdirSync(tmp).sort().map((n) => decodePng(fs.readFileSync(path.join(tmp, n))));
  fs.rmSync(tmp, { recursive: true, force: true });
  const bottom = Math.floor(h * (land ? 0.78 : 0.72)); // subtitles live below this line
  const luma = frames.map((f) => {
    const y = new Float32Array(w * bottom);
    for (let i = 0; i < w * bottom; i++) y[i] = 0.299 * f[i * 3] + 0.587 * f[i * 3 + 1] + 0.114 * f[i * 3 + 2];
    return y;
  });
  const lag = Math.round(RATE / 2);
  const diff = luma.map((y, k) => {
    if (k < lag) return 0;
    const p = luma[k - lag];
    let s = 0;
    for (let i = 0; i < y.length; i++) s += Math.abs(y[i] - p[i]);
    return s / y.length;
  });
  // Local change: the third most-changed tile (TILE px squares). A new card, a phone screen
  // sliding, or a character walking in moves several tiles; a talking mouth or a head tilt moves one
  // or two, so the third tile ignores them.
  const tx = Math.floor(w / TILE), ty = Math.floor(bottom / TILE);
  const local = luma.map((y, k) => {
    if (k < lag) return 0;
    const p = luma[k - lag];
    const v = [];
    for (let j = 0; j < ty; j++)
      for (let i = 0; i < tx; i++) {
        let s = 0;
        for (let yy = j * TILE; yy < (j + 1) * TILE; yy++) for (let xx = i * TILE; xx < (i + 1) * TILE; xx++) s += Math.abs(y[yy * w + xx] - p[yy * w + xx]);
        v.push(s / (TILE * TILE));
      }
    return v.sort((x, z) => z - x)[2];
  });
  // Beats: big change anywhere or a clear local one, merged when closer than 0.5 s (one cut = one beat).
  const beats = [];
  for (let k = 0; k < diff.length; k++) if ((diff[k] > BEAT || local[k] > LOCAL) && (!beats.length || k - beats[beats.length - 1] > lag)) beats.push(k);
  const dur = frames.length / RATE;
  // Still stretches: gaps between beats (also from the start and to the end).
  const marks = [0, ...beats.map((k) => (k - lag / 2) / RATE), dur];
  const still = [];
  for (let i = 1; i < marks.length; i++) if (marks[i] - marks[i - 1] >= STILL_WARN) still.push([+marks[i - 1].toFixed(1), +marks[i].toFixed(1)]);
  const longest = still.reduce((m, [a, b]) => Math.max(m, b - a), 0);
  return { file, w, h, land, frames, diff, dur: +dur.toFixed(1), beats: beats.map((k) => +((k - lag / 2) / RATE).toFixed(1)), perTen: +((beats.length / dur) * 10).toFixed(1), still, longest: +longest.toFixed(1) };
}

// ---------- snaps (gerak patah) ----------
// An area that changes completely from one frame to the next while the frames before and after are
// calm: an element popping in or out with no animation, a panel jumping to a new height when its text
// wraps, a hard pose swap. Smooth motion spreads the same change over several frames. Frames at 30
// per second (every other frame of a 60 fps video), 9 px tiles at 135×240 (≈ 72 px in the video),
// above the subtitle band. A snap = at least SNAP_TILES tiles with a jump of SNAP_LEVEL (mean |Δluma|)
// that is 4× bigger than the change one frame before and after. Calibrated 16 Oct 2026 on
// download-4gb-berapa-menit: typing a digit is 3–8 tiles at 20–40 (not a snap, it has its own key
// sound), a wrapped label growing its panel 20 tiles at 81. `skip` = [start, end] seconds to ignore
// (scene transitions, where whole areas move by design).
export const SNAP_RATE = 30;
export const SNAP_TILES = 10;
export const SNAP_LEVEL = 50;
export function snaps(file, skip = []) {
  const { w: W0, h: H0 } = probe(file);
  const land = W0 > H0;
  const [w, h] = land ? [240, 135] : [135, 240];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gerak-"));
  const r = spawnSync("npx", ["remotion", "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", file, "-an", "-vf", `scale=${w}:${h}`, "-r", String(SNAP_RATE), "-c:v", "png", "-pix_fmt", "rgb24", "-f", "image2", path.join(tmp, "%05d.png")], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr.split("\n").filter((l) => l && !l.includes("macOS")).slice(-2).join(" | "));
  const names = fs.readdirSync(tmp).sort();
  const bottom = Math.floor(h * (land ? 0.78 : 0.72));
  const T = 9, tx = Math.floor(w / T), ty = Math.floor(bottom / T);
  // Per-tile change between consecutive frames, streamed so only two frames are in memory.
  const diffs = [null];
  let prev = null;
  for (const n of names) {
    const f = decodePng(fs.readFileSync(path.join(tmp, n)));
    const y = new Uint8ClampedArray(w * bottom);
    for (let i = 0; i < w * bottom; i++) y[i] = 0.299 * f[i * 3] + 0.587 * f[i * 3 + 1] + 0.114 * f[i * 3 + 2];
    if (prev) {
      const v = new Float32Array(tx * ty);
      for (let j = 0; j < ty; j++)
        for (let i = 0; i < tx; i++) {
          let s = 0;
          for (let yy = j * T; yy < (j + 1) * T; yy++) for (let xx = i * T; xx < (i + 1) * T; xx++) s += Math.abs(y[yy * w + xx] - prev[yy * w + xx]);
          v[j * tx + i] = s / (T * T);
        }
      diffs.push(v);
    }
    prev = y;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  const found = [];
  for (let k = 2; k < diffs.length - 1; k++) {
    const t = k / SNAP_RATE;
    if (skip.some(([a, b]) => t >= a && t <= b)) continue;
    let n = 0, sum = 0;
    for (let i = 0; i < tx * ty; i++) {
      const v = diffs[k][i];
      if (v > SNAP_LEVEL && diffs[k - 1][i] < v / 4 && diffs[k + 1][i] < v / 4) (n++, (sum += v));
    }
    // One snap = one moment: neighbouring frames of the same jump are merged.
    if (n >= SNAP_TILES) {
      const last = found[found.length - 1];
      if (last && t - last.t < 0.2) last.tiles = Math.max(last.tiles, n);
      else found.push({ t: +t.toFixed(2), tiles: n, level: Math.round(sum / n) });
    }
  }
  return found;
}

// ---------- filmstrip PNG ----------
// 3×5 digit font for the second labels.
export const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001010010", "111101111101111", "111101111001111"];
export function png(w, h, rgb) {
  const crc = (b) => {
    let c = ~0;
    for (const x of b) {
      c ^= x;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
export function filmstrip(a, out) {
  const { w, h, frames, land } = a;
  const cols = land ? 6 : 10;
  const tiles = Math.ceil(frames.length / RATE);
  const rows = Math.ceil(tiles / cols);
  const gap = 6, bar = 8, label = 16;
  const TW = w + gap, TH = h + bar + label + gap;
  const W = cols * TW + gap, H = rows * TH + gap;
  const img = Buffer.alloc(W * H * 3, 24);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    img[(y * W + x) * 3] = c[0];
    img[(y * W + x) * 3 + 1] = c[1];
    img[(y * W + x) * 3 + 2] = c[2];
  };
  const stillAt = (t) => a.still.some(([s, e]) => t >= s && t < e);
  for (let s = 0; s < tiles; s++) {
    const k = Math.min(frames.length - 1, s * RATE + Math.round(RATE / 2)); // middle of the second
    const x0 = gap + (s % cols) * TW, y0 = gap + Math.floor(s / cols) * TH;
    const f = frames[k];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x0 + x, y0 + y, [f[(y * w + x) * 3], f[(y * w + x) * 3 + 1], f[(y * w + x) * 3 + 2]]);
    // Bar: one cell per sample; green = beat, red = inside a still stretch, grey = calm.
    for (let j = 0; j < RATE; j++) {
      const kk = s * RATE + j;
      if (kk >= frames.length) break;
      const t = kk / RATE;
      const beat = a.beats.some((b) => Math.abs(b - t) < 0.5 / RATE + 1e-6 || (b >= t && b < t + 1 / RATE));
      const c = beat ? [52, 211, 153] : stillAt(t) ? [239, 68, 68] : [90, 98, 120];
      const cw = Math.floor(w / RATE);
      for (let y = 0; y < bar - 2; y++) for (let x = 0; x < cw - 1; x++) put(x0 + j * cw + x, y0 + h + 2 + y, c);
    }
    // Label: seconds.
    const txt = String(s);
    [...txt].forEach((d, i) => {
      const g = DIGITS[+d];
      for (let p = 0; p < 15; p++) if (g[p] === "1") for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) put(x0 + i * 8 + (p % 3) * 2 + dx, y0 + h + bar + 2 + Math.floor(p / 3) * 2 + dy, [220, 226, 240]);
    });
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, png(W, H, img));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  let worst = 0;
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`Tidak ada ${f} (render dulu).`);
      process.exit(1);
    }
    const a = analyse(f);
    const name = path.basename(f);
    if (jsonOnly) {
      const { frames, diff, ...rest } = a;
      console.log(JSON.stringify({ ...rest, file: name }));
      continue;
    }
    const out = path.resolve(own ? (wide ? "out/ritme-yt.png" : "out/ritme.png") : path.join("out", name.replace(/\.mp4$/, "-ritme.png")));
    filmstrip(a, out);
    worst = Math.max(worst, a.longest);
    console.log(`${name}: ${a.dur} dtk, ${a.beats.length} beat (${a.perTen} per 10 dtk), diam terlama ${a.longest} dtk${a.still.length ? ` — layar diam ≥${STILL_WARN} dtk: ${a.still.map(([s, e]) => `${s}–${e}`).join(", ")}` : ""}`);
    console.log(`  filmstrip: ${path.relative(process.cwd(), out)} (hijau = beat, merah = diam)`);
  }
}
