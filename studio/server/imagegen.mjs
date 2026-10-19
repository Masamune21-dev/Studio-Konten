import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { MEDIA } from "./config.mjs";
import { get, run } from "./db.mjs";
import { chatJson, routerConfig } from "./llm.mjs";
import { BRAND } from "../../scripts/brand.mjs";

// Anime assets are drawn by Qwen-Image on DashScope (the Gemini key in .env is
// free tier, which has no image quota). The key only works on the intl region.
const BASE = () => process.env.DASHSCOPE_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/api/v1";
const T2I = "qwen-image-plus";
const EDIT = "qwen-image-edit-plus";

// qwen-image-plus with this style beat qwen-image-max in a side-by-side test (6 Oct 2026):
// max came out semi-realistic and printed the uniform logo twice.
const STYLE =
  "High-quality modern Japanese anime character illustration, polished key visual of a slice-of-life anime series by a top studio: clean confident lineart, soft cel shading with subtle gradient highlights, detailed expressive eyes with catchlights, glossy hair with defined strands, natural healthy proportions, anatomically correct hands with five fingers, crisp vibrant colors.";
const GREEN = "Isolated on a solid flat pure green #00FF00 background, no shadow, no floor, no props, no extra text.";
// Objects are keyed on magenta instead: white and grey props picked up green spill and
// got eaten by the green key. No hex code here, the model printed one on a router, and
// no "no reflection/no hands" wording: naming them made the model draw them.
const MAGENTA = "Plain solid flat pure magenta background filling the whole image.";
// The brand may add its own term (e.g. "brand logos other than <brand>") after "duplicated logo".
const NEGATIVE = ["realistic, photo, 3d render, semi-realistic, western cartoon, chibi, blurry, lowres, deformed hands, extra fingers, fused fingers, extra limbs, multiple characters, duplicated logo", BRAND.image?.negative, "extra arms, third arm, extra hands, third hand, two microphones, duplicated microphone, watermark, signature"].filter(Boolean).join(", ");
const OBJECT_STYLE =
  "High-quality anime-style illustration of a single object, clean confident lineart, soft cel shading with subtle highlights, crisp vibrant colors, centered isolated product illustration of the object alone.";
const NO_PEOPLE = "person, people, girl, boy, woman, man, character, face, hands, fingers, arms";
const KEEP = "Keep exactly the same character: same face, hairstyle, skin tone, outfit, uniform logo, colors and anime art style.";

// Characters come from the brand (brand/brand.mjs): name, hint, and the English look prompt.
export const CHARACTERS = Object.fromEntries(Object.entries(BRAND.characters ?? {}).map(([key, c]) => [key, { name: c.name, hint: c.hint, en: c.en, legs: c.legs, waist: c.waist }]));

export const POSES = {
  wave: { name: "Melambai", en: "friendly greeting, one hand raised in a small wave, cheerful smile" },
  point: { name: "Menunjuk", en: "pointing to the side with one arm extended, explaining something, friendly smile" },
  thumbs: { name: "Jempol", en: "giving a thumbs up with a confident wink" },
  phone: { name: "Pegang HP", en: "holding a smartphone in one hand and looking at it, slight smile" },
  cheer: { name: "Senang", en: "both fists raised in celebration, very happy excited expression" },
  think: { name: "Berpikir", en: "one hand on chin, curious thinking expression, looking up" },
  surprised: { name: "Kaget", en: "surprised shocked expression, wide eyes, both hands raised" },
  annoyed: { name: "Kesal", en: "annoyed frustrated expression, slight frown, scratching the back of the head with one hand" },
  sad: { name: "Sedih", en: "sad worried expression, shoulders slumped" },
  welcome: { name: "Menyambut", en: "hands clasped politely in front, slight bow, warm welcoming smile" },
  // Added 7 Oct 2026 for general tech videos (explainers, security tips, reactions).
  explain: { name: "Menjelaskan", en: "explaining something, both hands open with palms up in front of the chest, engaged friendly expression" },
  warn: { name: "Mengingatkan", en: "giving a friendly warning, one hand raised beside the shoulder with the index finger pointing up, serious but kind expression, eyebrows slightly raised, the other arm relaxed at the side" },
  confused: { name: "Bingung", en: "confused puzzled expression, head tilted to one side, one eyebrow raised, shrugging with both palms turned up" },
  laugh: { name: "Tertawa", en: "laughing happily, eyes closed in happy upward arcs, one hand resting on the stomach, the other arm relaxed" },
  confident: { name: "Percaya diri", en: "arms folded across the chest, confident proud smile, standing tall" },
  sorry: { name: "Minta maaf", en: "apologetic expression with eyebrows tilted up, both palms pressed together in front of the chest, slight bow of the head" },
  // Each character's own working pose, from the brand.
  work: { name: "Sedang kerja", en: Object.fromEntries(Object.entries(BRAND.characters ?? {}).map(([key, c]) => [key, c.work ?? "busy with their usual work, focused expression"])) },
};

// Half body only works when nothing below the waist is described.
const FRAMES = {
  full: { en: "Full body head to toe, front view, standing", legs: true },
  half: { en: "Waist-up portrait, medium shot cropped at the waist, the bottom edge of the image cuts through the waist, legs and feet not visible, front view", legs: false, negative: "full body, legs, knees, feet, shoes, skirt, trousers" },
};
// Sizes Qwen-Image supports, by aspect ratio.
const SIZES = { "9:16": "928*1664", "3:4": "1104*1472", "1:1": "1328*1328", "16:9": "1664*928" };

