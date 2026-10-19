import { useLayoutEffect, useRef, useState } from "react";
import { interpolate, spring, getInputProps, delayRender, continueRender } from "remotion";
import { useCurrentFrame, useVideoConfig } from "./Time";
import { Rect, findFaces, layoutRect, overlap, whenReady } from "./Faces";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadLexend } from "@remotion/google-fonts/Lexend";

const montserrat = loadMontserrat("normal", { weights: ["900"], subsets: ["latin"] }).fontFamily;
const poppins = loadPoppins("normal", { weights: ["800"], subsets: ["latin"] }).fontFamily;
const anton = loadAnton("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const lexend = loadLexend("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily;

// Solid outline from stacked shadows: cleaner than -webkit-text-stroke,
// which eats into the glyphs at this weight.
const outline = (px: number, color = "#000") =>
  Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `${(Math.cos(a) * px).toFixed(1)}px ${(Math.sin(a) * px).toFixed(1)}px 0 ${color}`;
  }).join(", ") + ", 0 8px 20px rgba(0,0,0,0.55)";

type Style = {
  font: string;
  weight: number;
  size: number;
  upper?: boolean;
  color: string;
  active: string;
  activeBox?: string; // pill behind the spoken word
  emph: string; // numbers and the scene's "tekan" words
  lineBox?: string; // panel behind the whole line
  shadow: string;
};

export const CAPTION_STYLES: Record<string, Style> = {
  montserrat: { font: montserrat, weight: 900, size: 72, color: "#ffffff", active: "#ffe14d", emph: "#5eead4", shadow: outline(6) },
  poppins: { font: poppins, weight: 800, size: 58, color: "#ffffff", active: "#ffffff", activeBox: "#0ea5e9", emph: "#ffe14d", shadow: outline(5) },
  anton: { font: anton, weight: 400, size: 92, upper: true, color: "#ffffff", active: "#ffe14d", emph: "#5eead4", shadow: outline(6) },
  lexend: { font: lexend, weight: 700, size: 62, color: "#ffffff", active: "#22d3ee", lineBox: "rgba(2,6,23,0.72)", emph: "#ffe14d", shadow: "none" },
};



export type Word = { text: string; start: number; end: number };

