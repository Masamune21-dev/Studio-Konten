// Motion-design building blocks from the 16 Oct 2026 research into the best Claude/Remotion motion
// graphics (SKILL.md 6f "Motion design playbook"): scenes that grow out of each other instead of
// fading, kinetic type synced to the narration, numbers that roll, camera moves without zoom
// (parallax), and a quiet ambient layer so no frame ever looks frozen.
//   sayAt / wordTimes  frame a word/phrase is spoken (same timing as the captions)
//   Handoff            a shape morphing from one box to another (match cut: "transisi": "cut")
//   KineticText        words (or letters) arriving one by one, key words coloured + a small punch
//   Highlight          marker sweeping behind a word
//   CountUp            number counting up (id-ID formatting), optionally rolling digits
//   WordSwap           one slot, words replacing each other with a vertical roll
//   Parallax / Layer   2.5D pan: far layers move less than near ones
//   AccentShapes       circles, rings, pills, plus signs and dot grids drifting at the edges
//   ColorShift         background colour blooming into a new one from a point, on a beat
import React, { createContext, useContext } from "react";
import { AbsoluteFill, interpolate, interpolateColors, random, spring } from "remotion";
import { useCurrentFrame, useVideoConfig } from "./Time";
import durations from "../vo-durations.json";
import turnsJson from "../vo-turns.json";
import { FPS, LEAD_IN } from "../theme";
import { display, Theme } from "../design";
import { Scene } from "./Type";
import { timeWords, Word } from "./Captions";
import { DUR, EASE, SPRING, float, ramp } from "./Motion";

/* ---------- narration timing ---------- */
const TURNS = turnsJson as Record<string, { start: number; end: number; vo: string }[]>;
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
// Every word of the scene's narration with its caption timing (scene frames).
export const spokenWords = (scene: Scene): Word[] => {
  const turns = TURNS[scene.id];
  if (turns && turns.length > 1) return turns.flatMap((t) => timeWords(t.vo, LEAD_IN + Math.round(t.start * FPS), Math.round((t.end - t.start) * FPS)));
  return timeWords(scene.vo, LEAD_IN, Math.ceil(((durations as Record<string, number>)[scene.id] ?? 3) * FPS));
};
// Start frame of each word of `phrase` where it is spoken (nth occurrence). Throws on a typo, like
// the "kata" cues, so a mistimed animation never ships silently.
export const wordTimes = (scene: Scene, phrase: string, nth = 1): number[] => {
  const words = spokenWords(scene);
  const keys = phrase.split(/\s+/).map(norm).filter(Boolean);
  let seen = 0;
  for (let i = 0; i + keys.length <= words.length; i++) {
    if (keys.every((k, j) => norm(words[i + j].text) === k) && ++seen === nth) return keys.map((_, j) => Math.round(words[i + j].start));
  }
  throw new Error(`${scene.id}: "${phrase}" tidak ada di narasi (sayAt/wordTimes)`);
};
export const sayAt = (scene: Scene, phrase: string, nth = 1) => wordTimes(scene, phrase, nth)[0];

/* ---------- handoff (match cut) ---------- */
export type Box = { x: number; y: number; w: number; h: number; r?: number; color?: string; rot?: number };
// Shape that turns from box `from` into box `to` (position, size, corner radius, colour, rotation).
// The outgoing scene ends with an element at `from`; the next scene comes in with "transisi": "cut"
// and starts its Handoff at that same box, so the eye sees one object becoming the next scene
// (its background, a card, a bar). Children fade in once the shape has arrived.
export const Handoff: React.FC<{ from: Box; to: Box; delay?: number; dur?: number; children?: React.ReactNode; style?: React.CSSProperties }> = ({ from, to, delay = 0, dur = DUR.big, children, style }) => {
  const f = useCurrentFrame();
  const p = ramp(f, delay, dur, EASE.inOut);
  const L = (a: number, b: number) => a + (b - a) * p;
  const color = interpolateColors(p, [0, 1], [from.color ?? "#000000", to.color ?? from.color ?? "#000000"]);
  const inner = ramp(f, delay + dur - 4, DUR.enter);
  return (
    <div
      style={{
        position: "absolute",
        left: L(from.x, to.x),
        top: L(from.y, to.y),
        width: L(from.w, to.w),
        height: L(from.h, to.h),
        borderRadius: L(from.r ?? 0, to.r ?? 0),
        background: color,
        transform: `rotate(${L(from.rot ?? 0, to.rot ?? 0)}deg)`,
        overflow: "hidden",
        ...style,
      }}
    >
      {children && <div style={{ position: "absolute", inset: 0, opacity: inner }}>{children}</div>}
    </div>
  );
};
// The whole frame as a Box (for a shape that grows into the next background).
export const fullBox = (W: number, H: number, color: string): Box => ({ x: 0, y: 0, w: W, h: H, r: 0, color });

