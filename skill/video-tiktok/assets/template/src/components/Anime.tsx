// Anime characters (transparent PNGs from Studio Konten → Media) and anime
// scenery cards. See SKILL.md, "Karakter anime".
import { Img, interpolate, spring, staticFile } from "remotion";
import { useCurrentFrame, useVideoConfig } from "./Time";
import { EASE, ramp } from "./Motion";
import { useAudioData, type AudioData } from "@remotion/media-utils";
import turnsJson from "../vo-turns.json";
import { LEAD_IN } from "../theme";
import { Scene, at } from "./Type";

/* ---------- anime character (transparent PNG) ---------- */
// Pose files are named <who>-<pose>.png (who = a character key from src/brand.ts). A pose with mouth
// frames also has <name>-mulut-closed/mid/open.png, identical except for the mouth.
// Only the character whose turn it is (src/vo-turns.json) tilts and moves its
// mouth; the other one just breathes.
// `mouths: true` when the three mouth frames were copied next to the pose.
// `rest: "base"` uses the original pose image (e.g. the shocked "O" mouth) instead of the
// closed-mouth frame, whose smile does not fit a shocked face.
export type PoseAt = { at: number; src: string; mouths?: boolean; rest?: "base" };
const TURNS = turnsJson as Record<string, { who: string; start: number; end: number }[]>;

const speakingAt = (sceneId: string, who: string, sec: number) => {
  const turns = TURNS[sceneId];
  if (!turns) return false;
  return turns.some((t) => t.who === who && sec >= t.start - 0.05 && sec <= t.end + 0.05);
};

// 0..1, how much `who` is talking: eases in and out over 0.25 s at the turn edges, so the sway
// starts and stops softly instead of snapping.
const talkAmount = (sceneId: string, who: string, sec: number) => {
  const ease = (v: number) => {
    const t = Math.max(0, Math.min(1, v));
    return t * t * (3 - 2 * t);
  };
  let a = 0;
  for (const t of TURNS[sceneId] ?? []) {
    if (t.who === who) a = Math.max(a, ease((sec - t.start + 0.05) / 0.25) * ease((t.end + 0.05 - sec) / 0.25));
  }
  return a;
};

// Loudness of the scene narration, read straight from the samples: Hann-weighted RMS over `win`
// seconds around `sec`, relative to the clip's own speaking level (90th percentile of its 50 ms
// blocks), 0..1. Not visualizeAudio: that looks at 32 samples (~1 ms) per frame, a near-random
// value that made the talking tilt reverse ±30 times a second (the character shook).
const refs = new WeakMap<AudioData, number>();
const rms = (audio: AudioData, sec: number, win: number) => {
  const x = audio.channelWaveforms[0];
  const c = sec * audio.sampleRate;
  const half = (win * audio.sampleRate) / 2;
  let sum = 0;
  let wsum = 0;
  for (let i = Math.max(0, Math.ceil(c - half)); i <= Math.min(x.length - 1, c + half); i++) {
    const w = 0.5 + 0.5 * Math.cos((Math.PI * (i - c)) / half);
    sum += w * x[i] * x[i];
    wsum += w;
  }
  return wsum ? Math.sqrt(sum / wsum) : 0;
};
const speakingLevel = (audio: AudioData) => {
  let ref = refs.get(audio);
  if (ref === undefined) {
    const blocks: number[] = [];
    for (let t = 0.025; t < audio.durationInSeconds; t += 0.05) {
      const b = rms(audio, t, 0.05);
      if (b > 0.01) blocks.push(b);
    }
    blocks.sort((a, b) => a - b);
    ref = blocks[Math.floor(blocks.length * 0.9)] ?? 0.2;
    refs.set(audio, ref);
  }
  return ref;
};
const useLoudness = (sceneId: string) => {
  const audio = useAudioData(staticFile(`vo/${sceneId}.wav`));
  return (sec: number, win: number) =>
    !audio || sec < 0 || sec > audio.durationInSeconds ? 0 : Math.min(1, rms(audio, sec, win) / speakingLevel(audio));
};

