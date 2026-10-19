import { useCurrentFrame } from "./Time";
import { K, label } from "../design";

// More hand-drawn props (home Wi-Fi + field tools), same style as Props.tsx.
type Sized = { size: number; style?: React.CSSProperties };
const Box: React.FC<Sized & { children: React.ReactNode; vb?: string }> = ({ size, style, children, vb = "0 0 200 200" }) => (
  <svg viewBox={vb} width={size} height={size} style={{ overflow: "visible", ...style }}>
    {children}
  </svg>
);

// Wi-Fi arcs drawn as strokes; `level` 0..3 lit arcs.
const Arcs: React.FC<{ x: number; y: number; r: number; level: number; color: string; dim?: string }> = ({ x, y, r, level, color, dim = "#CBD5E1" }) => (
  <g strokeLinecap="round" fill="none">
    {[1, 2, 3].map((i) => (
      <path key={i} d={`M${x - r * i * 0.33} ${y - r * i * 0.12} Q ${x} ${y - r * i * 0.48} ${x + r * i * 0.33} ${y - r * i * 0.12}`} stroke={i <= level ? color : dim} strokeWidth={r * 0.09} />
    ))}
    <circle cx={x} cy={y} r={r * 0.06} fill={level > 0 ? color : dim} />
  </g>
);

// Wooden cabinet with the modem shut inside: signal barely gets out.
export const Cabinet: React.FC<Sized> = (p) => {
  const f = useCurrentFrame();
  return (
    <Box {...p}>
      <rect x={30} y={30} width={140} height={160} rx={8} fill="#B7794A" />
      <rect x={170} y={38} width={14} height={152} fill="#8A5530" />
      <rect x={40} y={40} width={120} height={66} rx={4} fill="#5B3A22" />
      <rect x={52} y={78} width={96} height={24} rx={8} fill="#F8FAFC" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={68 + i * 22} cy={90} r={4} fill={i === 1 ? "#22C55E" : "#CBD5E1"} />
      ))}
      <rect x={40} y={112} width={120} height={70} rx={4} fill="#C98A58" />
      <circle cx={146} cy={146} r={5} fill="#5B3A22" />
      <g opacity={0.5 + 0.3 * Math.sin(f / 6)}>
        <Arcs x={100} y={26} r={70} level={1} color={K.coral} />
      </g>
    </Box>
  );
};

// Top-down floor plan; modem in the middle (good) or boxed in a corner (bad).
export const FloorPlan: React.FC<Sized & { good: boolean }> = ({ good, ...p }) => {
  const f = useCurrentFrame();
  const mx = good ? 100 : 36;
  const my = good ? 100 : 160;
  const rooms = [
    { x: 14, y: 14, w: 84, h: 84, n: "Kamar" },
    { x: 102, y: 14, w: 84, h: 84, n: "Kamar" },
    { x: 14, y: 102, w: 84, h: 84, n: "Dapur" },
    { x: 102, y: 102, w: 84, h: 84, n: "Ruang TV" },
  ];
  const reach = good ? 120 : 55;
  return (
    <Box {...p}>
      <defs>
        <radialGradient id={`cov${good ? "g" : "b"}`}>
          <stop offset="0%" stopColor={good ? K.mint : K.coral} stopOpacity={0.75} />
          <stop offset="100%" stopColor={good ? K.mint : K.coral} stopOpacity={0} />
        </radialGradient>
        <clipPath id={`house${good ? "g" : "b"}`}>
          <rect x={10} y={10} width={180} height={180} rx={10} />
        </clipPath>
      </defs>
      <rect x={10} y={10} width={180} height={180} rx={10} fill="#F8FAFC" />
      <g clipPath={`url(#house${good ? "g" : "b"})`}>
        <circle cx={mx} cy={my} r={reach + Math.sin(f / 8) * 4} fill={`url(#cov${good ? "g" : "b"})`} />
      </g>
      {rooms.map((r, i) => (
        <g key={i}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="#334155" strokeWidth={4} />
          <text x={r.x + r.w / 2} y={r.y + (i < 2 ? 22 : r.h - 10)} textAnchor="middle" fontFamily={label} fontWeight={700} fontSize={12} fill="#475569">
            {r.n}
          </text>
        </g>
      ))}
      <rect x={10} y={10} width={180} height={180} rx={10} fill="none" stroke="#0E1A3A" strokeWidth={7} />
      {!good && <rect x={20} y={146} width={34} height={34} rx={4} fill="#B7794A" />}
      <rect x={mx - 12} y={my - 7} width={24} height={14} rx={4} fill="white" stroke="#0E1A3A" strokeWidth={3} />
      <circle cx={mx} cy={my} r={2.5} fill="#22C55E" />
    </Box>
  );
};

