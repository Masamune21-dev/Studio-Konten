// Icons for scenes and edited footage (SKILL.md "Ikon & SVG", since 16 Oct 2026).
//   Ico        any of the 2,100+ Lucide line icons (ISC licence, package "lucide") by name, drawn
//              with the theme colour; `draw` 0..1 draws it stroke by stroke.
//   IconTile   the house style: the icon on a thick 2.5D tile (front face + darker side + highlight),
//              arriving with a soft pop and drawing itself. Use this, not a bare Ico, as a visual.
//   BrandIcon / BrandBadge / FollowBar   social and platform logos from brandIcons.ts (Simple Icons,
//              CC0): only to name a platform or for a follow/share call to action.
//   NetFlow    a chain of icon tiles joined by lines with packets running along them (device →
//              router → internet); `broken` cuts one link.
// Icons support the typography and the illustrations; they never replace a hand-drawn prop or a
// character, and emoji stay banned.
import React from "react";
import { icons as LUCIDE } from "lucide";
import { useCurrentFrame } from "./Time";
import { display, label as labelFont, Theme } from "../design";
import { BRANDS, BrandName } from "./brandIcons";
import { DUR, EASE, SPRING, enterStyle, ramp, useSpringIn } from "./Motion";

/* ---------- Lucide ---------- */
type Node = [string, Record<string, string | number>][];
const LIB = LUCIDE as unknown as Record<string, Node>;
// "wifi-off", "wifiOff" and "WifiOff" all find WifiOff.
const pascal = (n: string) => n.replace(/(^|[-_ ])(\w)/g, (_, __, c: string) => c.toUpperCase()).replace(/^\w/, (c) => c.toUpperCase());
export const iconNode = (name: string): Node => {
  const node = LIB[pascal(name)];
  if (!node) {
    const q = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const near = Object.keys(LIB).filter((k) => k.toLowerCase().includes(q)).slice(0, 8);
    throw new Error(`Ikon "${name}" tidak ada di Lucide${near.length ? ` (mirip: ${near.join(", ")})` : ""}. Daftar: https://lucide.dev/icons`);
  }
  return node;
};

// Network & tech icons checked to exist (lucide 1.48); any other Lucide name works too.
export const NET_ICONS = [
  "wifi", "wifi-off", "wifi-low", "router", "server", "cloud", "cloud-off", "globe", "earth", "signal", "signal-low", "antenna", "radio-tower", "satellite", "satellite-dish",
  "cable", "ethernet-port", "network", "plug", "zap", "gauge", "activity", "download", "upload", "arrow-down-up", "refresh-cw", "timer", "hourglass",
  "smartphone", "laptop", "monitor", "tv", "gamepad-2", "tablet", "printer", "cpu", "hard-drive", "database", "battery-charging", "bluetooth", "usb",
  "shield", "shield-check", "shield-alert", "lock", "lock-open", "key-round", "fingerprint", "scan-face", "eye-off", "bug", "skull",
  "message-circle", "mail", "bell", "phone", "headset", "video", "camera", "link", "share-2", "qr-code", "scan-line",
  "credit-card", "wallet", "receipt", "banknote", "house", "building-2", "map-pin", "user", "users", "settings", "wrench",
  "circle-check", "circle-x", "triangle-alert", "info", "clock", "calendar", "search", "sparkles", "bot", "brain", "code", "terminal",
] as const;

export const Ico: React.FC<{ name: string; size?: number; color?: string; stroke?: number; draw?: number; fill?: string; style?: React.CSSProperties }> = ({
  name,
  size = 96,
  color = "currentColor",
  stroke = 2,
  draw = 1,
  fill = "none",
  style,
}) => {
  const node = iconNode(name);
  const n = node.length;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", overflow: "visible", ...style }}>
      {node.map(([tag, attrs], i) => {
        const { key: _key, ...a } = attrs;
        if (draw >= 1) return React.createElement(tag, { key: i, ...a });
        // Each stroke draws in its own slice of the progress, one after another, slightly overlapping.
        const span = n > 1 ? 0.6 : 1;
        const p = Math.min(1, Math.max(0, (draw - (i / Math.max(1, n - 1)) * (1 - span)) / span));
        return React.createElement(tag, { key: i, ...a, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p, opacity: p > 0.001 ? 1 : 0 });
      })}
    </svg>
  );
};

/* ---------- colour helpers ---------- */
// Darker (k < 0) or lighter (k > 0) version of a #rrggbb colour; anything else is returned as is.
export const shade = (c: string, k: number) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return c;
  const v = parseInt(m[1], 16);
  const ch = (s: number) => {
    const x = (v >> s) & 255;
    return Math.round(k < 0 ? x * (1 + k) : x + (255 - x) * k);
  };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
};

