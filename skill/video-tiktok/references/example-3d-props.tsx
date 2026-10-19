// Galeri aset 3D (9 Okt 2026): satu adegan contoh 9:16 per ide konten, memakai prop baru di
// components/ThreeKitProps.tsx plus kit lama (components/ThreeKit.tsx). Tiap adegan 4 detik,
// tanpa suara; Galeri = semua adegan berurutan. Disalin ke skill sebagai
// references/example-3d-props.tsx: contoh kamera, tata letak, dan label 2D untuk tiap prop.
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { Sequence, useCurrentFrame, useVideoConfig } from "./components/Time";
import { loadFont as loadSora } from "@remotion/google-fonts/Sora";
import { loadFont as loadChakra } from "@remotion/google-fonts/ChakraPetch";
import { C3, Cam, GlobePin, HoloGlobe, Phone3D, Signal, Stage3D, THREE, toScreen, yawFacing } from "./components/ThreeKit";
import {
  Battery3D,
  CAR,
  CHIP_BLOCKS,
  Car3D,
  Chip3D,
  Cloud3D,
  Dust3D,
  FiberCore3D,
  Floor3D,
  GlobeArc,
  LandDots,
  NeuralNet3D,
  Ont3D,
  Padlock3D,
  QrStand3D,
  RACK,
  SOLAR_SAT,
  SeaCable3D,
  ServerRack3D,
  Shadow3D,
  Shield3D,
  SignalWaves,
  SolarSat3D,
  TOWER,
  Tower3D,
  TvBox3D,
  Waveform3D,
  arcPoints,
  ontLed,
  phoneScreen,
  routePoints,
  seaCableTip,
} from "./components/ThreeKitProps";

const display = loadSora("normal", { weights: ["600", "800"], subsets: ["latin"] }).fontFamily;
const label = loadChakra("normal", { weights: ["600", "700"], subsets: ["latin"] }).fontFamily;

export const DEMO = 120;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ramp = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const world = (local: THREE.Vector3, pos: THREE.Vector3, rot: THREE.Euler, s: number) => local.clone().multiplyScalar(s).applyEuler(rot).add(pos);

/* ---------- 2D layers ---------- */
const Frame: React.FC<{ bg: string; n: number; kicker: string; title: string; parts: string; children: React.ReactNode }> = ({ bg, n, kicker, title, parts, children }) => (
  <AbsoluteFill style={{ background: bg }}>
    {children}
    <div style={{ position: "absolute", left: 70, right: 70, top: 150 }}>
      <div style={{ fontFamily: label, fontWeight: 700, fontSize: 30, letterSpacing: 5, color: C3.cyan }}>
        ASET 3D · {String(n).padStart(2, "0")} · {kicker}
      </div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 70, lineHeight: 1.05, color: "#fff", marginTop: 14, textShadow: "0 6px 30px rgba(0,0,0,0.45)" }}>{title}</div>
      <div style={{ fontFamily: label, fontWeight: 600, fontSize: 28, color: "rgba(255,255,255,0.72)", marginTop: 18 }}>{parts}</div>
    </div>
  </AbsoluteFill>
);