// Indonesian reading of a whole number (what the TTS says for "433"), for timing only.
const SATUAN = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
const terbilang = (n: number): string => {
  const rest = (m: number) => (m ? " " + terbilang(m) : "");
  if (n < 10) return SATUAN[n];
  if (n === 10) return "sepuluh";
  if (n === 11) return "sebelas";
  if (n < 20) return SATUAN[n - 10] + " belas";
  if (n < 100) return SATUAN[Math.floor(n / 10)] + " puluh" + rest(n % 10);
  if (n < 200) return "seratus" + rest(n - 100);
  if (n < 1000) return SATUAN[Math.floor(n / 100)] + " ratus" + rest(n % 100);
  if (n < 2000) return "seribu" + rest(n - 1000);
  if (n < 1e6) return terbilang(Math.floor(n / 1000)) + " ribu" + rest(n % 1000);
  if (n < 1e9) return terbilang(Math.floor(n / 1e6)) + " juta" + rest(n % 1e6);
  if (n < 1e12) return terbilang(Math.floor(n / 1e9)) + " miliar" + rest(n % 1e9);
  return String(n);
};
const digits = (s: string) => [...s].map((d) => SATUAN[+d]).join(" ");
// "0812…" and very long runs are read digit by digit.
const whole = (s: string) => ((s.length > 1 && s[0] === "0") || s.length > 12 ? digits(s) : terbilang(Number(s)));
// One run of digits and separators: "1.600" (dots group thousands), "12,5" / "2,4" (decimal comma),
// "5.3" / "2.0" (versions; "USB 2.0" is said "USB dua"), "02:14" (time), else every group on its own
// ("192.168.1.1").
const readNumber = (m: string): string => {
  let r = m.match(/^([1-9]\d{0,2}(?:\.\d{3})+)(?:,(\d+))?$/);
  if (r) return terbilang(Number(r[1].replace(/\./g, ""))) + (r[2] ? " koma " + digits(r[2]) : "");
  if ((r = m.match(/^(\d+),(\d+)$/))) return whole(r[1]) + " koma " + digits(r[2]);
  if ((r = m.match(/^(\d+)\.(\d+)$/))) return whole(r[1]) + (/^0+$/.test(r[2]) ? "" : " titik " + digits(r[2]));
  if ((r = m.match(/^(\d{1,2}):(\d{2})$/))) return terbilang(+r[1]) + (+r[2] ? " " + terbilang(+r[2]) : "");
  return m
    .split(/([.,:])/)
    .map((p) => (p === "." ? "titik" : p === "," ? "koma" : p === ":" ? "" : whole(p)))
    .filter(Boolean)
    .join(" ");
};
// Symbols and units the TTS reads as words, beside a number ("100%", "5G", "Rp50.000") or alone ("GHz").
const UNIT = new Map(
  Object.entries({
    "%": "persen", "+": "plus", "/": "per", "°": "derajat", x: "kali", G: "ge", Rp: "rupiah", rb: "ribu", jt: "juta",
    KB: "kilo", MB: "mega", GB: "giga", TB: "tera", MHz: "mega hertz", GHz: "giga hertz", ms: "milidetik", km: "kilometer",
  }),
);
// Spoken length of a word: a number like "1201", "1.600" or "40-an" takes as long as its words.
const spokenLength = (w: string) => {
  const core = w.replace(/^["'“‘([]+|[.,?!:;…"'”’)\]]+$/g, "");
  if (UNIT.has(core)) return UNIT.get(core)!.length;
  if (!/\d/.test(core)) return w.length;
  return core
    .split(/(\d+(?:[.,:]\d+)*)/)
    .map((p, i) => (i % 2 ? readNumber(p) : (UNIT.get(p.replace(/-/g, "")) ?? p.replace(/-/g, ""))))
    .filter(Boolean)
    .join(" ").length;
};

// TTS gives no word timings, so spread words over the narration by spoken length (numbers count
// as their spelled-out reading), with extra weight after punctuation to mimic natural pauses
// (a colon, as in "Contekannya: 72 atau 144", pauses as long as a full stop).
export const timeWords = (vo: string, from: number, frames: number): Word[] => {
  // Long URLs are split at the first "/" so one word never overflows the line.
  const words = vo
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((w) => (w.length > 22 && w.indexOf("/") > 0 ? [w.slice(0, w.indexOf("/")), w.slice(w.indexOf("/"))] : [w]));
  const weight = (w: string) => spokenLength(w) + 2 + (/[.?!:]$/.test(w) ? 7 : /,$/.test(w) ? 4 : 0);
  const total = words.reduce((s, w) => s + weight(w), 0);
  let t = from;
  return words.map((w) => {
    const d = (weight(w) / total) * frames;
    const word = { text: w, start: t, end: t + d };
    t += d;
    return word;
  });
};

// Landscape frames are wider, so they take longer lines.
const chunk = (words: Word[], maxLen = 16, maxWords = 4) => {
  const out: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    const len = cur.map((x) => x.text).join(" ").length;
    if (/[.?!,]$/.test(w.text) || len > maxLen || cur.length >= maxWords) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
};

// Start and end frame of every caption line, for check:crop (Video.tsx logs their middles).
export const captionLines = (vo: string, from: number, frames: number, wide: boolean) =>
  (wide ? chunk(timeWords(vo, from, frames), 28, 6) : chunk(timeWords(vo, from, frames))).map((c) => ({ start: c[0].start, end: c[c.length - 1].end }));

// Where the caption block sits (insets of its full-width band) and how it dodged a face.
type Place = { left: number; right: number; top: number; how: string; key?: string };
const homeOf = (W: number, H: number): Place => (W > H ? { left: 240, right: 240, top: H - 215, how: "" } : { left: 60, right: 60, top: 1430, how: "" });
const CLEAR = 32; // px kept between a face and the captions

// Try places in order of how little they change: home; the same height on the side free of faces
// (narrower, so it may wrap to more lines); just under the lowest face in the way; just over the
// highest. Each try is laid out and measured for real. Falls back to home when nothing is free.
function dodge(box: HTMLDivElement, line: HTMLDivElement, faces: Rect[], W: number, H: number): Place {
  const home = homeOf(W, H);
  const wide = W > H;
  const near = faces.map((f) => ({ x0: f.x0 - CLEAR, y0: f.y0 - CLEAR, x1: f.x1 + CLEAR, y1: f.y1 + CLEAR }));
  const measure = (p: Place) => {
    box.style.left = `${p.left}px`;
    box.style.right = `${p.right}px`;
    box.style.top = `${p.top}px`;
    return layoutRect(line);
  };
  const clear = (r: Rect) => !near.some((f) => overlap(f, r) > 0);
  const restore = (p: Place) => (measure(p), p);
  const r0 = measure(home);
  if (!faces.length || clear(r0) || getInputProps().captionsStay) return restore(home);
  const tries: Place[] = [];
  // 1. Same height, on a side free of faces.
  const band = near.filter((f) => f.y1 > r0.y0 - 40 && f.y0 < r0.y1 + 120).sort((a, b) => a.x0 - b.x0);
  const gaps: [number, number][] = [];
  let x = home.left;
  for (const f of band) {
    if (f.x0 > x) gaps.push([x, f.x0]);
    x = Math.max(x, f.x1);
  }
  if (W - home.right > x) gaps.push([x, W - home.right]);
  for (const [a, b] of gaps.sort((g, h) => h[1] - h[0] - (g[1] - g[0])))
    if (b - a >= (wide ? 640 : 460)) tries.push({ left: Math.ceil(a), right: Math.ceil(W - b), top: home.top, how: "samping" }); // rounded inwards
  // 2. Under the lowest face in the way, 3. over the highest.
  const inWay = near.filter((f) => f.x1 > r0.x0 && f.x0 < r0.x1);
  if (inWay.length) {
    tries.push({ ...home, top: Math.ceil(Math.max(...inWay.map((f) => f.y1))), how: "turun" });
    tries.push({ ...home, top: Math.floor(Math.min(...inWay.map((f) => f.y0)) - (r0.y1 - r0.y0)), how: "naik" });
  }
  const lowest = wide ? H - 20 : 1700; // TikTok: stay above the description and buttons
  const highest = wide ? H * 0.5 : 900; // and below the main visuals
  for (const p of tries) {
    const r = measure(p);
    if (r.y1 <= lowest && r.y0 >= highest && clear(r)) return restore(p);
  }
  return restore(home);
}

// Words to colour: anything with a digit (prices, speeds, dates) plus the scene's "tekan" phrases,
// matched word by word in order ("5 hari" colours both words, only where they stand together).
const keyOf = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const emphasised = (words: Word[], phrases: string[] = []) => {
  const on = new Set<Word>(words.filter((w) => /\d/.test(w.text)));
  for (const ph of phrases) {
    const keys = ph.split(/\s+/).map(keyOf).filter(Boolean);
    for (let i = 0; i + keys.length <= words.length; i++) if (keys.every((k, j) => keyOf(words[i + j].text) === k)) keys.forEach((_, j) => on.add(words[i + j]));
  }
  return on;
};

// `until`: hide after this frame (when the next speaker's captions take over). `emph`: "tekan" phrases.
// `words`: real word timings (frames) instead of spreading `vo` over the clip, e.g. from the Whisper
// transcript of uploaded footage (src/Footage.tsx); a line then disappears 0.8 s after its last word
// when nobody speaks, instead of staying until the next line.
export const Captions: React.FC<{ vo?: string; from?: number; frames?: number; words?: Word[]; until?: number; emph?: string[] }> = ({ vo = "", from: from0 = 0, frames = 0, words: given, until, emph }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const wide = width > height;
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const st = CAPTION_STYLES[(getInputProps().captionStyle as string) ?? "poppins"] ?? CAPTION_STYLES.poppins;
  const words = given ?? timeWords(vo, from0, frames);
  const from = given ? (given[0]?.start ?? 0) : from0;
  const hot = emphasised(words, emph);
  const chunks = wide ? chunk(words, 28, 6) : chunk(words);
  const linger = (i: number) => Math.min(chunks[i + 1]?.[0].start ?? Infinity, chunks[i][chunks[i].length - 1].end + fps * 0.8);
  const active = given
    ? (chunks.find((c, i) => f >= c[0].start && f < linger(i)) ?? null)
    : (chunks.find((c) => f >= c[0].start && f < c[c.length - 1].end) ?? (f < from ? null : chunks[chunks.length - 1]));
  const shown = !!active && !(until !== undefined && f >= until);
  const home = homeOf(width, height);
  const key = shown ? `${active[0].start}` : "";
  // Keep the caption block off the characters' faces (components/Faces.ts): measured after each
  // render, decided once per line in layout space, so it never jitters with small moves.
  useLayoutEffect(() => {
    if (!shown || !box.current || !line.current) return;
    const scope = box.current.closest("[data-scene]") ?? document;
    const decide = () => {
      const { faces, pending } = findFaces(scope, true);
      if (pending.length) return false;
      const p = dodge(box.current!, line.current!, faces, width, height);
      if (!place || place.key !== key || p.left !== place.left || p.right !== place.right || p.top !== place.top) setPlace({ ...p, key });
      if (getInputProps().checkCrop) {
        const r = layoutRect(line.current!);
        if (r.y1 < 0) return true; // a copy Remotion keeps off-screen
        const hit = faces.filter((fc) => overlap(fc, r) > 0).map((fc) => fc.name);
        console.log(`FACECHECK ${JSON.stringify({ frame: f, caption: [r.x0, r.y0, r.x1, r.y1].map(Math.round), moved: p.how, hit, faces: faces.map((fc) => [fc.name, ...[fc.x0, fc.y0, fc.x1, fc.y1].map(Math.round)]) })}`);
      }
      return true;
    };
    if (decide()) return;
    // Images still loading: hold the frame until they are measured (a few tries, then give up).
    const h = delayRender("faces for captions");
    (async () => {
      for (let i = 0; i < 5; i++) {
        await whenReady(findFaces(scope, true).pending);
        if (decide()) break;
      }
      continueRender(h);
    })();
  });
  if (!shown) return null;
  // New line: short rise + 95% → 100% (was a 85% scale pop on every line, a small zoom each time).
  const pop = spring({ frame: f - active![0].start, fps, config: { damping: 18, stiffness: 220 } });
  const at = place && place.key === key ? place : home;

  return (
    // TikTok: below the visuals, clear of the app's side buttons. YouTube: a bottom band above the player controls.
    <div ref={box} style={{ position: "absolute", left: at.left, right: at.right, top: at.top, display: "flex", justifyContent: "center" }}>
      <div
        ref={line}
        style={{
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "4px 12px",
          padding: st.lineBox ? "14px 30px" : 0,
          borderRadius: 22,
          background: st.lineBox,
          fontFamily: st.font,
          fontWeight: st.weight,
          fontSize: wide ? Math.round(st.size * 0.9) : st.size,
          lineHeight: 1.2,
          letterSpacing: st.upper ? 1 : -0.5,
          textTransform: st.upper ? "uppercase" : undefined,
          textAlign: "center",
          transform: `translateY(${(1 - pop) * 14}px) scale(${interpolate(pop, [0, 1], [0.95, 1])})`,
          opacity: pop,
        }}
      >
        {active!.map((w, i) => {
          const on = f >= w.start && f < w.end;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                color: on ? st.active : hot.has(w) ? st.emph : st.color,
                padding: st.activeBox ? "0 12px" : 0,
                margin: st.activeBox ? "0 -6px" : 0,
                borderRadius: 14,
                background: on ? st.activeBox : undefined,
                transform: on ? "scale(1.06)" : undefined,
                textShadow: on && st.activeBox ? "none" : st.shadow,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