/* ---------- kinetic type ---------- */
type KMode = "rise" | "pop" | "drop";
// Words arrive one by one. Timing: `times` (one start frame per unit, e.g. wordTimes(scene, text)
// to land exactly when spoken) or `at` + `step`. `emph`: words coloured `accent` with a 6% punch as
// they land; `marker`: emphasised words also get a Highlight behind them.
export const KineticText: React.FC<{
  text: string;
  at?: number;
  step?: number;
  times?: number[];
  by?: "word" | "char";
  mode?: KMode;
  emph?: string[];
  accent?: string;
  marker?: string; // highlight colour behind emphasised words
  style?: React.CSSProperties;
  align?: "left" | "center" | "right";
}> = ({ text, at = 0, step = DUR.stagger, times, by = "word", mode = "rise", emph = [], accent, marker, style, align = "left" }) => {
  const f = useCurrentFrame();
  const units = by === "word" ? text.split(/(\s+)/).filter((u) => u.length) : [...text];
  const keys = new Set(emph.flatMap((e) => e.split(/\s+/)).map(norm));
  let n = 0;
  return (
    <div style={{ textAlign: align, ...style }}>
      {units.map((u, i) => {
        if (/^\s+$/.test(u)) return <span key={i}>{u}</span>;
        const k = n++;
        const t0 = times?.[k] ?? at + k * step;
        const p = ramp(f, t0, mode === "pop" ? DUR.quick + 2 : DUR.enter, mode === "pop" ? EASE.out : EASE.out);
        const hot = keys.has(norm(u));
        const punch = hot ? 1 + 0.06 * Math.sin(Math.min(1, Math.max(0, (f - t0 - 4) / 10)) * Math.PI) : 1;
        // Hidden words sit fully below (or above) their mask, descender padding included, so no sliver shows.
        const off = `calc(${(1 - p) * 110}% + ${(1 - p) * 0.3}em)`;
        const move = mode === "rise" ? `translateY(${off})` : mode === "drop" ? `translateY(calc(-1 * ${off}))` : `scale(${0.6 + 0.4 * p})`;
        const word = (
          <span style={{ display: "inline-block", transform: `${move} scale(${punch})`, opacity: mode === "pop" ? p : 1, color: hot && accent ? accent : undefined, transformOrigin: "50% 80%" }}>{u}</span>
        );
        return (
          <span key={i} style={{ display: "inline-block", overflow: mode === "pop" ? "visible" : "hidden", verticalAlign: "top", paddingBottom: "0.12em", marginBottom: "-0.12em" }}>
            {hot && marker ? (
              <Highlight at={t0 + 4} color={marker}>
                {word}
              </Highlight>
            ) : (
              word
            )}
          </span>
        );
      })}
    </div>
  );
};

// Marker stroke sweeping left → right behind the children (below the text, slightly skewed).
export const Highlight: React.FC<{ at: number; color: string; dur?: number; height?: string; children: React.ReactNode }> = ({ at, color, dur = DUR.move, height = "0.42em", children }) => {
  const f = useCurrentFrame();
  const p = ramp(f, at, dur, EASE.inOut);
  return (
    <span style={{ position: "relative", display: "inline-block", isolation: "isolate" }}>
      <span style={{ position: "absolute", left: "-0.08em", right: "-0.08em", bottom: "0.06em", height, background: color, transform: `scaleX(${p}) skewX(-8deg)`, transformOrigin: "left", borderRadius: "0.12em", zIndex: -1 }} />
      {children}
    </span>
  );
};

