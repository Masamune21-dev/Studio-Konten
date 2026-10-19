import { useCurrentFrame } from "./Time";
import { K, label } from "../design";

// Hand-drawn props in the same flat, lightly shaded style as the characters.
// Use these (or plain typography) instead of emoji / stock icon sets, which
// look generic. Each draws in a 200×200 box scaled by `size`.

type Sized = { size: number; style?: React.CSSProperties };
const Box: React.FC<Sized & { children: React.ReactNode; vb?: string }> = ({ size, style, children, vb = "0 0 200 200" }) => (
  <svg viewBox={vb} width={size} height={size} style={{ overflow: "visible", ...style }}>
    {children}
  </svg>
);

const CABLE = "#FFC21A";
const CABLE_DARK = "#D99A00";

// OLT chassis: front panel with port rows and blinking LEDs, 2.5D.
export const OltRack: React.FC<Sized> = (p) => {
  const f = useCurrentFrame();
  return (
    <Box {...p}>
      <path d="M40 40 L160 40 L180 24 L60 24 Z" fill="#3A4A8A" />
      <path d="M160 40 L180 24 L180 156 L160 172 Z" fill="#141C40" />
      <rect x={40} y={40} width={120} height={132} rx={8} fill="#1E2A5A" />
      {[0, 1, 2].map((r) => (
        <g key={r}>
          <rect x={50} y={56 + r * 38} width={100} height={28} rx={5} fill="#0E1530" />
          {[0, 1, 2, 3, 4, 5].map((c) => (
            <rect key={c} x={56 + c * 15} y={62 + r * 38} width={10} height={9} rx={2} fill="#9CA3AF" />
          ))}
          {[0, 1, 2, 3, 4, 5].map((c) => (
            <circle key={c} cx={61 + c * 15} cy={78 + r * 38} r={2.6} fill={(f + c * 7 + r * 11) % 24 < 14 ? "#22C55E" : "#14532D"} />
          ))}
        </g>
      ))}
      <rect x={40} y={40} width={120} height={10} fill="white" opacity={0.08} />
    </Box>
  );
};

// Loose coil of yellow fibre patch cable ending in a green connector.
export const FiberCoil: React.FC<Sized> = (p) => (
  <Box {...p}>
    {[0, 1, 2, 3].map((i) => (
      <ellipse key={i} cx={96 + i * 4} cy={92 - i * 6} rx={64} ry={42} fill="none" stroke={i % 2 ? CABLE_DARK : CABLE} strokeWidth={11} />
    ))}
    <ellipse cx={104} cy={78} rx={54} ry={30} fill="none" stroke="white" strokeWidth={3} opacity={0.35} strokeDasharray="30 200" />
    <path d="M150 110 Q 175 140 160 172" stroke={CABLE} strokeWidth={11} fill="none" strokeLinecap="round" />
    <rect x={146} y={168} width={30} height={24} rx={5} fill="#16A34A" transform="rotate(-10 161 180)" />
    <rect x={153} y={190} width={12} height={10} rx={2} fill="#F8FAFC" transform="rotate(-10 159 195)" />
  </Box>
);

// ODP closure strapped to a pole, drop cables leaving from the bottom.
export const OdpBox: React.FC<Sized> = (p) => (
  <Box {...p}>
    <rect x={150} y={0} width={30} height={200} rx={8} fill="#9CA3AF" />
    <rect x={150} y={0} width={10} height={200} fill="white" opacity={0.25} />
    <rect x={130} y={58} width={70} height={10} rx={4} fill="#6B7280" />
    <rect x={130} y={128} width={70} height={10} rx={4} fill="#6B7280" />
    <path d="M40 40 L140 40 L152 30 L52 30 Z" fill="#374151" />
    <path d="M140 40 L152 30 L152 150 L140 162 Z" fill="#111827" />
    <rect x={40} y={40} width={100} height={122} rx={10} fill="#1F2937" />
    <line x1={90} y1={46} x2={90} y2={156} stroke="#111827" strokeWidth={3} />
    <rect x={96} y={88} width={8} height={22} rx={3} fill="#6B7280" />
    <circle cx={60} cy={58} r={5} fill={K.cyan} />
    {[56, 80, 104, 128].map((x) => (
      <rect key={x} x={x - 6} y={160} width={12} height={10} rx={3} fill="#4B5563" />
    ))}
    {[56, 80, 104].map((x, i) => (
      <path key={x} d={`M${x} 170 Q ${x - 10 - i * 8} 190 ${x - 30 - i * 14} 200`} stroke={CABLE} strokeWidth={5} fill="none" strokeLinecap="round" />
    ))}
  </Box>
);

