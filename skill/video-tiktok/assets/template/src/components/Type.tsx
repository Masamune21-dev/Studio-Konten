import { Img, interpolate, staticFile } from "remotion";
import { accentItalic, display, serif, THEMES, Theme } from "../design";
import { Reveal, useIn } from "./Kinetic";
import { Character, useTalk, Who, Pose, Mood } from "./Character";

// Shared typography + character helpers for scene libraries.
export type Scene = { id: string; kind: string; theme: string; vo: string; [field: string]: any };
export type P = { scene: Scene; duration: number };
export type CharSpec = { who: Who; pose?: Pose; mood?: Mood };

export const themeOf = (s: Scene): Theme => THEMES[s.theme] ?? THEMES.cream;
export const idx = (s: Scene) => s.id.replace("s", "");
export const at = (duration: number, frac: number) => Math.round(duration * frac);

export const big = (size: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: display,
  fontWeight: 800,
  fontSize: size,
  lineHeight: 0.92,
  letterSpacing: -size * 0.035,
  color,
  ...extra,
});
export const italic = (size: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: serif,
  // Handwritten accent faces (look.type "bulat") have no italic; never fake one.
  fontStyle: accentItalic ? "italic" : "normal",
  fontWeight: 400,
  fontSize: size,
  lineHeight: 1,
  color,
  ...extra,
});

// Three-line headline: bold / serif italic / bold accent.
export const Headline: React.FC<{ lines: string[]; t: Theme; sizes?: number[]; top?: number; align?: "left" | "center" }> = ({
  lines,
  t,
  sizes = [130, 130, 170],
  top = 270,
  align = "left",
}) => (
  <div style={{ position: "absolute", top, left: 70, right: 70, textAlign: align }}>
    {lines.map((l, i) => (
      <Reveal key={i} delay={2 + i * 7}>
        <div style={i === 1 ? italic(sizes[i] ?? 130, t.fg) : big(sizes[i] ?? 130, i === 2 ? t.accent : t.fg)}>{l}</div>
      </Reveal>
    ))}
  </div>
);

export const Talker: React.FC<{ spec?: CharSpec; scene: Scene; width: number; style: React.CSSProperties; flip?: boolean; seed?: number }> = ({
  spec,
  scene,
  width,
  style,
  flip,
  seed,
}) => {
  const talk = useTalk(scene.id);
  const s = useIn(8, 13);
  if (!spec) return null;
  return (
    <div style={{ position: "absolute", ...style, opacity: Math.min(1, s * 2), transform: `translateY(${interpolate(s, [0, 1], [200, 0])}px)` }}>
      <Character who={spec.who} pose={spec.pose} mood={spec.mood} talk={talk} width={width} flip={flip} seed={seed} />
    </div>
  );
};

export const LogoCard: React.FC<{ width: number; delay?: number }> = ({ width, delay = 0 }) => {
  const s = useIn(delay, 16, 170);
  return (
    <div
      style={{
        opacity: Math.min(1, s * 1.8),
        background: "white",
        borderRadius: 26,
        padding: "16px 30px",
        boxShadow: "0 20px 50px rgba(0,0,0,0.22)",
        transform: `scale(${0.85 + 0.15 * s}) rotate(${interpolate(s, [0, 1], [-6, -2])}deg)`,
      }}
    >
      <Img src={staticFile("img/logo.webp")} style={{ width, display: "block" }} />
    </div>
  );
};
