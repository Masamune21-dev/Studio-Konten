// More 3D props for ThreeKit scenes (9 Oct 2026): a BTS tower and radio waves, a van with a
// fake-BTS rig, routes over the globe, server racks, a chip with CPU/GPU/NPU blocks, an Android
// TV box, a QR standee with a sticker over it, an optical fibre in x-ray view, an ONT modem, a
// phone battery, a cloud, a neural network, a voice waveform, a solar satellite, a shield and
// a padlock. All are Three.js primitives (no downloaded models, no logos) and every motion is
// a function of the frame `f` or a 0..1 value the scene animates, so renders are repeatable.
// SKILL.md, "Adegan 3D", says which prop fits which topic; references/example-3d-props.tsx
// (the uji-3d-aset/ gallery) shows each one in a finished 9:16 scene.
import { useMemo } from "react";
import { random } from "remotion";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { C3, THREE, onSphere, rimMaterial } from "./ThreeKit";
import { WORLD_DOTS } from "./worldDots";

type V3 = [number, number, number];
type Placement = { position?: V3; rotation?: THREE.Euler; scale?: number | V3 };

/* ---------- helpers ---------- */
const UP = new THREE.Vector3(0, 1, 0);
const cl = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const blink = (f: number, period: number, on: number, phase = 0) => (((f + phase) % period) + period) % period < on;

// Rounded box geometry, cached by size (props are re-rendered every frame).
const rboxCache = new Map<string, THREE.BufferGeometry>();
export const roundedBox = (w: number, h: number, d: number, r: number, seg = 4) => {
  const k = `${w}|${h}|${d}|${r}|${seg}`;
  let g = rboxCache.get(k);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
    rboxCache.set(k, g);
  }
  return g;
};

// Solid rod between two points (tower legs and braces, antennas, booms).
export const Rod: React.FC<{ from: THREE.Vector3; to: THREE.Vector3; radius: number; color: string; metalness?: number; roughness?: number; glow?: number }> = ({
  from,
  to,
  radius,
  color,
  metalness = 0.45,
  roughness = 0.4,
  glow = 0,
}) => {
  const dir = to.clone().sub(from);
  const len = dir.length();
  if (len < 1e-6) return null;
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
  return (
    <mesh position={from.clone().add(to).multiplyScalar(0.5)} quaternion={q} scale={[radius, len, radius]}>
      <cylinderGeometry args={[1, 1, 1, 10]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} emissive={color} emissiveIntensity={glow} />
    </mesh>
  );
};

// Additive, unlit material for glows and light.
const Glow: React.FC<{ color: string; opacity?: number }> = ({ color, opacity = 1 }) => (
  <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
);

// Soft round glow that always faces the camera (sun, LED bloom, alarm light, light leaking out).
const radialTex = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
    grad.addColorStop(0.6, "rgba(255,255,255,0.12)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();
export const GlowSprite: React.FC<{ position: V3 | THREE.Vector3; size: number; color: string; opacity?: number }> = ({ position, size, color, opacity = 1 }) => (
  <sprite position={Array.isArray(position) ? position : (position.toArray() as V3)} scale={[size, size, 1]}>
    <spriteMaterial map={radialTex()} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
  </sprite>
);

/* ---------- ground ---------- */
// Glowing grid floor that fades out from the centre (needs a dark background: it is additive).
export const Floor3D: React.FC<{ position?: V3; size?: number; step?: number; color?: string; opacity?: number }> = ({
  position = [0, 0, 0],
  size = 12,
  step = 0.6,
  color = C3.cyan,
  opacity = 0.5,
}) => {
  const geo = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color(color);
    const R = size / 2;
    const fade = (x: number, z: number) => Math.pow(Math.max(0, 1 - Math.hypot(x, z) / R), 1.6);
    const add = (x0: number, z0: number, x1: number, z1: number) => {
      const a = fade(x0, z0);
      const b = fade(x1, z1);
      pos.push(x0, 0, z0, x1, 0, z1);
      col.push(c.r * a, c.g * a, c.b * a, c.r * b, c.g * b, c.b * b);
    };
    const n = Math.round(R / step);
    for (let i = -n; i <= n; i++)
      for (let j = -n; j < n; j++) {
        add(i * step, j * step, i * step, (j + 1) * step);
        add(j * step, i * step, (j + 1) * step, i * step);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, [size, step, color]);
  return (
    <lineSegments geometry={geo} position={position}>
      <lineBasicMaterial vertexColors transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </lineSegments>
  );
};

// Soft round contact shadow on the floor under an object (works on light and dark backgrounds).
let shadowTex: THREE.CanvasTexture | null = null;
export const Shadow3D: React.FC<{ position?: V3; size?: number; opacity?: number }> = ({ position = [0, 0, 0], size = 2.5, opacity = 0.55 }) => {
  if (!shadowTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(0.45, "rgba(0,0,0,0.55)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    shadowTex = new THREE.CanvasTexture(c);
  }
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={shadowTex} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
};

// Floating specks in a box (dust in a server room, marine snow under the sea, sparks).
export const Dust3D: React.FC<{ f: number; count?: number; size?: [number, number, number]; position?: V3; color?: string; speed?: number; seed?: string }> = ({
  f,
  count = 60,
  size = [8, 8, 4],
  position = [0, 0, 0],
  color = "#BFE9FF",
  speed = 0.004,
  seed = "dust",
}) => (
  <group position={position}>
    {Array.from({ length: count }, (_, i) => {
      const r = (k: string) => random(`${seed}${k}${i}`);
      const y = ((((r("y") + f * speed * (0.5 + r("v"))) % 1) + 1) % 1 - 0.5) * size[1];
      const x = (r("x") - 0.5) * size[0] + Math.sin(f / 50 + i) * 0.08;
      const z = (r("z") - 0.5) * size[2];
      return (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.012 + r("s") * 0.022, 6, 4]} />
          <meshBasicMaterial color={color} transparent opacity={0.35 + r("o") * 0.5} toneMapped={false} />
        </mesh>
      );
    })}
  </group>
);

