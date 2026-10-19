import { Img, interpolate, spring, staticFile, Easing } from "remotion";
import { useCurrentFrame, useVideoConfig } from "./Time";
import { C, sans } from "../theme";
import script from "../script.json";

export const useSpring = (delay = 0, damping = 16) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping, stiffness: 160 } });
};

export const Title: React.FC<{ text: string; sub?: string; delay?: number }> = ({ text, sub, delay = 0 }) => {
  const s = useSpring(delay);
  const s2 = useSpring(delay + 6);
  return (
    <div style={{ position: "absolute", top: 210, left: 70, right: 70, textAlign: "center", fontFamily: sans }}>
      <div
        style={{
          display: "inline-block",
          padding: "10px 26px",
          borderRadius: 999,
          border: `2px solid ${C.border}`,
          background: "rgba(14,165,233,0.12)",
          color: C.cyan,
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: 4,
          textTransform: "uppercase",
          opacity: s,
          transform: `translateY(${interpolate(s, [0, 1], [-30, 0])}px)`,
        }}
      >
        {script.brand}
      </div>
      <div
        style={{
          marginTop: 26,
          color: C.text,
          fontWeight: 800,
          fontSize: 84,
          lineHeight: 1.05,
          opacity: s2,
          transform: `translateY(${interpolate(s2, [0, 1], [40, 0])}px)`,
        }}
      >
        {text}
      </div>
      {sub && (
        <div style={{ marginTop: 18, color: C.muted, fontWeight: 600, fontSize: 36, opacity: s2 }}>{sub}</div>
      )}
    </div>
  );
};

export const Panel: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      background: C.panel,
      border: `2px solid ${C.border}`,
      borderRadius: 32,
      boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 60px rgba(14,165,233,0.15)",
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

type PanPoint = { x: number; y: number; zoom: number };

// Screenshot inside a frame, with the camera moving between two focus points.
export const PanShot: React.FC<{
  src: string;
  imgW: number;
  imgH: number;
  pan: PanPoint[];
  duration: number;
  w?: number;
  h?: number;
  top?: number;
  delay?: number;
}> = ({ src, imgW, imgH, pan, duration, w = 960, h = 860, top = 420, delay = 4 }) => {
  const f = useCurrentFrame();
  const enter = useSpring(delay, 18);
  const t = interpolate(f, [delay + 8, duration - 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const [a, b] = [pan[0], pan[1] ?? pan[0]];
  const zoom = a.zoom + (b.zoom - a.zoom) * t;
  const cx = a.x + (b.x - a.x) * t;
  const cy = a.y + (b.y - a.y) * t;
  // zoom=1 → image fits frame height
  const scale = (h / imgH) * zoom;
  const rw = imgW * scale;
  const rh = imgH * scale;
  const x = Math.min(0, Math.max(w - rw, w / 2 - cx * rw));
  const y = Math.min(0, Math.max(h - rh, h / 2 - cy * rh));

  return (
    <Panel
      style={{
        position: "absolute",
        left: (1080 - w) / 2,
        top,
        width: w,
        height: h,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [90, 0])}px)`,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{ position: "absolute", width: rw, height: rh, left: x, top: y, maxWidth: "none" }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, transparent 75%, rgba(5,11,26,0.6))",
        }}
      />
    </Panel>
  );
};