/* ---------- minimal PNG codec (8-bit, non-interlaced) ---------- */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("Hasil gambar bukan PNG");
  let pos = 8;
  let w, h, depth, type, interlace;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (name === "IHDR") [w, h, depth, type, interlace] = [data.readUInt32BE(0), data.readUInt32BE(4), data[8], data[9], data[12]];
    else if (name === "IDAT") idat.push(data);
    else if (name === "IEND") break;
    pos += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
  if (depth !== 8 || interlace || !ch) throw new Error(`Format PNG tidak didukung (depth ${depth}, type ${type})`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * h * 4);
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const off = y * (stride + 1);
    const f = raw[off];
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v = raw[off + 1 + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const i = x * ch;
      if (ch >= 3) [out[o], out[o + 1], out[o + 2], out[o + 3]] = [cur[i], cur[i + 1], cur[i + 2], ch === 4 ? cur[i + 3] : 255];
      else [out[o], out[o + 1], out[o + 2], out[o + 3]] = [cur[i], cur[i], cur[i], ch === 2 ? cur[i + 1] : 255];
    }
    prev.set(cur);
  }
  return { w, h, data: out };
}

function encodePng({ w, h, data }) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  const zero = Buffer.alloc(stride);
  const cand = [0, 1, 2].map(() => Buffer.alloc(stride));
  for (let y = 0; y < h; y++) {
    const line = data.subarray(y * stride, (y + 1) * stride);
    const up = y ? data.subarray((y - 1) * stride, y * stride) : zero;
    // Pick None / Sub / Up per row, whichever looks most compressible.
    let best = 0;
    let bestSum = Infinity;
    for (let f = 0; f < 3; f++) {
      const c = cand[f];
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const v = (line[x] - (f === 1 ? (x >= 4 ? line[x - 4] : 0) : f === 2 ? up[x] : 0)) & 255;
        c[x] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) [best, bestSum] = [f, sum];
    }
    raw[y * (stride + 1)] = best;
    cand[best].copy(raw, y * (stride + 1) + 1);
  }
  const chunk = (name, body) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(body.length);
    const named = Buffer.concat([Buffer.from(name, "ascii"), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(named));
    return Buffer.concat([head, named, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- green-screen removal ---------- */
// "Greenness" = how much green beats red and blue. The generated backdrop scores
// 60–110 (shadows and floor gradients included); skin, navy, teal hijab and cyan
// trim stay under ~30, so the backdrop is flood-filled from the borders and
// enclosed pockets (between arms, under clasped hands) are caught by a stricter cut.
// Pale floor highlights score lower, but stay neutral (red ≈ blue) unlike teal.
const BG = 40;
const PALE = 18;
const POCKET = 70;
// The same cut works for a magenta backdrop with "magentaness" = how much red and
// blue both beat green.
export function removeGreen(img, key = "green") {
  const { w, h, data } = img;
  const n = w * h;
  const gn = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const [r, g, b] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
    gn[i] = key === "magenta" ? Math.min(r, b) - g : g - Math.max(r, b);
  }

  let border = 0;
  let green = 0;
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) (border++, gn[y * w + x] > BG && green++);
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) (border++, gn[y * w + x] > BG && green++);
  if (green < border * 0.5) return { ...img, keyed: false };

  const bg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qh = 0;
  let qt = 0;
  const backdrop = (i) => gn[i] > BG || (gn[i] > PALE && Math.abs(data[i * 4] - data[i * 4 + 2]) < 40);
  const push = (i) => {
    if (!bg[i] && backdrop(i)) (bg[i] = 1, (queue[qt++] = i));
  };
  for (let x = 0; x < w; x++) (push(x), push((h - 1) * w + x));
  for (let y = 0; y < h; y++) (push(y * w), push(y * w + w - 1));
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < n - w) push(i + w);
  }
  // Magenta never shows up on our props, so holes (inside a cable coil, a case handle) can be cut harder.
  const pocket = key === "magenta" ? 40 : POCKET;
  for (let i = 0; i < n; i++) if (gn[i] > pocket) bg[i] = 1;

  // Specks of floor highlight can survive as islands; keep only sizeable pieces.
  const label = new Int32Array(n).fill(-1);
  const sizes = [];
  for (let s = 0; s < n; s++) {
    if (bg[s] || label[s] >= 0) continue;
    const id = sizes.length;
    let count = 0;
    qh = qt = 0;
    queue[qt++] = s;
    label[s] = id;
    while (qh < qt) {
      const i = queue[qh++];
      count++;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < n && !bg[j] && label[j] < 0) (label[j] = id, (queue[qt++] = j));
      }
    }
    sizes.push(count);
  }
  const keep = sizes.reduce((a, b) => Math.max(a, b), 0) * 0.01;
  for (let i = 0; i < n; i++) if (!bg[i] && sizes[label[i]] < keep) bg[i] = 1;
  if (key === "magenta" && sizes.length > 1) {
    // Objects: keep the biggest piece and the pieces centred inside its box (tools in a
    // case, cable ends); reflections underneath and stray hands sit outside it.
    const main = sizes.indexOf(Math.max(...sizes));
    const box = sizes.map(() => [w, h, -1, -1]);
    for (let i = 0; i < n; i++) {
      if (bg[i]) continue;
      const b = box[label[i]];
      const [x, y] = [i % w, (i / w) | 0];
      [b[0], b[1], b[2], b[3]] = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
    }
    const [mx0, my0, mx1, my1] = box[main];
    const inside = box.map(([x0, y0, x1, y1], id) => id === main || ((x0 + x1) / 2 >= mx0 && (x0 + x1) / 2 <= mx1 && (y0 + y1) / 2 >= my0 && (y0 + y1) / 2 <= my1));
    for (let i = 0; i < n; i++) if (!bg[i] && !inside[label[i]]) bg[i] = 1;
  }

  const out = Buffer.from(data);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (bg[i]) {
      out[o + 3] = 0;
      continue;
    }
    const x = i % w;
    const y = (i / w) | 0;
    // Soften and de-green the one-pixel rim next to the removed backdrop.
    const edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
    if (edge) {
      out[o + 3] = Math.round(255 * Math.min(1, Math.max(0.15, (BG - gn[i]) / 25)));
      if (key === "magenta") {
        const spill = Math.min(out[o], out[o + 2]) - out[o + 1] - 8;
        if (spill > 0) (out[o] -= spill), (out[o + 2] -= spill);
      } else out[o + 1] = Math.min(out[o + 1], Math.max(out[o], out[o + 2]) + 8);
    }
  }
  cleanLeftovers(out, w, h, key);
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let i = 0; i < n; i++) {
    if (!out[i * 4 + 3]) continue;
    const x = i % w;
    const y = (i / w) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return { ...img, keyed: false };
  return { ...crop({ w, h, data: out }, x0, y0, x1, y1, 12), keyed: true };
}