/* ---------- light along a curve ---------- */
// Glowing tube along a curve between curve parameters a and b, a bright head while it grows,
// and sparks running along the lit part. Pass a memoised curve; the tube is rebuilt only when
// the lit length changes by more than 1/300.
export const GlowPath: React.FC<{
  curve: THREE.Curve<THREE.Vector3>;
  a?: number;
  b: number;
  f: number;
  color?: string;
  core?: string;
  radius?: number;
  sparks?: number;
  spark?: string;
  speed?: number;
}> = ({ curve, a = 0, b, f, color = C3.cyan, core = "#e9fbff", radius = 0.03, sparks = 3, spark = C3.sun, speed = 0.012 }) => {
  const qa = Math.round(cl(a) * 300) / 300;
  const qb = Math.round(cl(b) * 300) / 300;
  const tubes = useMemo(() => {
    if (qb - qa < 0.004) return null;
    const n = Math.max(2, Math.ceil((qb - qa) * 140));
    const sub = new THREE.CatmullRomCurve3(Array.from({ length: n + 1 }, (_, i) => curve.getPoint(qa + ((qb - qa) * i) / n)));
    return [new THREE.TubeGeometry(sub, n * 2, radius * 2.6, 10, false), new THREE.TubeGeometry(sub, n * 2, radius, 8, false)];
  }, [curve, qa, qb, radius]);
  if (!tubes) return null;
  return (
    <>
      <mesh geometry={tubes[0]}>
        <Glow color={color} opacity={0.24} />
      </mesh>
      <mesh geometry={tubes[1]}>
        <meshBasicMaterial color={core} transparent opacity={0.95} toneMapped={false} />
      </mesh>
      {qb < 1 && (
        <mesh position={curve.getPoint(qb)}>
          <sphereGeometry args={[radius * 2.6, 16, 12]} />
          <meshBasicMaterial color={spark} toneMapped={false} />
        </mesh>
      )}
      {Array.from({ length: sparks }, (_, k) => (
        <mesh key={k} position={curve.getPoint(qa + (((f * speed + k / sparks) % 1) + 1) % 1 * (qb - qa))}>
          <sphereGeometry args={[radius * 1.8, 14, 10]} />
          <meshBasicMaterial color={spark} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
};

/* ---------- globe routes ---------- */
// Great-circle arc from one [lat, lon] to another, lifted `height` at the middle. Height ≈ 0.02
// hugs the surface (undersea cable); 0.3–0.8 flies over it (attack traffic, data between cities).
export const arcPoints = (a: [number, number], b: [number, number], radius: number, height: number, n = 64) => {
  const A = onSphere(a[0], a[1], 1);
  const B = onSphere(b[0], b[1], 1);
  const ang = A.angleTo(B);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const v = ang < 1e-6 ? A.clone() : A.clone().multiplyScalar(Math.sin((1 - t) * ang) / Math.sin(ang)).add(B.clone().multiplyScalar(Math.sin(t * ang) / Math.sin(ang)));
    return v.setLength(radius + height * Math.sin(Math.PI * t));
  });
};

// A route through several [lat, lon] waypoints (keep a cable in the sea by adding corners).
export const routePoints = (way: [number, number][], radius: number, height = 0.012, n = 24) =>
  way.slice(1).flatMap((p, i) => arcPoints(way[i], p, radius, height, n).slice(i ? 1 : 0));

// Land dots as [lat, lon] (Natural Earth 1:50m land, packed in worldDots.ts by
// scripts/world-dots.mjs; ±25k dots 0.7° apart). Decoded once.
let landCache: [number, number][] | null = null;
export const landPoints = () => {
  if (landCache) return landCache;
  const raw = atob(WORLD_DOTS.bits);
  const out: [number, number][] = [];
  let k = 0;
  for (let i = 0; i < WORLD_DOTS.rows; i++) {
    const lat = -90 + (i + 0.5) * (180 / WORLD_DOTS.rows);
    const n = Math.max(1, Math.round((360 * Math.cos((lat * Math.PI) / 180)) / WORLD_DOTS.step));
    for (let j = 0; j < n; j++, k++) if ((raw.charCodeAt(k >> 3) >> (k & 7)) & 1) out.push([lat, -180 + ((j + 0.5) * 360) / n]);
  }
  landCache = out;
  return out;
};

// Round dot sprite for point clouds.
const dotTex = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(32, 32, 28, 0, Math.PI * 2);
    g.fill();
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();

// Dotted continents (Natural Earth, public domain). Use as a child of HoloGlobe so they turn
// with it, and pass the same radius. `highlight` recolours the dots within `r` degrees of a
// point (Indonesia, a country under attack); `px` is the dot size in pixels at 1080×1920.
// Points behind the globe are hidden by the sphere itself.
export type LandHighlight = { lat: number; lon: number; r: number; color: string };
export const LandDots: React.FC<{ radius: number; color?: string; px?: number; opacity?: number; highlight?: LandHighlight[] }> = ({
  radius,
  color = "#7FD8FF",
  px = 3.2,
  opacity = 0.95,
  highlight = [],
}) => {
  const key = JSON.stringify(highlight);
  const geo = useMemo(() => {
    const pts = landPoints();
    const pos = new Float32Array(pts.length * 3);
    const col = new Float32Array(pts.length * 3);
    const base = new THREE.Color(color);
    const hl = highlight.map((h) => ({ v: onSphere(h.lat, h.lon, 1), cos: Math.cos((h.r * Math.PI) / 180), c: new THREE.Color(h.color) }));
    pts.forEach(([lat, lon], i) => {
      const v = onSphere(lat, lon, radius * 1.004);
      pos.set([v.x, v.y, v.z], i * 3);
      const u = v.clone().normalize();
      const h = hl.find((x) => u.dot(x.v) >= x.cos);
      const c = h ? h.c : base;
      col.set([c.r, c.g, c.b], i * 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, color, key]);
  return (
    <points geometry={geo}>
      <pointsMaterial vertexColors map={dotTex()} size={px} sizeAttenuation={false} transparent opacity={opacity} alphaTest={0.4} depthWrite={false} toneMapped={false} />
    </points>
  );
};

// A route drawn on the globe: use as a child of HoloGlobe so it turns with it. `points` from
// arcPoints/routePoints, memoised (module constant or useMemo).
export const GlobeArc: React.FC<{ points: THREE.Vector3[]; progress: number; f: number; color?: string; radius?: number; spark?: string; sparks?: number; speed?: number }> = ({
  points,
  progress,
  f,
  color = C3.coral,
  radius = 0.011,
  spark = "#ffffff",
  sparks = 2,
  speed = 0.02,
}) => {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  return <GlowPath curve={curve} b={progress} f={f} color={color} core={color} radius={radius} sparks={progress >= 1 ? sparks : 0} spark={spark} speed={speed} />;
};

/* ---------- radio ---------- */
// Waves spreading from a point. Default: full rings in a vertical plane facing +z (radio from a
// tower seen side-on). `arc` = [start, length] in radians draws only part of each ring (WiFi
// style, π/2 = up); `flat` lays them on the ground. Each wave lives `period` frames.
export const SignalWaves: React.FC<{
  position: V3 | THREE.Vector3;
  f: number;
  color?: string;
  count?: number;
  period?: number;
  reach?: number;
  width?: number;
  arc?: [number, number];
  flat?: boolean;
  rotation?: THREE.Euler;
  opacity?: number;
}> = ({ position, f, color = C3.cyan, count = 3, period = 42, reach = 2.4, width = 0.05, arc = [0, Math.PI * 2], flat = false, rotation, opacity = 0.85 }) => {
  const pos = Array.isArray(position) ? position : (position.toArray() as V3);
  const waves = Array.from({ length: count }, (_, k) => ((((f / period + k / count) % 1) + 1) % 1));
  return (
    <group position={pos} rotation={flat ? new THREE.Euler(-Math.PI / 2, 0, 0) : rotation}>
      {waves.map((t, k) => {
        const r = 0.1 + t * reach;
        return (
          <mesh key={k}>
            <ringGeometry args={[Math.max(0.001, r - width), r, 96, 1, arc[0], arc[1]]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={opacity * Math.pow(1 - t, 1.3) * cl(t * 6)}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// Lattice telecom tower (BTS): three tapering legs with X braces, red/white bands, three sector
// antennas, a microwave dish and a blinking aviation light. Base at the origin; TOWER.top is the
// antenna height in local space (start SignalWaves or Signal there). `glow` lights the antennas.
export const TOWER = { h: 4.2, top: new THREE.Vector3(0, 3.95, 0) };
export const Tower3D: React.FC<Placement & { f: number; bands?: boolean; glow?: string }> = ({ f, position, rotation, scale = 1, bands = true, glow }) => {
  const rods = useMemo(() => {
    const H = TOWER.h - 0.45;
    const levels = 10;
    const legAt = (k: number, y: number) => {
      const r = 0.52 - 0.36 * (y / H);
      const a = (k / 3) * Math.PI * 2 + Math.PI / 6;
      return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    };
    const out: { a: THREE.Vector3; b: THREE.Vector3; r: number; band: number }[] = [];
    for (let l = 0; l < levels; l++) {
      const y0 = (l / levels) * H;
      const y1 = ((l + 1) / levels) * H;
      for (let k = 0; k < 3; k++) {
        const k2 = (k + 1) % 3;
        out.push({ a: legAt(k, y0), b: legAt(k, y1), r: 0.036, band: l });
        out.push({ a: legAt(k, y0), b: legAt(k2, y1), r: 0.013, band: l });
        out.push({ a: legAt(k2, y0), b: legAt(k, y1), r: 0.013, band: l });
        out.push({ a: legAt(k, y1), b: legAt(k2, y1), r: 0.016, band: l });
      }
    }
    return out;
  }, []);
  const H = TOWER.h;
  const steel = "#B8C2D6";
  const lit = blink(f, 40, 16);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, -0.06, 0]}>
        <boxGeometry args={[1.5, 0.12, 1.5]} />
        <meshStandardMaterial color="#8C93A3" roughness={0.9} />
      </mesh>
      {rods.map((r, i) => (
        <Rod key={i} from={r.a} to={r.b} radius={r.r} color={bands ? (Math.floor(r.band / 2) % 2 ? "#F4F4F0" : "#E5402B") : steel} />
      ))}
      {/* mast, platform, sector antennas */}
      <Rod from={new THREE.Vector3(0, H - 0.5, 0)} to={new THREE.Vector3(0, H + 0.05, 0)} radius={0.05} color={steel} />
      <mesh position={[0, H - 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.022, 8, 40]} />
        <meshStandardMaterial color={steel} metalness={0.5} roughness={0.4} />
      </mesh>
      {[0, 1, 2].map((k) => (
        <group key={k} rotation={[0, (k / 3) * Math.PI * 2 + Math.PI / 6, 0]}>
          <Rod from={new THREE.Vector3(0, H - 0.25, 0)} to={new THREE.Vector3(0, H - 0.25, 0.3)} radius={0.02} color={steel} />
          <mesh position={[0, H - 0.25, 0.34]} geometry={roundedBox(0.2, 0.82, 0.08, 0.03)}>
            <meshStandardMaterial color="#F2F4F8" roughness={0.45} emissive={glow ?? "#000000"} emissiveIntensity={glow ? 0.55 : 0} />
          </mesh>
        </group>
      ))}
      {/* microwave dish, turned to the side so it reads as a dish */}
      <group position={[0.3, H - 1.25, 0.2]} rotation={[0, 1.0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.24, 0.24, 0.14, 32]} />
          <meshStandardMaterial color="#E9ECF2" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.075]} scale={[1, 1, 0.25]}>
          <sphereGeometry args={[0.24, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#DDE2EA" roughness={0.6} />
        </mesh>
      </group>
      <mesh position={[0, H + 0.1, 0]}>
        <sphereGeometry args={[0.06, 16, 12]} />
        <meshBasicMaterial color={lit ? "#FF4B3A" : "#5a1f1a"} toneMapped={false} />
      </mesh>
      {lit && (
        <mesh position={[0, H + 0.1, 0]}>
          <sphereGeometry args={[0.16, 16, 12]} />
          <Glow color="#FF4B3A" opacity={0.35} />
        </mesh>
      )}
    </group>
  );
};

// Small van, generic and without a logo, facing +x with its wheels on y = 0. `drive` is the
// distance travelled (turns the wheels). `antenna` adds a box with two whip antennas and a
// blinking LED on the roof: the fake BTS that drives around sending SMS. CAR.rig = its top.
export const CAR = { rig: new THREE.Vector3(-0.25, 2.3, 0) };
export const Car3D: React.FC<Placement & { f: number; drive?: number; color?: string; antenna?: boolean; lights?: boolean }> = ({
  f,
  position,
  rotation,
  scale = 1,
  drive = 0,
  color = "#E9EDF3",
  antenna = false,
  lights = true,
}) => {
  const paint = <meshStandardMaterial color={color} metalness={0.35} roughness={0.32} />;
  const spin = -drive / 0.27;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, 0.56, 0]} geometry={roundedBox(2.6, 0.66, 1.18, 0.16)}>
        {paint}
      </mesh>
      <mesh position={[-0.22, 1.1, 0]} geometry={roundedBox(1.85, 0.62, 1.1, 0.2)}>
        {paint}
      </mesh>
      {/* glass band all round the cabin, pillars over it */}
      <mesh position={[-0.2, 1.13, 0]} geometry={roundedBox(1.9, 0.4, 1.12, 0.12)}>
        <meshStandardMaterial color="#1A2436" metalness={0.6} roughness={0.12} />
      </mesh>
      {[-0.62, 0.18].map((x) => (
        <mesh key={x} position={[x, 1.13, 0]}>
          <boxGeometry args={[0.09, 0.42, 1.14]} />
          {paint}
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[2.66, 0.12, 1.2]} />
        <meshStandardMaterial color="#2B303B" roughness={0.7} />
      </mesh>
      {lights &&
        [-0.4, 0.4].map((z) => (
          <group key={z}>
            <mesh position={[1.29, 0.66, z]} geometry={roundedBox(0.05, 0.13, 0.26, 0.02)}>
              <meshBasicMaterial color="#FFF4C8" toneMapped={false} />
            </mesh>
            <mesh position={[-1.29, 0.66, z]} geometry={roundedBox(0.05, 0.13, 0.22, 0.02)}>
              <meshBasicMaterial color="#FF3B30" toneMapped={false} />
            </mesh>
          </group>
        ))}
      {[-0.85, 0.85].flatMap((x) =>
        [-0.56, 0.56].map((z) => (
          <group key={`${x}${z}`} position={[x, 0.27, z]} rotation={[Math.PI / 2, 0, 0]}>
            <group rotation={[0, spin, 0]}>
              <mesh>
                <cylinderGeometry args={[0.27, 0.27, 0.2, 28]} />
                <meshStandardMaterial color="#14161B" roughness={0.85} />
              </mesh>
              <mesh>
                <cylinderGeometry args={[0.15, 0.15, 0.215, 20]} />
                <meshStandardMaterial color="#AEB6C4" metalness={0.7} roughness={0.3} />
              </mesh>
              {[0, Math.PI / 2].map((a) => (
                <mesh key={a} rotation={[0, a, 0]}>
                  <boxGeometry args={[0.26, 0.222, 0.04]} />
                  <meshStandardMaterial color="#5C6473" metalness={0.6} roughness={0.35} />
                </mesh>
              ))}
            </group>
          </group>
        )),
      )}
      {antenna && (
        <group position={[-0.25, 1.41, 0]}>
          <mesh position={[0, 0.09, 0]} geometry={roundedBox(0.9, 0.18, 0.62, 0.05)}>
            <meshStandardMaterial color="#2A2F3A" roughness={0.5} metalness={0.3} />
          </mesh>
          {[-0.3, 0.3].map((x) => (
            <group key={x}>
              <Rod from={new THREE.Vector3(x, 0.18, 0.16)} to={new THREE.Vector3(x, 0.9, 0.16)} radius={0.018} color="#1B1F27" />
              <mesh position={[x, 0.9, 0.16]}>
                <sphereGeometry args={[0.035, 12, 8]} />
                <meshStandardMaterial color="#1B1F27" />
              </mesh>
            </group>
          ))}
          <mesh position={[0.32, 0.19, -0.2]}>
            <sphereGeometry args={[0.04, 12, 8]} />
            <meshBasicMaterial color={blink(f, 14, 6) ? "#FF3B30" : "#4a1512"} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  );
};

/* ---------- data centre ---------- */
// Server rack seen from the front: units with blinking LEDs, a light strip at the top. `load`
// 0..1 makes the LEDs busier and amber; `alarm` 0..1 turns it red with a pulsing halo (the
// target of a DDoS). RACK gives its size; the base sits on y = 0.
export const RACK = { w: 1.0, h: 2.3, d: 1.0 };
export const ServerRack3D: React.FC<Placement & { f: number; units?: number; load?: number; alarm?: number; seed?: number }> = ({
  f,
  position,
  rotation,
  scale = 1,
  units = 9,
  load = 0.2,
  alarm = 0,
  seed = 0,
}) => {
  const slot = (RACK.h - 0.36) / units;
  const step = Math.max(2, Math.round(7 - 5 * load));
  const tick = Math.floor(f / step);
  const strip = alarm > 0.05 ? (blink(f, 16, 8) ? "#FF3B30" : "#7a1712") : C3.cyan;
  const hot = cl(alarm) * (0.55 + 0.45 * Math.sin(f / 3));
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, RACK.h / 2, 0]} geometry={roundedBox(RACK.w, RACK.h, RACK.d, 0.05)}>
        <meshStandardMaterial color="#151A26" metalness={0.55} roughness={0.38} emissive="#FF1A10" emissiveIntensity={hot * 0.18} />
      </mesh>
      <mesh position={[0, RACK.h - 0.09, RACK.d / 2 + 0.006]}>
        <boxGeometry args={[RACK.w - 0.16, 0.035, 0.01]} />
        <meshBasicMaterial color={strip} toneMapped={false} />
      </mesh>
      {Array.from({ length: units }, (_, i) => {
        const y = 0.18 + slot * (i + 0.5);
        return (
          <group key={i} position={[0, y, RACK.d / 2 + 0.004]}>
            <mesh>
              <boxGeometry args={[RACK.w - 0.16, slot * 0.8, 0.012]} />
              <meshStandardMaterial color="#262D3D" metalness={0.4} roughness={0.5} />
            </mesh>
            {[-0.3, -0.22, -0.14, -0.06].map((x) => (
              <mesh key={x} position={[x, 0, 0.008]}>
                <boxGeometry args={[0.05, slot * 0.6, 0.004]} />
                <meshStandardMaterial color="#121722" />
              </mesh>
            ))}
            {[0, 1, 2, 3].map((j) => {
              const on = random(`rack${seed}-${i}-${j}-${tick}`) > 0.42;
              const busy = random(`busy${seed}-${i}-${j}`) < load;
              const col = alarm > 0.05 ? (on ? "#FF3B30" : "#3a0e0b") : on ? (busy ? "#FFB020" : j % 2 ? "#3BA7FF" : "#22E07A") : "#14261C";
              return (
                <mesh key={j} position={[0.14 + j * 0.065, 0, 0.012]}>
                  <boxGeometry args={[0.032, 0.032, 0.006]} />
                  <meshBasicMaterial color={col} toneMapped={false} />
                </mesh>
              );
            })}
          </group>
        );
      })}
      {alarm > 0.01 && <GlowSprite position={[0, RACK.h / 2, RACK.d / 2 + 0.1]} size={3.2} color="#FF2A1A" opacity={0.55 * hot} />}
    </group>
  );
};

/* ---------- chip ---------- */
// Processor package (phone/laptop chip): substrate with gold pads and traces, a die split into
// CPU, GPU, NPU (AI) and memory blocks, and a metal lid that lifts with `open` 0..1. `active`
// makes one block pulse; `traces` sends data pulses out to the pads. CHIP_BLOCKS gives each
// block's centre in local space (for 2D labels via toScreen).
export const CHIP_BLOCKS = {
  cpu: new THREE.Vector3(-0.31, 0.16, -0.31),
  gpu: new THREE.Vector3(0.31, 0.16, -0.31),
  npu: new THREE.Vector3(0.31, 0.16, 0.31),
  ram: new THREE.Vector3(-0.31, 0.16, 0.31),
};
const BLOCK_COLOR = { cpu: "#3B82F6", gpu: "#22C55E", npu: "#B15CFF", ram: "#F59E0B" };
type Block = keyof typeof CHIP_BLOCKS;
export const Chip3D: React.FC<Placement & { f: number; open?: number; active?: Block | null; traces?: boolean }> = ({
  f,
  position,
  rotation,
  scale = 1,
  open = 0,
  active = null,
  traces = true,
}) => {
  const { pads, lines, balls, grid } = useMemo(() => {
    const pads: { p: V3; s: V3 }[] = [];
    const lines: { a: THREE.Vector3; b: THREE.Vector3 }[] = [];
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < 9; i++) {
        const u = -0.88 + i * 0.22;
        const rot = (v: THREE.Vector3) => v.applyAxisAngle(UP, (k * Math.PI) / 2);
        const p = rot(new THREE.Vector3(u, 0.066, 1.08));
        pads.push({ p: p.toArray() as V3, s: k % 2 ? [0.16, 0.012, 0.09] : [0.09, 0.012, 0.16] });
        lines.push({ a: rot(new THREE.Vector3(u * 0.62, 0.064, 0.66)), b: rot(new THREE.Vector3(u, 0.064, 0.99)) });
      }
    }
    // solder balls under the package
    const n = 13;
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: "#C8CDD6", metalness: 0.85, roughness: 0.3 }), n * n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) im.setMatrixAt(i * n + j, m.makeTranslation(-1.02 + i * 0.17, -0.09, -1.02 + j * 0.17));
    im.instanceMatrix.needsUpdate = true;
    // circuit detail drawn on each block
    const seg: number[] = [];
    const add = (c: THREE.Vector3, cols: number, rows: number) => {
      for (let i = 1; i < cols; i++) seg.push(c.x - 0.27 + (0.54 * i) / cols, 0.172, c.z - 0.27, c.x - 0.27 + (0.54 * i) / cols, 0.172, c.z + 0.27);
      for (let j = 1; j < rows; j++) seg.push(c.x - 0.27, 0.172, c.z - 0.27 + (0.54 * j) / rows, c.x + 0.27, 0.172, c.z - 0.27 + (0.54 * j) / rows);
    };
    add(CHIP_BLOCKS.cpu, 2, 2);
    add(CHIP_BLOCKS.gpu, 5, 5);
    add(CHIP_BLOCKS.npu, 3, 3);
    add(CHIP_BLOCKS.ram, 1, 6);
    const grid = new THREE.BufferGeometry();
    grid.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    return { pads, lines, balls: im, grid };
  }, []);
  const lid = cl(open);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={roundedBox(2.4, 0.12, 2.4, 0.05)}>
        <meshStandardMaterial color="#123A2E" roughness={0.55} metalness={0.2} />
      </mesh>
      <primitive object={balls} />
      {pads.map((p, i) => (
        <mesh key={i} position={p.p}>
          <boxGeometry args={p.s} />
          <meshStandardMaterial color="#E7B43F" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
      {lines.map((l, i) => (
        <Rod key={i} from={l.a} to={l.b} radius={0.008} color="#D9A73A" metalness={0.8} roughness={0.3} />
      ))}
      {traces &&
        lines.map((l, i) => {
          const t = ((f * 0.03 + random(`tr${i}`)) % 1 + 1) % 1;
          return (
            <mesh key={i} position={l.a.clone().lerp(l.b, t)}>
              <sphereGeometry args={[0.022, 10, 8]} />
              <meshBasicMaterial color="#FFF2B0" toneMapped={false} />
            </mesh>
          );
        })}
      {/* die and blocks */}
      <mesh position={[0, 0.11, 0]} geometry={roundedBox(1.36, 0.07, 1.36, 0.02)}>
        <meshStandardMaterial color="#1A2133" metalness={0.5} roughness={0.3} />
      </mesh>
      {(Object.keys(CHIP_BLOCKS) as Block[]).map((k) => {
        const c = CHIP_BLOCKS[k];
        const on = active === k;
        const pulse = on ? 0.9 + 0.6 * Math.sin(f / 4) : active ? 0.12 : 0.35;
        return (
          <mesh key={k} position={[c.x, 0.155, c.z]}>
            <boxGeometry args={[0.56, 0.025, 0.56]} />
            <meshStandardMaterial color={BLOCK_COLOR[k]} emissive={BLOCK_COLOR[k]} emissiveIntensity={pulse} roughness={0.4} />
          </mesh>
        );
      })}
      <lineSegments geometry={grid}>
        <lineBasicMaterial color="#0B1020" transparent opacity={0.55} />
      </lineSegments>
      {active && (
        <mesh position={CHIP_BLOCKS[active]} scale={[1, 0.25, 1]}>
          <sphereGeometry args={[0.42, 24, 12]} />
          <Glow color={BLOCK_COLOR[active]} opacity={0.22 + 0.1 * Math.sin(f / 4)} />
        </mesh>
      )}
      {/* lid */}
      <group position={[0, 0.2 + lid * 1.25, -lid * 0.35]} rotation={[-lid * 0.35, 0, 0]}>
        <mesh geometry={roundedBox(1.56, 0.1, 1.56, 0.04)}>
          <meshStandardMaterial color="#E4EAF3" metalness={0.45} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.52, 4, 1, Math.PI / 4]} />
          <meshBasicMaterial color="#8E98AB" />
        </mesh>
      </group>
    </group>
  );
};

/* ---------- devices ---------- */
// Phone screen drawn on a canvas, for Phone3D's `texture`: status bar (time, network label
// such as "4G"/"2G", signal bars), an optional app title, chat/SMS bubbles (warn = red outline)
// and an optional big centred text. Cached by its options, so calling it every frame is cheap.
export type ScreenOpts = {
  bg?: [string, string];
  time?: string;
  net?: string;
  bars?: number;
  title?: string;
  bubbles?: { text: string; me?: boolean; warn?: boolean }[];
  big?: string;
  bigColor?: string;
};
const screenCache = new Map<string, THREE.CanvasTexture>();
export const phoneScreen = (o: ScreenOpts) => {
  const key = JSON.stringify(o);
  const hit = screenCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 450;
  c.height = 960;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 960);
  grad.addColorStop(0, o.bg?.[0] ?? "#13224a");
  grad.addColorStop(1, o.bg?.[1] ?? "#0a1230");
  g.fillStyle = grad;
  g.fillRect(0, 0, 450, 960);
  g.fillStyle = "#ffffff";
  g.font = "600 30px sans-serif";
  g.textBaseline = "middle";
  g.fillText(o.time ?? "20:45", 34, 50);
  const bars = o.bars ?? 4;
  for (let i = 0; i < 4; i++) {
    g.globalAlpha = i < bars ? 1 : 0.28;
    g.fillRect(392 + i * 13, 62 - (i + 1) * 8, 9, (i + 1) * 8);
  }
  g.globalAlpha = 1;
  if (o.net) {
    g.font = "bold 26px sans-serif";
    g.textAlign = "right";
    g.fillText(o.net, 382, 50);
    g.textAlign = "left";
  }
  let y = 100;
  if (o.title) {
    g.fillStyle = "rgba(255,255,255,0.1)";
    g.fillRect(0, 88, 450, 86);
    g.fillStyle = "#ffffff";
    g.font = "bold 32px sans-serif";
    g.fillText(o.title, 34, 131);
    y = 210;
  }
  const wrap = (text: string, max: number) => {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (g.measureText(t).width > max && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  };
  g.font = "28px sans-serif";
  for (const b of o.bubbles ?? []) {
    const lines = wrap(b.text, 300);
    const w = Math.min(340, Math.max(...lines.map((l) => g.measureText(l).width)) + 40);
    const h = lines.length * 38 + 30;
    const x = b.me ? 450 - 26 - w : 26;
    g.fillStyle = b.me ? "#2B6BFF" : "#ffffff";
    g.beginPath();
    g.roundRect(x, y, w, h, 22);
    g.fill();
    if (b.warn) {
      g.lineWidth = 6;
      g.strokeStyle = "#FF3B30";
      g.stroke();
    }
    g.fillStyle = b.me ? "#ffffff" : "#111827";
    lines.forEach((l, i) => g.fillText(l, x + 20, y + 34 + i * 38));
    y += h + 22;
  }
  if (o.big) {
    g.fillStyle = o.bigColor ?? "#ffffff";
    g.font = "bold 92px sans-serif";
    g.textAlign = "center";
    g.fillText(o.big, 225, 520);
    g.textAlign = "left";
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  screenCache.set(key, t);
  return t;
};

// Small LED clock display like the one on cheap TV boxes, drawn on a canvas.
const ledTex = new Map<string, THREE.CanvasTexture>();
const ledDisplay = (text: string, color: string) => {
  const k = `${text}|${color}`;
  let t = ledTex.get(k);
  if (!t) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 80;
    const g = c.getContext("2d")!;
    g.fillStyle = "#050608";
    g.fillRect(0, 0, 256, 80);
    g.font = "bold 62px 'Courier New', monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = color + "33";
    g.fillText("88:88", 128, 44);
    g.shadowColor = color;
    g.shadowBlur = 14;
    g.fillStyle = color;
    g.fillText(text, 128, 44);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    ledTex.set(k, t);
  }
  return t;
};

// Android TV box (generic, no logo) with an LED clock on the front and a WiFi antenna at the
// back. `infected` 0..1: the clock and LED turn red and blink, a red glow pulses around it (a
// box quietly working for a botnet). `time` is the clock text.
export const TvBox3D: React.FC<Placement & { f: number; infected?: number; time?: string }> = ({ f, position, rotation, scale = 1, infected = 0, time = "20:45" }) => {
  const bad = infected > 0.05;
  const led = bad ? (blink(f, 8, 4) ? "#FF3B30" : "#5a1410") : "#3BA7FF";
  const clock = ledDisplay(bad && !blink(f, 24, 16) ? "  :  " : time, bad ? "#FF3B30" : "#4FB4FF");
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={roundedBox(1.25, 0.28, 1.25, 0.12)}>
        <meshStandardMaterial color="#16181F" metalness={0.35} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.135, 0]} geometry={roundedBox(0.92, 0.02, 0.92, 0.01)}>
        <meshStandardMaterial color="#262A35" metalness={0.5} roughness={0.15} />
      </mesh>
      {/* diamond pattern on the lid, as on many cheap boxes */}
      {[-0.2, 0, 0.2].flatMap((x) =>
        [-0.2, 0, 0.2].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.147, z]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
            <planeGeometry args={[0.1, 0.1]} />
            <meshStandardMaterial color="#323746" metalness={0.6} roughness={0.2} />
          </mesh>
        )),
      )}
      {/* front: LED clock and status LED */}
      <mesh position={[-0.08, -0.005, 0.627]}>
        <planeGeometry args={[0.46, 0.144]} />
        <meshBasicMaterial map={clock} toneMapped={false} />
      </mesh>
      <mesh position={[0.36, -0.01, 0.628]}>
        <sphereGeometry args={[0.022, 12, 8]} />
        <meshBasicMaterial color={led} toneMapped={false} />
      </mesh>
      <GlowSprite position={[0.36, -0.01, 0.66]} size={0.22} color={led} opacity={0.7} />
      {/* ports and antenna at the back */}
      {[-0.35, -0.12, 0.1, 0.3].map((x, i) => (
        <mesh key={x} position={[x, -0.02, -0.626]}>
          <boxGeometry args={[i === 0 ? 0.12 : 0.14, i === 0 ? 0.05 : 0.07, 0.01]} />
          <meshStandardMaterial color="#05060A" />
        </mesh>
      ))}
      <group position={[0.48, 0.0, -0.66]} rotation={[-0.25, 0, -0.18]}>
        <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.08, 16]} />
          <meshStandardMaterial color="#C9A64A" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.48, 0]} geometry={roundedBox(0.09, 0.9, 0.09, 0.04)}>
          <meshStandardMaterial color="#14161C" roughness={0.45} />
        </mesh>
      </group>
      {bad && <GlowSprite position={[0, 0.1, 0]} size={2.6 + 0.4 * Math.sin(f / 2.5)} color="#FF2A1A" opacity={0.45 * infected} />}
    </group>
  );
};

