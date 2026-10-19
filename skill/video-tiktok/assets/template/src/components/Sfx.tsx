// Sound effects, synthesised by ../scripts/sfx.mjs into public/sfx/<name>-<i>.wav (lengths in ../sfx.json;
// remotion.config.ts regenerates them when missing). Every sound has several variants and the pick is
// seeded by scene + frame, so the same action twice in a video does not sound copy-pasted.
//   <Sfx s="pop" at={f} />              one sound at frame f of the scene; end={f} = finish at f (riser)
//   const t = useTyping(text, a, b)      text typed between frames a..b: {t.text} … {t.sfx} (one key per letter)
//   <SfxTrain count={fn} from to s />    a sound each time fn(frame) goes up (counters, list items)
//   <Pointer keys={[{ at, x, y, click }]} />   mouse pointer (touch = finger) whose clicks press, ripple and sound
// script.json "sfx": false mutes them all, { "volume": 0.7 } scales them, { "wipe": false } drops the
// scene-change whoosh; per-scene cues ("sfx": [{ "s": "ding", "kata": "gratis" }]) are played by Video.tsx.
import { createContext, useContext } from "react";
import { Audio, Easing, interpolate, random, staticFile } from "remotion";
import { Sequence, useCurrentFrame } from "./Time";
import lib from "../sfx.json";
import script from "../script.json";
import { FPS } from "../theme";

export type SfxName = keyof typeof lib.list;
const LIST = lib.list as Record<SfxName, number[]>;

type Cfg = false | { volume?: number; wipe?: boolean } | undefined;
const cfg = (script as { sfx?: Cfg }).sfx;
export const SFX_ON = cfg !== false;
const MASTER = cfg ? (cfg.volume ?? 1) : 1;
export const WIPE_SFX = SFX_ON && !(cfg && cfg.wipe === false);

// Scene id, set by SceneShell in Video.tsx.
export const SfxScope = createContext("");

const pick = (s: SfxName, seed: string, avoid = -1) => {
  const n = LIST[s].length;
  const k = Math.floor(random(`sfx|${s}|${seed}`) * n);
  return k === avoid && n > 1 ? (k + 1) % n : k;
};
// Slightly uneven levels sound played, not pasted.
const jitter = (seed: string, spread: number) => 1 - spread + spread * random(`vol|${seed}`);

const Play: React.FC<{ s: SfxName; k: number; from: number; volume: number }> = ({ s, k, from, volume }) => (
  <Sequence from={from} durationInFrames={Math.ceil(LIST[s][k] * FPS) + 1} layout="none" name={`sfx ${s}`}>
    <Audio src={staticFile(`sfx/${s}-${k}.wav`)} volume={Math.min(1, volume * MASTER)} />
  </Sequence>
);

export const Sfx: React.FC<{ s: SfxName; at?: number; end?: number; volume?: number; variant?: number }> = ({ s, at = 0, end, volume = 1, variant }) => {
  const scope = useContext(SfxScope);
  if (!SFX_ON) return null;
  const seed = `${scope}|${at}|${end ?? ""}`;
  const k = variant ?? pick(s, seed);
  const from = end === undefined ? at : end - Math.round(LIST[s][k] * FPS);
  return <Play s={s} k={k} from={from} volume={volume * jitter(seed + s, 0.15)} />;
};

// One sound each time count(f) goes up between frames from..to. Steps closer than `gap` frames share
// one sound, so a fast counter does not turn into a buzz. With `text` (s = "key"), a space gets the
// space bar and "\n" the enter key. Never the same variant twice in a row.
export const SfxTrain: React.FC<{ count: (f: number) => number; from: number; to: number; s?: SfxName; text?: string; gap?: number; volume?: number }> = ({
  count,
  from,
  to,
  s = "key",
  text,
  gap = 2,
  volume = 1,
}) => {
  const scope = useContext(SfxScope);
  if (!SFX_ON) return null;
  const hits: React.ReactNode[] = [];
  const lastVar: Partial<Record<SfxName, number>> = {};
  let prev = count(from - 1);
  let last = -Infinity;
  for (let f = from; f <= to; f++) {
    const c = count(f);
    if (c <= prev) continue;
    if (f - last >= gap) {
      const typed = text?.slice(Math.max(0, prev), c) ?? "";
      const name: SfxName = s !== "key" ? s : typed.includes("\n") ? "enter" : typed.endsWith(" ") ? "space" : "key";
      const seed = `${scope}|${f}`;
      const k = pick(name, seed, lastVar[name]);
      lastVar[name] = k;
      hits.push(<Play key={f} s={name} k={k} from={f} volume={volume * jitter(seed + name, 0.3)} />);
      last = f;
    }
    prev = c;
  }
  return <>{hits}</>;
};

