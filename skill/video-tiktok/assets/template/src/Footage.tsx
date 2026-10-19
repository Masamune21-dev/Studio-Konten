// Editing uploaded footage (SKILL.md step 9 "Edit video upload", since 16 Oct 2026). Compositions
// "Edit" (9:16) and "EditWide" (16:9) play the cuts listed in src/edit.json, with per-word captions
// from the Whisper transcript (npm run transcribe → src/footage-words.json), overlays from the icon
// and SVG kits, gentle zoom/sorot, and sound effects. Example edit.json:
// {
//   "format": "portrait",                       portrait → npm run render:edit, landscape → render:edit:yt
//   "sources": { "a": "footage/rekaman.mp4" },   files in public/
//   "fit": "blur",                               fill (crop to the frame) | blur (whole picture on a blurred copy) | card (in a card on the theme colour)
//   "theme": "night",                            THEMES key for cards, panels and titles
//   "segments": [ { "src": "a", "from": 2.4, "to": 9.1, "x": 0.5, "y": 0.4, "fit": "fill", "speed": 1, "volume": 1, "fade": false } ],
//   "captions": true, "tekan": ["gratis"],
//   "koreksi": { "kontoh fiber": "CONTOH FIBER", "penagi": "penagih" },   spelling fixes for misheard words
//   "overlays": [ { "type": "judul", "text": "Router di lantai?", "sub": "pindah ke sini", "t": 0, "lama": 3 },
//                 { "type": "ikon", "name": "router", "label": "Router", "kata": "router", "x": 0.78, "y": 0.3 } ],
//   "zoom": [ { "kata": "lampu", "x": 0.5, "y": 0.4 } ], "sorot": [ … ], "guncang": [ … ],
//   "sfx": [ { "s": "pop", "kata": "router" } ]
// }
// Times: "t" = seconds of the FINISHED video, "kata" = when that word is spoken (first match, "ke": 2
// for the second; "t" is then added as an offset). Positions are shares of the frame (x 0..1, y 0..1).
import React from "react";
import { AbsoluteFill, OffthreadVideo, getInputProps, staticFile } from "remotion";
import { Sequence, useCurrentFrame, useFrameRatio, useVideoConfig } from "./components/Time";
import edit from "./edit.json";
import wordsJson from "./footage-words.json";
import { FPS } from "./theme";
import { THEMES, Theme, display, label as labelFont } from "./design";
import { Captions, Word } from "./components/Captions";
import { Camera, Punch, Shake, Spot, SPOT_FULL, Spotlight, ZOOM_DEFAULT, ZOOM_IN } from "./components/Edit";
import { Sfx, SfxName, SfxScope } from "./components/Sfx";
import { BrandBadge, FollowBar, FlowNode, IconTile, NetFlow } from "./components/Icons";
import type { BrandName } from "./components/brandIcons";
import { Arrow, Gauge, Svg } from "./components/Svg";
import { Backdrop, Reveal } from "./components/Kinetic";
import { DUR, EASE, enterStyle, ramp } from "./components/Motion";

type Fit = "fill" | "blur" | "card";
type Seg = { src: string; from: number; to: number; fit?: Fit; x?: number; y?: number; speed?: number; volume?: number; fade?: boolean };
type When = { t?: number; kata?: string; ke?: number };
type Overlay = When & {
  type: "judul" | "teks" | "ikon" | "logo" | "follow" | "panah" | "jaringan" | "gauge" | "nama";
  lama?: number;
  s?: SfxName;
  text?: string;
  sub?: string;
  name?: string;
  label?: string;
  brand?: BrandName;
  items?: { brand: BrandName; handle: string }[];
  title?: string;
  x?: number;
  y?: number;
  size?: number;
  from?: [number, number];
  to?: [number, number];
  nodes?: FlowNode[];
  broken?: number;
  value?: number;
  max?: number;
  unit?: string;
  role?: string;
  color?: string;
};
type ZoomCue = When & { skala?: number; x?: number; y?: number; lama?: number; s?: SfxName };
type SpotCue = When & { x?: number; y?: number; w?: number; h?: number; lama?: number; s?: SfxName };
type ShakeCue = When & { kuat?: number; s?: SfxName };
export type EditSpec = {
  format?: "portrait" | "landscape";
  sources: Record<string, string>;
  fit?: Fit;
  theme?: string;
  segments: Seg[];
  captions?: boolean;
  tekan?: string[];
  koreksi?: Record<string, string>;
  overlays?: Overlay[];
  zoom?: ZoomCue[];
  sorot?: SpotCue[];
  guncang?: ShakeCue[];
  sfx?: (When & { s: SfxName; v?: number })[];
};
const E = edit as unknown as EditSpec;
const WORDS = wordsJson as Record<string, { text: string; start: number; end: number }[]>;