// Phone with full Wi-Fi bars but a page still loading.
export const PhoneBars: React.FC<Sized> = (p) => {
  const f = useCurrentFrame();
  return (
    <Box {...p}>
      <rect x={52} y={10} width={96} height={180} rx={18} fill="#111827" />
      <rect x={58} y={22} width={84} height={156} rx={10} fill="#F8FAFC" />
      <Arcs x={100} y={92} r={70} level={3} color={K.cobalt} />
      <circle cx={100} cy={128} r={16} fill="none" stroke="#E2E8F0" strokeWidth={6} />
      <path d="M100 112 A16 16 0 0 1 116 128" stroke={K.coral} strokeWidth={6} fill="none" strokeLinecap="round" transform={`rotate(${f * 14} 100 128)`} />
      <rect x={70} y={156} width={60} height={8} rx={4} fill="#E2E8F0" />
      <rect x={70} y={156} width={14} height={8} rx={4} fill={K.coral} />
    </Box>
  );
};

export const PhoneDev: React.FC<Sized> = (p) => (
  <Box {...p}>
    <rect x={64} y={20} width={72} height={150} rx={16} fill="#111827" />
    <rect x={70} y={32} width={60} height={126} rx={8} fill={K.cyan} />
    <rect x={76} y={44} width={48} height={30} rx={5} fill="white" opacity={0.6} />
    <rect x={76} y={82} width={36} height={8} rx={4} fill="white" opacity={0.6} />
  </Box>
);

export const Laptop: React.FC<Sized> = (p) => (
  <Box {...p}>
    <rect x={36} y={40} width={128} height={86} rx={8} fill="#1F2937" />
    <rect x={44} y={48} width={112} height={70} rx={4} fill={K.cobalt} />
    <rect x={54} y={60} width={60} height={10} rx={5} fill="white" opacity={0.7} />
    <rect x={54} y={78} width={86} height={26} rx={4} fill="white" opacity={0.25} />
    <path d="M20 132 L180 132 L168 150 L32 150 Z" fill="#9CA3AF" />
    <rect x={84} y={134} width={32} height={5} rx={2} fill="#6B7280" />
  </Box>
);

export const TvDev: React.FC<Sized> = (p) => (
  <Box {...p}>
    <rect x={20} y={36} width={160} height={100} rx={10} fill="#111827" />
    <rect x={28} y={44} width={144} height={84} rx={4} fill={K.coral} />
    <path d="M88 70 L118 86 L88 102 Z" fill="white" />
    <rect x={90} y={136} width={20} height={20} fill="#374151" />
    <rect x={64} y={154} width={72} height={10} rx={5} fill="#374151" />
  </Box>
);

// Thick masonry wall (bricks) with a crack.
export const Wall: React.FC<Sized> = (p) => (
  <Box {...p}>
    <rect x={30} y={30} width={140} height={140} rx={6} fill="#9CA3AF" />
    {[0, 1, 2, 3, 4].map((r) =>
      [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={34 + c * 46 - (r % 2 ? 22 : 0)} y={34 + r * 27} width={42} height={23} rx={3} fill={r % 2 ? "#C2410C" : "#B45309"} />),
    )}
    <rect x={30} y={30} width={140} height={140} rx={6} fill="none" stroke="#6B7280" strokeWidth={4} />
    <rect x={8} y={30} width={22} height={140} fill={K.cream} />
    <rect x={170} y={30} width={22} height={140} fill={K.cream} />
  </Box>
);

// Standing mirror bouncing signal away.
export const Mirror: React.FC<Sized> = (p) => (
  <Box {...p}>
    <ellipse cx={100} cy={88} rx={52} ry={72} fill="#94A3B8" />
    <ellipse cx={100} cy={88} rx={44} ry={64} fill="#E0F2FE" />
    <path d="M78 50 L96 34 M76 72 L112 40" stroke="white" strokeWidth={8} strokeLinecap="round" />
    <rect x={94} y={158} width={12} height={24} fill="#64748B" />
    <rect x={70} y={180} width={60} height={10} rx={5} fill="#64748B" />
  </Box>
);

