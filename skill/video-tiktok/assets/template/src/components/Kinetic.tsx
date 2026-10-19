import { AbsoluteFill, interpolate, spring } from "remotion";
import { useCurrentFrame, useVideoConfig } from "./Time";
import { display, label, Theme } from "../design";
import { DUR, EASE } from "./Motion";

// Spring 0..1 from `delay`. Default damping 20 (was 18): settles without a visible bounce. Damping
// below 15 is raised to 15 (since 16 Oct 2026): the scene libraries asked for 9–13, which overshoots
// 20–27% and makes every element wobble before it rests (15 → 7.6%).
export const useIn = (delay = 0, damping = 20, stiffness = 140) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping: Math.max(15, damping), stiffness } });
};

// Text line that slides up from behind an invisible baseline mask.
export const Reveal: React.FC<{
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  from?: "up" | "down";
}> = ({ delay = 0, children, style, from = "up" }) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [delay, delay + DUR.enter], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  // The mask reaches 0.25em below the line so descenders (g, j, y — deep in Fraunces)
  // are not clipped; the negative margin keeps the layout height at line + 0.08em, and
  // the extra 0.25em of travel keeps the line hidden below the mask at the start.
  const dir = from === "up" ? 1 : -1;
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.25em", marginBottom: "-0.17em", ...style }}>
      <div style={{ transform: `translateY(calc(${dir * t * 110}% + ${dir * t * 0.25}em))` }}>{children}</div>
    </div>
  );
};

// Horizontal strip of repeated text, scrolling forever.
export const Marquee: React.FC<{ text: string; theme: Theme; top: number; rotate?: number; speed?: number; size?: number; inverse?: boolean }> = ({
  text,
  theme,
  top,
  rotate = 0,
  speed = 4,
  size = 44,
  inverse,
}) => {
  const f = useCurrentFrame();
  const unit = `${text}  ✦  `;
  return (
    <div
      style={{
        position: "absolute",
        left: -200,
        right: -200,
        top,
        transform: `rotate(${rotate}deg)`,
        background: inverse ? theme.fg : theme.accent,
        color: theme.bg,
        padding: "14px 0",
        whiteSpace: "nowrap",
        overflow: "hidden",
        fontFamily: display,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: 1,
      }}
    >
      <div style={{ transform: `translateX(${-((f * speed) % 900)}px)` }}>{unit.repeat(12)}</div>
    </div>
  );
};

// Huge outlined word used as background texture.
export const Outline: React.FC<{ text: string; color: string; top: number; size?: number; drift?: number }> = ({ text, color, top, size = 300, drift = 1 }) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        whiteSpace: "nowrap",
        fontFamily: display,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1,
        color: "transparent",
        WebkitTextStroke: `3px ${color}`,
        transform: `translateX(${-60 - f * drift}px)`,
        letterSpacing: -6,
      }}
    >
      {text}
    </div>
  );
};

export const Chip: React.FC<{ children: React.ReactNode; bg: string; fg: string; delay?: number; style?: React.CSSProperties }> = ({
  children,
  bg,
  fg,
  delay = 0,
  style,
}) => {
  // Soft pop: fades in from 85% with a small settle (was a bouncy scale from 0 with an 8° swing).
  const s = useIn(delay, 16, 170);
  return (
    <div
      style={{
        opacity: Math.min(1, s * 1.8),
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "16px 30px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontFamily: display,
        fontWeight: 800,
        fontSize: 42,
        transform: `translateY(${(1 - s) * 18}px) scale(${0.85 + 0.15 * s}) rotate(${interpolate(s, [0, 1], [-4, 0])}deg)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Small all-caps label with a leading index number, editorial style.
export const Kicker: React.FC<{ index: string; text: string; color: string; delay?: number; top?: number }> = ({ index, text, color, delay = 0, top = 200 }) => {
  const s = useIn(delay);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 70,
        right: 70,
        display: "flex",
        alignItems: "center",
        gap: 18,
        fontFamily: label,
        fontWeight: 700,
        fontSize: 28,
        letterSpacing: 4,
        color,
        opacity: s,
      }}
    >
      <span>{index}</span>
      <span style={{ flex: 1, height: 3, background: color, transformOrigin: "left", transform: `scaleX(${s})` }} />
      <span>{text}</span>
    </div>
  );
};

// Flat colour background with film grain and a soft vignette. The grain is static by default (since
// 16 Oct 2026): a pattern that changes every frame makes flat colours crawl, and the encoder (and
// TikTok's re-encode) spends its bits on noise instead of on the moving elements. grain="live" for
// the old changing grain, false for none.
export const Backdrop: React.FC<{ theme: Theme; children?: React.ReactNode; grain?: "static" | "live" | false }> = ({ theme, children, grain = "static" }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: "hidden" }}>
      {children}
      {grain && (
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.09, mixBlendMode: "multiply" }}>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={grain === "live" ? Math.floor(f) % 8 : 3} />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      )}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(0,0,0,0.12))" }} />
    </AbsoluteFill>
  );
};