// Leftovers the flood fill misses (found 8 Oct 2026 across 30 new cut-outs): pale green
// floor lines and pockets beside hands on characters, pink glow round lit parts and
// lavender spill on silver props. Only leftover pixels connected to the transparent
// area are touched, so cyan trim and skin inside the figure stay as they are.
function cleanLeftovers(data, w, h, key) {
  const n = w * h;
  const left = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
    if (!a) continue;
    if (key === "magenta") left[i] = Math.min(r, b) - g > 30 || (r > 170 && b > 100 && r - g > 60 && b - g > 10) ? 1 : 0;
    // Cyan trim has little red, so the pale test leaves it alone.
    else left[i] = g - Math.max(r, b) > 22 || (r > 140 && g > r + 6 && g > b + 6) ? 1 : 0;
  }
  // Enclosed pockets (between fingers and trousers) never touch the transparent area,
  // so the flood below cannot reach them; cut the clearly green ones first. Skin, hair
  // and cyan trim stay well under 40. Their pale rims are then caught by the flood.
  if (key !== "magenta") {
    const gn = (i) => data[i * 4 + 1] - Math.max(data[i * 4], data[i * 4 + 2]);
    const seen = new Uint8Array(n);
    for (let s = 0; s < n; s++) {
      if (seen[s] || !data[s * 4 + 3] || gn(s) <= 40) continue;
      const comp = [s];
      let open = false;
      seen[s] = 1;
      for (let k = 0; k < comp.length; k++) {
        const i = comp[k];
        const [x, y] = [i % w, (i / w) | 0];
        for (const [X, Y] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          const j = Y * w + X;
          if (X < 0 || Y < 0 || X >= w || Y >= h || data[j * 4 + 3] < 128) open = true;
          else if (!seen[j] && gn(j) > 40) (seen[j] = 1), comp.push(j);
        }
      }
      if (open) continue;
      if (comp.length >= 30) for (const i of comp) data[i * 4 + 3] = 0;
      else
        // A green fleck inside hair: a hole would show too, so paint it with the
        // average of the surrounding non-green pixels instead.
        for (const i of comp) {
          const [x, y] = [i % w, (i / w) | 0];
          const sum = [0, 0, 0];
          let cnt = 0;
          for (let dy = -3; dy <= 3; dy++)
            for (let dx = -3; dx <= 3; dx++) {
              const [X, Y] = [x + dx, y + dy];
              const j = Y * w + X;
              if (X < 0 || Y < 0 || X >= w || Y >= h || data[j * 4 + 3] < 128 || gn(j) > 20) continue;
              for (let c = 0; c < 3; c++) sum[c] += data[j * 4 + c];
              cnt++;
            }
          if (cnt) for (let c = 0; c < 3; c++) data[i * 4 + c] = sum[c] / cnt;
        }
    }
  }
  const hit = new Uint8Array(n);
  const stack = [];
  const clear = (x, y) => x < 0 || y < 0 || x >= w || y >= h || data[(y * w + x) * 4 + 3] < 128;
  for (let i = 0; i < n; i++) {
    if (!left[i]) continue;
    const [x, y] = [i % w, (i / w) | 0];
    if (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1)) (hit[i] = 1), stack.push(i);
  }
  while (stack.length) {
    const i = stack.pop();
    const [x, y] = [i % w, (i / w) | 0];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const [X, Y] = [x + dx, y + dy];
        const j = Y * w + X;
        if (X >= 0 && Y >= 0 && X < w && Y < h && left[j] && !hit[j]) (hit[j] = 1), stack.push(j);
      }
  }
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (key === "magenta") {
      if (hit[i]) data[o + 3] = 0;
      else if (data[o + 3]) {
        const spill = Math.min(data[o], data[o + 2]) - data[o + 1];
        if (spill > 4) (data[o] -= spill), (data[o + 2] -= spill);
      }
    } else if (hit[i]) {
      // Dark ones are green-tinted hair and outline edges: neutralise, do not cut.
      if (0.3 * data[o] + 0.59 * data[o + 1] + 0.11 * data[o + 2] >= 110) data[o + 3] = 0;
      else data[o + 1] = Math.max(data[o], data[o + 2]);
    }
  }
}

