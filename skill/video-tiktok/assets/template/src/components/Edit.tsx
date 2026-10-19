// Editing layer used by Video.tsx: scene transitions and camera moves. Scenes only draw their own
// content; how one scene hands over to the next and how the "camera" breathes is decided here.
//   transitions  wipe · slide · bars · push · iris · stairs (automatic) and fade · cut · zoom · whip ·
//                flash · glitch (only on request), each with its own sound. "cut" = no animation, for a
//                match cut where the next scene starts from a shape of the previous one (MotionKit Handoff). script.json: scene "transisi": "fade" picks
//                one; top-level "transisi": ["slide", …] limits the automatic pick; otherwise a seeded
//                shuffle bag (all used before repeats).
//   camera       very slow push-in over every scene (drift 1.5%), gentle punch-in zooms (max 1.12×) and
//                shakes on cues ("zoom": [{ "kata": "gratis" }], "guncang": [{ "kata": "boom" }]).
//                script.json "kamera": false turns it off, { "drift": 0 } keeps only the cues.
//   spotlight    "sorot": dims everything around one area and draws an outline around it: a beat that
//                points at something without zooming (SKILL.md 6c/6e).
// Since 16 Oct 2026 (user: "kurangi efek zoom", smoother motion): transitions 0.5 s instead of 0.4 s
// with softer easing, zoom transition and whip out of the automatic pool, punch-ins ease in over
// 0.4 s instead of snapping in 4 frames.
import { AbsoluteFill, Easing, interpolate, random } from "remotion";
import { useCurrentFrame, useVideoConfig } from "./Time";
import { EASE, ramp } from "./Motion";
import type { SfxName } from "./Sfx";

export const WIPE = 15; // frames the incoming scene takes to cover the outgoing one

export const TRANSITIONS = ["wipe", "slide", "bars", "push", "iris", "stairs", "fade", "cut", "zoom", "whip", "flash", "glitch"] as const;
export type TransName = (typeof TRANSITIONS)[number];
export type Trans = { name: TransName; dir: 1 | -1 };
// Picked automatically: the calm ones. zoom and whip are strong moves (asked for by meaning: "masuk
// lebih dalam", "pindah tempat"), flash is kept for reveals and glitch for hacking/scam topics, so
// they are only used when a scene asks for them or the video's "transisi" list includes them. fade
// (a crossfade) left the automatic pool on 16 Oct 2026: the research into the best motion graphics
// found crossfades read as generic; "bars" (colour blocks) took its place. "cut" is for match cuts.
const AUTO: TransName[] = ["wipe", "slide", "bars", "push", "iris", "stairs"];
// Sound played as the incoming scene starts (the whoosh peaks about where the cut lands).
export const TRANS_SFX: Record<TransName, [SfxName, number]> = {
  wipe: ["whoosh", 0.7],
  slide: ["swipe", 0.9],
  bars: ["whoosh", 0.8],
  fade: ["whoosh", 0.4],
  cut: ["whoosh", 0], // silent: the Handoff carries the moment (give it its own Sfx if needed)
  push: ["swipe", 0.9],
  iris: ["whoosh", 0.6],
  stairs: ["swipe", 0.8],
  zoom: ["whoosh", 0.7],
  whip: ["whoosh", 1],
  flash: ["thud", 0.6],
  glitch: ["glitch", 0.9],
};

const isTrans = (n: unknown): n is TransName => TRANSITIONS.includes(n as TransName);
// Shuffle-bag pick: every allowed transition is used once before any repeats, the bag is reshuffled
// (seeded) when empty, and the same one never plays twice in a row, also across bags.
export const planTransitions = (scenes: { id: string; transisi?: string }[], pool: unknown, seed: string): (Trans | null)[] => {
  if (Array.isArray(pool) && pool.some((n) => !isTrans(n))) throw new Error(`script.json "transisi": nama tidak dikenal (pilihan: ${TRANSITIONS.join(", ")})`);
  const allowed = Array.isArray(pool) && pool.length ? (pool as TransName[]) : AUTO;
  let bag: TransName[] = [];
  let round = 0;
  let prev: TransName | null = null;
  return scenes.map((s, i) => {
    if (i === 0) return null;
    if (s.transisi !== undefined && !isTrans(s.transisi)) throw new Error(`${s.id}: transisi "${s.transisi}" tidak dikenal (pilihan: ${TRANSITIONS.join(", ")})`);
    let name = s.transisi as TransName | undefined;
    if (!name) {
      if (!bag.length) {
        bag = [...allowed].sort((a, b) => random(`${seed}|bag${round}|${a}`) - random(`${seed}|bag${round}|${b}`));
        round++;
      }
      const k = bag.length > 1 && bag[0] === prev ? 1 : 0;
      name = bag.splice(k, 1)[0];
    }
    prev = name;
    return { name, dir: random(`${seed}|dir|${s.id}`) < 0.5 ? 1 : -1 };
  });
};

