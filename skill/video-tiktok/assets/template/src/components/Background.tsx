import { AbsoluteFill } from "remotion";
import { useCurrentFrame } from "./Time";
import { C } from "../theme";

export const Background: React.FC = () => {
  const f = useCurrentFrame();
  const shift = (f * 0.6) % 80;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, ${C.bg2} 0%, ${C.bg} 55%, #03060f 100%)` }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(56,189,248,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.07) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          backgroundPosition: `0 ${shift}px`,
          maskImage: "radial-gradient(ellipse at 50% 40%, black 30%, transparent 80%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          left: 90 + Math.sin(f / 70) * 120,
          top: 300 + Math.cos(f / 90) * 80,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14,165,233,0.22), transparent 65%)",
          filter: "blur(30px)",
        }}
      />
    </AbsoluteFill>
  );
};