/* ---------- timeline ---------- */
const segFrames = (s: Seg) => Math.max(1, Math.round(((s.to - s.from) / (s.speed ?? 1)) * FPS));
export const editTimeline = () => {
  let at = 0;
  return E.segments.map((s, i) => {
    if (!E.sources[s.src]) throw new Error(`edit.json segmen ${i + 1}: sumber "${s.src}" tidak ada di "sources"`);
    if (!(s.to > s.from)) throw new Error(`edit.json segmen ${i + 1}: "to" harus lebih besar dari "from"`);
    const seg = { ...s, at, frames: segFrames(s) };
    at += seg.frames;
    return seg;
  });
};
// Logical (30 fps) frames of the whole edit; a 1 s placeholder while edit.json is empty.
export const editFrames = () => Math.max(FPS, editTimeline().reduce((a, s) => a + s.frames, 0));

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
// "koreksi": Whisper mishears names and slang ("kontoh fiber" for CONTOH FIBER). Each rule replaces the
// spoken words wherever they stand together; the new words share the old words' time span, and the
// punctuation of the last old word is kept.
type Raw = { text: string; start: number; end: number };
const corrected = (words: Raw[]): Raw[] => {
  let out = words;
  for (const [from, to] of Object.entries(E.koreksi ?? {})) {
    const keys = from.split(/\s+/).map(norm).filter(Boolean);
    const repl = to.split(/\s+/).filter(Boolean);
    if (!keys.length) continue;
    const next: Raw[] = [];
    for (let i = 0; i < out.length; ) {
      if (i + keys.length <= out.length && keys.every((k, j) => norm(out[i + j].text) === k)) {
        const a = out[i].start, b = out[i + keys.length - 1].end;
        const punct = out[i + keys.length - 1].text.match(/[.,?!:;]+$/)?.[0] ?? "";
        repl.forEach((w, j) => next.push({ text: j === repl.length - 1 && !/[.,?!:;]$/.test(w) ? w + punct : w, start: a + ((b - a) * j) / repl.length, end: a + ((b - a) * (j + 1)) / repl.length }));
        i += keys.length;
      } else next.push(out[i++]);
    }
    out = next;
  }
  return out;
};

// Transcript words that survive the cuts, moved to the finished video's frames.
const baseName = (p: string) => p.split("/").pop() ?? p;
export const editWords = (): Word[] =>
  editTimeline().flatMap((s) => {
    const sp = s.speed ?? 1;
    return corrected(WORDS[baseName(E.sources[s.src])] ?? [])
      .filter((w) => (w.start + w.end) / 2 >= s.from && (w.start + w.end) / 2 < s.to)
      .map((w) => ({ text: w.text, start: s.at + ((Math.max(w.start, s.from) - s.from) / sp) * FPS, end: s.at + ((Math.min(w.end, s.to) - s.from) / sp) * FPS }));
  });

const cueFrame = (c: When, what: string, words: Word[]) => {
  if (c.kata === undefined) return Math.round((c.t ?? 0) * FPS);
  const hit = words.filter((w) => norm(w.text) === norm(c.kata!))[(c.ke ?? 1) - 1];
  if (!hit) throw new Error(`edit.json ${what}: kata "${c.kata}" tidak terucap di bagian yang dipakai (cek out/transcript-*.txt)`);
  return Math.round(hit.start + (c.t ?? 0) * FPS);
};