function crop(img, x0, y0, x1, y1, pad) {
  [x0, y0, x1, y1] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad), Math.min(img.w - 1, x1 + pad), Math.min(img.h - 1, y1 + pad)];
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) img.data.copy(data, y * w * 4, ((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x1 + 1) * 4);
  return { w, h, data };
}

// The edit model keeps the input's aspect ratio, so a cut-out reference is laid
// back onto green and padded to 3:4 to get a portrait character out again.
// Sides are rounded up to 16 px, which the edit model snaps its output to.
function onGreen(img) {
  const h = Math.ceil(Math.max(img.h, (img.w * 4) / 3) / 16) * 16;
  const w = Math.ceil(Math.max(img.w, (h * 3) / 4) / 16) * 16;
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([0, 255, 0, 255], i * 4);
  const ox = (w - img.w) >> 1;
  const oy = (h - img.h) >> 1;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const s = (y * img.w + x) * 4;
      const d = ((oy + y) * w + ox + x) * 4;
      const a = img.data[s + 3] / 255;
      data[d] = img.data[s] * a;
      data[d + 1] = img.data[s + 1] * a + 255 * (1 - a);
      data[d + 2] = img.data[s + 2] * a;
    }
  return { w, h, data, ox, oy };
}

function resize(img, w, h) {
  if (img.w === w && img.h === h) return img;
  const data = Buffer.alloc(w * h * 4);
  const sx = img.w / w;
  const sy = img.h / h;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(img.h - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(img.h - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(img.w - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(img.w - 1, x0 + 1);
      const tx = fx - x0;
      for (let c = 0; c < 4; c++) {
        const a = img.data[(y0 * img.w + x0) * 4 + c] * (1 - tx) + img.data[(y0 * img.w + x1) * 4 + c] * tx;
        const b = img.data[(y1 * img.w + x0) * 4 + c] * (1 - tx) + img.data[(y1 * img.w + x1) * 4 + c] * tx;
        data[(y * w + x) * 4 + c] = a * (1 - ty) + b * ty;
      }
    }
  }
  return { w, h, data };
}

/* ---------- DashScope ---------- */
// A few calls at a time: a batch of mouth frames would otherwise trip the rate limit.
let active = 0;
const waiting = [];
const slot = () => (active < 4 ? (active++, Promise.resolve()) : new Promise((r) => waiting.push(r)));
const release = () => (waiting.length ? waiting.shift()() : active--);

async function draw(model, content, parameters) {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error("DASHSCOPE_API_KEY belum ada di .env (folder utama repo)");
  await slot();
  try {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${BASE()}/services/aigc/multimodal-generation/generation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: { messages: [{ role: "user", content }] }, parameters: { watermark: false, prompt_extend: false, negative_prompt: NEGATIVE, ...parameters } }),
        signal: AbortSignal.timeout(240000),
      });
      const d = await res.json().catch(() => ({}));
      if ((res.status === 429 || /Throttling/i.test(d.code ?? "")) && attempt < 3) {
        await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
        continue;
      }
      const url = d.output?.choices?.[0]?.message?.content?.find((c) => c.image)?.image;
      if (!res.ok || !url) throw new Error(`${model}: ${d.message ?? d.code ?? res.status}`);
      const img = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!img.ok) throw new Error(`Gagal mengunduh hasil gambar (${img.status})`);
      return Buffer.from(await img.arrayBuffer());
    }
  } finally {
    release();
  }
}

// Free text from the dashboard is Indonesian; the image model reads English best.
async function english(text) {
  if (!text?.trim()) return "";
  try {
    const { data } = await chatJson(
      "Kamu menerjemahkan instruksi gambar ke bahasa Inggris untuk model text-to-image. Pertahankan detail, jangan menambah hal baru. Balas HANYA JSON valid.",
      `Instruksi: ${text}\n\nJSON: {"en":"<frase prompt bahasa Inggris yang ringkas>"}`,
    );
    return String(data.en ?? text).trim();
  } catch {
    return text.trim();
  }
}

/* ---------- tasks ---------- */
const tasks = new Map();
let seq = 0;
export const pendingTasks = () => [...tasks.values()];

