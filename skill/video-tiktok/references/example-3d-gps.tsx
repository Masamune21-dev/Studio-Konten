// Contoh adegan 3D (uji 8 Okt 2026): globe digital, tiga satelit GPS mengorbit, sinyal
// dari tiap satelit ke HP di Yogyakarta, lalu posisi "terkunci" saat sinyal ketiga tiba.
// Host (PNG anime dari Studio → Media) dan kartu teks adalah lapisan 2D di atasnya.
// Semua bagian 3D dari components/ThreeKit.tsx.
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile } from "remotion";
import { useCurrentFrame, useVideoConfig } from "./components/Time";
import { loadFont as loadSora } from "@remotion/google-fonts/Sora";
import { loadFont as loadChakra } from "@remotion/google-fonts/ChakraPetch";
import { C3, Cam, GlobePin, HoloGlobe, PathLine, Satellite, Signal, Stage3D, THREE, onSphere, orbit, toScreen, yawFacing } from "./components/ThreeKit";

const display = loadSora("normal", { weights: ["600", "800"], subsets: ["latin"] }).fontFamily;
const label = loadChakra("normal", { weights: ["600", "700"], subsets: ["latin"] }).fontFamily;

export const DURATION = 240;
const C = { ink: "#0E1A3A", white: "#FFFFFF" };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const R = 1.5; // globe radius
const RO = 2.75; // orbit radius
const PIN = { lat: -7.8, lon: 110.37 }; // Yogyakarta
const SIGNAL_START = [52, 76, 100];
const TRAVEL = 22;
const LOCK = SIGNAL_START[2] + TRAVEL + 4; // the third signal arrives
const TARGET = new THREE.Vector3(0, -0.55, 0); // looking below the globe puts it high in the frame

// The globe turns so that the pin faces the camera when the position locks.
const globeRot = (f: number) => new THREE.Euler(0.18, yawFacing(PIN.lat, PIN.lon) + (f - LOCK) * 0.0045, 0, "XYZ");
const pinWorld = (f: number, r = R) => onSphere(PIN.lat, PIN.lon, r).applyEuler(globeRot(f));

const camAt = (f: number): Cam => {
  const ease = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  const d = interpolate(f, [0, LOCK, DURATION], [13.5, 10.6, 10.1], ease);
  const sway = interpolate(f, [0, DURATION], [-0.3, 0.2], ease);
  const lift = interpolate(f, [0, DURATION], [1.6, 0.6], ease);
  return { position: new THREE.Vector3(Math.sin(sway) * d, TARGET.y + lift, Math.cos(sway) * d), target: TARGET, fov: 42 };
};

// Solved from screen targets (upper left, upper right, lower right of the globe at frame 110)
// so all three stay below the headline and move ±135–170 px over the clip.
const ORBITS = [
  orbit([-1.23, 0.9, 2.29], [2.13, -0.89, 1.49], RO, 0.0025, 110),
  orbit([0.69, 1.1, 2.42], [2.22, -1.62, 0.1], RO, 0.0025, 110),
  orbit([0.84, -0.4, 2.59], [2.55, -0.47, -0.91], RO, 0.0025, 110),
];
const RINGS = ORBITS.map((o) => o.ring());

const Card: React.FC<{ f: number; from: number; to: number; step: string; text: React.ReactNode }> = ({ f, from, to, step, text }) => {
  const { fps } = useVideoConfig();
  const inn = spring({ frame: f - from, fps, config: { damping: 14, stiffness: 140 } });
  const out = interpolate(f, [to - 8, to], [1, 0], clamp);
  if (f < from || f > to) return null;
  return (
    <div style={{ position: "absolute", right: 36, bottom: 560, width: 430, opacity: Math.min(inn, out), transform: `translateY(${(1 - inn) * 40}px)` }}>
      <div style={{ background: C.white, borderRadius: 28, padding: "26px 30px", boxShadow: "0 18px 50px rgba(0,0,0,0.35)" }}>
        <div style={{ fontFamily: label, fontWeight: 700, fontSize: 26, letterSpacing: 3, color: C3.blue }}>{step}</div>
        <div style={{ fontFamily: display, fontWeight: 600, fontSize: 40, lineHeight: 1.15, color: C.ink, marginTop: 8 }}>{text}</div>
      </div>
    </div>
  );
};

