import { useId } from "react";
import { staticFile } from "remotion";
import { useCurrentFrame, useVideoConfig } from "./Time";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { LEAD_IN } from "../theme";

export type Who = "tech" | "cs" | "user";
export type Mood = "happy" | "excited" | "sad" | "neutral" | "surprised" | "curious";
export type Pose = "idle" | "wave" | "point" | "thumbs" | "phone" | "cheer" | "headset";

type Props = {
  who: Who;
  mood?: Mood;
  pose?: Pose;
  talk?: number; // 0..1 mouth opening (lip-sync)
  width?: number;
  flip?: boolean;
  seed?: number; // de-syncs idle motion between characters
  style?: React.CSSProperties;
};

const LOOK = {
  tech: { skin: "#E8B07D", shirt: "#1E2A5A", sleeve: "#1E2A5A", long: true, pants: "#2A3350", shoe: "#0E1A3A" },
  cs: { skin: "#F2C9A0", shirt: "#1A2A6C", sleeve: "#1A2A6C", long: true, pants: "#1A2240", shoe: "#3B2A4A" },
  user: { skin: "#C98B5A", shirt: "#FF6A4D", sleeve: "#FF6A4D", long: false, pants: "#3A4A7A", shoe: "#F4EFE6" },
};

// Mouth opening from the loudness of this scene's narration.
export const useTalk = (sceneId: string, from = LEAD_IN) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(staticFile(`vo/${sceneId}.wav`));
  if (!audioData || f < from) return 0;
  const frame = f - from;
  if (frame / fps > audioData.durationInSeconds) return 0;
  const bins = visualizeAudio({ fps, frame, audioData, numberOfSamples: 16 });
  const level = bins.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
  return Math.min(1, level * 6);
};

// [upper arm, forearm relative] in degrees; 0 = hanging straight down.
// SVG rotates clockwise, so the right arm swings outward with negative values.
const POSES: Record<Pose, { r: [number, number]; l: [number, number]; rHand?: "thumb" | "point" | "phone"; lHand?: "phone" }> = {
  idle: { r: [-8, 8], l: [8, -8] },
  wave: { r: [-145, -15], l: [8, -8] },
  point: { r: [-82, -4], l: [8, -8], rHand: "point" },
  thumbs: { r: [-30, -100], l: [8, -8], rHand: "thumb" },
  phone: { r: [-8, 8], l: [14, -118], lHand: "phone" },
  cheer: { r: [-155, -10], l: [155, 10] },
  headset: { r: [-25, -150], l: [8, -8] },
};