const eased = (x: number, e: (t: number) => number = EASE.inOut) => e(Math.min(1, Math.max(0, x)));
// Lighter version of a #rrggbb colour (k 0..1), for the colour blocks; other colours pass through.
// (Same as shade() in Icons.tsx, kept here so every project does not bundle the icon library.)
const lighter = (c: string, k: number) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return c;
  const v = parseInt(m[1], 16);
  return `#${[16, 8, 0].map((sh) => Math.round(((v >> sh) & 255) + (255 - ((v >> sh) & 255)) * k).toString(16).padStart(2, "0")).join("")}`;
};

// Horizontal bands revealed from one side, each a little later: one polygon, so the scene is drawn once.
const stairs = (p: number, dir: 1 | -1, bands = 5) => {
  const pts: string[] = [];
  const X = (v: number) => `${dir === 1 ? v : 100 - v}%`;
  pts.push(`${X(0)} 0%`);
  for (let i = 0; i < bands; i++) {
    const x = eased(p * 1.6 - i * 0.15) * 100;
    pts.push(`${X(x)} ${(i / bands) * 100}%`, `${X(x)} ${((i + 1) / bands) * 100}%`);
  }
  pts.push(`${X(0)} 100%`);
  return `polygon(${pts.join(", ")})`;
};
// Random horizontal strips for the glitch cut; zero-width edges join them into one polygon.
const strips = (f: number, p: number) => {
  const n = 9, pts: string[] = [];
  for (let i = 0; i < n; i++) {
    if (random(`gl|${f}|${i}`) > p * 1.3) continue;
    const a = (i / n) * 100, b = ((i + 1) / n) * 100;
    pts.push(`0% ${a}%`, `100% ${a}%`, `100% ${b}%`, `0% ${b}%`);
  }
  return pts.length ? `polygon(evenodd, ${pts.join(", ")})` : "inset(100% 0 0 0)";
};