export const Gps3D: React.FC = () => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cam = camAt(f);
  const head = spring({ frame: f + 8, fps, config: { damping: 16, stiffness: 120 } }); // already mostly in at frame 0
  const pinIn = spring({ frame: f - 30, fps, config: { damping: 12, stiffness: 140 } });
  const locked = spring({ frame: f - LOCK, fps, config: { damping: 9, stiffness: 160 } });
  const pinPop = pinIn * (1 + 0.35 * locked * Math.max(0, 1 - (f - LOCK) / 25));
  const pose = f < LOCK ? "raka-jelaskan" : "raka-ingatkan";
  const pop = f >= LOCK ? spring({ frame: f - LOCK, fps, config: { damping: 10, stiffness: 220 } }) : 1;
  // The pin faces the camera, so the chip is lifted in screen space, not along the pin.
  const chip = toScreen(pinWorld(f, R + 0.2), cam, width, height);
  const chipIn = spring({ frame: f - LOCK - 4, fps, config: { damping: 12, stiffness: 160 } });
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 38%, #16306e 0%, #0a1433 45%, #050914 100%)" }}>
      <Stage3D cam={cam}>
        <HoloGlobe radius={R} rotation={globeRot(f)}>
          <GlobePin lat={PIN.lat} lon={PIN.lon} radius={R} grow={pinPop} color={f >= LOCK ? C3.coral : C3.sun} ripple={f >= LOCK ? f - LOCK : undefined} />
        </HoloGlobe>
        {RINGS.map((pts, k) => (
          <PathLine key={k} points={pts} />
        ))}
        {ORBITS.map((o, k) => (
          <Satellite key={k} seed={k} f={f} position={o.at(f)} />
        ))}
        {ORBITS.map((o, k) => (
          <Signal
            key={k}
            f={f - SIGNAL_START[k]}
            from={o.at(f)}
            to={pinWorld(f, R + 0.2)}
            progress={interpolate(f, [SIGNAL_START[k], SIGNAL_START[k] + TRAVEL], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) })}
          />
        ))}
      </Stage3D>

      <div style={{ position: "absolute", left: 70, right: 70, top: 120, transform: `translateY(${(1 - head) * -30}px)`, opacity: head }}>
        <div style={{ fontFamily: label, fontWeight: 700, fontSize: 34, letterSpacing: 7, color: C3.cyan }}>GPS · CARA KERJANYA</div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 96, lineHeight: 1.0, color: C.white, marginTop: 14, letterSpacing: -2 }}>
          HP kamu dengerin <span style={{ color: C3.sun }}>3 satelit</span> sekaligus
        </div>
      </div>

      {f >= LOCK && (
        <div
          style={{
            position: "absolute",
            left: chip.x,
            top: chip.y - 95,
            transform: `translate(-50%, -100%) scale(${chipIn})`,
            background: C3.coral,
            color: C.white,
            fontFamily: label,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: 2,
            padding: "10px 20px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          KAMU DI SINI · YOGYAKARTA
        </div>
      )}

      <Img
        src={staticFile(`img/${pose}.png`)}
        style={{ position: "absolute", left: -10, bottom: -20 + Math.sin(f / 14) * 6, height: 900, transform: `scale(${0.94 + 0.06 * pop})`, transformOrigin: "50% 100%" }}
      />

      <Card f={f} from={18} to={LOCK} step="1 · SATELIT KIRIM SINYAL" text={<>Isinya <b>jam super akurat</b> + posisi satelitnya</>} />
      <Card f={f} from={LOCK + 6} to={DURATION + 20} step="2 · HP HITUNG JARAK" text={<>3 jarak ketemu di <b>satu titik</b> = lokasimu</>} />
    </AbsoluteFill>
  );
};