export const Microwave: React.FC<Sized> = (p) => {
  const f = useCurrentFrame();
  return (
    <Box {...p}>
      <rect x={24} y={50} width={152} height={100} rx={12} fill="#E5E7EB" />
      <rect x={34} y={60} width={98} height={80} rx={8} fill="#1F2937" />
      <rect x={40} y={66} width={86} height={68} rx={6} fill={K.sun} opacity={0.35 + 0.15 * Math.sin(f / 4)} />
      <rect x={140} y={62} width={28} height={16} rx={3} fill="#111827" />
      <text x={154} y={74} textAnchor="middle" fontFamily={label} fontSize={11} fontWeight={700} fill="#22C55E">
        2:00
      </text>
      {[0, 1, 2].map((r) => (
        <g key={r}>
          <circle cx={148} cy={92 + r * 16} r={5} fill="#9CA3AF" />
          <circle cx={162} cy={92 + r * 16} r={5} fill="#9CA3AF" />
        </g>
      ))}
    </Box>
  );
};

// Fusion splicer: screen shows two fibres meeting, arc sparks when joining.
export const Splicer: React.FC<Sized & { join?: number }> = ({ join = 1, ...p }) => {
  const f = useCurrentFrame();
  const gap = 30 * (1 - join);
  const spark = join > 0.8 && join < 1;
  return (
    <Box {...p}>
      <path d="M30 70 L150 70 L172 56 L52 56 Z" fill="#9CA3AF" />
      <path d="M150 70 L172 56 L172 160 L150 174 Z" fill="#4B5563" />
      <rect x={30} y={70} width={120} height={104} rx={10} fill="#6B7280" />
      <rect x={40} y={80} width={100} height={60} rx={6} fill="#0B1230" />
      <line x1={46} y1={110} x2={90 - gap} y2={110} stroke={K.cyan} strokeWidth={5} strokeLinecap="round" />
      <line x1={90 + gap} y1={110} x2={134} y2={110} stroke={K.cyan} strokeWidth={5} strokeLinecap="round" />
      {spark && (
        <g stroke={K.sun} strokeWidth={3} strokeLinecap="round" opacity={0.6 + 0.4 * Math.sin(f)}>
          <path d="M90 96 L90 88 M80 100 L74 94 M100 100 L106 94 M90 124 L90 132" />
          <circle cx={90} cy={110} r={6} fill={K.sun} />
        </g>
      )}
      {join >= 1 && <circle cx={90} cy={110} r={4} fill="white" />}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={48 + i * 30} y={150} width={22} height={12} rx={4} fill="#374151" />
      ))}
      <path d="M0 110 L40 110 M140 110 L200 110" stroke="#FFC21A" strokeWidth={6} />
    </Box>
  );
};

// Handheld optical power meter showing a reading.
export const PowerMeter: React.FC<Sized & { reading: string; ok?: boolean }> = ({ reading, ok = true, ...p }) => (
  <Box {...p}>
    <rect x={56} y={20} width={88} height={160} rx={18} fill="#FACC15" />
    <rect x={64} y={30} width={72} height={150} rx={12} fill="#374151" />
    <rect x={72} y={42} width={56} height={44} rx={6} fill={ok ? "#DCFCE7" : "#FEE2E2"} />
    <text x={100} y={64} textAnchor="middle" fontFamily={label} fontWeight={700} fontSize={14} fill={ok ? "#166534" : "#991B1B"}>
      {reading}
    </text>
    <text x={100} y={80} textAnchor="middle" fontFamily={label} fontWeight={700} fontSize={9} fill={ok ? "#166534" : "#991B1B"}>
      dBm
    </text>
    {[0, 1, 2].map((r) =>
      [0, 1].map((c) => <rect key={`${r}${c}`} x={76 + c * 26} y={100 + r * 22} width={20} height={14} rx={4} fill="#6B7280" />),
    )}
    <rect x={90} y={4} width={20} height={18} rx={4} fill="#16A34A" />
    <path d="M100 4 Q 100 -20 140 -26" stroke="#FFC21A" strokeWidth={6} fill="none" />
  </Box>
);

export const EXTRA_PROPS: Record<string, React.FC<Sized>> = {
  cabinet: Cabinet,
  "floor-good": (p) => <FloorPlan {...p} good />,
  "floor-bad": (p) => <FloorPlan {...p} good={false} />,
  "phone-bars": PhoneBars,
  phone: PhoneDev,
  laptop: Laptop,
  tv: TvDev,
  wall: Wall,
  mirror: Mirror,
  microwave: Microwave,
  splicer: Splicer,
  meter: (p) => <PowerMeter {...p} reading="-19.8" />,
};