const Tag: React.FC<{ at: { x: number; y: number }; text: string; color?: string; show?: number; dx?: number; dy?: number }> = ({ at, text, color = C3.cyan, show = 1, dx = 0, dy = 0 }) =>
  show <= 0 ? null : (
    <div
      style={{
        position: "absolute",
        left: at.x + dx,
        top: at.y + dy,
        transform: `translate(-50%, -50%) scale(${0.7 + 0.3 * show})`,
        opacity: show,
        fontFamily: label,
        fontWeight: 700,
        fontSize: 30,
        letterSpacing: 2,
        color: "#0B1020",
        background: color,
        padding: "8px 18px",
        borderRadius: 999,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );

/* ---------- 01 · BTS palsu ---------- */
export const BtsPalsu: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cam: Cam = { position: v(-0.3 + Math.sin(f / 90) * 0.4, 1.0, 9.4), target: v(0, -0.7, 0), fov: 42 };
  const towerPos = v(-1.45, -2.9, -3.4);
  const ts = 0.9;
  const top = world(TOWER.top, towerPos, new THREE.Euler(), ts);
  const carX = interpolate(f, [0, 42], [3.6, 0.8], { ...clamp, easing: Easing.out(Easing.cubic) });
  const carRot = new THREE.Euler(0, -0.5, 0);
  const cs = 0.7;
  const carPos = v(carX, -2.9, 0.4);
  const rig = world(CAR.rig, carPos, carRot, cs);
  const phone = v(0.55, 0.35, 1.6);
  const sw = f >= 58;
  const ph = toScreen(phone, cam, width, height);
  const screen = sw
    ? phoneScreen({ net: "2G", bars: 4, title: "Pesan", bubbles: [{ text: "Poin kamu 25.000 hangus malam ini. Tukarkan sekarang lewat link berikut", warn: ramp(f, 86, 87) > 0 }] })
    : phoneScreen({ net: "4G", bars: 2, title: "Pesan" });
  return (
    <Frame bg="radial-gradient(120% 80% at 50% 30%, #18306b 0%, #0a1433 60%, #060b1f 100%)" n={1} kicker="BTS PALSU" title="BTS asli vs BTS palsu di mobil" parts="Tower3D · Car3D antenna · SignalWaves · Phone3D">
      <Stage3D cam={cam} stars={false}>
        <Floor3D position={[0, -2.9, 0]} size={14} opacity={0.35} />
        <Shadow3D position={[carX, -2.89, 0.4]} size={2.4} />
        <Tower3D f={f} position={towerPos.toArray()} scale={ts} glow={C3.cyan} />
        <SignalWaves position={top} f={f} color={C3.cyan} reach={2.2} opacity={0.45} />
        <Car3D f={f} position={carPos.toArray()} rotation={carRot} scale={cs} antenna drive={carX * -1} />
        <SignalWaves position={rig} f={f} color={C3.coral} reach={3.2} period={28} opacity={0.95 * ramp(f, 30, 44)} />
        <Phone3D position={phone.toArray()} rotation={new THREE.Euler(0.06, -0.3 + Math.sin(f / 28) * 0.08, 0.05)} scale={0.36} texture={screen} />
        {!sw && <Signal from={top} to={phone} progress={ramp(f, 6, 26)} f={f} />}
        {sw && <Signal from={rig} to={phone} progress={ramp(f, 58, 74)} f={f} color={C3.coral} pulse="#FFFFFF" />}
      </Stage3D>
      <Tag at={ph} dx={-20} dy={-215} text={sw ? "NYANTOL KE BTS PALSU · 2G" : "4G · BTS ASLI"} color={sw ? C3.coral : C3.cyan} show={sw ? ramp(f, 74, 84) : 1 - ramp(f, 50, 58)} />
    </Frame>
  );
};

/* ---------- 02 · DDoS dari Indonesia ---------- */
const GR = 1.5;
const DDOS_TARGET: [number, number] = [35.68, 139.69];
const DDOS_SOURCES: [number, number][] = [
  [-6.2, 106.8],
  [-7.25, 112.75],
  [3.6, 98.7],
  [-5.13, 119.4],
  [-6.75, 111.04],
  [-1.27, 116.83],
  [-8.65, 115.22],
  [-0.95, 100.35],
  [-2.99, 104.76],
  [1.47, 124.84],
];
const DDOS_ARCS = DDOS_SOURCES.map((s, i) => arcPoints(s, DDOS_TARGET, GR, 0.45 + (i % 3) * 0.1));
// Indonesia as a few circles (one big circle would also catch the Philippines and Australia).
const INDONESIA = [
  { lat: 0, lon: 101, r: 7 },
  { lat: -7.2, lon: 110, r: 4 },
  { lat: 0, lon: 114, r: 6 },
  { lat: -2, lon: 121, r: 5 },
  { lat: -8.6, lon: 118, r: 4 },
  { lat: -4, lon: 136, r: 5 },
];
export const Ddos: React.FC = () => {
  const f = useCurrentFrame();
  const cam: Cam = { position: v(0, 0.3, 9.6), target: v(0, -0.35, 0), fov: 42 };
  const rot = new THREE.Euler(0.22, yawFacing(8, 122) + (f - 60) * 0.0018, 0);
  return (
    <Frame bg="radial-gradient(120% 80% at 50% 35%, #2a1440 0%, #120a26 60%, #07050f 100%)" n={2} kicker="DDOS" title="Ribuan perangkat menyerang satu server" parts="HoloGlobe · GlobeArc · arcPoints · TvBox3D">
      <Stage3D cam={cam}>
        <group position={[0, 0.05, 0]}>
          <HoloGlobe radius={GR} rotation={rot} grid={0.12}>
            <LandDots radius={GR} color="#5FA8D8" px={3} highlight={INDONESIA.map((h) => ({ ...h, color: "#FF8A6A" }))} />
            {DDOS_SOURCES.map(([lat, lon], i) => (
              <GlobePin key={i} lat={lat} lon={lon} radius={GR} grow={ramp(f, i * 3, i * 3 + 10) * 0.55} color={C3.coral} />
            ))}
            <GlobePin lat={DDOS_TARGET[0]} lon={DDOS_TARGET[1]} radius={GR} grow={1} color="#FF2D55" ripple={f - 50} />
            {DDOS_ARCS.map((pts, i) => (
              <GlobeArc key={i} points={pts} progress={ramp(f, 10 + i * 4, 44 + i * 4)} f={f + i * 7} color={i % 2 ? C3.coral : "#FF2D55"} />
            ))}
          </HoloGlobe>
        </group>
        <TvBox3D f={f} position={[0, -2.45, 2.4]} rotation={new THREE.Euler(0.42, -0.45 + f * 0.004, 0)} scale={0.6} infected={1} />
      </Stage3D>
    </Frame>
  );
};

/* ---------- 03 · STB jadi botnet ---------- */
export const TvBoxBotnet: React.FC = () => {
  const f = useCurrentFrame();
  const cam: Cam = { position: v(0, 1.2, 8.6), target: v(0, -0.9, 0), fov: 42 };
  const inf = ramp(f, 28, 44);
  return (
    <Frame bg="radial-gradient(120% 80% at 50% 40%, #1d2238 0%, #0d1020 60%, #05060c 100%)" n={3} kicker="STB ANDROID" title="TV box murah diam-diam kerja buat botnet" parts="TvBox3D infected · ServerRack3D alarm · Floor3D">
      <Stage3D cam={cam} stars={false}>
        <Floor3D position={[0, -2.6, 0]} size={14} opacity={0.3} color={inf > 0.5 ? C3.coral : C3.cyan} />
        {[-1.2, 0, 1.2].map((x, i) => (
          <ServerRack3D key={x} f={f} position={[x, -2.6, -3.2]} seed={i} load={0.3 + inf * 0.7} alarm={ramp(f, 70 + i * 6, 80 + i * 6)} />
        ))}
        <Shadow3D position={[0, -2.59, 1]} size={3.2} />
        <TvBox3D f={f} position={[0, -1.1, 1]} rotation={new THREE.Euler(0.42, -0.5 + f * 0.005, 0)} scale={1.5} infected={inf} />
        {inf > 0 && <SignalWaves position={[0, -1.1, 1]} f={f} color={C3.coral} flat reach={2.6} period={24} opacity={0.8 * inf} />}
      </Stage3D>
    </Frame>
  );
};

/* ---------- 04 · Data center AI di orbit ---------- */
const SATS: { p: [number, number, number]; s: number }[] = [
  { p: [-0.75, 1.0, -1], s: 0.36 },
  { p: [0.7, 0.05, 0], s: 0.4 },
  { p: [-0.5, -1.05, 0.9], s: 0.42 },
];
export const OrbitDc: React.FC = () => {
  const f = useCurrentFrame();
  const cam: Cam = { position: v(0, 0.3, 9), target: v(0, -0.3, 0), fov: 42 };
  const rot = (i: number) => new THREE.Euler(0.25, -0.35 + Math.sin(f / 60 + i) * 0.06, 0.05 * i);
  const pos = (i: number) => v(SATS[i].p[0] + Math.sin(f / 70 + i) * 0.05, SATS[i].p[1] + Math.cos(f / 55 + i * 2) * 0.04, SATS[i].p[2]);
  const laser = (i: number) => world(SOLAR_SAT.laser, pos(i), rot(i), SATS[i].s);
  return (
    <Frame bg="radial-gradient(70% 30% at 88% 80%, rgba(255,214,120,0.75) 0%, rgba(255,150,60,0.22) 35%, rgba(0,0,0,0) 70%), radial-gradient(120% 90% at 30% 10%, #1a2f6b 0%, #081233 55%, #030616 100%)" n={4} kicker="AI DI LUAR ANGKASA" title="Data center AI tenaga matahari, di orbit" parts="SolarSat3D · Signal (laser) · HoloGlobe">
      <Stage3D cam={cam}>
        <group position={[0, -5.4, -1.5]}>
          <HoloGlobe radius={3.4} rotation={new THREE.Euler(0.5, yawFacing(10, 105) + f * 0.002, 0)} grid={0.14}>
            <LandDots radius={3.4} px={4.2} color="#8FDcff" />
          </HoloGlobe>
        </group>
        {SATS.map((s, i) => (
          <SolarSat3D key={i} f={f} seed={i} position={pos(i).toArray()} rotation={rot(i)} scale={s.s} />
        ))}
        <Signal from={laser(0)} to={laser(1)} progress={ramp(f, 20, 40)} f={f} color="#3DF5A8" pulse="#FFFFFF" />
        <Signal from={laser(1)} to={laser(2)} progress={ramp(f, 38, 58)} f={f} color="#3DF5A8" pulse="#FFFFFF" />
      </Stage3D>
    </Frame>
  );
};

/* ---------- 05 · Stiker QR palsu ---------- */
export const QrPalsu: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cam: Cam = { position: v(0, 0.6, 7.4), target: v(0, -0.45, 0), fov: 42 };
  const pos = v(0, -2.0, 0);
  const sticker = ramp(f, 8, 34);
  const peel = ramp(f, 70, 96);
  const at = toScreen(v(0, -0.6, 0.5), cam, width, height);
  return (
    <Frame bg="linear-gradient(180deg, #2b1d14 0%, #160f0b 100%)" n={5} kicker="QUISHING" title="Stiker QR palsu ditempel di atas yang asli" parts="QrStand3D sticker + peel · Shadow3D">
      <Stage3D cam={cam} stars={false}>
        <mesh position={[0, -2.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 14]} />
          <meshStandardMaterial color="#6b4a33" roughness={0.8} />
        </mesh>
        <Shadow3D position={[0, -2.0, 0.1]} size={2.8} opacity={0.6} />
        <QrStand3D f={f} position={pos.toArray()} rotation={new THREE.Euler(0, -0.32 + f * 0.0035, 0)} scale={1.45} sticker={sticker} peel={peel} />
      </Stage3D>
      <Tag at={at} dy={-560} text="STIKER PALSU" color={C3.coral} show={ramp(f, 30, 40) * (1 - ramp(f, 66, 72))} />
      <Tag at={at} dy={-560} text="KODE ASLI DI BAWAHNYA" color="#3DF5A8" show={ramp(f, 92, 102)} />
    </Frame>
  );
};

