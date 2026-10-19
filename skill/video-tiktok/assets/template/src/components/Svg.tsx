// SVG motion toolkit (SKILL.md "Ikon & SVG", since 16 Oct 2026). Everything is drawn from the frame,
// in px of the composition, with the Motion.ts presets, so it stays smooth at 60 fps:
//   DrawPath   any path drawing itself (+ optional arrow head riding the tip)
//   Arrow      curved arrow from A to B, drawn in; for pointing at things without a cursor
//   FlowLine   path with packets running along it (data, signal, money); `broken` stops them
//   Gauge      speedometer: needle sweeps to `value`, number counts up (speed tests, ping, usage)
//   Donut      shares of a whole, segments grow one after another
//   Bars       horizontal bars that grow, value at the end (comparisons, "angka vs angka")
//   SignalBars / WifiWaves   0–4 bars or arcs, lit up to `level`, optional pulse
//   Ripple     rings spreading from a point (ping, notification, tap)
//   Morph      one shape turning into another (both paths need the same structure; see note)
// Wrap in <Svg> (a full-frame overlay) or your own <svg>. Text inside SVG uses the theme fonts.
import React from "react";
import { interpolate } from "remotion";
import { evolvePath, getLength, getPointAtLength, getTangentAtLength, interpolatePath } from "@remotion/paths";
import { useCurrentFrame, useVideoConfig } from "./Time";
import { display, label as labelFont } from "../design";
import { DUR, EASE, ramp } from "./Motion";

type Pt = [number, number];

// Full-frame SVG overlay in composition px (1080×1920 or 1920×1080).
export const Svg: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  const { width, height } = useVideoConfig();
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", ...style }}>
      {children}
    </svg>
  );
};

const ArrowHead: React.FC<{ d: string; at: number; color: string; size: number; opacity?: number }> = ({ d, at, color, size, opacity = 1 }) => {
  const len = getLength(d);
  const l = Math.max(0.01, Math.min(len, at * len));
  const p = getPointAtLength(d, l) ?? { x: 0, y: 0 };
  const tg = getTangentAtLength(d, l) ?? { x: 1, y: 0 };
  const a = (Math.atan2(tg.y, tg.x) * 180) / Math.PI;
  return <path d={`M ${-size} ${-size * 0.62} L 0 0 L ${-size} ${size * 0.62}`} fill="none" stroke={color} strokeWidth={size * 0.32} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${p.x} ${p.y}) rotate(${a})`} opacity={opacity} />;
};

export const DrawPath: React.FC<{ d: string; progress: number; color: string; width?: number; dash?: boolean; head?: number; opacity?: number }> = ({ d, progress, color, width = 10, dash, head, opacity = 1 }) => {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0) return null;
  const ev = evolvePath(p, d);
  return (
    <g opacity={opacity}>
      {dash ? (
        // Dashed and drawn in: clip a dashed copy with the evolving solid one as a mask.
        <>
          <defs>
            <mask id={`dp-${d.length}-${Math.round(getLength(d))}`}>
              <path d={d} fill="none" stroke="#fff" strokeWidth={width + 4} strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
            </mask>
          </defs>
          <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${width * 0.2} ${width * 2.2}`} mask={`url(#dp-${d.length}-${Math.round(getLength(d))})`} />
        </>
      ) : (
        <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
      )}
      {head ? <ArrowHead d={d} at={p} color={color} size={head} /> : null}
    </g>
  );
};

// Quadratic curve from `from` to `to`, bulging sideways by `bend` × distance (negative = other side).
export const arrowPath = (from: Pt, to: Pt, bend = 0.25) => {
  const [x0, y0] = from, [x1, y1] = to;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const dx = x1 - x0, dy = y1 - y0;
  return `M ${x0} ${y0} Q ${mx - dy * bend} ${my + dx * bend} ${x1} ${y1}`;
};

export const Arrow: React.FC<{ from: Pt; to: Pt; delay?: number; dur?: number; bend?: number; color: string; width?: number; head?: number; dash?: boolean }> = ({
  from,
  to,
  delay = 0,
  dur = DUR.move,
  bend = 0.25,
  color,
  width = 10,
  head = 34,
  dash,
}) => {
  const f = useCurrentFrame();
  return <DrawPath d={arrowPath(from, to, bend)} progress={ramp(f, delay, dur, EASE.inOut)} color={color} width={width} head={head} dash={dash} />;
};