/* ---------- numbers ---------- */
const fmt = (v: number, decimals: number) => v.toLocaleString("id-ID", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
// Counts from `from` to `to` (ease-out, so it slows into the final value). `roll`: every digit is a
// column of 0–9 that scrolls, like an odometer, instead of the number flickering.
export const CountUp: React.FC<{ from?: number; to: number; at?: number; dur?: number; decimals?: number; prefix?: string; suffix?: string; roll?: boolean; style?: React.CSSProperties }> = ({
  from = 0,
  to,
  at = 0,
  dur = 36,
  decimals = 0,
  prefix = "",
  suffix = "",
  roll,
  style,
}) => {
  const f = useCurrentFrame();
  const v = interpolate(ramp(f, at, dur, EASE.out), [0, 1], [from, to]);
  if (!roll)
    return (
      <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
        {prefix}
        {fmt(v, decimals)}
        {suffix}
      </span>
    );
  // Odometer: the final string decides the layout; each digit column is offset by the continuous
  // value of its place, so lower digits spin faster and every column lands exactly on its digit.
  const target = fmt(to, decimals);
  const scaled = v * 10 ** decimals;
  let place = target.replace(/\D/g, "").length - 1;
  return (
    <span style={{ display: "inline-flex", fontVariantNumeric: "tabular-nums", lineHeight: 1, ...style }}>
      {prefix}
      {[...target].map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i}>{ch}</span>;
        const pl = place--;
        // Units spin continuously; higher places only turn while the place below rolls 9 → 0 (a real
        // odometer), so every column rests exactly on its digit (was: tens stopped at 13,2 → "3" + a sliver of "4").
        const below = pl === 0 ? 0 : (scaled % 10 ** pl) / 10 ** pl;
        const pos = pl === 0 ? scaled % 10 : (Math.floor(scaled / 10 ** pl) + Math.max(0, below * 10 - 9)) % 10;
        // Leading digits (tens and up) fade in once the count reaches them: no "00,0" at the start.
        const lead = pl > decimals ? Math.min(1, Math.max(0, (scaled / 10 ** pl - 0.5) * 2)) : 1;
        return (
          <span key={i} style={{ display: "inline-block", height: "1em", overflow: "hidden", position: "relative", opacity: lead, maxWidth: lead > 0 ? undefined : 0 }}>
            <span style={{ display: "flex", flexDirection: "column", transform: `translateY(${-pos}em)` }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => (
                <span key={j} style={{ height: "1em" }}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
      {suffix}
    </span>
  );
};

// One slot whose word changes at each frame in `at` (words[0] shown from the start): the old word
// rolls up and out, the new one rolls in from below. Width follows the current word.
export const WordSwap: React.FC<{ words: string[]; at: number[]; color?: string; style?: React.CSSProperties }> = ({ words, at, color, style }) => {
  const f = useCurrentFrame();
  let cur = 0;
  at.forEach((t, i) => f >= t && (cur = i + 1));
  const p = cur === 0 ? 1 : ramp(f, at[cur - 1], DUR.enter, EASE.inOut);
  const prev = cur > 0 ? words[cur - 1] : null;
  return (
    <span style={{ display: "inline-block", position: "relative", overflow: "hidden", verticalAlign: "bottom", color, paddingBottom: "0.1em", ...style }}>
      <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 100}%)` }}>{words[Math.min(cur, words.length - 1)]}</span>
      {prev !== null && p < 1 && <span style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${-p * 100}%)`, opacity: 1 - p }}>{prev}</span>}
    </span>
  );
};

/* ---------- parallax ---------- */
const Pan = createContext<[number, number]>([0, 0]);
// Camera pan over layered artwork without zooming: between frames `from` and `to` the camera moves
// by `pan` px (sine ease); each <Layer depth> moves by depth × pan (0 = fixed far background,
// 1 = foreground). Depth differences of 0.3–0.6 read as space; keep the whole pan ≤ ±160 px.
export const Parallax: React.FC<{ pan: [number, number]; from?: number; to?: number; children: React.ReactNode }> = ({ pan, from = 0, to, children }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = ramp(f, from, Math.max(1, (to ?? durationInFrames) - from), EASE.sine);
  return <Pan.Provider value={[pan[0] * p, pan[1] * p]}>{children}</Pan.Provider>;
};
export const Layer: React.FC<{ depth: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ depth, children, style }) => {
  const [x, y] = useContext(Pan);
  return <AbsoluteFill style={{ transform: `translate(${-x * depth}px, ${-y * depth}px)`, ...style }}>{children}</AbsoluteFill>;
};