/* ---------- house-style tile ---------- */
export const IconTile: React.FC<{
  name: string;
  size?: number;
  t?: Theme;
  bg?: string; // front face (default t.accent)
  fg?: string; // icon (default t.bg)
  delay?: number;
  label?: string;
  labelColor?: string;
  round?: boolean; // circle instead of rounded square
  dim?: boolean; // greyed out (offline, not chosen)
  style?: React.CSSProperties;
}> = ({ name, size = 180, t, bg, fg, delay = 0, label, labelColor, round, dim, style }) => {
  const f = useCurrentFrame();
  const s = useSpringIn(delay, SPRING.pop);
  const draw = ramp(f, delay + 4, DUR.move, EASE.inOut);
  const face = dim ? "#9AA3B2" : (bg ?? t?.accent ?? "#2B50FF");
  const ink = fg ?? t?.bg ?? "#FFFFFF";
  const depth = Math.round(size * 0.07);
  const r = round ? size / 2 : size * 0.26;
  return (
    <div style={{ position: "absolute", width: size, ...enterStyle(s, { dist: 30, scale: 0.85 }), ...style }}>
      <div style={{ position: "relative", width: size, height: size + depth }}>
        <div style={{ position: "absolute", left: 0, top: depth, width: size, height: size, borderRadius: r, background: shade(face, -0.32), boxShadow: "0 18px 30px rgba(0,0,0,0.22)" }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: size, height: size, borderRadius: r, background: face, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: size * 0.1, top: size * 0.07, width: size * 0.5, height: size * 0.09, borderRadius: size, background: "rgba(255,255,255,0.28)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ico name={name} size={size * 0.56} color={ink} stroke={2.2} draw={draw} />
          </div>
        </div>
      </div>
      {label && (
        <div style={{ marginTop: 14, textAlign: "center", fontFamily: labelFont, fontWeight: 700, fontSize: Math.max(22, size * 0.15), letterSpacing: 2, textTransform: "uppercase", color: labelColor ?? t?.fg ?? "#0E1A3A", whiteSpace: "nowrap", marginLeft: -size, marginRight: -size }}>
          {label}
        </div>
      )}
    </div>
  );
};

/* ---------- brand logos ---------- */
export const BrandIcon: React.FC<{ brand: BrandName; size?: number; color?: string; style?: React.CSSProperties }> = ({ brand, size = 80, color, style }) => {
  const b = BRANDS[brand];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", ...style }} role="img" aria-label={b.title}>
      <path d={b.path} fill={color ?? b.hex} />
    </svg>
  );
};

// Relative luminance 0..1 of a #rrggbb colour.
const lum = (hex: string) => {
  const v = parseInt(hex.slice(1), 16);
  return (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
};

// Logo on the brand colour in a rounded tile: white, or black on light brand colours (Snapchat).
export const BrandBadge: React.FC<{ brand: BrandName; size?: number; delay?: number; style?: React.CSSProperties }> = ({ brand, size = 120, delay = 0, style }) => {
  const s = useSpringIn(delay, SPRING.pop);
  const b = BRANDS[brand];
  const glyph = lum(b.hex) > 0.75 ? "#000000" : "#FFFFFF";
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: b.hex, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 28px rgba(0,0,0,0.25), inset 0 0 0 3px rgba(255,255,255,0.16)", ...enterStyle(s, { dist: 24, scale: 0.85 }), ...style }}>
      <BrandIcon brand={brand} size={size * 0.56} color={glyph} />
    </div>
  );
};