/* ---------- one cut ---------- */
const SegmentView: React.FC<{ seg: Seg & { frames: number }; fit: Fit; t: Theme }> = ({ seg, fit, t }) => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const k = useFrameRatio(); // real frames per logical frame
  const real = FPS * k;
  const src = staticFile(E.sources[seg.src]);
  const pos = `${(seg.x ?? 0.5) * 100}% ${(seg.y ?? 0.5) * 100}%`;
  const len = seg.frames * k;
  const edge = Math.max(1, Math.round(real * 0.05)); // 50 ms fades at the cut: no clicks
  const vol = seg.volume ?? 1;
  const common = { trimBefore: Math.round(seg.from * real), playbackRate: seg.speed ?? 1 };
  const main = (style: React.CSSProperties) => (
    <OffthreadVideo src={src} {...common} volume={(fr: number) => vol * Math.max(0, Math.min(1, fr / edge, (len - fr) / edge))} style={{ width: "100%", height: "100%", ...style }} />
  );
  const opacity = seg.fade ? ramp(f, 0, DUR.quick, EASE.out) : 1;
  if (fit === "fill") return <AbsoluteFill style={{ opacity, background: "#000" }}>{main({ objectFit: "cover", objectPosition: pos })}</AbsoluteFill>;
  if (fit === "blur")
    return (
      <AbsoluteFill style={{ opacity, background: "#000", overflow: "hidden" }}>
        <OffthreadVideo src={src} {...common} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, filter: "blur(36px) brightness(0.55)", transform: "scale(1.15)" }} />
        {main({ position: "absolute", inset: 0, objectFit: "contain" })}
      </AbsoluteFill>
    );
  // card: the clip in a rounded frame on the theme colour, room for a title above and captions below.
  const box = W > H ? { left: 360, top: 70, width: 1200, height: 760 } : { left: 40, top: 360, width: 1000, height: 960 };
  return (
    <AbsoluteFill style={{ opacity }}>
      <Backdrop theme={t}>
        <div style={{ position: "absolute", ...box, borderRadius: 36, overflow: "hidden", background: "#000", boxShadow: "0 30px 60px rgba(0,0,0,0.35)" }}>{main({ objectFit: "contain" })}</div>
      </Backdrop>
    </AbsoluteFill>
  );
};

/* ---------- overlays ---------- */
const Panel: React.FC<{ t: Theme; style: React.CSSProperties; children: React.ReactNode }> = ({ t, style, children }) => (
  <div style={{ position: "absolute", background: t.bg, borderRadius: 34, boxShadow: "0 24px 50px rgba(0,0,0,0.35)", ...style }}>{children}</div>
);