// Packets: `count` dots spaced evenly, one lap every `period` frames, fading at both ends.
export const FlowLine: React.FC<{ d: string; color: string; packet?: string; delay?: number; width?: number; count?: number; period?: number; r?: number; broken?: boolean; reverse?: boolean }> = ({
  d,
  color,
  packet,
  delay = 0,
  width = 8,
  count = 3,
  period = 45,
  r = 11,
  broken,
  reverse,
}) => {
  const f = useCurrentFrame();
  const grow = ramp(f, delay, DUR.move, EASE.inOut);
  const len = getLength(d);
  const run = f - delay - DUR.move;
  return (
    <g>
      <DrawPath d={d} progress={grow} color={broken ? "#EF4444" : color} width={width} dash={!broken} />
      {!broken && run > 0
        ? Array.from({ length: count }, (_, j) => {
            const u = ((run / period + j / count) % 1 + 1) % 1;
            const pt = getPointAtLength(d, (reverse ? 1 - u : u) * len);
            if (!pt) return null;
            return <circle key={j} cx={pt.x} cy={pt.y} r={r} fill={packet ?? color} opacity={Math.min(1, Math.min(u, 1 - u) * 8)} />;
          })
        : null}
    </g>
  );
};

/* ---------- gauge ---------- */
const polar = (cx: number, cy: number, r: number, deg: number): Pt => [cx + r * Math.cos(((deg - 90) * Math.PI) / 180), cy + r * Math.sin(((deg - 90) * Math.PI) / 180)];
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};

// Speedometer centred at (x, y). The needle eases to `value` from `delay` over `dur` frames; the
// number counts with it. `ticks` are labelled marks (default 0, max/4 … max).
export const Gauge: React.FC<{
  x: number;
  y: number;
  r?: number;
  value: number;
  max: number;
  unit?: string;
  label?: string;
  delay?: number;
  dur?: number;
  color: string; // filled arc + needle
  track?: string;
  text: string; // number/labels colour
  ticks?: number[];
  decimals?: number;
}> = ({ x, y, r = 300, value, max, unit = "Mbps", label, delay = 0, dur = 40, color, track = "rgba(0,0,0,0.12)", text, ticks, decimals = 0 }) => {
  const f = useCurrentFrame();
  const START = -120, SWEEP = 240;
  const p = ramp(f, delay, dur, EASE.out);
  const v = value * p;
  const ang = START + (Math.min(v, max) / max) * SWEEP;
  const marks = ticks ?? [0, 0.25, 0.5, 0.75, 1].map((k) => Math.round(max * k));
  const w = r * 0.13;
  const [nx, ny] = polar(x, y, r * 0.78, ang);
  return (
    <g>
      <path d={arc(x, y, r, START, START + SWEEP)} fill="none" stroke={track} strokeWidth={w} strokeLinecap="round" />
      {v > 0 && <path d={arc(x, y, r, START, Math.max(START + 0.5, ang))} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />}
      {marks.map((m) => {
        const a = START + (m / max) * SWEEP;
        const [tx, ty] = polar(x, y, r - w * 1.6, a);
        return (
          <text key={m} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontFamily={labelFont} fontWeight={700} fontSize={r * 0.1} fill={text} opacity={0.7}>
            {m}
          </text>
        );
      })}
      <line x1={x} y1={y} x2={nx} y2={ny} stroke={color} strokeWidth={r * 0.045} strokeLinecap="round" />
      <circle cx={x} cy={y} r={r * 0.07} fill={color} />
      <text x={x} y={y + r * 0.42} textAnchor="middle" fontFamily={display} fontWeight={800} fontSize={r * 0.36} fill={text}>
        {v.toFixed(decimals).replace(".", ",")}
      </text>
      <text x={x} y={y + r * 0.62} textAnchor="middle" fontFamily={labelFont} fontWeight={700} fontSize={r * 0.12} fill={text} opacity={0.8}>
        {unit}
      </text>
      {label && (
        <text x={x} y={y - r * 0.3} textAnchor="middle" fontFamily={labelFont} fontWeight={700} fontSize={r * 0.1} letterSpacing={3} fill={text} opacity={0.75}>
          {label.toUpperCase()}
        </text>
      )}
    </g>
  );
};

/* ---------- donut ---------- */
export const Donut: React.FC<{ x: number; y: number; r?: number; thick?: number; parts: { value: number; color: string }[]; delay?: number; track?: string }> = ({
  x,
  y,
  r = 220,
  thick = 70,
  parts,
  delay = 0,
  track = "rgba(0,0,0,0.08)",
}) => {
  const f = useCurrentFrame();
  const total = parts.reduce((s, q) => s + q.value, 0) || 1;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <g transform={`rotate(-90 ${x} ${y})`}>
      <circle cx={x} cy={y} r={r} fill="none" stroke={track} strokeWidth={thick} />
      {parts.map((q, i) => {
        const share = q.value / total;
        const grow = ramp(f, delay + i * DUR.stagger * 2, DUR.move, EASE.inOut);
        const el = <circle key={i} cx={x} cy={y} r={r} fill="none" stroke={q.color} strokeWidth={thick} strokeDasharray={`${Math.max(0, share * grow * C - 4)} ${C}`} strokeDashoffset={-acc * C} />;
        acc += share;
        return el;
      })}
    </g>
  );
};