// Follow/share call to action: one row per platform (logo + handle), arriving one after another.
export const FollowBar: React.FC<{
  items: { brand: BrandName; handle: string }[];
  t: Theme;
  top: number;
  delay?: number;
  title?: string; // e.g. "Ikuti kami"
  size?: number;
}> = ({ items, t, top, delay = 0, title, size = 92 }) => {
  const f = useCurrentFrame();
  const head = ramp(f, delay, DUR.enter);
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top }}>
      {title && <div style={{ fontFamily: display, fontWeight: 800, fontSize: 64, color: t.fg, marginBottom: 22, ...enterStyle(head) }}>{title}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {items.map((it, i) => {
          const d = delay + 6 + i * DUR.stagger;
          const p = ramp(f, d, DUR.enter);
          return (
            <div key={it.brand + it.handle} style={{ display: "flex", alignItems: "center", gap: 24, ...enterStyle(p, { from: "left", dist: 50 }) }}>
              <BrandBadge brand={it.brand} size={size} delay={d} />
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: size * 0.52, color: t.fg, letterSpacing: -1 }}>{it.handle}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- network path ---------- */
export type FlowNode = { icon: string; label?: string; bg?: string; dim?: boolean };

// Tiles laid out in a row (or column) across `width`, joined by dashed links that draw in, then
// packets running from left to right. `broken` = index of the link that is cut (red, with a gap and
// no packets past it). Positions are layout constants, so a "sorot" or pointer can aim at node i:
// centre x = left + gap * i + size / 2 (row), see `flowPoint`.
export const flowPoint = (i: number, n: number, opts: { left?: number; width?: number; top?: number; size?: number; dir?: "row" | "col" } = {}) => {
  const { left = 70, width = 940, top = 700, size = 170, dir = "row" } = opts;
  const step = n > 1 ? (width - size) / (n - 1) : 0;
  return dir === "row" ? { x: left + step * i + size / 2, y: top + size / 2 } : { x: left + size / 2, y: top + step * i + size / 2 };
};

export const NetFlow: React.FC<{
  nodes: FlowNode[];
  t: Theme;
  top?: number;
  left?: number;
  width?: number; // row: total width; col: total height
  size?: number;
  dir?: "row" | "col";
  delay?: number;
  broken?: number;
  packetColor?: string;
}> = ({ nodes, t, top = 700, left = 70, width = 940, size = 170, dir = "row", delay = 0, broken, packetColor }) => {
  const f = useCurrentFrame();
  const n = nodes.length;
  const pt = (i: number) => flowPoint(i, n, { left, width, top, size, dir });
  const ok = packetColor ?? t.accent;
  return (
    <>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} width={1} height={1}>
        {nodes.slice(1).map((_, k) => {
          const a = pt(k), b = pt(k + 1);
          const pad = size * 0.62;
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
          const x0 = a.x + ux * pad, y0 = a.y + uy * pad, x1 = b.x - ux * pad, y1 = b.y - uy * pad;
          const linkAt = delay + 8 + k * DUR.stagger * 2;
          const grow = ramp(f, linkAt, DUR.move, EASE.inOut);
          const cut = broken === k;
          const dead = broken !== undefined && k > broken;
          const color = cut ? "#EF4444" : dead ? "#9AA3B2" : t.fg;
          const dots = cut || dead || grow < 1 ? [] : [0, 1, 2].map((j) => ((f - linkAt - DUR.move) / 36 + j / 3) % 1).filter((u) => u >= 0);
          const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
          return (
            <g key={k}>
              {cut ? (
                <>
                  <line x1={x0} y1={y0} x2={x0 + (x1 - x0) * 0.4 * grow} y2={y0 + (y1 - y0) * 0.4 * grow} stroke={color} strokeWidth={8} strokeLinecap="round" />
                  <line x1={x1} y1={y1} x2={x1 - (x1 - x0) * 0.4 * grow} y2={y1 - (y1 - y0) * 0.4 * grow} stroke={color} strokeWidth={8} strokeLinecap="round" />
                  <g opacity={ramp(f, linkAt + DUR.move, DUR.quick)} stroke="#EF4444" strokeWidth={9} strokeLinecap="round">
                    <line x1={mx - 18} y1={my - 18} x2={mx + 18} y2={my + 18} />
                    <line x1={mx + 18} y1={my - 18} x2={mx - 18} y2={my + 18} />
                  </g>
                </>
              ) : (
                <line x1={x0} y1={y0} x2={x0 + (x1 - x0) * grow} y2={y0 + (y1 - y0) * grow} stroke={color} strokeWidth={8} strokeLinecap="round" strokeDasharray="2 18" />
              )}
              {dots.map((u, j) => (
                <circle key={j} cx={x0 + (x1 - x0) * u} cy={y0 + (y1 - y0) * u} r={11} fill={ok} opacity={Math.min(1, Math.min(u, 1 - u) * 8)} />
              ))}
            </g>
          );
        })}
      </svg>
      {nodes.map((nd, i) => {
        const p = pt(i);
        return (
          <IconTile
            key={i}
            name={nd.icon}
            size={size}
            t={t}
            bg={nd.bg}
            dim={nd.dim ?? (broken !== undefined && i > broken)}
            delay={delay + i * DUR.stagger * 2}
            label={nd.label}
            style={{ left: p.x - size / 2, top: p.y - size / 2 }}
          />
        );
      })}
    </>
  );
};