/* ---------- 06 · Kloning suara ---------- */
export const KlonSuara: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cam: Cam = { position: v(0, 0, 9.2), target: v(0, -0.75, 0), fov: 42 };
  const out = ramp(f, 52, 70);
  const w = interpolate(f, [18, 58], [-0.3, 3.3], clamp);
  return (
    <Frame bg="radial-gradient(120% 80% at 50% 40%, #13294f 0%, #0a1430 60%, #050a1a 100%)" n={6} kicker="KLONING SUARA" title="Beberapa detik suaramu, jadi suara tiruan" parts="Waveform3D · NeuralNet3D">
      <Stage3D cam={cam}>
        <Waveform3D f={f} position={[0, 0.55, 0]} width={3.2} level={1} />
        <NeuralNet3D f={f} position={[0, -1.15, 0]} rotation={new THREE.Euler(0.15, Math.sin(f / 40) * 0.35, -Math.PI / 2)} scale={0.6} wave={w} />
        <Waveform3D f={f} position={[0, -2.9, 0]} width={3.2} level={out} seed={5} color="#FF6A4D" color2="#FF4D8D" />
      </Stage3D>
      <Tag at={toScreen(v(-1.15, 0.55, 0), cam, width, height)} dy={-95} text="SUARA ASLI" />
      <Tag at={toScreen(v(1.0, -2.9, 0), cam, width, height)} dy={-95} text="SUARA TIRUAN AI" color={C3.coral} show={out} />
    </Frame>
  );
};