// SC/APC connector (green body, white ferrule) on a yellow cable.
export const ScConnector: React.FC<Sized> = (p) => (
  <Box {...p}>
    <path d="M10 150 Q 50 150 70 120" stroke={CABLE} strokeWidth={16} fill="none" strokeLinecap="round" />
    <g transform="rotate(-40 110 90)">
      <rect x={60} y={74} width={34} height={32} rx={8} fill={CABLE_DARK} />
      <rect x={92} y={66} width={70} height={48} rx={8} fill="#16A34A" />
      <rect x={92} y={66} width={70} height={14} rx={6} fill="white" opacity={0.18} />
      {[100, 110, 120].map((x) => (
        <rect key={x} x={x} y={84} width={4} height={24} rx={2} fill="#15803D" />
      ))}
      <rect x={160} y={82} width={22} height={16} rx={3} fill="#F8FAFC" />
      <rect x={160} y={82} width={22} height={5} rx={2} fill="#CBD5E1" />
    </g>
  </Box>
);

// Patch cable kinked against a door edge, kink circled in red.
export const BentCable: React.FC<Sized> = (p) => {
  const f = useCurrentFrame();
  const pulse = 1 + Math.sin(f / 5) * 0.06;
  return (
    <Box {...p}>
      <rect x={96} y={0} width={34} height={200} fill="#E5E7EB" />
      <rect x={124} y={0} width={10} height={200} fill="#9CA3AF" />
      <path d="M10 60 Q 80 70 112 100 L 120 108 Q 140 130 190 150" stroke={CABLE} strokeWidth={14} fill="none" strokeLinejoin="miter" strokeLinecap="round" />
      <path d="M108 96 L126 112" stroke={CABLE_DARK} strokeWidth={6} strokeLinecap="round" />
      <circle cx={116} cy={104} r={30 * pulse} fill="none" stroke={K.coral} strokeWidth={7} />
      <path d="M150 70 L162 58 M156 84 L172 80 M140 62 L144 46" stroke={K.coral} strokeWidth={5} strokeLinecap="round" />
    </Box>
  );
};

// Severed cable: two ends with bare glass fibres glinting.
export const CutCable: React.FC<Sized> = (p) => {
  const f = useCurrentFrame();
  const gap = 18 + Math.sin(f / 8) * 4;
  return (
    <Box {...p}>
      <path d={`M10 130 Q 50 120 ${92 - gap / 2} 104`} stroke={CABLE} strokeWidth={16} fill="none" strokeLinecap="butt" />
      <path d={`M${108 + gap / 2} 96 Q 150 80 190 70`} stroke={CABLE} strokeWidth={16} fill="none" strokeLinecap="butt" />
      <path d={`M${92 - gap / 2} 96 l4 4 -4 4 4 4 -4 4`} stroke={CABLE_DARK} strokeWidth={4} fill="none" />
      {[-4, 0, 4].map((d) => (
        <line key={d} x1={92 - gap / 2} y1={104 + d} x2={100 - gap / 2 + 4} y2={102 + d * 1.6} stroke="#E0F2FE" strokeWidth={2} />
      ))}
      {[-4, 0, 4].map((d) => (
        <line key={d} x1={108 + gap / 2} y1={96 + d} x2={100 + gap / 2 - 4} y2={98 + d * 1.6} stroke="#E0F2FE" strokeWidth={2} />
      ))}
      <path d="M96 60 L100 44 M110 62 L120 50 M84 64 L74 52" stroke={K.cyan} strokeWidth={4} strokeLinecap="round" opacity={0.5 + 0.5 * Math.sin(f / 3)} />
    </Box>
  );
};