// Wraps one scene: entering (first WIPE frames, over the previous scene) and leaving (WIPE frames
// after `duration`, under the next one). Only the incoming scene's transition decides both sides.
// edge = the incoming scene's accent, bg = its background (for the colour blocks of "bars").
export const SceneFrame: React.FC<{ enter: Trans | null; exit: Trans | null; duration: number; edge: string; bg?: string; children: React.ReactNode }> = ({ enter, exit, duration, edge, bg = "#ffffff", children }) => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  let style: React.CSSProperties = {};
  let inside: React.ReactNode = null;
  let above: React.ReactNode = null;
  if (enter && f < WIPE) {
    const raw = f / WIPE;
    const p = eased(raw);
    const d = enter.dir;
    switch (enter.name) {
      case "wipe":
        style = { clipPath: `inset(${(1 - p) * 100}% 0 0 0)` };
        inside = <div style={{ position: "absolute", left: 0, right: 0, top: `${(1 - p) * 100}%`, height: 18, background: edge }} />;
        break;
      case "slide":
        // Covers the old scene from one side while the old one drifts a little the other way (exit).
        style = { transform: `translateX(${d * (1 - p) * W}px)`, boxShadow: p < 1 ? `${-d * 24}px 0 60px rgba(0,0,0,0.3)` : undefined };
        break;
      case "fade":
        style = { opacity: p, transform: `translateY(${(1 - p) * 36}px)` };
        break;
      case "cut":
        break;
      case "bars": {
        // Three colour blocks sweep across (accent, a lighter accent, the new background), one after
        // another; the new scene shows wherever the last block has passed.
        const colors = [edge, lighter(edge, 0.45), bg];
        const bw = W * 0.62;
        const xs = colors.map((_, i) => -bw + (W + bw) * eased(raw * 1.45 - i * 0.2, EASE.inOut));
        const lead = d === 1 ? xs[2] : W - xs[2] - bw;
        style = { clipPath: d === 1 ? `inset(0 ${Math.max(0, W - lead)}px 0 0)` : `inset(0 0 0 ${Math.max(0, lead + bw)}px)` };
        above = (
          <>
            {colors.map((c, i) => (
              <div key={i} style={{ position: "absolute", top: 0, bottom: 0, width: bw, left: d === 1 ? xs[i] : W - xs[i] - bw, background: c }} />
            ))}
          </>
        );
        break;
      }
      case "push":
        style = { transform: `translateX(${d * (1 - p) * W}px)` };
        break;
      case "zoom":
        style = { transform: `scale(${0.94 + 0.06 * p})`, opacity: Math.min(1, p * 1.6) };
        break;
      case "iris": {
        const ref = Math.hypot(W, H) / Math.SQRT2;
        const r = p * 1.2 * ref;
        style = { clipPath: `circle(${r}px at 50% 42%)` };
        above = <div style={{ position: "absolute", left: W / 2 - r, top: H * 0.42 - r, width: 2 * r, height: 2 * r, borderRadius: "50%", border: `14px solid ${edge}`, opacity: 1 - p * 0.6 }} />;
        break;
      }
      case "whip": {
        const q = eased(raw, Easing.inOut(Easing.exp));
        style = { transform: `translateX(${d * (1 - q) * W}px)`, filter: `blur(${Math.sin(q * Math.PI) * 14}px)` };
        break;
      }
      case "flash":
        style = { opacity: raw >= 0.5 ? 1 : 0, transform: `scale(${raw < 0.5 ? 1.04 : interpolate(raw, [0.5, 1], [1.04, 1], { easing: EASE.out })})` };
        above = <AbsoluteFill style={{ background: "#fff", opacity: 1 - Math.abs(raw * 2 - 1) }} />;
        break;
      case "glitch":
        style = {
          clipPath: raw > 0.75 ? undefined : strips(f, raw),
          transform: `translateX(${(random(`gx|${f}`) * 2 - 1) * (1 - raw) * 60}px)`,
          filter: random(`gf|${f}`) < 0.5 ? `hue-rotate(${random(`gr|${f}`) < 0.5 ? -25 : 25}deg) saturate(1.6) contrast(1.25)` : undefined,
        };
        above = (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ position: "absolute", left: 0, right: 0, top: `${random(`gb|${f}|${i}`) * 100}%`, height: 6 + random(`gh|${f}|${i}`) * 26, background: i % 2 ? "rgba(34,211,238,0.6)" : "rgba(244,63,94,0.6)", opacity: 1 - raw }} />
            ))}
          </>
        );
        break;
      case "stairs":
        style = { clipPath: stairs(raw, d) };
        break;
    }
  } else if (exit && f >= duration) {
    const raw = (f - duration) / WIPE;
    const q = eased(raw);
    const d = exit.dir;
    switch (exit.name) {
      case "slide":
        style = { transform: `translateX(${-d * q * W * 0.3}px)`, filter: `brightness(${1 - 0.3 * q})` };
        break;
      case "push":
        style = { transform: `translateX(${-d * q * W}px)` };
        break;
      case "zoom":
        style = { transform: `scale(${1 + 0.08 * q})`, filter: `blur(${q * 4}px)` };
        break;
      case "iris":
        style = { filter: `brightness(${1 - 0.35 * q})` };
        break;
      case "whip": {
        const w = eased(raw, Easing.inOut(Easing.exp));
        style = { transform: `translateX(${-d * w * W}px)`, filter: `blur(${Math.sin(w * Math.PI) * 14}px)` };
        break;
      }
      default:
        break; // wipe, fade, flash, glitch, stairs: the incoming scene covers this one
    }
  }
  return (
    <AbsoluteFill data-scene="">
      <AbsoluteFill style={style}>
        {children}
        {inside}
      </AbsoluteFill>
      {above}
    </AbsoluteFill>
  );
};

// ---------- camera ----------
export type Punch = { at: number; scale: number; x: number; y: number; hold: number };
export type Shake = { at: number; power: number };
export type CameraCfg = false | { drift?: number } | undefined;

export const ZOOM_DEFAULT = 1.08;
export const ZOOM_MAX = 1.12; // larger "skala" values are clamped
export const ZOOM_IN = 12; // frames to reach the full punch-in (0.4 s)
export const ZOOM_OUT = 15; // frames back to normal
// When a punch is fully zoomed in, and when it is gone again (frames from the scene start).
export const punchSpan = (p: Punch) => {
  const held = p.at + Math.max(p.hold, ZOOM_IN);
  return { full: p.at + ZOOM_IN, release: held, end: held + ZOOM_OUT };
};

