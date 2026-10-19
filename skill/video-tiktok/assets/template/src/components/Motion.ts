// Motion presets shared by every scene, so the whole video moves with one feel: things arrive fast
// and settle slowly, nothing bounces more than a few percent, and big moves get enough frames to
// read as motion at 60 fps instead of a jump (SKILL.md 6e "Gerak halus"). All frame counts are
// logical 30 fps frames (components/Time.tsx).
import { Easing, interpolate, spring } from "remotion";
import { useCurrentFrame, useVideoConfig } from "./Time";

export const EASE = {
  // Entrances: quick start, long soft landing (≈ easeOutQuint).
  out: Easing.bezier(0.22, 1, 0.36, 1),
  // Moves from A to B and transitions: gentle start and stop, no sudden peak speed.
  inOut: Easing.bezier(0.45, 0, 0.25, 1),
  // Exits: speeds up as it leaves.
  in: Easing.bezier(0.5, 0, 0.75, 0),
  // Slow continuous drifts (camera, Ken Burns, floats).
  sine: Easing.inOut(Easing.sin),
};

// Durations in logical frames (30 per second).
export const DUR = {
  quick: 8, // small state change: colour, tick, highlight on
  enter: 15, // text line, card, chip arriving
  move: 18, // element travelling across the screen, layout change
  big: 24, // full-screen move, character walking in
  stagger: 5, // between items of a list
};

// Spring configs (pass to spring({ config })): at most a small settle.
export const SPRING = {
  smooth: { damping: 200 }, // no overshoot at all
  soft: { damping: 20, stiffness: 140 }, // <1% overshoot: text, panels, characters
  pop: { damping: 16, stiffness: 170 }, // ≈9% overshoot: chips, badges, stamps
};

// 0..1 over `dur` frames from `delay`, eased; clamped on both sides. Deterministic, no overshoot.
export const ramp = (f: number, delay: number, dur: number = DUR.enter, easing = EASE.out) =>
  interpolate(f, [delay, delay + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

export const useRamp = (delay = 0, dur: number = DUR.enter, easing = EASE.out) => ramp(useCurrentFrame(), delay, dur, easing);

export const useSpringIn = (delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = SPRING.soft) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config });
};

// Standard entrance style from a 0..1 progress: fade + short rise (or slide from a side), with an
// optional small scale (≥ 0.9, never from 0: a scale pop from nothing reads as a zoom).
export const enterStyle = (p: number, opts: { from?: "up" | "down" | "left" | "right"; dist?: number; scale?: number } = {}): React.CSSProperties => {
  const { from = "up", dist = 40, scale = 1 } = opts;
  const o = (1 - p) * dist;
  const t = from === "up" ? `translateY(${o}px)` : from === "down" ? `translateY(${-o}px)` : from === "left" ? `translateX(${-o}px)` : `translateX(${o}px)`;
  const s = scale === 1 ? "" : ` scale(${scale + (1 - scale) * p})`;
  return { opacity: Math.min(1, p * 1.6), transform: t + s };
};

// Slow sine float for idle elements (px). Use instead of a zoom to keep a still screen alive.
export const float = (f: number, amp = 6, period = 90, phase = 0) => Math.sin(((f + phase) / period) * Math.PI * 2) * amp;