/* ---------- 07 · Chip NPU ---------- */
export const ChipNpu: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cam: Cam = { position: v(0, 0.6, 7.6), target: v(0, -0.55, 0), fov: 42 };
  const pos = v(0, -0.9, 0);
  const rot = new THREE.Euler(0.72, -0.55 + f * 0.0035, 0);
  const s = 0.82;
  const open = ramp(f, 8, 42);
  const show = ramp(f, 40, 52);
  const tag = (k: keyof typeof CHIP_BLOCKS) => toScreen(world(CHIP_BLOCKS[k], pos, rot, s), cam, width, height);
  return (
    <Frame bg="radial-gradient(120% 80% at 50% 40%, #241a4a 0%, #100c26 60%, #06050f 100%)" n={7} kicker="NPU" title="Isi chip HP & laptop: CPU, GPU, NPU" parts="Chip3D open + active · CHIP_BLOCKS">
      <Stage3D cam={cam} stars={false}>
        <Chip3D f={f} position={pos.toArray()} rotation={rot} scale={s} open={open} active={f > 56 ? "npu" : null} />
      </Stage3D>
      <Tag at={tag("cpu")} text="CPU" color="#7FB0FF" show={show} dy={-10} />
      <Tag at={tag("gpu")} text="GPU" color="#7BE3A1" show={show} dy={-10} />
      <Tag at={tag("npu")} text="NPU · AI" color="#D9A6FF" show={show} dy={-10} />
      <Tag at={tag("ram")} text="MEMORI" color="#FFD08A" show={show} dy={-10} />
    </Frame>
  );
};

