// Cover system (since 19 Oct 2026). The user looked at the TikTok profile grid and said
// "desain kita kok jelek ya, kaya ngga konsisten": every video had its own palette, type set,
// opener layout and host position, so the grid read as many different channels.
//
// Frame 0 of the first scene is the cover. The profile grid shows it cropped to 3:4 (y 240–1680 of
// 1920) with the view count over the bottom-left corner, so the skeleton is fixed and only the
// middle changes:
//   1 series tag     top left, the brand wordmark + "· HITUNGAN" in the mode colour (SeriesTag)
//   2 title          ≤ 5 words in display 800, one accent word, question tail in serif italic,
//                    a giant number goes here too (CoverTitle + Acc / Big / Tail)
//   3 visual zone    the part that differs per video: phone, voucher, router, OTP card, 3D object,
//                    comment card (CoverViz, CoverComment)
//   4 host           bottom right, always the same height, face inside the 3:4 crop (CoverHost)
//   5 views corner   bottom left, keep empty (TikTok prints "▷ 1.234" there)
// The mode (colours + tag) comes from script.json "look"; CoverFrame mode="…" overrides it for a
// gallery. npm run qa checks tag, background and the empty corners on frame 0 ("Sampul konsisten").
// Gallery: npx remotion still AsetSampul out/aset-sampul.png
import React, { createContext, useContext } from "react";
import { Img, staticFile } from "remotion";
import { useCurrentFrame, useVideoConfig } from "./Time";
import { CoverMode, MODE, THEMES, Theme, coverMode, display, label, serif } from "../design";
import { Backdrop } from "./Kinetic";
import { Anime, PoseAt } from "./Anime";
import { IconTile } from "./Icons";
import { Scene, P } from "./Type";
import { float } from "./Motion";
import { BASE, GLYPHS, Pt } from "./logoGlyphs";
import { BRAND } from "../brand";

/* ---------- layout ---------- */
// Portrait numbers are frame pixels of 1080×1920; scripts/qa.mjs samples the same spots.
export const COVER_LAYOUT = {
  portrait: {
    w: 1080,
    h: 1920,
    safe: { top: 240, bottom: 1680 }, // what the 3:4 profile grid keeps
    tag: { left: 72, top: 288, size: 36 },
    title: { left: 72, right: 72, top: 384, size: 162, min: 128, max: 190 },
    big: 440,
    viz: { left: 72, top: 1000, width: 540, bottom: 1500 },
    host: { height: 840, right: -12 },
    views: { left: 0, top: 1530, width: 400, height: 150 }, // TikTok's "▷ views" label
  },
  // YouTube 16:9 (VideoWide): same pieces, title column on the left, host on the right.
  wide: {
    w: 1920,
    h: 1080,
    safe: { top: 0, bottom: 1080 },
    tag: { left: 96, top: 84, size: 30 },
    title: { left: 96, right: 860, top: 168, size: 150, min: 120, max: 176 },
    big: 380,
    viz: { left: 96, top: 700, width: 900, bottom: 1020 },
    host: { height: 900, right: 40 },
    views: { left: 0, top: 1080, width: 0, height: 0 },
  },
};
export type CoverLayout = (typeof COVER_LAYOUT)["portrait"];
// VideoWide draws a TikTok scene without a landscape layout inside a 1080×1920 box; it says so here,
// because useVideoConfig there reports 1920×1080.
export const CoverOrientation = createContext<"portrait" | "wide" | null>(null);
export const useCoverLayout = (): CoverLayout => {
  const { width, height } = useVideoConfig();
  const forced = useContext(CoverOrientation);
  return (forced ?? (width > height ? "wide" : "portrait")) === "wide" ? COVER_LAYOUT.wide : COVER_LAYOUT.portrait;
};

/* ---------- mode ---------- */
const ModeCtx = createContext<CoverMode | null>(null);
export const useCoverMode = () => useContext(ModeCtx) ?? MODE;
// The cover's theme: the mode's background and text with the mode accent. Pass it to kit components
// (IconTile t=…, Gauge, Pill) inside the cover so they pick up the right colours.
export const coverTheme = (m: CoverMode): Theme => ({ ...(THEMES[m.theme] ?? THEMES.night), accent: m.accent });
export const useCoverTheme = () => coverTheme(useCoverMode());
// For the project's own mode (script.json look), outside components.
export const COVER_T: Theme = coverTheme(MODE);
type Tone = "fg" | "acc" | "acc2";
const toneOf = (m: CoverMode, k: Tone) => ({ fg: m.fg, acc: m.accent, acc2: m.accent2 })[k];

