// Galleries of the icon and SVG kits, to pick from by eye (SKILL.md "Ikon & SVG"):
//   npx remotion still AsetIkon out/aset-ikon.png        all NET_ICONS in tiles + the brand logos
//   npx remotion still AsetSvg out/aset-svg.png --frame=150   the SVG toolkit, settled
//   npx remotion render AsetSvg out/aset-svg.mp4         the same, animated (6 s)
//   npx remotion render AsetMotion out/aset-motion.mp4   10 s demo of the motion playbook (SKILL.md 6f):
//                                                         match cut via Handoff, kinetic type, rolling numbers,
//                                                         parallax, colour shift, "bars" transition, sound hits
import { AbsoluteFill } from "remotion";
import { Sequence, useCurrentFrame, useVideoConfig } from "./components/Time";
import { SceneFrame, WIPE } from "./components/Edit";
import { Kicker, Outline } from "./components/Kinetic";
import { AccentShapes, ColorShift, CountUp, Handoff, Highlight, KineticText, Layer, Parallax, WordSwap, fullBox, kineticBig } from "./components/MotionKit";
import { DUR, EASE, ramp } from "./components/Motion";
import { Sfx } from "./components/Sfx";
import { Backdrop } from "./components/Kinetic";
import { BRANDS, BrandName } from "./components/brandIcons";
import { BrandBadge, Ico, IconTile, NET_ICONS, NetFlow } from "./components/Icons";
import { Arrow, Bars, Donut, FlowLine, Gauge, Ripple, SignalBars, Svg, WifiWaves } from "./components/Svg";
import { display, label, THEMES } from "./design";