// Fibre modem front view with status lights (used small in chains/lists).
export type LightState = "on" | "off" | "blink" | "red" | "red-blink";
export const LIGHT = { green: "#22C55E", red: "#EF4444", off: "#CBD5E1" };
export const Modem: React.FC<{ width: number; lights: { name: string; state: LightState }[]; labels?: boolean }> = ({ width, lights, labels = true }) => {
  const f = useCurrentFrame();
  const n = lights.length;
  const gap = 560 / Math.max(1, n - 1);
  return (
    <svg viewBox="0 -130 700 440" width={width} height={(width * 440) / 700} style={{ overflow: "visible" }}>
      <rect x={90} y={-120} width={26} height={170} rx={13} fill="#94A3B8" />
      <rect x={584} y={-120} width={26} height={170} rx={13} fill="#94A3B8" />
      <rect x={10} y={56} width={700} height={230} rx={44} fill="#CBD5E1" />
      <rect x={0} y={40} width={700} height={230} rx={44} fill="#F8FAFC" stroke="#CBD5E1" strokeWidth={6} />
      <rect x={30} y={70} width={640} height={30} rx={15} fill="#E2E8F0" />
      {lights.map((l, i) => {
        const x = 70 + i * gap;
        // lit two thirds of the time so a still frame rarely catches it dark
        const blinkOn = f % 18 < 12;
        const color =
          l.state === "on" ? LIGHT.green : l.state === "red" ? LIGHT.red : l.state === "red-blink" ? (blinkOn ? LIGHT.red : LIGHT.off) : l.state === "blink" ? (blinkOn ? LIGHT.green : LIGHT.off) : LIGHT.off;
        const lit = color !== LIGHT.off;
        return (
          <g key={l.name}>
            {lit && <circle cx={x} cy={170} r={34} fill={color} opacity={0.3} />}
            <circle cx={x} cy={170} r={18} fill={color} />
            {labels && (
              <text x={x} y={236} textAnchor="middle" fontFamily={label} fontWeight={700} fontSize={24} fill="#334155">
                {l.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// A Javanese-town house: tiled roof, varied colours so rows don't look stamped.
const WALLS = ["#F8FAFC", "#FDE68A", "#BAE6FD", "#FBCFE8", "#D9F99D"];
export const House: React.FC<Sized & { variant?: number; lit?: boolean }> = ({ variant = 0, lit, ...p }) => {
  const wall = WALLS[variant % WALLS.length];
  const tall = variant % 3 === 1;
  return (
    <Box {...p}>
      <rect x={30} y={tall ? 70 : 90} width={140} height={tall ? 110 : 90} rx={6} fill={wall} />
      <rect x={150} y={tall ? 70 : 90} width={20} height={tall ? 110 : 90} fill="black" opacity={0.08} />
      <path d={`M14 ${tall ? 76 : 96} L100 ${tall ? 20 : 40} L186 ${tall ? 76 : 96} Z`} fill="#C2410C" />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${40 + i * 20} ${tall ? 66 - i * 12 : 86 - i * 12} L${160 - i * 20} ${tall ? 66 - i * 12 : 86 - i * 12}`} stroke="#9A3412" strokeWidth={3} />
      ))}
      <rect x={86} y={130} width={28} height={50} rx={4} fill="#7C2D12" />
      <rect x={44} y={tall ? 96 : 112} width={30} height={26} rx={3} fill={lit ? K.sun : "#94A3B8"} />
      <rect x={126} y={tall ? 96 : 112} width={30} height={26} rx={3} fill={lit ? K.sun : "#94A3B8"} />
      <rect x={20} y={178} width={160} height={8} rx={4} fill="#9CA3AF" />
    </Box>
  );
};

// Diagonal hazard tape with a message: replaces a warning-sign emoji.
export const CautionTape: React.FC<{ text: string; top: number; rotate?: number }> = ({ text, top, rotate = -8 }) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: -120,
        right: -120,
        top,
        height: 110,
        transform: `rotate(${rotate}deg)`,
        background: `repeating-linear-gradient(45deg, ${K.sun} 0 40px, ${K.ink} 40px 80px)`,
        backgroundPosition: `${f * 3}px 0`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 16px 30px rgba(0,0,0,0.2)",
      }}
    >
      <div style={{ background: K.sun, color: K.ink, padding: "8px 30px", fontFamily: label, fontWeight: 700, fontSize: 40, letterSpacing: 3 }}>{text}</div>
    </div>
  );
};

// Pulsing red status pill: replaces a siren emoji.
export const AlarmPill: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderRadius: 999, background: "#FEE2E2", color: "#B91C1C", fontFamily: label, fontWeight: 700, fontSize: 26, letterSpacing: 2 }}>
      <span style={{ width: 16, height: 16, borderRadius: 8, background: "#EF4444", opacity: 0.4 + 0.6 * Math.abs(Math.sin(f / 4)) }} />
      ALARM
    </div>
  );
};

/* ---- mini app mockups (for product/ecosystem tiles) ---- */

const Screen: React.FC<Sized & { children: React.ReactNode; bg?: string }> = ({ children, bg = "#F8FAFC", ...p }) => (
  <Box {...p}>
    <rect x={14} y={22} width={180} height={164} rx={22} fill="black" opacity={0.12} />
    <rect x={8} y={14} width={180} height={164} rx={22} fill={bg} />
    {children}
  </Box>
);

// Billing: phone-style card with a QR block and a "paid" check.
export const MiniBilling: React.FC<Sized> = (p) => (
  <Screen {...p}>
    <rect x={8} y={14} width={180} height={34} rx={22} fill={K.cobalt} />
    <rect x={8} y={34} width={180} height={14} fill={K.cobalt} />
    <rect x={24} y={24} width={70} height={10} rx={5} fill="white" opacity={0.85} />
    {Array.from({ length: 49 }).map((_, i) => {
      const x = i % 7;
      const y = Math.floor(i / 7);
      const corner = (x < 2 && y < 2) || (x > 4 && y < 2) || (x < 2 && y > 4);
      return (x * 3 + y * 5 + x * y) % 3 === 0 || corner ? <rect key={i} x={30 + x * 13} y={62 + y * 13} width={12} height={12} rx={2} fill={K.ink} /> : null;
    })}
    <circle cx={150} cy={140} r={22} fill="#22C55E" />
    <path d="M139 140 L147 148 L162 132" stroke="white" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Screen>
);

// NMS: donut of ONU states plus port bars.
export const MiniNms: React.FC<Sized> = (p) => {
  const f = useCurrentFrame();
  return (
    <Screen {...p} bg="#0E1A3A">
      <circle cx={64} cy={76} r={32} fill="none" stroke="#22C55E" strokeWidth={14} strokeDasharray="150 201" transform="rotate(-90 64 76)" />
      <circle cx={64} cy={76} r={32} fill="none" stroke={K.sun} strokeWidth={14} strokeDasharray="36 201" strokeDashoffset={-150} transform="rotate(-90 64 76)" />
      <circle cx={64} cy={76} r={32} fill="none" stroke={K.coral} strokeWidth={14} strokeDasharray="15 201" strokeDashoffset={-186} transform="rotate(-90 64 76)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={112 + i * 14} y={110 - (20 + ((i * 17 + f) % 30))} width={9} height={20 + ((i * 17 + f) % 30)} rx={3} fill={K.cyan} />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={24} y={128 + i * 16} width={150 - i * 30} height={9} rx={4} fill="white" opacity={0.2} />
      ))}
    </Screen>
  );
};

// Gateway: small router with Ethernet ports and link LEDs.
export const MiniGateway: React.FC<Sized> = (p) => {
  const f = useCurrentFrame();
  return (
    <Box {...p}>
      <path d="M20 90 L170 90 L188 74 L38 74 Z" fill="#475569" />
      <path d="M170 90 L188 74 L188 128 L170 144 Z" fill="#1E293B" />
      <rect x={20} y={90} width={150} height={54} rx={8} fill="#334155" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={32 + i * 26} y={106} width={20} height={18} rx={3} fill="#0F172A" />
          <circle cx={36 + i * 26} cy={132} r={3} fill={(f + i * 9) % 20 < 12 ? "#22C55E" : "#14532D"} />
          <circle cx={48 + i * 26} cy={132} r={3} fill={K.sun} opacity={0.8} />
        </g>
      ))}
      <path d="M60 74 Q100 30 140 74" stroke={K.cyan} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.6} />
    </Box>
  );
};

// Pulse: backbone traffic sparkline with a highlighted dip.
export const MiniPulse: React.FC<Sized> = (p) => {
  const f = useCurrentFrame();
  const pts = Array.from({ length: 12 }, (_, i) => `${22 + i * 15},${110 - 30 * Math.sin((i + f / 10) / 1.6) - (i === 7 ? -28 : 0)}`).join(" ");
  return (
    <Screen {...p}>
      {[60, 95, 130].map((y) => (
        <line key={y} x1={22} y1={y} x2={176} y2={y} stroke="#E2E8F0" strokeWidth={2} />
      ))}
      <polyline points={pts} fill="none" stroke={K.cobalt} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
      <rect x={24} y={150} width={60} height={14} rx={7} fill={K.mint} />
      <rect x={92} y={150} width={40} height={14} rx={7} fill="#E2E8F0" />
    </Screen>
  );
};

// Geo attendance: street map, geofence circle and a drawn pin.
export const MiniGeo: React.FC<Sized> = (p) => {
  const f = useCurrentFrame();
  return (
    <Screen {...p} bg="#E8F5E9">
      <path d="M8 70 L188 92 M8 130 L188 120 M70 14 L60 178 M138 14 L150 178" stroke="white" strokeWidth={12} />
      <circle cx={102} cy={100} r={44 + Math.sin(f / 8) * 3} fill={K.cobalt} opacity={0.15} stroke={K.cobalt} strokeWidth={3} strokeDasharray="8 6" />
      <path d="M102 60 C86 60 76 72 76 86 C76 106 102 128 102 128 C102 128 128 106 128 86 C128 72 118 60 102 60 Z" fill={K.coral} />
      <circle cx={102} cy={86} r={9} fill="white" />
    </Screen>
  );
};

// Stock: stacked cardboard boxes, one with a fibre spool label.
export const MiniStock: React.FC<Sized> = (p) => {
  const box = (x: number, y: number, w: number, h: number) => (
    <g>
      <path d={`M${x} ${y} L${x + w} ${y} L${x + w + 16} ${y - 12} L${x + 16} ${y - 12} Z`} fill="#E3B27A" />
      <path d={`M${x + w} ${y} L${x + w + 16} ${y - 12} L${x + w + 16} ${y + h - 12} L${x + w} ${y + h} Z`} fill="#B8834A" />
      <rect x={x} y={y} width={w} height={h} fill="#D19A5B" />
      <rect x={x + w / 2 - 6} y={y} width={12} height={h} fill="#C08850" />
    </g>
  );
  return (
    <Box {...p}>
      {box(26, 120, 70, 56)}
      {box(102, 120, 70, 56)}
      {box(62, 66, 70, 54)}
      <circle cx={97} cy={94} r={14} fill="none" stroke={CABLE} strokeWidth={6} />
    </Box>
  );
};

export const PROPS: Record<string, React.FC<Sized>> = {
  billing: MiniBilling,
  nms: MiniNms,
  gateway: MiniGateway,
  pulse: MiniPulse,
  geo: MiniGeo,
  stock: MiniStock,
  olt: OltRack,
  fiber: FiberCoil,
  odp: OdpBox,
  connector: ScConnector,
  bent: BentCable,
  cut: CutCable,
  house: (p) => <House {...p} variant={0} lit />,
  modem: ({ size, style }) => (
    <div style={{ width: size, height: size, display: "grid", placeItems: "center", ...style }}>
      <Modem width={size} labels={false} lights={[{ name: "a", state: "on" }, { name: "b", state: "on" }, { name: "c", state: "off" }, { name: "d", state: "blink" }]} />
    </div>
  ),
};