// Validate up front so the dashboard gets errors right away, then draw in the background.
export function startGenerate(b, emit) {
  const mode = b.mode ?? "karakter";
  const count = Math.min(4, Math.max(1, Number(b.count ?? 1)));
  const pose = POSES[b.pose];
  let label;
  let plan;
  if (mode === "karakter") {
    const c = CHARACTERS[b.char];
    if (!c) throw new Error("Pilih karakter dulu");
    label = `${c.name} · ${pose?.name ?? "bebas"}`;
    plan = async () => {
      const action = pose ? (typeof pose.en === "string" ? pose.en : pose.en[b.char]) : "";
      const extra = await english(b.extra);
      const frame = FRAMES[b.frame] ?? FRAMES.full;
      const prompt = [STYLE, `${frame.en}, one character only: ${c.en}, ${frame.legs ? c.legs : `${c.waist} at the bottom edge`}.`, action && `Pose and expression: ${action}.`, extra && `Also: ${extra}.`, GREEN].filter(Boolean).join(" ");
      const parameters = { size: SIZES["3:4"], ...(frame.negative && { negative_prompt: `${NEGATIVE}, ${frame.negative}` }) };
      return { model: T2I, content: [{ text: prompt }], parameters, prompt, cutout: true, char: b.char, note: `Karakter anime ${c.name} (${c.hint.toLowerCase()}, ${BRAND.outfit}, ${frame.legs ? "seluruh badan" : "setengah badan"})${pose ? `, pose ${pose.name.toLowerCase()}` : ""}${b.extra ? `, ${b.extra}` : ""}. PNG transparan.` };
    };
  } else if (mode === "variasi") {
    const ref = get("SELECT * FROM media WHERE id = ? AND kind = 'image'", b.refId);
    if (!ref || !fs.existsSync(ref.path)) throw new Error("Pilih gambar referensi dulu");
    if (!pose && !b.extra?.trim()) throw new Error("Pilih pose atau tulis perubahan yang diinginkan");
    const cutout = Boolean(ref.cutout);
    const who = ref.char ? CHARACTERS[ref.char]?.name : null;
    label = `${who ?? "Variasi"} · ${pose?.name ?? "edit"}`;
    plan = async () => {
      const action = pose ? (typeof pose.en === "string" ? pose.en : (pose.en[ref.char] ?? Object.values(pose.en)[0])) : "";
      const extra = await english(b.extra);
      const buf = fs.readFileSync(ref.path);
      let image;
      if (cutout && /\.png$/i.test(ref.path)) image = "data:image/png;base64," + encodePng(onGreen(decodePng(buf))).toString("base64");
      else image = `data:image/${/\.png$/i.test(ref.path) ? "png" : /\.webp$/i.test(ref.path) ? "webp" : "jpeg"};base64,` + buf.toString("base64");
      const prompt = [ref.char ? KEEP : "Keep the same subject and art style.", action && `Change the pose and expression to: ${action}. Redraw both arms and hands for the new pose and remove the arms and hands of the old pose completely, so the character has exactly two arms and two hands.`, extra && `Change: ${extra}.`, cutout && GREEN].filter(Boolean).join(" ");
      return { model: EDIT, content: [{ image }, { text: prompt }], parameters: cutout ? { size: SIZES["3:4"] } : {}, prompt, cutout, char: ref.char ?? null, note: `${ref.note ? ref.note.replace(/, pose [^,.]+/, "").replace(/\.? PNG transparan\.?$/, "") : "Variasi gambar"}${pose ? `, pose ${pose.name.toLowerCase()}` : ""}${b.extra ? `, ${b.extra}` : ""}.${cutout ? " PNG transparan." : ""}` };
    };
  } else {
    if (!b.prompt?.trim()) throw new Error("Tulis dulu gambar yang mau dibuat");
    const cutout = Boolean(b.cutout);
    label = b.prompt.trim().slice(0, 40);
    plan = async () => {
      const desc = await english(b.prompt);
      const key = /pink|magenta|purple|violet|ungu|merah muda/i.test(`${b.prompt} ${desc}`) ? "green" : "magenta";
      const prompt = [cutout ? OBJECT_STYLE : "High quality Japanese anime style illustration, anime background art, cel shading, clean lineart, vibrant colors, soft lighting.", desc + ".", cutout ? (key === "magenta" ? MAGENTA : GREEN) : "No text, no watermark, no brand logos."].join(" ");
      return { model: T2I, content: [{ text: prompt }], parameters: { size: SIZES[b.ratio] ?? SIZES["9:16"], ...(cutout && { negative_prompt: `${NEGATIVE}, ${NO_PEOPLE}, reflection, mirror image, floor, table, shadow, text, logo` }) }, prompt, cutout, key, char: null, note: `Gambar anime: ${b.prompt.trim()}${cutout ? ". PNG transparan." : ""}` };
    };
  }

  const ids = [];
  for (let k = 0; k < count; k++) {
    const id = ++seq;
    ids.push(id);
    tasks.set(id, { id, label: count > 1 ? `${label} (${k + 1}/${count})` : label, name: count > 1 ? `${label} ${k + 1}` : label, started: Date.now() });
  }
  emit({ type: "gen", tasks: pendingTasks() });
  plan()
    .then((p) =>
      Promise.all(
        ids.map(async (id) => {
          try {
            const buf = await draw(p.model, p.content, { ...p.parameters, seed: Math.floor(Math.random() * 2 ** 31) });
            let png = buf;
            let cut = false;
            if (p.cutout) {
              const keyed = removeGreen(decodePng(buf), p.key);
              if (keyed.keyed) (png = encodePng(keyed), (cut = true));
            }
            const name = tasks.get(id).name.replace(/[^\w ·-]+/g, "").trim();
            const file = path.join(MEDIA, `${Date.now()}-ai-${name.normalize("NFKD").replace(/[^\w-]+/g, "_").slice(0, 60)}.png`);
            fs.writeFileSync(file, png);
            run("INSERT INTO media (filename, path, kind, size, note, prompt, char, cutout) VALUES (?, ?, 'image', ?, ?, ?, ?, ?)", name + ".png", file, png.length, cut ? p.note : p.note.replace(" PNG transparan.", " (background gagal dihapus)"), p.prompt, p.char, cut ? 1 : 0);
            emit({ type: "gen-done", ok: true, label: name });
          } catch (e) {
            emit({ type: "gen-done", ok: false, label: tasks.get(id).label, error: e.message });
          }
        }),
      ),
    )
    .catch((e) => ids.forEach((id) => emit({ type: "gen-done", ok: false, label: tasks.get(id).label, error: e.message })))
    .finally(() => {
      ids.forEach((id) => tasks.delete(id));
      emit({ type: "gen", tasks: pendingTasks() });
      emit({ type: "refresh" });
    });
  return ids;
}