/* ---------- 1: series tag ---------- */
const path = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("") + "Z";
const LOGO_TOP = 36; // top of the outer WiFi arc, in pixels of the 600×206 logo image
// The brand wordmark in one colour: the logo outlines from components/logoGlyphs.ts when the brand
// ships them (brand/template/src/components/logoGlyphs.ts), otherwise the brand name as text.
export const LogoMark: React.FC<{ height: number; color: string; style?: React.CSSProperties }> = ({ height, color, style }) => {
  if (!GLYPHS.length)
    return <span style={{ display: "block", flexShrink: 0, fontFamily: display, fontWeight: 800, fontSize: height * 0.82, lineHeight: 1, letterSpacing: -height * 0.02, color, ...style }}>{BRAND.name}</span>;
  const vh = BASE - LOGO_TOP;
  return (
    <svg width={(height * 600) / vh} height={height} viewBox={`0 ${LOGO_TOP} 600 ${vh}`} style={{ display: "block", flexShrink: 0, ...style }}>
      {GLYPHS.map((g) => (
        <path key={g.id} d={path(g.outer) + g.holes.map(path).join("")} fill={color} fillRule="evenodd" />
      ))}
    </svg>
  );
};

export const SeriesTag: React.FC<{ tag?: string }> = ({ tag }) => {
  const L = useCoverLayout();
  const m = useCoverMode();
  const s = L.tag.size;
  return (
    <div
      style={{
        position: "absolute",
        left: L.tag.left,
        top: L.tag.top,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: s * 0.45,
        padding: `${s * 0.42}px ${s * 0.8}px ${s * 0.42}px ${s * 0.7}px`,
        borderRadius: 999,
        background: m.tagBg,
        color: m.tagFg,
        fontFamily: label,
        fontWeight: 700,
        fontSize: s,
        letterSpacing: s * 0.12,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <LogoMark height={s * 1.2} color={m.tagFg} style={{ marginTop: -s * 0.18 }} />
      <span style={{ opacity: 0.72 }}>· {tag ?? m.tag}</span>
    </div>
  );
};

/* ---------- frame ---------- */
// Background in the mode colour + the one shared signature (a soft accent glow, top right) + tag.
export const CoverFrame: React.FC<{ tag?: string; mode?: string; children?: React.ReactNode }> = ({ tag, mode, children }) => {
  const f = useCurrentFrame();
  const L = useCoverLayout();
  const inherited = useCoverMode();
  const m = mode ? coverMode(mode) : inherited;
  const r = L.w * 0.95;
  return (
    <ModeCtx.Provider value={m}>
      <Backdrop theme={coverTheme(m)}>
        <div
          style={{
            position: "absolute",
            width: r,
            height: r,
            right: -r * 0.45,
            top: -r * 0.2 + float(f, 10, 160),
            borderRadius: "50%",
            background: `radial-gradient(circle, ${m.accent}38 0%, ${m.accent}00 68%)`,
          }}
        />
        {children}
        <SeriesTag tag={tag} />
      </Backdrop>
    </ModeCtx.Provider>
  );
};

/* ---------- 2: title ---------- */
// Size stays within min–max so titles look alike across videos; ≤ 5 words, 2–3 lines.
// `flow`: no absolute position, for a column that stacks title + visual (CoverStack).
export const CoverTitle: React.FC<{ children: React.ReactNode; size?: number; top?: number; flow?: boolean; style?: React.CSSProperties }> = ({ children, size, top, flow, style }) => {
  const L = useCoverLayout();
  const m = useCoverMode();
  const fs = Math.max(L.title.min, Math.min(L.title.max, size ?? L.title.size));
  return (
    <div
      style={{
        ...(flow ? { position: "relative" as const } : { position: "absolute" as const, left: L.title.left, right: L.title.right, top: top ?? L.title.top }),
        zIndex: 10,
        fontFamily: display,
        fontWeight: 800,
        fontSize: fs,
        lineHeight: 0.9,
        letterSpacing: -fs * 0.035,
        color: m.fg,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
// The one accent word (two = the second accent, for a number or a contrast word).
export const Acc: React.FC<{ two?: boolean; children: React.ReactNode }> = ({ two, children }) => {
  const m = useCoverMode();
  return <span style={{ color: two ? m.accent2 : m.accent }}>{children}</span>;
};
// Question tail in serif italic, on its own line.
export const Tail: React.FC<{ tone?: Tone; scale?: number; children: React.ReactNode }> = ({ tone = "fg", scale = 0.86, children }) => {
  const m = useCoverMode();
  return <div style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 400, fontSize: `${scale}em`, letterSpacing: "-0.01em", lineHeight: 1, marginTop: "0.1em", color: toneOf(m, tone) }}>{children}</div>;
};
// Giant number with its unit (Mbps, GB, %) in small caps beside it.
export const Big: React.FC<{ unit?: string; tone?: Tone; size?: number; children: React.ReactNode }> = ({ unit, tone = "acc", size, children }) => {
  const L = useCoverLayout();
  const m = useCoverMode();
  const fs = size ?? L.big;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: fs * 0.04, margin: `${-fs * 0.04}px 0 ${-fs * 0.06}px` }}>
      <span style={{ fontSize: fs, letterSpacing: -fs * 0.05, lineHeight: 0.86, color: toneOf(m, tone) }}>{children}</span>
      {unit && <span style={{ fontFamily: label, fontWeight: 700, fontSize: L.tag.size * 1.5, letterSpacing: L.tag.size * 0.15, opacity: 0.8, textTransform: "uppercase" }}>{unit}</span>}
    </div>
  );
};

/* ---------- 3: visual zone ---------- */
// Below the title, left of the host, above the views corner. `top` follows the title's height.
export const CoverViz: React.FC<{ top?: number; width?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ top, width, style, children }) => {
  const L = useCoverLayout();
  return <div style={{ position: "absolute", left: L.viz.left, top: top ?? L.viz.top, width: width ?? L.viz.width, zIndex: 8, ...style }}>{children}</div>;
};