// QR pattern on a canvas: three finder squares, timing lines and random modules. It is NOT a
// working code (nothing to scan by accident) and has no payment-brand logo.
const qrCanvas = (seed: string, size: number, header?: { text: string; color: string }, paper = "#ffffff") => {
  const c = document.createElement("canvas");
  const top = header ? Math.round(size * 0.27) : 0;
  c.width = size;
  c.height = size + top + (header ? Math.round(size * 0.1) : 0);
  const g = c.getContext("2d")!;
  g.fillStyle = paper;
  g.fillRect(0, 0, c.width, c.height);
  if (header) {
    g.fillStyle = header.color;
    g.fillRect(0, 0, c.width, top * 0.82);
    g.fillStyle = "#ffffff";
    g.font = `bold ${Math.round(size * 0.075)}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(header.text, c.width / 2, top * 0.41);
  }
  const n = 25;
  const pad = size * 0.08;
  const s = (size - pad * 2) / n;
  const finder = (i: number, j: number) => (i < 8 && j < 8) || (i >= n - 8 && j < 8) || (i < 8 && j >= n - 8);
  g.fillStyle = "#0B0F18";
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (finder(i, j)) continue;
      const on = i === 6 || j === 6 ? (i + j) % 2 === 0 : random(`qr-${seed}-${i}-${j}`) > 0.52;
      if (on) g.fillRect(pad + i * s, top + pad + j * s, s + 0.5, s + 0.5);
    }
  for (const [i, j] of [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ]) {
    const x = pad + i * s;
    const y = top + pad + j * s;
    g.fillRect(x, y, 7 * s, 7 * s);
    g.fillStyle = paper;
    g.fillRect(x + s, y + s, 5 * s, 5 * s);
    g.fillStyle = "#0B0F18";
    g.fillRect(x + 2 * s, y + 2 * s, 3 * s, 3 * s);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

// Acrylic QR standee at a shop counter. `sticker` 0..1 slides a different QR sticker over the
// printed one (a fake code stuck on top); `peel` 0..1 lifts it from the top edge to show the
// real code underneath. `title` is the band above the code (default "SCAN UNTUK BAYAR").
export const QrStand3D: React.FC<Placement & { f: number; sticker?: number; peel?: number; title?: string; color?: string }> = ({
  f,
  position,
  rotation,
  scale = 1,
  sticker = 0,
  peel = 0,
  title = "SCAN UNTUK BAYAR",
  color = "#D7263D",
}) => {
  const card = useMemo(() => qrCanvas("asli", 512, { text: title, color }), [title, color]);
  const fake = useMemo(() => qrCanvas("palsu", 512, undefined, "#F7F3EA"), []);
  // card 1.16 × 1.6 (canvas 512 × 704); QR square centre and size in card space
  const W = 1.16;
  const px = W / 512;
  const qrY = 0.8 - (138 + 256) * px;
  const qrS = 512 * px * 0.97;
  const sIn = cl(sticker);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, 0.06, 0.05]} geometry={roundedBox(1.55, 0.12, 0.75, 0.05)}>
        <meshStandardMaterial color="#F2F4F8" roughness={0.4} />
      </mesh>
      <group position={[0, 1.02, 0]} rotation={[-0.1, 0, 0]}>
        <mesh geometry={roundedBox(1.32, 1.86, 0.06, 0.04)}>
          <meshStandardMaterial color="#DFF6FF" transparent opacity={0.28} roughness={0.05} metalness={0.1} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, 0.033]}>
          <planeGeometry args={[W, 1.6]} />
          <meshStandardMaterial map={card} roughness={0.55} />
        </mesh>
        {sIn > 0.001 && (
          <group position={[0.02 + (1 - sIn) * 1.6, qrY + qrS / 2 + 0.03, 0.04 + (1 - sIn) * 0.3]} rotation={[0, (1 - sIn) * -0.8, -0.035]}>
            {/* shadow of the sticker edge on the card */}
            <mesh position={[0.015, -qrS / 2 - 0.015, 0.0005]}>
              <planeGeometry args={[qrS * 0.98 + 0.03, qrS * 0.98 + 0.03]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.22 * sIn * (1 - cl(peel))} depthWrite={false} />
            </mesh>
            <group rotation={[-cl(peel) * 1.9, 0, 0]}>
              <mesh position={[0, -qrS / 2, 0.002]}>
                <planeGeometry args={[qrS * 0.98, qrS * 0.98]} />
                <meshStandardMaterial map={fake} roughness={0.15} metalness={0.05} side={THREE.FrontSide} />
              </mesh>
              <mesh position={[0, -qrS / 2, 0.001]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[qrS * 0.98, qrS * 0.98]} />
                <meshStandardMaterial color="#E4E0D8" emissive="#8A867E" emissiveIntensity={0.6} roughness={0.8} side={THREE.FrontSide} />
              </mesh>
            </group>
          </group>
        )}
      </group>
    </group>
  );
};

/* ---------- fibre and modem ---------- */
// Optical fibre in x-ray view along x (−len/2 … len/2): see-through jacket, glass cladding,
// glowing core, light pulses bouncing inside the core. The right end is stripped to show the
// layers. `bend` 0..1 kinks the middle into a tight curve; past ±0.35 pulses leak out at the
// bend and the light after it dims (why the thin cable at the modem must not be folded).
export const FiberCore3D: React.FC<Placement & { f: number; bend?: number; len?: number; jacket?: string; core?: string; pulses?: number }> = ({
  f,
  position,
  rotation,
  scale = 1,
  bend = 0,
  len = 6,
  jacket = "#E8F1FF",
  core = C3.cyan,
  pulses = 12,
}) => {
  const b = Math.round(cl(bend) * 50) / 50;
  const L = len / 2;
  const { curve, tubes } = useMemo(() => {
    const pts: V3[] = [
      [-L, 0, 0],
      [-L * 0.55, 0, 0],
      [-0.8, 0, 0],
      [-0.34, -0.6 * b, 0.12 * b],
      [0, -1.2 * b, 0],
      [0.34, -0.6 * b, -0.12 * b],
      [0.8, 0, 0],
      [L * 0.55, 0, 0],
      [L, 0, 0],
    ];
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "centripetal");
    const part = (a: number, c: number, r: number) => {
      const n = 120;
      const sub = new THREE.CatmullRomCurve3(Array.from({ length: n + 1 }, (_, i) => curve.getPoint(a + ((c - a) * i) / n)));
      return new THREE.TubeGeometry(sub, 240, r, 24, false);
    };
    return {
      curve,
      tubes: { jacket: part(0, 0.86, 0.3), clad: part(0, 0.94, 0.16), coreA: part(0, 0.5, 0.06), coreB: part(0.5, 1, 0.06) },
    };
  }, [L, b]);
  const leak = cl((b - 0.35) / 0.5);
  const end = curve.getPoint(1);
  const endT = curve.getTangent(1);
  const qEnd = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), endT);
  const bendT = 0.44;
  const exitDir = curve.getTangent(bendT);
  const exitAt = curve.getPoint(bendT);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={tubes.jacket}>
        <meshStandardMaterial color={jacket} transparent opacity={0.13} roughness={0.4} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={tubes.clad}>
        <meshStandardMaterial color="#BFEFFF" transparent opacity={0.22} roughness={0.05} metalness={0.1} depthWrite={false} />
      </mesh>
      <mesh geometry={tubes.coreA}>
        <Glow color={core} opacity={0.85} />
      </mesh>
      <mesh geometry={tubes.coreB}>
        <Glow color={core} opacity={0.85 * (1 - 0.7 * leak)} />
      </mesh>
      {/* stripped end: jacket ring, cladding disc, bright core */}
      <group position={end} quaternion={qEnd}>
        <mesh>
          <circleGeometry args={[0.16, 40]} />
          <meshStandardMaterial color="#DFF7FF" transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 0.002]}>
          <circleGeometry args={[0.06, 24]} />
          <meshBasicMaterial color="#FFFFFF" toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 0.004]}>
          <circleGeometry args={[0.2 * (1 - 0.6 * leak), 24]} />
          <Glow color={core} opacity={0.35} />
        </mesh>
      </group>
      {/* pulses: zigzag inside the core; with a bend every third one escapes */}
      {Array.from({ length: pulses }, (_, k) => {
        const p = ((f / 80 + k / pulses) % 1 + 1) % 1;
        const escapes = leak > 0 && k % 2 === 0 && p > bendT;
        if (escapes) {
          const d = (p - bendT) * len * 0.9;
          const pos = exitAt.clone().add(exitDir.clone().multiplyScalar(d)).add(new THREE.Vector3(0, -d * 0.35, 0));
          const o = leak * cl(1 - d / 2.4);
          return (
            <group key={k}>
              <mesh position={pos}>
                <sphereGeometry args={[0.055, 12, 8]} />
                <meshBasicMaterial color="#FFD9C8" transparent opacity={o} toneMapped={false} />
              </mesh>
              <GlowSprite position={pos} size={0.45} color={C3.coral} opacity={o} />
            </group>
          );
        }
        const t = curve.getTangent(p);
        const nrm = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 0, 1)).normalize();
        const zig = Math.abs(((p * 46 + k * 0.37) % 2) - 1) * 2 - 1;
        const dim = p > 0.5 ? 1 - 0.7 * leak : 1;
        return (
          <mesh key={k} position={curve.getPoint(p).add(nrm.multiplyScalar(zig * 0.045))}>
            <sphereGeometry args={[0.045, 12, 8]} />
            <meshBasicMaterial color="#FFFBE0" transparent opacity={dim} toneMapped={false} />
          </mesh>
        );
      })}
      {leak > 0.02 && <GlowSprite position={curve.getPoint(0.5)} size={1.6} color={C3.coral} opacity={0.6 * leak * (1 + 0.3 * Math.sin(f / 3))} />}
    </group>
  );
};

// Submarine cable cut open at the +x end: black polyethylene jacket, a twisted ring of steel
// armour wires, copper sleeve, gel tube and coloured optical fibres in the middle whose tips
// blink with light. Each layer stops a little before the next so all of them show. The cable
// lies along x from −len/2; let the far end run off-screen. seaCableTip(len) = the fibre tips.
const FIBRE_COLORS = ["#2F6BFF", "#FF8A1F", "#22C55E", "#8B5A2B", "#8C99AD", "#F4F4F4", "#EF4444", "#FACC15"];
export const seaCableTip = (len = 6) => new THREE.Vector3(len / 2, 0, 0);
export const SeaCable3D: React.FC<Placement & { f: number; len?: number }> = ({ f, position, rotation, scale = 1, len = 6 }) => {
  const L = len / 2;
  const wires = useMemo(() => {
    const n = 20;
    return Array.from({ length: n }, (_, i) => {
      const pts = Array.from({ length: 81 }, (_, j) => {
        const x = -L + (j / 80) * (len - 0.55);
        const a = (i / n) * Math.PI * 2 + x * 0.9;
        return new THREE.Vector3(x, Math.cos(a) * 0.4, Math.sin(a) * 0.4);
      });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.058, 8, false);
    });
  }, [L, len]);
  const along = (r: number, from: number, to: number) => ({ position: [(from + to) / 2, 0, 0] as V3, rotation: new THREE.Euler(0, 0, Math.PI / 2), args: [r, r, to - from, 48] as [number, number, number, number] });
  const layer = (r: number, to: number, mat: React.ReactNode) => {
    const a = along(r, -L, to);
    return (
      <mesh position={a.position} rotation={a.rotation}>
        <cylinderGeometry args={a.args} />
        {mat}
      </mesh>
    );
  };
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {layer(0.5, L - 1.0, <meshStandardMaterial color="#16181E" roughness={0.55} metalness={0.1} />)}
      {/* white stripe printed along the jacket */}
      <mesh position={[-0.5, 0.0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.503, 0.503, len - 1.0, 48, 1, true, -0.12, 0.24]} />
        <meshStandardMaterial color="#E8ECF2" roughness={0.6} />
      </mesh>
      {wires.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#AEB7C6" metalness={0.85} roughness={0.28} />
        </mesh>
      ))}
      {layer(0.3, L - 0.32, <meshStandardMaterial color="#C8743A" metalness={0.85} roughness={0.28} />)}
      {layer(0.2, L - 0.14, <meshStandardMaterial color="#F3E7B0" transparent opacity={0.55} roughness={0.15} />)}
      {FIBRE_COLORS.map((c, i) => {
        const a = (i / FIBRE_COLORS.length) * Math.PI * 2;
        const y = Math.cos(a) * 0.1;
        const z = Math.sin(a) * 0.1;
        const on = (f + i * 5) % 20 < 12;
        return (
          <group key={i}>
            <mesh position={[0, y, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.028, 0.028, len, 12]} />
              <meshStandardMaterial color={c} roughness={0.35} />
            </mesh>
            <mesh position={[L + 0.002, y, z]} rotation={[0, Math.PI / 2, 0]}>
              <circleGeometry args={[0.028, 12]} />
              <meshBasicMaterial color={on ? "#FFFFFF" : "#6FD8FF"} toneMapped={false} />
            </mesh>
            {on && <GlowSprite position={[L + 0.05, y, z]} size={0.32} color={C3.cyan} opacity={0.8} />}
          </group>
        );
      })}
      {/* end faces of the cut layers */}
      {[
        [0.5, 0.0, L - 1.0, "#0E1015"],
        [0.3, 0.2, L - 0.32, "#D9894B"],
      ].map(([ro, ri, x, c]) => (
        <mesh key={String(x)} position={[x as number, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <ringGeometry args={[ri as number, ro as number, 48]} />
          <meshStandardMaterial color={c as string} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <GlowSprite position={[L + 0.15, 0, 0]} size={1.1} color={C3.cyan} opacity={0.35 + 0.15 * Math.sin(f / 4)} />
    </group>
  );
};

// Home fibre modem (ONT), white and without a logo, base on y = 0. LEDs POWER, PON, LOS, LAN,
// WLAN on the front; `los` makes LOS blink red and PON go dark (the fibre signal is lost) while
// LAN/WLAN keep blinking (WiFi on, internet off).
// ontLed(i) gives LED i in local space for 2D labels; `antennas` adds two at the back.
export const ONT_LEDS = ["POWER", "PON", "LOS", "LAN", "WLAN"] as const;
export const ontLed = (i: number) => new THREE.Vector3(-0.56 + i * 0.28, 0.2, 0.67);
export const Ont3D: React.FC<Placement & { f: number; los?: boolean; antennas?: boolean; body?: string }> = ({
  f,
  position,
  rotation,
  scale = 1,
  los = false,
  antennas = true,
  body = "#F4F6FA",
}) => {
  const led = (i: number) => {
    if (i === 0) return "#22E07A";
    if (i === 1) return los ? "#1d2430" : "#22E07A";
    if (i === 2) return los && blink(f, 18, 12) ? "#FF3B30" : "#1d2430";
    // LAN and WLAN stay on with LOS: the WiFi works, the internet behind it does not
    return blink(f, 9 + i * 2, 6, i * 3) ? "#22E07A" : "#1d2430";
  };
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, 0.2, 0]} geometry={roundedBox(1.9, 0.4, 1.32, 0.14)}>
        <meshStandardMaterial color={body} roughness={0.32} metalness={0.05} />
      </mesh>
      {[-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45].map((x) => (
        <mesh key={x} position={[x, 0.402, -0.2]}>
          <boxGeometry args={[0.07, 0.006, 0.55]} />
          <meshStandardMaterial color="#C9CFDA" />
        </mesh>
      ))}
      <mesh position={[0, 0.2, 0.664]} geometry={roundedBox(1.46, 0.14, 0.02, 0.006)}>
        <meshStandardMaterial color="#1B2130" roughness={0.2} />
      </mesh>
      {ONT_LEDS.map((_, i) => {
        const c = led(i);
        const on = c !== "#1d2430";
        return (
          <group key={i} position={ontLed(i)}>
            <mesh>
              <sphereGeometry args={[0.03, 12, 8]} />
              <meshBasicMaterial color={c} toneMapped={false} />
            </mesh>
            {on && (
              <mesh>
                <sphereGeometry args={[0.075, 12, 8]} />
                <Glow color={c} opacity={0.3} />
              </mesh>
            )}
          </group>
        );
      })}
      {/* optical port (green SC/APC) at the back */}
      <mesh position={[0.6, 0.18, -0.67]}>
        <boxGeometry args={[0.16, 0.11, 0.05]} />
        <meshStandardMaterial color="#1FA855" roughness={0.4} />
      </mesh>
      {antennas &&
        [-0.75, 0.75].map((x) => (
          <group key={x} position={[x, 0.36, -0.52]} rotation={[-0.08, 0, x > 0 ? -0.12 : 0.12]}>
            <mesh position={[0, 0.58, 0]} geometry={roundedBox(0.11, 1.1, 0.06, 0.03)}>
              <meshStandardMaterial color={body} roughness={0.35} />
            </mesh>
          </group>
        ))}
    </group>
  );
};

/* ---------- battery ---------- */
// Lightning bolt outline (charging symbol), extruded.
const boltGeo = (() => {
  let g: THREE.ExtrudeGeometry | null = null;
  return () => {
    if (g) return g;
    const s = new THREE.Shape();
    [
      [0.08, 0.5],
      [-0.22, -0.04],
      [-0.02, -0.04],
      [-0.1, -0.5],
      [0.24, 0.08],
      [0.03, 0.08],
    ].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
    return g;
  };
})();

// Phone battery (pouch cell) in a glass shell: the charge `level` 0..1 fills it (green → amber →
// red), `charging` shows a bolt and rising sparks, `heat` 0..1 turns the edge glow orange-red
// and sends heat specks up, and `swell` 0..1 puffs it up (a swollen battery).
export const Battery3D: React.FC<Placement & { f: number; level?: number; charging?: boolean; heat?: number; swell?: number }> = ({
  f,
  position,
  rotation,
  scale = 1,
  level = 0.7,
  charging = false,
  heat = 0,
  swell = 0,
}) => {
  const hot = cl(heat);
  const rim = useMemo(() => rimMaterial(C3.cyan, 2.4, 1.0, THREE.FrontSide), []);
  (rim.uniforms.color.value as THREE.Color).set(C3.cyan).lerp(new THREE.Color("#FF5A2A"), hot);
  const lv = cl(level);
  const h = 1.86 * lv;
  const fill = lv > 0.5 ? "#22C55E" : lv > 0.2 ? "#F59E0B" : "#EF4444";
  const sw = 1 + cl(swell) * 1.8;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group scale={[1, 1 + cl(swell) * 0.04, sw]}>
        <mesh geometry={roundedBox(1.3, 2.1, 0.24, 0.1, 6)}>
          <meshStandardMaterial color="#D6ECFF" transparent opacity={0.16} roughness={0.08} metalness={0.1} depthWrite={false} />
        </mesh>
        <mesh material={rim} geometry={roundedBox(1.31, 2.11, 0.25, 0.1, 6)} />
        {h > 0.01 && (
          <mesh position={[0, -0.93 + h / 2, 0]} geometry={roundedBox(1.1, h, 0.13, Math.min(0.05, h / 2))}>
            <meshStandardMaterial color={fill} emissive={fill} emissiveIntensity={0.55 + (charging ? 0.25 * Math.sin(f / 5) : 0)} roughness={0.4} />
          </mesh>
        )}
        {/* layered electrodes seen through the shell */}
        {[-0.6, -0.3, 0, 0.3, 0.6].map((y) => (
          <mesh key={y} position={[0, y, 0.071]}>
            <boxGeometry args={[1.1, 0.008, 0.002]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.18} />
          </mesh>
        ))}
      </group>
      {/* terminal tab */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.56, 0.12, 0.06]} />
        <meshStandardMaterial color="#E7B43F" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0, 1.2, 0]} geometry={roundedBox(0.34, 0.1, 0.12, 0.03)}>
        <meshStandardMaterial color="#1B1F27" />
      </mesh>
      {charging && (
        <>
          <mesh geometry={boltGeo()} position={[0, 0.02, 0.14 * sw]} scale={1.15 + 0.06 * Math.sin(f / 5)}>
            <meshStandardMaterial color="#FFD23F" emissive="#FFC400" emissiveIntensity={0.9} />
          </mesh>
          {Array.from({ length: 8 }, (_, k) => {
            const t = ((f / 50 + k / 8) % 1 + 1) % 1;
            return (
              <mesh key={k} position={[-0.45 + random(`chg${k}`) * 0.9, -0.9 + t * Math.max(0.2, h), 0.08]}>
                <sphereGeometry args={[0.025, 10, 8]} />
                <meshBasicMaterial color="#EFFFF4" transparent opacity={1 - t} toneMapped={false} />
              </mesh>
            );
          })}
        </>
      )}
      {hot > 0.02 &&
        Array.from({ length: 14 }, (_, k) => {
          const t = ((f / 60 + random(`ht${k}`)) % 1 + 1) % 1;
          return (
            <mesh key={k} position={[-0.7 + random(`hx${k}`) * 1.4, 0.4 + t * 1.6, (random(`hz${k}`) - 0.5) * 0.4]}>
              <sphereGeometry args={[0.03 + 0.03 * random(`hs${k}`), 10, 8]} />
              <Glow color={k % 2 ? "#FF8A2A" : "#FF4B2A"} opacity={hot * (1 - t) * 0.9} />
            </mesh>
          );
        })}
    </group>
  );
};

/* ---------- cloud, AI, voice ---------- */
const PUFFS: [number, number, number, number][] = [
  [-0.95, -0.05, 0, 0.52],
  [-0.4, 0.28, 0.05, 0.72],
  [0.32, 0.36, -0.05, 0.82],
  [0.98, 0.02, 0.02, 0.56],
  [0.05, -0.1, 0.28, 0.62],
  [-0.1, -0.12, -0.3, 0.6],
  [0.55, -0.12, 0.2, 0.5],
];
// Puffy cloud (cloud storage, "data in the cloud"); bobs gently. `glow` tints its rim.
export const Cloud3D: React.FC<Placement & { f: number; color?: string; glow?: string }> = ({ f, position, rotation, scale = 1, color = "#F4F8FF", glow = C3.cyan }) => {
  const rim = useMemo(() => rimMaterial(glow, 2.6, 0.9, THREE.FrontSide), [glow]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group position={[0, Math.sin(f / 40) * 0.06, 0]}>
        {PUFFS.map(([x, y, z, r], i) => (
          <group key={i} position={[x, y, z]}>
            <mesh>
              <sphereGeometry args={[r, 40, 28]} />
              <meshStandardMaterial color={color} roughness={0.95} emissive="#9DB8E8" emissiveIntensity={0.18} />
            </mesh>
            <mesh material={rim} scale={1.01}>
              <sphereGeometry args={[r, 40, 28]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, -0.28, 0]} scale={[1.55, 0.32, 0.7]}>
          <sphereGeometry args={[1, 40, 20]} />
          <meshStandardMaterial color={color} roughness={0.95} emissive="#9DB8E8" emissiveIntensity={0.18} />
        </mesh>
      </group>
    </group>
  );
};

// Neural network: layers of nodes joined by faint lines; a wave of activity runs through it.
// `wave` (layer index, may be fractional) says where the signal is; omit it to loop on `f`.
// nnNode(layers, i, j, spacing) gives a node position for labels or for wiring other props in.
export const nnNode = (layers: number[], i: number, j: number, spacing = 1.1) =>
  new THREE.Vector3((i - (layers.length - 1) / 2) * spacing, (j - (layers[i] - 1) / 2) * 0.46, (random(`nn${i}-${j}`) - 0.5) * 0.5);
const NN_LAYERS = [4, 6, 6, 3];
export const NeuralNet3D: React.FC<Placement & { f: number; layers?: number[]; wave?: number; spacing?: number; color?: string; hot?: string }> = ({
  f,
  position,
  rotation,
  scale = 1,
  layers = NN_LAYERS,
  wave,
  spacing = 1.1,
  color = "#4B5BA8",
  hot = C3.cyan,
}) => {
  const { nodes, edges, lines } = useMemo(() => {
    const nodes = layers.map((n, i) => Array.from({ length: n }, (_, j) => nnNode(layers, i, j, spacing)));
    const edges: [THREE.Vector3, THREE.Vector3, number][] = [];
    const seg: number[] = [];
    nodes.slice(1).forEach((layer, i) =>
      layer.forEach((b, jb) =>
        nodes[i].forEach((a, ja) => {
          edges.push([a, b, i]);
          seg.push(...a.toArray(), ...b.toArray());
          void jb;
          void ja;
        }),
      ),
    );
    const lines = new THREE.BufferGeometry();
    lines.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    return { nodes, edges, lines };
  }, [layers, spacing]);
  const span = layers.length - 1;
  const w = wave ?? ((f / 22) % (span + 1.2)) - 0.1;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color="#8FA6FF" transparent opacity={0.16} />
      </lineSegments>
      {edges.map(([a, b, i], k) => {
        const t = w - i;
        if (t <= 0 || t >= 1 || random(`e${k}`) > 0.45) return null;
        return (
          <mesh key={k} position={a.clone().lerp(b, t)}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshBasicMaterial color={hot} toneMapped={false} />
          </mesh>
        );
      })}
      {nodes.map((layer, i) =>
        layer.map((p, j) => {
          const lit = cl(1 - Math.abs(w - i) * 1.4);
          const c = new THREE.Color(color).lerp(new THREE.Color(hot), lit);
          return (
            <group key={`${i}-${j}`} position={p}>
              <mesh scale={1 + lit * 0.35}>
                <sphereGeometry args={[0.1, 20, 14]} />
                <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.35 + lit * 0.9} roughness={0.35} />
              </mesh>
              {lit > 0.1 && (
                <mesh>
                  <sphereGeometry args={[0.22, 16, 12]} />
                  <Glow color={hot} opacity={0.25 * lit} />
                </mesh>
              )}
            </group>
          );
        }),
      )}
    </group>
  );
};

// Voice waveform: a row of glowing bars along x (or a ring with `ring`) whose heights move like
// speech. `level` 0..1 is the loudness; `seed` gives another voice; colours run color → color2.
export const Waveform3D: React.FC<Placement & { f: number; bars?: number; level?: number; ring?: boolean; color?: string; color2?: string; seed?: number; width?: number }> = ({
  f,
  position,
  rotation,
  scale = 1,
  bars = 36,
  level = 1,
  ring = false,
  color = C3.cyan,
  color2 = "#7B6CFF",
  seed = 0,
  width = 4,
}) => (
  <group position={position} rotation={rotation} scale={scale}>
    {Array.from({ length: bars }, (_, i) => {
      const u = i / (bars - 1);
      const env = ring ? 1 : Math.pow(Math.sin(Math.PI * u), 0.8);
      const syll = 0.5 + 0.5 * Math.sin(f * 0.23 + seed * 1.7) * Math.sin(f * 0.11 + seed);
      const n = Math.abs(Math.sin(f * 0.37 + i * 0.85 + seed * 3.1) * 0.6 + Math.sin(f * 0.19 - i * 0.43 + seed) * 0.4);
      const hgt = 0.06 + cl(level) * env * (0.25 + 1.25 * n * (0.35 + 0.65 * syll));
      const c = new THREE.Color(color).lerp(new THREE.Color(color2), u);
      if (ring) {
        const a = u * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * (1.1 + hgt / 2), Math.sin(a) * (1.1 + hgt / 2), 0]} rotation={[0, 0, a - Math.PI / 2]}>
            <boxGeometry args={[0.07, hgt, 0.07]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.8} />
          </mesh>
        );
      }
      return (
        <mesh key={i} position={[(u - 0.5) * width, 0, 0]} geometry={roundedBox(0.075, hgt, 0.075, 0.035)}>
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.8} />
        </mesh>
      );
    })}
  </group>
);

/* ---------- space ---------- */
// Satellite with big solar wings and a glowing compute module (an AI data centre in orbit).
// SOLAR_SAT.laser is the optical terminal in local space, for laser links (Beam/Signal).
export const SOLAR_SAT = { laser: new THREE.Vector3(0, 0, 0.42) };
export const SolarSat3D: React.FC<Placement & { f: number; seed?: number; core?: string }> = ({ f, position, rotation, scale = 1, seed = 0, core = C3.cyan }) => {
  const cells = useMemo(() => {
    const seg: number[] = [];
    for (let i = 1; i < 4; i++) seg.push(-0.31 + i * 0.155, 0.012, -0.45, -0.31 + i * 0.155, 0.012, 0.45);
    for (let j = 1; j < 6; j++) seg.push(-0.31, 0.012, -0.45 + j * 0.15, 0.31, 0.012, -0.45 + j * 0.15);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    return g;
  }, []);
  const pulse = 0.7 + 0.3 * Math.sin(f / 6 + seed);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={roundedBox(0.56, 0.56, 0.72, 0.04)}>
        <meshStandardMaterial color="#D9A441" metalness={0.75} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0, 0.37]} geometry={roundedBox(0.36, 0.36, 0.06, 0.02)}>
        <meshStandardMaterial color="#0E1730" emissive={core} emissiveIntensity={pulse} />
      </mesh>
      <mesh position={[0, 0, 0.4]}>
        <sphereGeometry args={[0.32, 16, 12]} />
        <Glow color={core} opacity={0.18 * pulse} />
      </mesh>
      {/* radiator fin on top */}
      <mesh position={[0, 0.42, -0.1]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.7, 0.02, 0.55]} />
        <meshStandardMaterial color="#F2F4F8" roughness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Rod from={new THREE.Vector3(s * 0.28, 0, 0)} to={new THREE.Vector3(s * 0.55, 0, 0)} radius={0.02} color="#C9D3E6" />
          {[0, 1, 2].map((k) => (
            <group key={k} position={[s * (0.9 + k * 0.66), 0, 0]} rotation={[Math.PI / 2 - 0.25, 0, 0]}>
              <mesh>
                <boxGeometry args={[0.62, 0.02, 0.9]} />
                <meshStandardMaterial color="#14318A" emissive="#0B2380" emissiveIntensity={0.5} metalness={0.4} roughness={0.3} />
              </mesh>
              <lineSegments geometry={cells}>
                <lineBasicMaterial color="#7FB2FF" transparent opacity={0.5} />
              </lineSegments>
            </group>
          ))}
        </group>
      ))}
      <mesh position={[0.2, -0.3, 0.3]}>
        <sphereGeometry args={[0.025, 10, 8]} />
        <meshBasicMaterial color={blink(f, 30, 6, seed * 9) ? "#FF5A5A" : "#5a2020"} toneMapped={false} />
      </mesh>
    </group>
  );
};

/* ---------- security ---------- */
const shieldShape = (k: number) => {
  const s = new THREE.Shape();
  s.moveTo(0, 1 * k);
  s.bezierCurveTo(0.32 * k, 0.84 * k, 0.6 * k, 0.8 * k, 0.84 * k, 0.8 * k);
  s.lineTo(0.84 * k, 0.12 * k);
  s.bezierCurveTo(0.84 * k, -0.5 * k, 0.4 * k, -0.86 * k, 0, -1.06 * k);
  s.bezierCurveTo(-0.4 * k, -0.86 * k, -0.84 * k, -0.5 * k, -0.84 * k, 0.12 * k);
  s.lineTo(-0.84 * k, 0.8 * k);
  s.bezierCurveTo(-0.6 * k, 0.8 * k, -0.32 * k, 0.84 * k, 0, 1 * k);
  return s;
};
const shieldGeos = (() => {
  let g: THREE.ExtrudeGeometry[] | null = null;
  return () =>
    (g ??= [
      new THREE.ExtrudeGeometry(shieldShape(1), { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 4, curveSegments: 32 }).translate(0, 0, -0.09),
      new THREE.ExtrudeGeometry(shieldShape(0.8), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 32 }),
    ]);
})();
const SHIELD = { ok: "#22C55E", bad: "#EF4444", info: "#2B6BFF" };
// Shield with a check (ok), a cross (bad) or plain (info): safe/blocked/protected moments.
// `pop` 0..1 scales the symbol in.
export const Shield3D: React.FC<Placement & { f: number; state?: keyof typeof SHIELD; pop?: number }> = ({ f, position, rotation, scale = 1, state = "ok", pop = 1 }) => {
  const [outer, inner] = shieldGeos();
  const col = SHIELD[state];
  const rim = useMemo(() => rimMaterial(col, 2.2, 0.8, THREE.FrontSide), [col]);
  const sym = cl(pop);
  const arm = (x0: number, y0: number, x1: number, y1: number, key: string) => {
    const len = Math.hypot(x1 - x0, y1 - y0) + 0.17;
    return (
      <mesh key={key} position={[(x0 + x1) / 2, (y0 + y1) / 2, 0.2]} rotation={[0, 0, Math.atan2(y1 - y0, x1 - x0)]} geometry={roundedBox(len, 0.17, 0.12, 0.06)}>
        <meshStandardMaterial color="#FFFFFF" roughness={0.3} emissive="#FFFFFF" emissiveIntensity={0.15} />
      </mesh>
    );
  };
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group rotation={[0, Math.sin(f / 30) * 0.12, 0]}>
        <mesh geometry={outer}>
          <meshStandardMaterial color={col} metalness={0.35} roughness={0.3} />
        </mesh>
        <mesh geometry={outer} material={rim} scale={1.01} />
        <mesh geometry={inner} position={[0, 0.02, 0.12]}>
          <meshStandardMaterial color={new THREE.Color(col).lerp(new THREE.Color("#ffffff"), 0.22)} metalness={0.25} roughness={0.35} />
        </mesh>
        <group scale={Math.max(0.001, sym)} position={[0, 0, 0.02]}>
          {state === "ok" && [arm(-0.4, 0.04, -0.1, -0.27, "a"), arm(-0.1, -0.27, 0.42, 0.34, "b")]}
          {state === "bad" && [arm(-0.36, -0.36, 0.36, 0.36, "a"), arm(-0.36, 0.36, 0.36, -0.36, "b")]}
        </group>
      </group>
    </group>
  );
};

// Padlock; `open` 0..1 lifts and swings the shackle (unlocked = account opened by someone else).
export const Padlock3D: React.FC<Placement & { f: number; open?: number; color?: string }> = ({ f, position, rotation, scale = 1, open = 0, color = "#F2B731" }) => {
  const o = cl(open);
  const metal = <meshStandardMaterial color="#C9D2E3" metalness={0.9} roughness={0.2} />;
  const key = useMemo(() => {
    const s = new THREE.Shape();
    s.absarc(0, 0.06, 0.09, 0, Math.PI * 2, false);
    const t = new THREE.Shape();
    t.moveTo(-0.05, 0.02);
    t.lineTo(0.05, 0.02);
    t.lineTo(0.08, -0.22);
    t.lineTo(-0.08, -0.22);
    t.closePath();
    return [s, t].map((sh) => new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false, curveSegments: 24 }));
  }, []);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group rotation={[0, Math.sin(f / 34) * 0.15, 0]}>
        <mesh geometry={roundedBox(1.25, 1.0, 0.44, 0.16)}>
          <meshStandardMaterial color={color} metalness={0.7} roughness={0.28} />
        </mesh>
        {key.map((g, i) => (
          <mesh key={i} geometry={g} position={[0, 0, 0.21]}>
            <meshStandardMaterial color="#2A1E05" roughness={0.6} />
          </mesh>
        ))}
        {/* shackle: hinged on the left leg */}
        <group position={[-0.36, 0.5 + o * 0.32, 0]} rotation={[0, o * 1.3, 0]}>
          <mesh position={[0.36, 0.42, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.36, 0.085, 16, 40, Math.PI]} />
            {metal}
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.42, 20]} />
            {metal}
          </mesh>
          <mesh position={[0.72, 0.22, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.42, 20]} />
            {metal}
          </mesh>
        </group>
      </group>
    </group>
  );
};