/* ---------- ambient ---------- */
// A few flat shapes near the edges, arriving one by one and then drifting slowly (the ambient layer:
// the scene never freezes, and nothing competes with the text). Seeded, so each scene differs.
export const AccentShapes: React.FC<{ t: Theme; seed: string; count?: number; delay?: number; opacity?: number }> = ({ t, seed, count = 5, delay = 0, opacity = 0.9 }) => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const kinds = ["circle", "ring", "pill", "plus", "dots"] as const;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}|${i}|${k}`);
        const kind = kinds[Math.floor(r("k") * kinds.length)];
        // Edges only: left/right bands or top/bottom corners, clear of the text column.
        const side = r("s") < 0.5;
        const x = side ? (r("x") < 0.5 ? r("xx") * W * 0.07 : W * (0.93 + r("xx") * 0.06)) : r("xx") * W;
        const y = side ? H * (0.12 + r("y") * 0.7) : r("y") < 0.5 ? H * (0.03 + r("yy") * 0.07) : H * (0.86 + r("yy") * 0.06);
        const size = 26 + r("size") * 70;
        const color = [t.accent, t.fg, t.soft][Math.floor(r("c") * 3)];
        const s = spring({ frame: f - delay - i * DUR.stagger, fps, config: SPRING.soft });
        const dx = float(f, 10, 140 + r("p") * 80, r("ph") * 100), dy = float(f, 14, 170 + r("q") * 90, r("qh") * 100);
        const rot = (f / 4) * (r("rot") - 0.5);
        const base: React.CSSProperties = { position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, opacity: opacity * Math.min(1, s * 1.5), transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${0.6 + 0.4 * s})` };
        if (kind === "circle") return <div key={i} style={{ ...base, borderRadius: "50%", background: color }} />;
        if (kind === "ring") return <div key={i} style={{ ...base, borderRadius: "50%", border: `${Math.max(5, size * 0.14)}px solid ${color}` }} />;
        if (kind === "pill") return <div key={i} style={{ ...base, height: size * 0.42, borderRadius: size, background: color }} />;
        if (kind === "plus")
          return (
            <div key={i} style={base}>
              <div style={{ position: "absolute", left: "40%", top: 0, width: "20%", height: "100%", borderRadius: 99, background: color }} />
              <div style={{ position: "absolute", top: "40%", left: 0, height: "20%", width: "100%", borderRadius: 99, background: color }} />
            </div>
          );
        return (
          <div key={i} style={{ ...base, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: size * 0.18 }}>
            {Array.from({ length: 9 }, (_, j) => (
              <div key={j} style={{ borderRadius: "50%", background: color, aspectRatio: "1" }} />
            ))}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Background colour change on a beat: each new colour grows as a circle from (x, y) (shares of the
// frame) over DUR.move frames. Put it first inside the scene, under the content.
export const ColorShift: React.FC<{ base: string; shifts: { at: number; color: string; x?: number; y?: number }[] }> = ({ base, shifts }) => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: base }}>
      {shifts.map((s, i) => {
        const p = ramp(f, s.at, DUR.move, EASE.inOut);
        if (p <= 0) return null;
        const cx = (s.x ?? 0.5) * W, cy = (s.y ?? 0.5) * H;
        const R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
        return <AbsoluteFill key={i} style={{ background: s.color, clipPath: `circle(${R * p}px at ${cx}px ${cy}px)` }} />;
      })}
    </AbsoluteFill>
  );
};

// Big display line helper for KineticText (same metrics as big() in Type.tsx).
export const kineticBig = (size: number, color: string): React.CSSProperties => ({ fontFamily: display, fontWeight: 800, fontSize: size, lineHeight: 0.95, letterSpacing: -size * 0.03, color });