/* ---------- 08 · Kabel bawah laut ---------- */
export const KabelLaut: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cam: Cam = { position: v(0.9 + Math.sin(f / 70) * 0.25, 0.8, 6.8), target: v(-0.1, -0.9, 0), fov: 42 };
  const pos = v(-2.0, -1.05, -1.6);
  const rot = new THREE.Euler(0.0, -0.9, 0.04);
  const s = 0.95;
  const len = 7;
  const at = (x: number, y: number, z: number) => toScreen(world(v(x, y, z), pos, rot, s), cam, width, height);
  const show = (k: number) => ramp(f, 20 + k * 12, 30 + k * 12);
  return (
    <Frame bg="linear-gradient(180deg, #0f5674 0%, #0a3550 45%, #041622 100%)" n={8} kicker="KABEL BAWAH LAUT" title="Isi kabel internet di dasar laut" parts="SeaCable3D · Dust3D · Shadow3D">
      <Stage3D cam={cam} stars={false}>
        <fog attach="fog" args={["#0c4561", 7, 20]} />
        <mesh position={[0, -1.56, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#365E5A" roughness={1} />
        </mesh>
        <Shadow3D position={[0, -1.54, 0.8]} size={3} opacity={0.5} />
        <SeaCable3D f={f} position={pos.toArray()} rotation={rot} scale={s} len={len} />
        <Dust3D f={f} count={70} size={[9, 6, 6]} position={[0, 0, -1]} color="#CFEFFF" speed={0.003} />
      </Stage3D>
      <Tag at={at(len / 2 - 1.9, 0.5, 0)} dy={-60} dx={40} text="PELINDUNG PLASTIK" color="#E8ECF2" show={show(0)} />
      <Tag at={at(len / 2 - 0.75, -0.45, 0)} dy={80} dx={-60} text="KAWAT BAJA" color="#C9D2E3" show={show(1)} />
      <Tag at={at(len / 2 - 0.32, 0.3, 0)} dy={-90} dx={30} text="TEMBAGA" color="#F0A46A" show={show(2)} />
      <Tag at={toScreen(world(seaCableTip(len), pos, rot, s), cam, width, height)} dx={110} dy={40} text="SERAT KACA" color={C3.cyan} show={show(3)} />
    </Frame>
  );
};

/* ---------- 09 · Baterai panas ---------- */
export const BateraiPanas: React.FC = () => {
  const f = useCurrentFrame();
  const cam: Cam = { position: v(0, 0.3, 7.6), target: v(0, -0.6, 0), fov: 42 };
  const heat = ramp(f, 22, 66);
  return (
    <Frame bg={`radial-gradient(120% 80% at 50% 45%, ${heat > 0.5 ? "#4a1b14" : "#16304f"} 0%, #0b1120 65%, #05070d 100%)`} n={9} kicker="BATERAI" title="Ngecas sambil main game: baterai kepanasan" parts="Battery3D level · charging · heat · swell">
      <Stage3D cam={cam} stars={false}>
        <Battery3D f={f} position={[0, -0.95, 0]} rotation={new THREE.Euler(0.08, -0.35 - ramp(f, 58, 108) * 0.85 + Math.sin(f / 45) * 0.12, 0)} scale={1.3} level={0.82} charging heat={heat} swell={ramp(f, 62, 104) * 0.7} />
      </Stage3D>
    </Frame>
  );
};

/* ---------- 10 · Kabel fiber jangan ditekuk ---------- */
export const FiberTekuk: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cam: Cam = { position: v(0, 0.5, 9), target: v(0, -0.7, 0), fov: 42 };
  const los = f >= 66;
  const ontPos = v(0, -2.85, 0.8);
  const ontRot = new THREE.Euler(0.38, -0.32, 0);
  const led = (i: number) => toScreen(world(ontLed(i), ontPos, ontRot, 1.25), cam, width, height);
  return (
    <Frame bg="radial-gradient(120% 80% at 50% 40%, #12305e 0%, #091633 60%, #040915 100%)" n={10} kicker="FIBER OPTIK" title="Kabel kecil ditekuk, cahayanya bocor" parts="FiberCore3D bend · Ont3D los · ontLed">
      <Stage3D cam={cam} stars={false}>
        <FiberCore3D f={f} position={[0, 0.25, 0]} rotation={new THREE.Euler(0.22, -0.18, 0)} scale={0.7} len={4.2} bend={ramp(f, 14, 52)} />
        <Shadow3D position={[0, -2.86, 0.8]} size={3.2} />
        <Ont3D f={f} position={ontPos.toArray()} rotation={ontRot} scale={1.25} los={los} />
      </Stage3D>
      <Tag at={led(1)} dy={-80} text="PON" color={los ? "#5b6478" : "#3DF5A8"} />
      <Tag at={led(2)} dy={80} text="LOS MERAH" color={C3.coral} show={ramp(f, 66, 74)} />
    </Frame>
  );
};