// Scale `s` around point (x, y) in px, as a CSS transform with origin 0 0.
const around = (s: number, x: number, y: number) => `translate(${x}px, ${y}px) scale(${s}) translate(${-x}px, ${-y}px)`;

// Very slow push-in over the whole scene (alternating between a point a little above and a little
// below the middle), plus punch-in zooms that ease in over ZOOM_IN frames, hold, and ease out over
// ZOOM_OUT, and short decaying shakes. Overlapping punches are combined, so one never snaps back to
// 1× when the next starts. Wraps the scene content only: captions stay put.
export const Camera: React.FC<{ cfg: CameraCfg; duration: number; odd: boolean; punches: Punch[]; shakes: Shake[]; children: React.ReactNode }> = ({ cfg, duration, odd, punches, shakes, children }) => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  if (cfg === false) return <>{children}</>;
  const drift = cfg?.drift ?? 0.015;
  const parts: string[] = [];
  if (drift) parts.push(around(1 + drift * Math.min(1, Math.max(0, f / duration)), W / 2, H * (odd ? 0.58 : 0.38)));
  for (const p of punches) {
    const { release, end } = punchSpan(p);
    if (f < p.at || f >= end) continue;
    const k = f < release ? ramp(f, p.at, ZOOM_IN, EASE.out) : 1 - ramp(f, release, ZOOM_OUT, EASE.inOut);
    parts.unshift(around(1 + (Math.min(ZOOM_MAX, p.scale) - 1) * k, p.x * W, p.y * H));
  }
  const s = shakes.find((z) => f >= z.at && f < z.at + 12);
  if (s) {
    const amp = s.power * 14 * (1 - (f - s.at) / 12) ** 2;
    parts.unshift(`translate(${(random(`sx|${f}`) * 2 - 1) * amp}px, ${(random(`sy|${f}`) * 2 - 1) * amp}px) rotate(${(random(`sr|${f}`) * 2 - 1) * amp * 0.04}deg)`);
  }
  // Always the same wrapper, so the scene is not remounted when a punch starts or ends.
  return <AbsoluteFill style={{ transform: parts.join(" ") || undefined, transformOrigin: "0 0" }}>{children}</AbsoluteFill>;
};

// ---------- spotlight ("sorot") ----------
// x/y = centre, w/h = size of the lit area, all as a share of the frame; hold in frames.
export type Spot = { at: number; x: number; y: number; w: number; h: number; hold: number };
export const SPOT_IN = 10;
export const SPOT_OUT = 12;
export const SPOT_FULL = 18; // frames until the outline is fully drawn

// Dims everything outside a soft rounded box (to 50%) and draws an accent outline around it. Inside
// the camera, so it stays on its target during the drift; captions are drawn later and stay bright.
export const Spotlight: React.FC<{ spots: Spot[]; color: string; id: string }> = ({ spots, color, id }) => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const s = spots.find((z) => f >= z.at && f < z.at + Math.max(z.hold, SPOT_IN) + SPOT_OUT);
  if (!s) return null;
  const release = s.at + Math.max(s.hold, SPOT_IN);
  const k = f < release ? ramp(f, s.at, SPOT_IN, EASE.out) : 1 - ramp(f, release, SPOT_OUT, EASE.inOut);
  const draw = ramp(f, s.at + 2, SPOT_FULL - 2, EASE.inOut);
  const bw = s.w * W, bh = s.h * H;
  const x0 = s.x * W - bw / 2, y0 = s.y * H - bh / 2;
  const r = Math.min(44, Math.min(bw, bh) / 2);
  const mask = `sorot-${id}`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id={`${mask}-soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={16} />
          </filter>
          <mask id={mask}>
            <rect width={W} height={H} fill="white" />
            <rect x={x0} y={y0} width={bw} height={bh} rx={r} fill="black" filter={`url(#${mask}-soft)`} />
          </mask>
        </defs>
        <rect width={W} height={H} fill="rgb(8,10,18)" opacity={0.5 * k} mask={`url(#${mask})`} />
        {draw > 0.01 && (
          <rect x={x0 - 12} y={y0 - 12} width={bw + 24} height={bh + 24} rx={r + 12} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray={`${draw} 1`} opacity={k} />
        )}
      </svg>
    </AbsoluteFill>
  );
};