/* ---------- bars ---------- */
// Horizontal bars from (x, y), one per item, growing in order; the value is written at the tip.
export const Bars: React.FC<{ x: number; y: number; width: number; items: { label: string; value: number; color: string; text?: string }[]; max?: number; gap?: number; thick?: number; delay?: number; text: string; track?: string }> = ({
  x,
  y,
  width,
  items,
  max,
  gap = 46,
  thick = 54,
  delay = 0,
  text,
  track = "rgba(0,0,0,0.08)",
}) => {
  const f = useCurrentFrame();
  const top = max ?? Math.max(...items.map((i) => i.value));
  return (
    <g>
      {items.map((it, i) => {
        const yy = y + i * (thick + gap + 34);
        const g = ramp(f, delay + i * DUR.stagger * 2, DUR.move, EASE.out);
        const w = (it.value / top) * width * g;
        return (
          <g key={i} opacity={Math.min(1, g * 3)}>
            <text x={x} y={yy} fontFamily={labelFont} fontWeight={700} fontSize={30} fill={text} opacity={0.8}>
              {it.label}
            </text>
            <rect x={x} y={yy + 14} width={width} height={thick} rx={thick / 2} fill={track} />
            <rect x={x} y={yy + 14} width={Math.max(thick, w)} height={thick} rx={thick / 2} fill={it.color} />
            <text x={x + Math.max(thick, w) + 18} y={yy + 14 + thick * 0.72} fontFamily={display} fontWeight={800} fontSize={thick * 0.8} fill={text}>
              {it.text ?? interpolate(g, [0, 1], [0, it.value]).toFixed(0)}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/* ---------- signal ---------- */
export const SignalBars: React.FC<{ x: number; y: number; h?: number; level: number; color: string; off?: string }> = ({ x, y, h = 120, level, color, off = "rgba(0,0,0,0.15)" }) => {
  const w = h * 0.2;
  return (
    <g>
      {[0, 1, 2, 3].map((i) => {
        const bh = h * (0.32 + i * 0.226);
        return <rect key={i} x={x + i * w * 1.45} y={y + h - bh} width={w} height={bh} rx={w * 0.3} fill={i < level ? color : off} />;
      })}
    </g>
  );
};

// WiFi arcs above (x, y); `pulse` makes the lit arcs breathe outward one after another.
export const WifiWaves: React.FC<{ x: number; y: number; r?: number; level: number; color: string; off?: string; pulse?: boolean }> = ({ x, y, r = 150, level, color, off = "rgba(0,0,0,0.15)", pulse }) => {
  const f = useCurrentFrame();
  const w = r * 0.14;
  return (
    <g>
      <circle cx={x} cy={y} r={w * 0.85} fill={level > 0 ? color : off} />
      {[1, 2, 3].map((i) => {
        const rr = (r / 3) * i;
        const lit = i < level;
        const glow = pulse && lit ? 0.55 + 0.45 * Math.max(0, Math.sin((f / 30) * Math.PI * 2 - i * 0.9)) : 1;
        return <path key={i} d={arc(x, y, rr, -45, 45)} fill="none" stroke={lit ? color : off} strokeWidth={w} strokeLinecap="round" opacity={lit ? glow : 1} />;
      })}
    </g>
  );
};

export const Ripple: React.FC<{ x: number; y: number; color: string; r?: number; period?: number; rings?: number; from?: number }> = ({ x, y, color, r = 160, period = 45, rings = 3, from = 0 }) => {
  const f = useCurrentFrame() - from;
  if (f < 0) return null;
  return (
    <g>
      {Array.from({ length: rings }, (_, i) => {
        const u = ((f / period + i / rings) % 1 + 1) % 1;
        return <circle key={i} cx={x} cy={y} r={r * EASE.out(u)} fill="none" stroke={color} strokeWidth={8 * (1 - u) + 1} opacity={(1 - u) * 0.8} />;
      })}
    </g>
  );
};

// Shape change. interpolatePath needs paths with matching commands; for two icons, draw both from
// the same number of points (e.g. two polylines of 3 points: ✕ legs → ✓) or cross-fade instead.
export const Morph: React.FC<{ from: string; to: string; progress: number; fill?: string; stroke?: string; width?: number }> = ({ from, to, progress, fill = "none", stroke, width = 10 }) => (
  <path d={interpolatePath(Math.max(0, Math.min(1, progress)), from, to)} fill={fill} stroke={stroke} strokeWidth={stroke ? width : undefined} strokeLinecap="round" strokeLinejoin="round" />
);