export const Character: React.FC<Props> = ({ who, mood = "neutral", pose = "idle", talk = 0, width = 340, flip, seed = 0, style }) => {
  const f = useCurrentFrame() + seed * 37;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const c = LOOK[who];

  const breathe = Math.sin(f / 12) * 3;
  const headTilt = Math.sin(f / 29) * 2.5 + (mood === "sad" ? -5 : mood === "curious" ? 6 : 0) + talk * 2;
  const blink = f % 103 >= 60 && f % 103 < 64;
  const gazeX = Math.sin(f / 41) * 3;
  const gazeY = Math.cos(f / 53) * 2;

  const p = POSES[pose];
  const waveOsc = pose === "wave" ? Math.sin(f / 4) * 16 : 0;
  const r: [number, number] = [p.r[0] + waveOsc * 0.4, p.r[1] + waveOsc];
  const cheerOsc = pose === "cheer" ? Math.sin(f / 5) * 8 : 0;
  r[0] += cheerOsc;
  const l: [number, number] = [p.l[0] - cheerOsc, p.l[1]];

  const brow = { happy: -4, excited: -8, sad: 14, neutral: 0, surprised: -12, curious: 6 }[mood];

  const hand = (kind: string | undefined, upright: number) => {
    if (kind === "thumb")
      return (
        <g transform={`rotate(${-upright})`}>
          <rect x={-24} y={-20} width={48} height={44} rx={16} fill={c.skin} />
          <rect x={-10} y={-58} width={20} height={48} rx={10} fill={c.skin} />
          <path d="M-22 0 H22 M-22 11 H22" stroke="rgba(0,0,0,0.12)" strokeWidth={3} />
        </g>
      );
    if (kind === "phone")
      return (
        <g transform={`rotate(${-upright})`}>
          <rect x={-32} y={-92} width={64} height={112} rx={12} fill="#111827" />
          <rect x={-26} y={-85} width={52} height={96} rx={8} fill={mood === "sad" ? "#374151" : "#3BD5F5"} />
          <ellipse cx={0} cy={6} rx={26} ry={20} fill={c.skin} />
        </g>
      );
    if (kind === "point")
      return (
        <g>
          <ellipse cx={0} cy={0} rx={22} ry={24} fill={c.skin} />
          <rect x={-7} y={10} width={14} height={40} rx={7} fill={c.skin} />
        </g>
      );
    return (
      <g>
        <ellipse cx={0} cy={0} rx={22} ry={24} fill={c.skin} />
        <ellipse cx={-14} cy={-8} rx={9} ry={12} fill={c.skin} transform="rotate(-30 -14 -8)" />
      </g>
    );
  };

  const arm = (sx: number, [up, low]: [number, number], kind?: string) => (
    <g transform={`rotate(${up} ${sx} 345)`}>
      <rect x={sx - 24} y={330} width={48} height={100} rx={24} fill={c.sleeve} />
      <g transform={`rotate(${low} ${sx} 420)`}>
        <rect x={sx - 20} y={410} width={40} height={88} rx={20} fill={c.long ? c.sleeve : c.skin} />
        {c.long && <rect x={sx - 20} y={478} width={40} height={20} rx={10} fill={c.skin} />}
        <g transform={`translate(${sx} 508)`}>{hand(kind, up + low)}</g>
      </g>
    </g>
  );

  const mouth = (() => {
    if (talk > 0.06) {
      const h = 8 + talk * 26;
      return (
        <g>
          <path d={`M174 250 Q200 ${250 + h * 1.6} 226 250 Z`} fill="#5B1A1A" />
          <path d="M178 251 Q200 256 222 251 L220 256 Q200 260 180 256 Z" fill="white" />
          <ellipse cx={200} cy={250 + h * 0.9} rx={11} ry={Math.max(2, h * 0.28)} fill="#F07A7A" />
        </g>
      );
    }
    switch (mood) {
      case "excited":
        return (
          <g>
            <path d="M170 244 Q200 292 230 244 Z" fill="#5B1A1A" />
            <path d="M174 246 Q200 252 226 246 L224 252 Q200 256 176 252 Z" fill="white" />
          </g>
        );
      case "happy":
        return <path d="M176 246 Q200 270 224 246" stroke="#5B1A1A" strokeWidth={7} fill="none" strokeLinecap="round" />;
      case "sad":
        return <path d="M178 264 Q200 246 222 264" stroke="#5B1A1A" strokeWidth={7} fill="none" strokeLinecap="round" />;
      case "surprised":
        return <ellipse cx={200} cy={258} rx={13} ry={17} fill="#5B1A1A" />;
      case "curious":
        return <path d="M184 256 Q204 250 220 258" stroke="#5B1A1A" strokeWidth={7} fill="none" strokeLinecap="round" />;
      default:
        return <path d="M182 254 Q200 262 218 254" stroke="#5B1A1A" strokeWidth={7} fill="none" strokeLinecap="round" />;
    }
  })();

  const eye = (cx: number) => (
    <g>
      <ellipse cx={cx} cy={204} rx={19} ry={mood === "surprised" ? 25 : 22} fill="white" />
      <circle cx={cx + gazeX} cy={207 + gazeY} r={13} fill="#3B2416" />
      <circle cx={cx + gazeX} cy={207 + gazeY} r={7} fill="#0B0B0B" />
      <circle cx={cx + gazeX - 4} cy={201 + gazeY} r={4} fill="white" />
      <circle cx={cx + gazeX + 5} cy={212 + gazeY} r={2} fill="white" />
      {blink && <ellipse cx={cx} cy={204} rx={21} ry={24} fill={c.skin} />}
      {blink && <path d={`M${cx - 18} 206 Q${cx} 214 ${cx + 18} 206`} stroke="#3B2416" strokeWidth={4} fill="none" strokeLinecap="round" />}
      {who === "cs" && !blink && (
        <path d={`M${cx - 19} 196 Q${cx} 178 ${cx + 19} 196`} stroke="#1F1410" strokeWidth={5} fill="none" strokeLinecap="round" />
      )}
    </g>
  );

  const headgear = {
    tech: (
      <g>
        <path d="M112 196 Q104 160 120 150 L126 196 Z M288 196 Q296 160 280 150 L274 196 Z" fill="#2A1B12" />
        <path d="M92 168 Q94 66 200 64 Q306 66 308 168 Z" fill="#FFC21A" />
        <path d="M120 120 Q150 80 200 76" stroke="#FFE38A" strokeWidth={14} fill="none" strokeLinecap="round" opacity={0.8} />
        <rect x={186} y={68} width={28} height={98} rx={12} fill="#FFD54F" />
        <rect x={76} y={156} width={248} height={28} rx={14} fill="#F2A900" />
        {/* brand mark on the helmet */}
        <g transform="translate(200 128)" stroke="#2B50FF" strokeWidth={6} fill="none" strokeLinecap="round">
          <path d="M-22 4 Q0 -18 22 4" />
          <path d="M-12 12 Q0 0 12 12" />
          <circle cx={0} cy={20} r={3} fill="#2B50FF" />
        </g>
      </g>
    ),
    user: (
      <g>
        <path d="M100 196 Q88 96 172 84 Q256 70 300 132 Q314 166 302 200 Q292 150 252 142 Q214 166 168 146 Q128 156 110 204 Z" fill="#1C1410" />
        <path d="M150 104 Q190 88 240 98" stroke="#3A2A20" strokeWidth={8} fill="none" strokeLinecap="round" />
      </g>
    ),
    cs: (
      <g>
        {/* headset band, cup and mic over the hijab */}
        <path d="M96 168 Q200 30 304 168" stroke="#111827" strokeWidth={12} fill="none" strokeLinecap="round" />
        <ellipse cx={302} cy={206} rx={20} ry={30} fill="#111827" />
        <ellipse cx={302} cy={206} rx={10} ry={18} fill="#3BD5F5" />
        <path d="M300 232 Q292 274 240 268" stroke="#111827" strokeWidth={7} fill="none" strokeLinecap="round" />
        <circle cx={236} cy={268} r={9} fill="#111827" />
      </g>
    ),
  }[who];

  const torso = "M122 332 Q88 334 88 370 L100 472 Q102 494 124 494 L276 494 Q298 494 300 472 L312 370 Q312 334 278 332 Z";

  const outfit = {
    tech: (
      <g>
        {/* hi-vis vest over the navy shirt */}
        <path d="M112 340 L168 336 L186 494 L124 494 Q102 494 100 472 L92 372 Q92 346 112 340 Z" fill="#FF7A1A" />
        <path d="M288 340 L232 336 L214 494 L276 494 Q298 494 300 472 L308 372 Q308 346 288 340 Z" fill="#FF7A1A" />
        <rect x={96} y={420} width={86} height={14} fill="#E5E7EB" />
        <rect x={218} y={420} width={86} height={14} fill="#E5E7EB" />
        <rect x={232} y={366} width={50} height={34} rx={8} fill="white" />
        <g transform="translate(257 386)" stroke="#2B50FF" strokeWidth={4} fill="none" strokeLinecap="round">
          <path d="M-14 0 Q0 -12 14 0" />
          <path d="M-7 6 Q0 0 7 6" />
        </g>
        <path d="M176 334 L200 366 L224 334" fill="#3BD5F5" />
      </g>
    ),
    cs: (
      <g>
        <path d="M168 334 L200 400 L232 334 Z" fill="white" />
        <path d="M168 334 L186 420 L150 470 M232 334 L214 420 L250 470" stroke="#0F1A4A" strokeWidth={6} fill="none" />
        <rect x={228} y={380} width={56} height={30} rx={6} fill="white" />
        <rect x={236} y={388} width={34} height={5} rx={2} fill="#2B50FF" />
        <rect x={236} y={398} width={24} height={4} rx={2} fill="#9CA3AF" />
      </g>
    ),
    user: (
      <g>
        <path d="M172 334 Q200 356 228 334" stroke="#E04E33" strokeWidth={10} fill="none" />
        <path d="M150 420 Q175 395 200 420 T250 420" stroke="#FFD23F" strokeWidth={10} fill="none" strokeLinecap="round" />
      </g>
    ),
  }[who];

  return (
    <svg
      viewBox="0 0 400 700"
      width={width}
      height={(width * 700) / 400}
      style={{ overflow: "visible", transform: flip ? "scaleX(-1)" : undefined, ...style }}
    >
      <defs>
        <radialGradient id={`face${uid}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="white" stopOpacity={0.22} />
          <stop offset="100%" stopColor="black" stopOpacity={0.08} />
        </radialGradient>
        <linearGradient id={`shade${uid}`} x1="0" x2="1">
          <stop offset="55%" stopColor="black" stopOpacity={0} />
          <stop offset="100%" stopColor="black" stopOpacity={0.18} />
        </linearGradient>
      </defs>
      <ellipse cx={200} cy={684} rx={130} ry={14} fill="rgba(0,0,0,0.18)" />
      <g transform={`translate(0 ${breathe})`}>
        {/* legs + shoes */}
        <rect x={136} y={478} width={56} height={176} rx={24} fill={c.pants} />
        <rect x={208} y={478} width={56} height={176} rx={24} fill={c.pants} />
        <rect x={120} y={640} width={84} height={36} rx={18} fill={c.shoe} />
        <rect x={196} y={640} width={84} height={36} rx={18} fill={c.shoe} />
        <rect x={120} y={664} width={84} height={10} rx={5} fill="white" opacity={0.9} />
        <rect x={196} y={664} width={84} height={10} rx={5} fill="white" opacity={0.9} />

        {/* an arm holding something in front of the body is drawn after the torso */}
        {!p.lHand && arm(100, l)}
        <path d={torso} fill={c.shirt} />
        {outfit}
        <path d={torso} fill={`url(#shade${uid})`} />
        {p.lHand && arm(100, l, p.lHand)}
        {arm(300, r, p.rHand)}

        {/* head */}
        <g transform={`rotate(${headTilt} 200 300)`}>
          {who === "cs" && (
            <path d="M200 62 Q78 64 76 206 Q74 306 136 352 L264 352 Q326 306 324 206 Q322 64 200 62 Z" fill="#14B8A6" />
          )}
          <rect x={178} y={270} width={44} height={70} rx={14} fill={c.skin} />
          <rect x={178} y={290} width={44} height={22} fill="black" opacity={0.08} />
          {who !== "cs" && <ellipse cx={100} cy={208} rx={18} ry={22} fill={c.skin} />}
          {who !== "cs" && <ellipse cx={300} cy={208} rx={18} ry={22} fill={c.skin} />}
          <ellipse cx={200} cy={196} rx={who === "cs" ? 88 : 102} ry={who === "cs" ? 100 : 108} fill={c.skin} />
          <ellipse cx={200} cy={196} rx={who === "cs" ? 88 : 102} ry={who === "cs" ? 100 : 108} fill={`url(#face${uid})`} />
          {who === "cs" && <ellipse cx={200} cy={196} rx={92} ry={104} fill="none" stroke="#0F766E" strokeWidth={8} />}
          {headgear}
          {/* brows */}
          <path d="M140 166 Q160 156 182 166" stroke="#2A1B12" strokeWidth={9} fill="none" strokeLinecap="round" transform={`rotate(${brow} 161 162)`} />
          <path d="M218 166 Q240 156 260 166" stroke="#2A1B12" strokeWidth={9} fill="none" strokeLinecap="round" transform={`rotate(${-brow} 239 162)`} />
          {eye(160)}
          {eye(240)}
          <path d="M194 226 Q200 238 208 230" stroke="rgba(0,0,0,0.25)" strokeWidth={5} fill="none" strokeLinecap="round" />
          <ellipse cx={136} cy={240} rx={17} ry={10} fill="#FF6A6A" opacity={mood === "happy" || mood === "excited" || talk > 0.06 ? 0.4 : 0.15} />
          <ellipse cx={264} cy={240} rx={17} ry={10} fill="#FF6A6A" opacity={mood === "happy" || mood === "excited" || talk > 0.06 ? 0.4 : 0.15} />
          {mouth}
        </g>
      </g>
    </svg>
  );
};