// `instant`: the overlay is on screen from frame 0 of the video (FYP rule: frame 0 already full), so
// it starts settled instead of animating in from nothing.
const OverlayView: React.FC<{ o: Overlay; len: number; t: Theme; instant?: boolean }> = ({ o, len, t, instant }) => {
  const f = useCurrentFrame();
  const d0 = instant ? -60 : 0;
  const { width: W, height: H } = useVideoConfig();
  const wide = W > H;
  const out = 1 - ramp(f, len - DUR.quick, DUR.quick, EASE.in); // leaves before its time is up
  const inP = instant ? 1 : ramp(f, 0, DUR.enter);
  const X = (v: number | undefined, d: number) => (v ?? d) * W;
  const Y = (v: number | undefined, d: number) => (v ?? d) * H;
  let body: React.ReactNode = null;
  switch (o.type) {
    case "judul":
      body = (
        <Panel t={t} style={{ left: wide ? 96 : 50, right: wide ? undefined : 50, maxWidth: wide ? 1100 : undefined, top: Y(o.y, wide ? 0.07 : 0.09), padding: "30px 40px 34px" }}>
          <Reveal delay={d0}>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: o.size ?? (wide ? 84 : 92), lineHeight: 0.95, letterSpacing: -2, color: t.fg }}>{o.text}</div>
          </Reveal>
          {o.sub && (
            <Reveal delay={d0 + 6}>
              <div style={{ fontFamily: display, fontWeight: 700, fontSize: (o.size ?? 92) * 0.5, color: t.accent, marginTop: 10 }}>{o.sub}</div>
            </Reveal>
          )}
        </Panel>
      );
      break;
    case "teks":
      body = (
        <div style={{ position: "absolute", left: X(o.x, 0.5), top: Y(o.y, 0.25), transform: "translate(-50%, -50%)" }}>
          <div style={{ padding: "16px 30px", borderRadius: 999, background: o.color ?? t.accent, color: t.bg, fontFamily: display, fontWeight: 800, fontSize: o.size ?? 52, whiteSpace: "nowrap", boxShadow: "0 14px 30px rgba(0,0,0,0.3)", ...enterStyle(inP, { scale: 0.9 }) }}>{o.text}</div>
        </div>
      );
      break;
    case "ikon": {
      const size = o.size ?? 180;
      body = <IconTile name={o.name ?? "sparkles"} t={t} bg={o.color} size={size} delay={d0} label={o.label} labelColor="#FFFFFF" style={{ left: X(o.x, 0.78) - size / 2, top: Y(o.y, 0.3) - size / 2, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" }} />;
      break;
    }
    case "logo": {
      const size = o.size ?? 140;
      body = <BrandBadge brand={o.brand ?? "tiktok"} size={size} delay={d0} style={{ position: "absolute", left: X(o.x, 0.5) - size / 2, top: Y(o.y, 0.3) - size / 2 }} />;
      break;
    }
    case "follow":
      body = (
        <Panel t={t} style={{ left: wide ? W / 2 - 520 : 50, width: wide ? 1040 : W - 100, top: Y(o.y, wide ? 0.2 : 0.3), height: 130 + (o.title ? 90 : 0) + (o.items?.length ?? 0) * 110, ...enterStyle(inP, { dist: 50 }) }}>
          <FollowBar t={t} top={40} delay={d0 + 2} title={o.title} items={o.items ?? []} />
        </Panel>
      );
      break;
    case "panah":
      body = (
        <Svg>
          <Arrow from={[X(o.from?.[0], 0.3), Y(o.from?.[1], 0.3)]} to={[X(o.to?.[0], 0.5), Y(o.to?.[1], 0.5)]} color={o.color ?? t.accent} width={12} head={40} />
        </Svg>
      );
      break;
    case "jaringan": {
      const n = o.nodes ?? [];
      const top = Y(o.y, wide ? 0.08 : 0.12);
      const pw = wide ? 1300 : W - 80;
      const left = wide ? (W - pw) / 2 : 40;
      body = (
        <Panel t={t} style={{ left, top, width: pw, height: 330, ...enterStyle(inP, { dist: 40 }) }}>
          <NetFlow nodes={n} t={t} top={50} left={50} width={pw - 100} size={Math.min(170, (pw - 100) / Math.max(1, n.length) - 40)} broken={o.broken} delay={d0 + 4} />
        </Panel>
      );
      break;
    }
    case "gauge": {
      const r = o.size ?? 230;
      const cx = X(o.x, 0.5), cy = Y(o.y, wide ? 0.4 : 0.3);
      body = (
        <>
          <Panel t={t} style={{ left: cx - r * 1.25, top: cy - r * 1.2, width: r * 2.5, height: r * 2.1, ...enterStyle(inP, { dist: 40 }) }}>{null}</Panel>
          <Svg>
            <Gauge x={cx} y={cy + r * 0.05} r={r} value={o.value ?? 0} max={o.max ?? 100} unit={o.unit} label={o.label} color={o.color ?? t.accent} text={t.fg} track="rgba(128,128,128,0.25)" delay={d0 + 6} decimals={(o.value ?? 0) % 1 ? 1 : 0} />
          </Svg>
        </>
      );
      break;
    }
    case "nama":
      body = (
        <div style={{ position: "absolute", left: wide ? 96 : 50, top: Y(o.y, wide ? 0.66 : 0.6), ...enterStyle(inP, { from: "left", dist: 60 }) }}>
          <div style={{ display: "inline-block", padding: "14px 28px", background: t.accent, color: t.bg, fontFamily: display, fontWeight: 800, fontSize: 56 }}>{o.text}</div>
          {o.role && <div style={{ display: "table", padding: "10px 28px", background: t.bg, color: t.fg, fontFamily: labelFont, fontWeight: 700, fontSize: 30, letterSpacing: 2 }}>{o.role.toUpperCase()}</div>}
        </div>
      );
      break;
  }
  return <AbsoluteFill style={{ opacity: out, pointerEvents: "none" }}>{body}</AbsoluteFill>;
};