// Text typed at an even pace between frames a..b of the scene, plus its key sounds.
// s: "key" (keyboard, default) or "softkey" (phone keyboard).
export const useTyping = (text: string, a: number, b: number, opts: { s?: SfxName; volume?: number } = {}) => {
  const f = useCurrentFrame();
  const count = (x: number) => Math.round(interpolate(x, [a, b], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return {
    text: text.slice(0, count(f)),
    done: count(f) >= text.length,
    sfx: <SfxTrain count={count} from={a} to={b} text={text} s={opts.s ?? "key"} volume={opts.volume} />,
  };
};

// Mouse pointer (or a fingertip with touch) travelling through keyframes in scene frames. A key with
// click: true is reached exactly at `at`, then pressed (shrink + ripple) with a click/tap sound.
// Keys in time order (`at` strictly increasing). x/y are the tip in px of the enclosing box: compute them from the same layout constants that draw
// the target, then check a still at every click frame (SKILL: pointer must land on the target).
export type PointerKey = { at: number; x: number; y: number; click?: boolean };
export const Pointer: React.FC<{ keys: PointerKey[]; touch?: boolean; size?: number; color?: string; volume?: number }> = ({
  keys,
  touch = false,
  size = 64,
  color = "#ffffff",
  volume = 1,
}) => {
  const f = useCurrentFrame();
  const i = keys.findIndex((k) => k.at > f);
  const cur = i === -1 ? keys[keys.length - 1] : keys[Math.max(0, i - 1)];
  const next = i === -1 ? cur : keys[i];
  const p = i <= 0 ? (i === 0 ? 0 : 1) : interpolate(f, [cur.at, next.at], [0, 1], { easing: Easing.inOut(Easing.cubic) });
  const from = i === 0 ? next : cur;
  const x = from.x + (next.x - from.x) * p;
  const y = from.y + (next.y - from.y) * p;
  const clicks = keys.filter((k) => k.click);
  const press = clicks.reduce((m, k) => Math.max(m, interpolate(f - k.at, [-3, 0, 5], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })), 0);
  const ring = clicks.map((k) => f - k.at).find((d) => d >= 0 && d < 14);
  const opacity = interpolate(f, [keys[0].at - 8, keys[0].at - 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      {clicks.map((k) => (
        <Sfx key={k.at} s={touch ? "tap" : "click"} at={k.at} volume={volume} />
      ))}
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", opacity }}>
        {ring !== undefined && (
          <div
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size * (0.5 + ring / 7),
              height: size * (0.5 + ring / 7),
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              border: `${Math.max(2, size / 12)}px solid ${touch ? "rgba(255,255,255,0.9)" : "rgba(14,165,233,0.85)"}`,
              opacity: 1 - ring / 14,
            }}
          />
        )}
        {touch ? (
          <div
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              transform: `translate(-50%, -50%) scale(${1 - 0.18 * press})`,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.55)",
              border: "3px solid rgba(255,255,255,0.95)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
            }}
          />
        ) : (
          <svg
            width={size}
            height={size * 1.4}
            viewBox="0 0 20 28"
            style={{ position: "absolute", left: x - size * 0.05, top: y - size * 0.05, transform: `scale(${1 - 0.15 * press})`, transformOrigin: `${size * 0.05}px ${size * 0.05}px`, overflow: "visible", filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.35))" }}
          >
            <path d="M1 1 L1 22 L6.5 16.8 L10.2 25.5 L13.6 24 L10 15.6 L17.5 15.6 Z" fill={color} stroke="#0b1220" strokeWidth={1.6} strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </>
  );
};