/* ---------- 11 · Cloud = komputer orang lain ---------- */
export const CloudRack: React.FC = () => {
  const f = useCurrentFrame();
  const cam: Cam = { position: v(0, 0.8, 9.2), target: v(0, -0.6, 0), fov: 42 };
  const phone = v(-1.15, 0.15, 1.8);
  const cloud = v(0.25, 0.3, -0.6);
  const rackTop = v(0, -2.8 + RACK.h, -2.6);
  const reveal = ramp(f, 46, 70);
  return (
    <Frame bg="radial-gradient(120% 80% at 50% 35%, #173a73 0%, #0a1838 60%, #050b1c 100%)" n={11} kicker="CLOUD" title="'Cloud' itu komputer milik orang lain" parts="Cloud3D · ServerRack3D · Phone3D · Signal">
      <Stage3D cam={cam} stars={false}>
        <Floor3D position={[0, -2.8, 0]} size={14} opacity={0.3} />
        <Cloud3D f={f} position={cloud.toArray()} scale={0.85 - reveal * 0.15} />
        {[-1.15, 0, 1.15].map((x, i) => (
          <ServerRack3D key={x} f={f} position={[x, -2.8 - (1 - reveal) * 0.6, -2.6]} seed={i + 4} load={0.45} scale={[1, 0.4 + 0.6 * reveal, 1]} />
        ))}
        <Phone3D position={phone.toArray()} rotation={new THREE.Euler(0.05, 0.45, -0.05)} scale={0.36} texture={phoneScreen({ title: "Backup foto", big: `${Math.round(ramp(f, 6, 40) * 100)}%`, bigColor: "#7FE3FF" })} />
        <Signal from={phone} to={cloud} progress={ramp(f, 6, 30)} f={f} />
        <Signal from={cloud} to={rackTop} progress={ramp(f, 50, 72)} f={f} color={C3.sun} pulse="#FFFFFF" />
      </Stage3D>
    </Frame>
  );
};

/* ---------- 12 · Keamanan akun ---------- */
export const AkunAman: React.FC = () => {
  const f = useCurrentFrame();
  const cam: Cam = { position: v(0, 0.3, 8), target: v(0, -0.6, 0), fov: 42 };
  const bad = f < 56;
  return (
    <Frame bg="radial-gradient(120% 80% at 50% 40%, #12305e 0%, #0a1733 60%, #040915 100%)" n={12} kicker="AKUN AMAN" title="Gembok & perisai untuk 2FA, OTP, password" parts="Shield3D ok/bad/info · Padlock3D open">
      <Stage3D cam={cam} stars={false}>
        <Shield3D f={f} position={[0, 0.0, -0.6]} scale={0.95} state={bad ? "bad" : "ok"} pop={bad ? ramp(f, 4, 16) : ramp(f, 58, 70)} />
        <Padlock3D f={f} position={[0, -2.4, 0.9]} scale={0.9} open={1 - ramp(f, 26, 52)} />
      </Stage3D>
    </Frame>
  );
};