const cap: React.CSSProperties = { fontFamily: label, fontWeight: 700, fontSize: 15, letterSpacing: 0.5, textAlign: "center", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

export const AsetIkon: React.FC = () => {
  const t = THEMES.cream;
  return (
    <AbsoluteFill style={{ background: t.bg, padding: "40px 40px", color: t.fg }}>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 52 }}>Ikon jaringan &amp; teknologi</div>
      <div style={{ fontFamily: label, fontSize: 20, opacity: 0.7, marginBottom: 18 }}>Lucide (ISC) · {NET_ICONS.length} pilihan, nama lain dari lucide.dev juga bisa · &lt;IconTile name=&quot;…&quot; /&gt;</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: "10px 8px" }}>
        {NET_ICONS.map((n) => (
          <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 78, height: 78, borderRadius: 20, background: t.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ico name={n} size={46} color={t.bg} stroke={2} />
            </div>
            <div style={{ ...cap, width: 108 }}>{n}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 44, marginTop: 26 }}>Logo platform</div>
      <div style={{ fontFamily: label, fontSize: 20, opacity: 0.7, marginBottom: 14 }}>Simple Icons (CC0) · hanya untuk menyebut platform / ajakan follow · &lt;BrandBadge brand=&quot;…&quot; /&gt;</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: "10px 8px" }}>
        {(Object.keys(BRANDS) as BrandName[]).map((b) => (
          <div key={b} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <BrandBadge brand={b} size={74} delay={-30} />
            <div style={{ ...cap, width: 108 }}>{b}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const AsetSvg: React.FC = () => {
  const t = THEMES.night;
  return (
    <Backdrop theme={t}>
      <div style={{ position: "absolute", left: 60, top: 50, fontFamily: display, fontWeight: 800, fontSize: 56, color: t.fg }}>Kit SVG &amp; ikon</div>
      {/* tiles + network path */}
      <IconTile name="router" t={t} size={150} delay={4} label="IconTile" style={{ left: 60, top: 150 }} />
      <IconTile name="shield-check" t={t} bg="#22C55E" fg="#fff" size={150} delay={8} label="bg/fg" style={{ left: 250, top: 150 }} />
      <IconTile name="wifi-off" t={t} size={150} delay={12} dim label="dim" style={{ left: 440, top: 150 }} />
      <IconTile name="globe" t={t} bg="#2B50FF" fg="#fff" round size={150} delay={16} label="round" style={{ left: 630, top: 150 }} />
      <NetFlow t={t} top={420} left={60} width={960} size={140} delay={10} broken={1} nodes={[{ icon: "smartphone", label: "HP" }, { icon: "router", label: "Router" }, { icon: "server", label: "OLT" }, { icon: "globe", label: "Internet" }]} />
      <Svg>
        <Gauge x={300} y={980} r={210} value={87.4} max={100} decimals={1} label="download" color={t.accent} text={t.fg} track="rgba(255,255,255,0.12)" delay={20} />
        <Donut x={800} y={960} r={150} thick={56} parts={[{ value: 60, color: t.accent }, { value: 25, color: "#FFD23F" }, { value: 15, color: "#FF6A4D" }]} delay={30} track="rgba(255,255,255,0.08)" />
        <Bars x={60} y={1260} width={620} text={t.fg} track="rgba(255,255,255,0.08)" delay={40} items={[{ label: "WiFi 2,4 GHz", value: 45, color: "#FF6A4D", text: "45 Mbps" }, { label: "WiFi 5 GHz", value: 290, color: t.accent, text: "290 Mbps" }, { label: "Kabel LAN", value: 940, color: "#7CE3B5", text: "940 Mbps" }]} max={1000} />
        <SignalBars x={790} y={1250} h={110} level={3} color={t.accent} off="rgba(255,255,255,0.15)" />
        <WifiWaves x={880} y={1520} r={130} level={3} color="#3BD5F5" off="rgba(255,255,255,0.15)" pulse />
        <FlowLine d="M 90 1700 C 300 1580, 560 1820, 760 1690" color="rgba(255,255,255,0.6)" packet={t.accent} delay={50} />
        <Arrow from={[980, 1820]} to={[860, 1640]} bend={-0.3} color="#FFD23F" delay={60} />
        <Ripple x={760} y={1690} color={t.accent} r={70} from={60} />
      </Svg>
      <div style={{ position: "absolute", left: 60, top: 1820, fontFamily: label, fontSize: 22, color: t.fg, opacity: 0.7 }}>Gauge · Donut · Bars · SignalBars · WifiWaves · FlowLine · Arrow · Ripple</div>
    </Backdrop>
  );
};

/* ---------- motion playbook demo (10 s) ---------- */
const PILL = { x: 70, y: 1180, w: 560, h: 150, r: 75 };
// Everything but the pill leaves before the cut, so the match cut lands on an identical frame.
const Leave: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame();
  const p = ramp(f, at, DUR.quick + 2, EASE.in);
  return <div style={{ position: "absolute", inset: 0, opacity: 1 - p, transform: `translateY(${-p * 40}px)` }}>{children}</div>;
};

const DemoA: React.FC = () => {
  const t = THEMES.cobalt;
  return (
    <Backdrop theme={t}>
      <AccentShapes t={t} seed="demo-a" count={5} />
      <Leave at={84}>
        <Kicker index="01" text="PAKET INTERNET" color={t.fg} delay={0} />
        <KineticText text="Paket 100 Mbps" at={2} step={5} emph={["100", "Mbps"]} accent={t.accent} style={{ position: "absolute", left: 70, right: 70, top: 300, ...kineticBig(150, t.fg) }} />
        <KineticText text="itu bukan 100 MB per detik" at={26} step={4} mode="rise" style={{ position: "absolute", left: 70, right: 70, top: 640, ...kineticBig(78, t.fg), fontWeight: 700 }} />
      </Leave>
      <div style={{ position: "absolute", left: PILL.x, top: PILL.y, width: PILL.w, height: PILL.h, borderRadius: PILL.r, background: t.accent }}>
        <Leave at={86}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", ...kineticBig(72, t.bg) }}>
            =&nbsp;
            <CountUp to={12.5} decimals={1} at={46} dur={34} roll />
            &nbsp;MB/dtk
          </div>
        </Leave>
      </div>
      <Sfx s="pop" at={7} />
      <Sfx s="pop" at={12} />
      <Sfx s="swipe" at={26} volume={0.6} />
      <Sfx s="riser" end={80} volume={0.5} />
      <Sfx s="ding" at={80} volume={0.7} />
    </Backdrop>
  );
};

const DemoB: React.FC = () => {
  const t = THEMES.cream;
  const { width: W, height: H } = useVideoConfig();
  const f = useCurrentFrame();
  const bits = "10110010";
  return (
    <AbsoluteFill style={{ background: THEMES.cobalt.bg }}>
      {/* the pill of scene A grows into this scene's background */}
      <Handoff from={{ ...PILL, color: THEMES.cobalt.accent }} to={fullBox(W, H, t.bg)} dur={DUR.big}>
        <ColorShift base={t.bg} shifts={[{ at: 78, color: THEMES.mint.bg, x: 0.5, y: 0.47 }]} />
        <Parallax pan={[90, 0]} from={20} to={115}>
          <Layer depth={0.25}>
            <Outline text="BIT · BYTE · BIT" color="rgba(14,26,58,0.12)" top={330} size={260} drift={0} />
          </Layer>
          <Layer depth={0.6}>
            <div style={{ position: "absolute", left: 150, top: 760, display: "flex", gap: 18 }}>
              {[...bits].map((b, i) => {
                const p = ramp(f, 30 + i * 4, DUR.enter);
                return (
                  <div key={i} style={{ width: 100, height: 130, borderRadius: 22, background: b === "1" ? t.accent : "#0E1A3A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", ...kineticBig(72, "#fff"), opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * 40}px)` }}>
                    {b}
                  </div>
                );
              })}
            </div>
          </Layer>
          <Layer depth={1}>
            <div style={{ position: "absolute", left: 170, top: 1000, ...kineticBig(96, t.fg) }}>
              8 bit = <Highlight at={70} color={THEMES.sun.bg}>1 byte</Highlight>
            </div>
            <div style={{ position: "absolute", left: 170, top: 1150, ...kineticBig(64, t.fg), fontWeight: 700 }}>
              1 GB ≈ <WordSwap words={["…", "80 detik"]} at={[88]} color={t.accent} />
            </div>
          </Layer>
        </Parallax>
      </Handoff>
      <Sfx s="whoosh" at={0} volume={0.7} />
      {[...bits].map((_, i) => (
        <Sfx key={i} s="blip" at={30 + i * 4} volume={0.45} />
      ))}
      <Sfx s="scribble" at={70} volume={0.6} />
      <Sfx s="pop" at={88} />
    </AbsoluteFill>
  );
};

const DemoC: React.FC = () => {
  const t = THEMES.night;
  return (
    <Backdrop theme={t}>
      <AccentShapes t={t} seed="demo-c" count={4} delay={10} />
      <Svg>
        <Gauge x={540} y={760} r={300} value={94} max={100} label="speedtest" color={t.accent} text={t.fg} track="rgba(255,255,255,0.12)" delay={14} dur={40} />
      </Svg>
      <KineticText text="Normal kok, bukan ditipu." at={52} step={4} emph={["Normal"]} accent={t.accent} style={{ position: "absolute", left: 70, right: 70, top: 1220, ...kineticBig(96, t.fg) }} align="center" />
      <Sfx s="tick" at={20} volume={0.5} />
      <Sfx s="success" at={54} volume={0.6} />
    </Backdrop>
  );
};

export const AsetMotion: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Sequence from={0} durationInFrames={100}>
      <DemoA />
    </Sequence>
    {/* match cut: no transition, the Handoff carries the eye */}
    <Sequence from={100} durationInFrames={100 + WIPE}>
      <SceneFrame enter={null} exit={{ name: "bars", dir: 1 }} duration={100} edge={THEMES.night.accent}>
        <DemoB />
      </SceneFrame>
    </Sequence>
    <Sequence from={200} durationInFrames={100}>
      <SceneFrame enter={{ name: "bars", dir: 1 }} exit={null} duration={100} edge={THEMES.night.accent} bg={THEMES.night.bg}>
        <DemoC />
      </SceneFrame>
    </Sequence>
  </AbsoluteFill>
);