/* ---------- the edit ---------- */
export const EditVideo: React.FC = () => {
  const { width, height } = useVideoConfig();
  const k = useFrameRatio();
  const wide = width > height;
  const t = THEMES[E.theme ?? "night"] ?? THEMES.night;
  const segs = editTimeline();
  const words = editWords();
  const total = editFrames();
  const punches: Punch[] = (E.zoom ?? []).map((z, i) => ({ at: cueFrame(z, `zoom ${i + 1}`, words), scale: z.skala ?? ZOOM_DEFAULT, x: z.x ?? 0.5, y: z.y ?? (wide ? 0.45 : 0.42), hold: Math.round((z.lama ?? 1.5) * FPS) }));
  const spots: Spot[] = (E.sorot ?? []).map((z, i) => ({ at: cueFrame(z, `sorot ${i + 1}`, words), x: z.x ?? 0.5, y: z.y ?? 0.45, w: z.w ?? (wide ? 0.45 : 0.7), h: z.h ?? (wide ? 0.35 : 0.22), hold: Math.round((z.lama ?? 1.5) * FPS) }));
  const shakes: Shake[] = (E.guncang ?? []).map((g, i) => ({ at: cueFrame(g, `guncang ${i + 1}`, words), power: g.kuat ?? 1 }));
  const overlays = (E.overlays ?? []).map((o, i) => ({ o, at: cueFrame(o, `overlay ${i + 1} (${o.type})`, words), len: Math.round((o.lama ?? 2.5) * FPS) }));
  const sounds = [
    ...(E.sfx ?? []).map((q, i) => ({ s: q.s, at: cueFrame(q, `sfx ${i + 1}`, words), v: q.v })),
    ...overlays.filter((x) => x.o.s).map((x) => ({ s: x.o.s!, at: x.at, v: 1 })),
    ...(E.zoom ?? []).filter((z) => z.s).map((z, i) => ({ s: z.s!, at: punches[i].at, v: 1 })),
    ...(E.sorot ?? []).filter((z) => z.s).map((z, i) => ({ s: z.s!, at: spots[i].at, v: 1 })),
    ...(E.guncang ?? []).filter((z) => z.s).map((z, i) => ({ s: z.s!, at: shakes[i].at, v: 1 })),
  ];
  // npm run frames -- --comp=Edit --isyarat: every zoom/sorot/guncang at its fullest.
  if (getInputProps().listCues)
    console.log(
      `CUEFRAMES ${JSON.stringify([
        ...punches.map((p) => ({ scene: "edit", kind: "zoom", frame: Math.round((p.at + ZOOM_IN) * k) })),
        ...spots.map((p) => ({ scene: "edit", kind: "sorot", frame: Math.round((p.at + SPOT_FULL) * k) })),
        ...shakes.map((p) => ({ scene: "edit", kind: "guncang", frame: Math.round((p.at + 1) * k) })),
      ])}`,
    );
  if (!segs.length)
    return (
      <Backdrop theme={t}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: 60, color: t.fg }}>edit.json masih kosong</div>
      </Backdrop>
    );
  return (
    <SfxScope.Provider value="edit">
      <AbsoluteFill style={{ background: "#000" }}>
        <Camera cfg={{ drift: 0 }} duration={total} odd={false} punches={punches} shakes={shakes}>
          {segs.map((s, i) => (
            <Sequence key={i} from={s.at} durationInFrames={s.frames} name={`potongan ${i + 1}`}>
              <SegmentView seg={s} fit={s.fit ?? E.fit ?? (wide ? "fill" : "blur")} t={t} />
            </Sequence>
          ))}
          <Spotlight spots={spots} color={t.accent} id="edit" />
        </Camera>
        {overlays.map(({ o, at, len }, i) => (
          <Sequence key={i} from={at} durationInFrames={len} name={`${o.type} ${i + 1}`}>
            <OverlayView o={o} len={len} t={t} instant={at <= 0} />
          </Sequence>
        ))}
        {sounds.map((q, i) => (
          <Sfx key={i} s={q.s} at={q.at} volume={q.v} />
        ))}
        {E.captions !== false && words.length > 0 && <Captions words={words} emph={E.tekan} />}
      </AbsoluteFill>
    </SfxScope.Provider>
  );
};