/* ---------- talking mouths ---------- */
// Three mouth shapes for lip flaps. The edit model redraws the whole picture, so
// only the mouth area of each edit is pasted onto the original; everything else
// stays pixel-identical and frames can be swapped without the character jittering.
// Three mouth shapes for lip flaps. The edit model redraws the whole picture, so
// only the mouth area of each edit is pasted onto the original; everything else
// stays pixel-identical and frames can be swapped without the character jittering.
// Openings drawn in code were tried on 6 Oct 2026 and judged too small, so all three
// stay AI-drawn; the wording below asks for modest mouths.
export const MOUTHS = {
  closed: { name: "tutup", en: "the mouth closed, a short thin dark line in a small calm smile, same size and position as before" },
  mid: { name: "setengah", en: "the mouth only slightly parted while speaking: a small narrow opening about as wide as the closed mouth and only a little taller, thin dark outline, dark red inside, no teeth" },
  open: { name: "buka", en: "the mouth open while saying a vowel, but small and natural: a small rounded opening no wider than the closed mouth and less than half as tall as it is wide, thin dark outline, dark red inside, tiny hint of tongue, not big, not tall" },
};
// Vision models on the router that answer face/mouth boxes, tried in order (VISION_MODELS in .env).
const VISION = (process.env.VISION_MODELS ?? "ag/gemini-3.8-flash,gemini/gemini-3.8-flash").split(",").map((m) => m.trim()).filter(Boolean);

// Gemini answers boxes in its native 0–1000 grid. It sometimes returns a box far
// too big, so the mouth is checked against the face before it is trusted.
async function locateMouth(png, w, h, scale = 1) {
  let last = "";
  for (const model of [...VISION, ...VISION]) {
    try {
      const { base, key } = routerConfig();
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: "data:image/png;base64," + png.toString("base64") } },
                {
                  type: "text",
                  text: `Find the character's face and mouth. Coordinates are normalized to 0-1000 (x: 0 = left edge, 1000 = right edge; y: 0 = top edge, 1000 = bottom edge). "face" is the whole face from hairline to chin, "mouth" is the lips only. Reply ONLY JSON {"face":[x0,y0,x1,y1],"mouth":[x0,y0,x1,y1]}.`,
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(120000),
      });
      const text = (await res.json()).choices?.[0]?.message?.content ?? "";
      const box = (key) => {
        const n = (text.match(new RegExp(`${key}"?\\s*:\\s*\\[([^\\]]*)\\]`))?.[1].match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
        if (n.length !== 4) return null;
        // Values above 1000 can only be pixels.
        const px = n.some((v) => v > 1000);
        // Pixel answers refer to the (possibly smaller) image that was sent.
        return [px ? n[0] * scale : (n[0] * w) / 1000, px ? n[1] * scale : (n[1] * h) / 1000, px ? n[2] * scale : (n[2] * w) / 1000, px ? n[3] * scale : (n[3] * h) / 1000].map(Math.round);
      };
      const face = box("face");
      const mouth = box("mouth");
      if (!face || !mouth) throw new Error(`jawaban tidak terbaca (${text.slice(0, 80)})`);
      // With a hand near the chin the model boxes only the middle of the lips; widen a
      // too-small box around its centre instead of rejecting it.
      {
        const [fw0, fh0] = [face[2] - face[0], face[3] - face[1]];
        const [ccx, ccy] = [(mouth[0] + mouth[2]) / 2, (mouth[1] + mouth[3]) / 2];
        const [hw, hh] = [Math.max(mouth[2] - mouth[0], fw0 * 0.14) / 2, Math.max(mouth[3] - mouth[1], fh0 * 0.04) / 2];
        [mouth[0], mouth[1], mouth[2], mouth[3]] = [ccx - hw, ccy - hh, ccx + hw, ccy + hh].map(Math.round);
      }
      const [fw, fh] = [face[2] - face[0], face[3] - face[1]];
      const [mw, mh] = [mouth[2] - mouth[0], mouth[3] - mouth[1]];
      const [cx, cy] = [(mouth[0] + mouth[2]) / 2, (mouth[1] + mouth[3]) / 2];
      const ok =
        fw > w * 0.08 && fh > 0 && mw > 0 && mh > 0 &&
        cx > face[0] && cx < face[2] && cy > face[1] + fh * 0.5 && cy < face[3] &&
        mw > fw * 0.1 && mw < fw * 0.6 && mh < fh * 0.4;
      if (ok) return { mouth, face };
      last = `${model}: kotak tidak masuk akal (wajah ${face}, mulut ${mouth})`;
    } catch (e) {
      last = `${model}: ${e.message}`;
    }
  }
  throw new Error("Posisi mulut tidak ketemu. " + last);
}