// Title and what goes under it in one column from the title's spot, so a title that wraps to an
// extra line pushes the visual down instead of running into it. Children: <CoverTitle flow>, then
// <CoverComment flow> or any block (keep it left of the host: width ≤ viz.width).
export const CoverStack: React.FC<{ gap?: number; children: React.ReactNode }> = ({ gap = 56, children }) => {
  const L = useCoverLayout();
  return <div style={{ position: "absolute", left: L.title.left, right: L.title.right, top: L.title.top, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap }}>{children}</div>;
};

// Viewer comment for reply videos (tag "BALAS KOMEN"): name + text exactly as written, full width
// under the title. Long text shrinks instead of being cut.
export const CoverComment: React.FC<{ name: string; text: string; source?: string; top?: number; avatar?: string; flow?: boolean }> = ({ name, text, source, top, avatar, flow }) => {
  const L = useCoverLayout();
  const m = useCoverMode();
  const fs = text.length <= 70 ? 46 : text.length <= 120 ? 40 : text.length <= 170 ? 35 : 31;
  const onDark = m.fg === "#FFFFFF";
  return (
    <div
      style={{
        ...(flow ? { position: "relative" as const, alignSelf: "stretch" as const } : { position: "absolute" as const, left: L.title.left, right: L.title.left, top: top ?? 760 }),
        zIndex: 12,
        padding: "24px 30px 28px",
        borderRadius: 30,
        background: "#FFFFFF",
        boxShadow: onDark ? "0 20px 44px rgba(0,0,0,0.42)" : "0 16px 34px rgba(14,26,58,0.16)",
        transform: "rotate(-1.2deg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 58, height: 58, borderRadius: 29, background: avatar ?? m.accent, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: 30, flexShrink: 0 }}>
          {name.replace(/^@/, "").slice(0, 1).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 30, color: "#0E1A3A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
          {source && <div style={{ fontFamily: label, fontSize: 21, color: "#5B6478" }}>{source}</div>}
        </div>
      </div>
      <div style={{ fontFamily: display, fontWeight: 700, fontSize: fs, lineHeight: 1.16, color: "#0E1A3A", marginTop: 14 }}>{text}</div>
    </div>
  );
};

/* ---------- 4: host ---------- */
// Always bottom right at the same height; the pose and the person change, the spot does not.
// Present from frame 0 (delay -30). Pick a pose that faces or points left, or flip it.
export const CoverHost: React.FC<{ scene: Scene; duration: number; poses: PoseAt[]; seed?: number; flip?: boolean }> = ({ scene, duration, poses, seed, flip }) => {
  const L = useCoverLayout();
  const h = L.host.height;
  return <Anime scene={scene} duration={duration} poses={poses} height={h} style={{ right: L.host.right, top: L.h - h + 30, zIndex: 20 }} from="right" delay={-30} seed={seed} flip={flip} />;
};
// The same spot without the talking machinery, for galleries and stills without a voice.
export const CoverHostStill: React.FC<{ src: string; flip?: boolean }> = ({ src, flip }) => {
  const L = useCoverLayout();
  const h = L.host.height;
  return (
    <Img
      src={staticFile(`img/${src}.png`)}
      style={{ position: "absolute", right: L.host.right, top: L.h - h + 30, height: h, zIndex: 20, transform: flip ? "scaleX(-1)" : undefined, filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.22))" }}
    />
  );
};

/* ---------- ready-made cover scene ---------- */
// "kind": "cover" in script.json works with every scene library (Video.tsx falls back to it):
//   "judul": ["Link speed"]          lines of the title; *kata* = accent, ~kata~ = second accent
//   "angka": { "nilai": "433", "satuan": "Mbps" }    giant number under the title lines
//   "ekor": "bagus nggak?"           question tail in serif italic
//   "komentar": { "nama": "@user", "teks": "…", "sumber": "komentar di video …" }
//   "chips": [{ "ikon": "wifi", "teks": "433 Mbps" }]   up to 3 rows in the visual zone
//   "host": [{ "at": 0, "src": "raka-mikir", "mouths": true }]
//   "tag": "BALAS KOMEN"             overrides look.tag for this scene
// For a custom visual (phones, router, 3D) write your own scene from CoverFrame + CoverTitle +
// CoverViz + CoverHost instead.
const marks = (line: string, keyBase: number) =>
  line.split(/(\*[^*]+\*|~[^~]+~)/).map((part, i) =>
    part.startsWith("*") ? (
      <Acc key={keyBase + i}>{part.slice(1, -1)}</Acc>
    ) : part.startsWith("~") ? (
      <Acc key={keyBase + i} two>
        {part.slice(1, -1)}
      </Acc>
    ) : (
      <span key={keyBase + i}>{part}</span>
    ),
  );

export type CoverFields = {
  judul?: string[];
  angka?: { nilai: string; satuan?: string };
  ekor?: string;
  komentar?: { nama: string; teks: string; sumber?: string };
  chips?: { ikon: string; teks: string }[];
  host?: PoseAt[];
  tag?: string;
};

// Title block + what sits under it, shared by CoverScene and the gallery.
export const CoverBody: React.FC<{ s: CoverFields & { onscreen?: string[] } }> = ({ s }) => {
  const m = useCoverMode();
  const L = useCoverLayout();
  const lines = s.judul ?? s.onscreen ?? [];
  const rows = (s.chips ?? []).slice(0, 3);
  return (
    <CoverStack>
      <CoverTitle flow>
        {lines.map((l, i) => (
          <div key={i}>{marks(l, i * 10)}</div>
        ))}
        {s.angka && <Big unit={s.angka.satuan}>{s.angka.nilai}</Big>}
        {s.ekor && <Tail tone={s.angka ? "acc2" : "acc"}>{s.ekor}</Tail>}
      </CoverTitle>
      {s.komentar && <CoverComment flow name={s.komentar.nama} text={s.komentar.teks} source={s.komentar.sumber} />}
      {!s.komentar && rows.length > 0 && (
        <div style={{ width: L.viz.width }}>
          {rows.map((r, i) => (
            <div key={i} style={{ position: "relative", height: 132, display: "flex", alignItems: "center", gap: 22, marginBottom: 18 }}>
              <div style={{ position: "relative", width: 112, height: 120, flexShrink: 0 }}>
                <IconTile name={r.ikon} size={112} t={coverTheme(m)} bg={i % 2 ? m.accent2 : m.accent} fg={i % 2 ? "#0E1A3A" : m.tagFg} delay={-30} />
              </div>
              <div style={{ fontFamily: display, fontWeight: 700, fontSize: 52, lineHeight: 1, color: m.fg }}>{r.teks}</div>
            </div>
          ))}
        </div>
      )}
    </CoverStack>
  );
};

export const CoverScene: React.FC<P> = ({ scene, duration }) => {
  const s = scene as Scene & CoverFields;
  return (
    <CoverFrame tag={s.tag}>
      <CoverBody s={s} />
      {s.host && <CoverHost scene={scene} duration={duration} poses={s.host} seed={1} />}
    </CoverFrame>
  );
};

// Scene kinds every library gets (Video.tsx / VideoWide.tsx fall back to these).
export const CORE_SCENES: Record<string, React.FC<P>> = { cover: CoverScene };