/* ---------- 13 · Rute kabel laut di peta ---------- */
// Waypoints keep each route at sea (around Sumatra's tip, south of Sri Lanka, through the
// Luzon Strait, along the Makassar Strait). Routes are illustrations, not real cable systems.
const KR = 1.6;
const CABLES: [number, number][][] = [
  [
    [-6.1, 106.8],
    [-3.2, 107.4],
    [1.2, 104.4],
  ],
  [
    [1.25, 104.0],
    [1.9, 102.2],
    [3.2, 100.6],
    [5.6, 97.6],
    [6.2, 94.5],
    [5.0, 80.5],
    [10, 62],
    [12.5, 45.5],
  ],
  [
    [1.35, 104.3],
    [8, 109],
    [15, 113],
    [22, 114.3],
    [21, 118],
    [21.2, 121],
    [26, 125],
    [30.5, 132],
    [35, 140],
  ],
  [
    [-8.8, 115.3],
    [-15, 117.5],
    [-25, 112],
    [-31.9, 115.6],
  ],
  [
    [-6.9, 112.75],
    [-6.4, 113.5],
    [-5.3, 119.2],
    [-3.5, 118.8],
    [-1.3, 116.9],
  ],
];
const CABLE_PTS = CABLES.map((w) => routePoints(w, KR, 0.012));
const CABLE_COL = [C3.sun, C3.cyan, "#3DF5A8", C3.coral, "#B15CFF"];
export const RuteKabel: React.FC = () => {
  const f = useCurrentFrame();
  const cam: Cam = { position: v(0, 0.2, 8.8), target: v(0, -0.35, 0), fov: 42 };
  const rot = new THREE.Euler(0.1, yawFacing(5, 108) + (f - 60) * 0.0018, 0);
  return (
    <Frame bg="radial-gradient(120% 80% at 50% 40%, #0d3350 0%, #06192e 60%, #030b17 100%)" n={13} kicker="RUTE KABEL" title="Kabel laut menyambung negara-negara" parts="HoloGlobe grid · LandDots · GlobeArc · routePoints">
      <Stage3D cam={cam}>
        <group position={[0, -0.1, 0]}>
          <HoloGlobe radius={KR} rotation={rot} grid={0.1}>
            <LandDots radius={KR} px={3.2} highlight={INDONESIA.map((h) => ({ ...h, color: "#FFD23F" }))} />
            {CABLE_PTS.map((pts, i) => (
              <GlobeArc key={i} points={pts} progress={ramp(f, 6 + i * 8, 46 + i * 8)} f={f + i * 9} color={CABLE_COL[i]} radius={0.009} speed={0.012} />
            ))}
            {CABLES.flatMap((w, i) =>
              [w[0], w[w.length - 1]].map((p, j) => <GlobePin key={`${i}${j}`} lat={p[0]} lon={p[1]} radius={KR} grow={ramp(f, 40 + i * 8, 50 + i * 8) * 0.4} color={CABLE_COL[i]} />),
            )}
          </HoloGlobe>
        </group>
      </Stage3D>
    </Frame>
  );
};

export const DEMOS: React.FC[] = [BtsPalsu, Ddos, TvBoxBotnet, OrbitDc, QrPalsu, KlonSuara, ChipNpu, KabelLaut, BateraiPanas, FiberTekuk, CloudRack, AkunAman, RuteKabel];

// All demos in a row, with a short fade between them.
export const Galeri: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#05070d" }}>
      {DEMOS.map((D, i) => {
        const local = f - i * DEMO;
        const o = interpolate(local, [0, 6, DEMO - 6, DEMO], [0, 1, 1, 0], clamp);
        return (
          <Sequence key={i} from={i * DEMO} durationInFrames={DEMO}>
            <AbsoluteFill style={{ opacity: i === 0 ? Math.max(o, local < 6 ? 1 : 0) : o }}>
              <D />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