// Find the shift that lines the edit up with the original on the face around the
// mouth, then blend the edit in over the mouth. `ox`,`oy`: where the edit's
// top-left sits in the original. The paste mask is the mouth area plus skin only,
// softened: eyes, hair, outlines and the headset never change, so a slightly
// redrawn face in the edit cannot leave ghosts.
function pasteMouth(base, edit, { mouth: [mx0, my0, mx1, my1], face: [fx0, fy0, fx1, fy1] }, ox = 0, oy = 0) {
  const [mw, mh, fw, fh] = [mx1 - mx0, my1 - my0, fx1 - fx0, fy1 - fy0];
  const cx = (mx0 + mx1) / 2;
  const cy = (my0 + my1) / 2 + mh * 0.2;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // Open mouths come out bigger than the original one; the skin-only mask keeps a
  // generous area safe.
  const rx = clamp(mw * 1.3, 10, fw * 0.34);
  const ry = clamp(Math.max(mh * 2.4, mw * 0.85), 8, fh * 0.3);
  const at = (img, x, y) => (y * img.w + x) * 4;
  const inside = (img, x, y) => x >= 0 && y >= 0 && x < img.w && y < img.h;
  const px = (img, x, y) => img.data.subarray(at(img, x, y), at(img, x, y) + 4);
  const solid = (x, y) => base.data[at(base, x, y) + 3] === 255;
  const skin = (x, y) => {
    const [r, g, b] = px(base, x, y);
    return r > 140 && r >= g && g + 12 >= b && r - b > 20 && !(r > 235 && g > 235 && b > 235);
  };
  const [bx0, by0, bx1, by1] = [mx0 - mw * 0.25, my0 - mh * 0.4, mx1 + mw * 0.25, my1 + mh * 0.6];
  const lips = (x, y) => x >= bx0 && x <= bx1 && y >= by0 && y <= by1;
  const E = (x, y, dx, dy) => [x - ox + dx, y - oy + dy];
  const green = (x, y) => {
    const [r, g, b] = px(edit, x, y);
    return g - Math.max(r, b) > 30;
  };
  const lum = (p) => p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11;
  const R = Math.round(clamp(fw * 0.06, 4, 24));
  let shift = [0, 0];
  let err = Infinity;
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      let sum = 0;
      let n = 0;
      const step = fw > 300 ? 3 : 1;
      for (let y = Math.max(0, Math.round(fy0)); y < Math.min(base.h, fy1); y += step)
        for (let x = Math.max(0, Math.round(fx0)); x < Math.min(base.w, fx1); x += step) {
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1.7 || !solid(x, y)) continue;
          const [ex, ey] = E(x, y, dx, dy);
          if (!inside(edit, ex, ey) || green(ex, ey)) continue;
          sum += Math.abs(lum(px(base, x, y)) - lum(px(edit, ex, ey)));
          n++;
        }
      if (n > 50 && sum / n < err) [err, shift] = [sum / n, [dx, dy]];
    }
  const [dx, dy] = shift;
  // Mask over the ellipse's box, then softened with two box blurs.
  const X0 = Math.max(0, Math.floor(cx - rx) - 3);
  const Y0 = Math.max(0, Math.floor(cy - ry) - 3);
  const X1 = Math.min(base.w - 1, Math.ceil(cx + rx) + 3);
  const Y1 = Math.min(base.h - 1, Math.ceil(cy + ry) + 3);
  const W = X1 - X0 + 1;
  const H = Y1 - Y0 + 1;
  let mask = new Float32Array(W * H);
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      const e = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      const [ex, ey] = E(x, y, dx, dy);
      if (e >= 1 || !solid(x, y) || !inside(edit, ex, ey) || green(ex, ey) || !(lips(x, y) || skin(x, y))) continue;
      const t = e < 0.7 ? 1 : 1 - (e - 0.7) / 0.3;
      mask[(y - Y0) * W + x - X0] = t * t * (3 - 2 * t);
    }
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let sum = 0;
        let n = 0;
        for (let j = -1; j <= 1; j++)
          for (let i = -1; i <= 1; i++)
            if (x + i >= 0 && y + j >= 0 && x + i < W && y + j < H) (sum += mask[(y + j) * W + x + i]), n++;
        next[y * W + x] = sum / n;
      }
    mask = next;
  }
  const out = Buffer.from(base.data);
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      const m = mask[(y - Y0) * W + x - X0];
      const [ex, ey] = E(x, y, dx, dy);
      if (m <= 0 || !solid(x, y) || !inside(edit, ex, ey)) continue;
      const o = at(base, x, y);
      const s = at(edit, ex, ey);
      for (let c = 0; c < 3; c++) out[o + c] = base.data[o + c] * (1 - m) + edit.data[s + c] * m;
    }
  return { img: { w: base.w, h: base.h, data: out }, err, shift };
}