export const Anime: React.FC<{
  scene: Scene;
  duration: number;
  poses: PoseAt[];
  height: number;
  style: React.CSSProperties;
  flip?: boolean;
  from?: "left" | "right" | "up";
  delay?: number;
  seed?: number;
  disc?: string;
}> = ({ scene, duration, poses, height, style, flip, from = "up", delay = 6, seed = 0, disc }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Entrance: damping 18 (was 14) so the character lands without bouncing back up.
  const s = spring({ frame: f - delay, fps, config: { damping: 18, stiffness: 120 } });
  const cur = [...poses].reverse().find((p) => f >= at(duration, p.at)) ?? poses[0];
  const who = cur.src.split("-")[0];
  const sec = (f - LEAD_IN) / fps;
  const talking = speakingAt(scene.id, who, sec);
  const amount = talkAmount(scene.id, who, sec);
  const loud = useLoudness(scene.id);
  // Mouth shapes change about 10 times a second, like hand-drawn lip flaps, following the syllables.
  const step = Math.floor((f - LEAD_IN) / 3) * 3;
  const level = loud(step / fps, 0.08);
  // The body follows the phrase (0.4 s window), not single syllables, so it sways without shaking.
  const phrase = loud(sec, 0.4);
  const mouth = !cur.mouths ? null : !talking || level < 0.35 ? "closed" : level < 0.85 ? "mid" : "open";
  const file = mouth && !(cur.rest === "base" && mouth === "closed") ? `${cur.src}-mulut-${mouth}` : cur.src;
  // Pose change: the previous pose fades out over 6 frames on top of the new one while the new one
  // settles 10 px (was an instant swap with a bouncy 94% → 100% scale pop).
  const changed = at(duration, cur.at);
  const curIdx = poses.indexOf(cur);
  const prev = changed > 0 && curIdx > 0 ? poses[curIdx - 1] : null;
  const fadeOld = prev ? 1 - ramp(f, changed, 6, EASE.inOut) : 0;
  const settle = changed > 0 ? 1 - ramp(f, changed, 12, EASE.out) : 0;
  const breath = Math.sin(f / 18 + seed * 2) * (0.6 + 0.4 * amount);
  const tilt = amount * (Math.sin(f / 14 + seed) * (0.4 + 0.6 * phrase) + phrase * 0.8);
  const off = interpolate(s, [0, 1], [1, 0]);
  const enter =
    from === "left" ? `translateX(${-off * 500}px)` : from === "right" ? `translateX(${off * 500}px)` : `translateY(${off * 400}px)`;
  return (
    <div style={{ position: "absolute", ...style, height, opacity: Math.min(1, s * 2), transform: enter }}>
      {disc && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: height * 0.06,
            width: height * 0.62,
            height: height * 0.62,
            marginLeft: -height * 0.31,
            borderRadius: "50%",
            background: disc,
            opacity: Math.min(1, s * 1.5),
            transform: `scale(${0.85 + 0.15 * s})`,
          }}
        />
      )}
      <Img
        src={staticFile(`img/${file}.png`)}
        style={{
          height,
          display: "block",
          position: "relative",
          transformOrigin: "50% 100%",
          transform: `translateY(${breath * 5 + settle * 10}px) scaleY(${1 + breath * 0.006}) rotate(${(flip ? -1 : 1) * tilt}deg) scaleX(${flip ? -1 : 1})`,
          filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.22))",
        }}
      />
      {prev && fadeOld > 0 && (
        <Img
          src={staticFile(`img/${prev.src}.png`)}
          style={{
            height,
            position: "absolute",
            left: "50%",
            bottom: 0,
            opacity: fadeOld,
            transformOrigin: "50% 100%",
            transform: `translateX(-50%) translateY(${breath * 5}px) scaleY(${1 + breath * 0.006}) rotate(${(flip ? -1 : 1) * tilt}deg) scaleX(${flip ? -1 : 1})`,
            filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.22))",
          }}
        />
      )}
    </div>
  );
};

/* ---------- anime illustration card ---------- */
// Generated anime scenery in a rounded frame, slowly drifting (Ken Burns). Since 16 Oct 2026 the
// drift is 2% → 6% (was 4% → 14%, too much zoom) and the card rises in without a scale pop.
export const Scenery: React.FC<{
  src: string;
  duration: number;
  style: React.CSSProperties;
  delay?: number;
  zoom?: [number, number];
  pan?: [number, number];
  radius?: number;
  border?: string;
  children?: React.ReactNode;
}> = ({ src, duration, style, delay = 6, zoom = [1.02, 1.06], pan = [0, 0], radius = 34, border, children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 20, stiffness: 110 } });
  const k = interpolate(f, [0, duration], [0, 1], { extrapolateRight: "clamp", easing: EASE.sine });
  return (
    <div
      style={{
        position: "absolute",
        overflow: "hidden",
        borderRadius: radius,
        border,
        boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
        opacity: Math.min(1, s * 1.6),
        transform: `translateY(${(1 - s) * 70}px)`,
        ...style,
      }}
    >
      <Img
        src={staticFile(`img/${src}`)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${interpolate(k, [0, 1], zoom)}) translate(${pan[0] * k}px, ${pan[1] * k}px)`,
        }}
      />
      {children}
    </div>
  );
};