// The face (with some hair and neck) cut out on green and scaled to 1024 px, so
// small faces in full-body pictures get redrawn crisply and barely drift.
function faceCrop(img, [fx0, fy0, fx1, fy1]) {
  const S = Math.round(Math.max(fx1 - fx0, fy1 - fy0) * 1.8);
  const x0 = Math.round((fx0 + fx1) / 2 - S / 2);
  const y0 = Math.round((fy0 + fy1) / 2 + (fy1 - fy0) * 0.1 - S / 2);
  const data = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = (y * S + x) * 4;
      const [X, Y] = [x0 + x, y0 + y];
      if (X < 0 || Y < 0 || X >= img.w || Y >= img.h) {
        data.set([0, 255, 0, 255], d);
        continue;
      }
      const s = (Y * img.w + X) * 4;
      const a = img.data[s + 3] / 255;
      data.set([img.data[s] * a, img.data[s + 1] * a + 255 * (1 - a), img.data[s + 2] * a, 255], d);
    }
  return { img: { w: S, h: S, data }, x0, y0 };
}

// `only`: redo just these mouth shapes (e.g. ["open"]) and keep the others.
export function startMouths(id, emit, only = null) {
  const base = get("SELECT * FROM media WHERE id = ?", id);
  if (!base || !base.cutout || !/\.png$/i.test(base.path) || !fs.existsSync(base.path)) throw new Error("Hanya untuk gambar karakter transparan");
  if (base.mouth_of) throw new Error("Pilih gambar karakter utamanya, bukan frame mulut");
  const name = base.filename.replace(/\.png$/i, "");
  const tid = ++seq;
  tasks.set(tid, { id: tid, label: `${name} · mulut bicara`, started: Date.now() });
  emit({ type: "gen", tasks: pendingTasks() });
  (async () => {
    const img = decodePng(fs.readFileSync(base.path));
    // A small copy for the vision model: coordinates are normalized, and the full
    // 700 KB PNG sometimes came back from the router as an empty answer.
    const k = Math.min(1, 640 / img.w);
    const where = await locateMouth(encodePng(resize(img, Math.round(img.w * k), Math.round(img.h * k))), img.w, img.h, 1 / k);
    const face = faceCrop(img, where.face);
    const ref = "data:image/png;base64," + encodePng(resize(face.img, 1024, 1024)).toString("base64");
    const save = (key, out, prompt) => {
      const png = encodePng(out);
      const file = base.path.replace(/\.png$/i, `-mulut-${key}.png`);
      fs.writeFileSync(file, png);
      run("DELETE FROM media WHERE mouth_of = ? AND mouth = ?", base.id, key);
      run(
        "INSERT INTO media (filename, path, kind, size, note, prompt, char, cutout, mouth_of, mouth) VALUES (?, ?, 'image', ?, ?, ?, ?, 1, ?, ?)",
        `${name} · mulut ${MOUTHS[key].name}.png`,
        file,
        png.length,
        `Frame mulut ${MOUTHS[key].name} untuk ${base.filename}`,
        prompt,
        base.char,
        base.id,
        key,
      );
    };
    const shaky = [];
    for (const r of await Promise.allSettled(
      Object.entries(MOUTHS)
        .filter(([key]) => !only?.length || only.includes(key))
        .map(async ([key, m]) => {
          const prompt = `Keep the image exactly the same: same character, face, eyes, hair, outfit, colors, lineart and plain green background. Only change the mouth: ${m.en}. No added effects, symbols or lines.`;
          // A badly aligned edit (face redrawn too differently) gets one more try.
          let best = null;
          for (let attempt = 0; attempt < 2 && !(best && best.err <= 14); attempt++) {
            const buf = await draw(EDIT, [{ image: ref }, { text: prompt }], { size: "1024*1024", seed: Math.floor(Math.random() * 2 ** 31), negative_prompt: `${NEGATIVE}, speech lines, emanata, sparkles, exclamation marks, sweat drops, text, letters, red lipstick, thick lips, blurry` });
            const res = pasteMouth(img, resize(decodePng(buf), face.img.w, face.img.h), where, face.x0, face.y0);
            if (!best || res.err < best.err) best = res;
          }
          if (best.err > 20) shaky.push(m.name);
          save(key, best.img, prompt);
        }),
    ))
      if (r.status === "rejected") throw r.reason;
    emit({ type: "gen-done", ok: true, label: `${name} · mulut bicara${shaky.length ? ` (cek frame ${shaky.join(", ")})` : ""}` });
  })()
    .catch((e) => emit({ type: "gen-done", ok: false, label: `${name} · mulut bicara`, error: e.message }))
    .finally(() => {
      tasks.delete(tid);
      emit({ type: "gen", tasks: pendingTasks() });
      emit({ type: "refresh" });
    });
  return tid;
}

export const imageOptions = () => ({
  characters: Object.entries(CHARACTERS).map(([key, c]) => ({ key, name: c.name, hint: c.hint })),
  poses: Object.entries(POSES).map(([key, p]) => ({ key, name: p.name })),
  ratios: Object.keys(SIZES),
  ready: Boolean(process.env.DASHSCOPE_API_KEY),
});

export { decodePng, encodePng, onGreen, resize, pasteMouth, locateMouth, faceCrop, cleanLeftovers };
