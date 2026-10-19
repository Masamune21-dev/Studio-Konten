// 3D pieces for scenes that read better in space: the Earth with satellites/GPS, a
// device turning around, data flowing between points. Built on @remotion/three
// (Three.js); see SKILL.md, "Adegan 3D". Everything is driven by the frame number
// passed in as `f`, never by a clock, so every render is identical.
// The first use is the GPS test clip (8 Oct 2026, uji-3d-gps/): references/example-3d-gps.tsx.
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { cancelRender, continueRender, delayRender, random, staticFile } from "remotion";
import { useVideoConfig } from "./Time";

export { THREE };
export const C3 = { cyan: "#3BD5F5", sun: "#FFD23F", coral: "#FF6A4D", navy: "#0d2a5c", white: "#FFFFFF", blue: "#2B50FF" };

/* ---------- maths ---------- */
// Point on a sphere. lat/lon in degrees; the same mapping Three.js uses for a sphere texture.
export const onSphere = (lat: number, lon: number, r: number) => {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
};

// Yaw that turns a point on the globe (lat/lon) to face the camera on +z.
export const yawFacing = (lat: number, lon: number) => {
  const p = onSphere(lat, lon, 1);
  return Math.atan2(-p.x, p.z);
};

// A satellite on a great circle through P (its position at frame `mid`) moving along
// tangent T at w radians per frame. Pick P and T from where it should be on screen
// (SKILL.md explains how); satellites near the camera drift far on screen otherwise.
export const orbit = (p: [number, number, number], t: [number, number, number], radius: number, w: number, mid: number) => {
  const P = new THREE.Vector3(...p).setLength(radius);
  const T = new THREE.Vector3(...t);
  T.sub(P.clone().multiplyScalar(T.dot(P) / P.lengthSq())).setLength(radius);
  const at = (theta: number) => P.clone().multiplyScalar(Math.cos(theta)).add(T.clone().multiplyScalar(Math.sin(theta)));
  return { at: (f: number) => at(w * (f - mid)), ring: (n = 240) => Array.from({ length: n + 1 }, (_, i) => at((i / n) * Math.PI * 2)) };
};

export type Cam = { position: THREE.Vector3; target: THREE.Vector3; fov?: number };

// Screen position (px) of a 3D point, for 2D labels pinned to 3D objects.
export const toScreen = (v: THREE.Vector3, cam: Cam, width: number, height: number) => {
  const c = new THREE.PerspectiveCamera(cam.fov ?? 42, width / height, 0.1, 200);
  c.position.copy(cam.position);
  c.lookAt(cam.target);
  c.updateMatrixWorld();
  const s = v.clone().project(c);
  return { x: ((s.x + 1) / 2) * width, y: ((1 - s.y) / 2) * height };
};

/* ---------- stage ---------- */
const CameraRig: React.FC<{ cam: Cam }> = ({ cam }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  // Layout effect: @remotion/three draws the frame in a later useEffect.
  useLayoutEffect(() => {
    camera.position.copy(cam.position);
    if (cam.fov && camera.fov !== cam.fov) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(cam.target);
    camera.updateMatrixWorld();
  }, [camera, cam]);
  return null;
};

// Full-size transparent 3D canvas with the usual lights. Put it inside a scene and
// layer 2D text/characters above it. Width/height follow the composition (9:16 or 16:9).
export const Stage3D: React.FC<{ cam: Cam; children: React.ReactNode; stars?: boolean; lights?: boolean }> = ({ cam, children, stars = true, lights = true }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: cam.fov ?? 42, near: 0.1, far: 200, position: cam.position.toArray() }}>
      <CameraRig cam={cam} />
      {lights && (
        <>
          <ambientLight intensity={0.55} />
          <directionalLight position={[-4, 5, 6]} intensity={2.6} />
          <pointLight position={[3.5, -2, -3]} color={C3.cyan} intensity={12} />
        </>
      )}
      {stars && <Stars />}
      {children}
    </ThreeCanvas>
  );
};

export const Stars: React.FC<{ count?: number }> = ({ count = 1400 }) => {
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = random(`u${i}`) * 2 - 1;
      const a = random(`a${i}`) * Math.PI * 2;
      const r = 30 + random(`r${i}`) * 30;
      const s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(a), r * u, r * s * Math.sin(a)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#cfe8ff" size={0.09} sizeAttenuation transparent opacity={0.8} />
    </points>
  );
};

// Image from public/ as a texture (a phone screen, a poster); call it inside Stage3D.
// The canvas only draws when the frame changes, so once the texture is in place the
// frame is drawn again before the render is released (otherwise the screen stays black).
export const useImageTexture = (src: string) => {
  const advance = useThree((s) => s.advance);
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [handle] = useState(() => delayRender(`texture ${src}`));
  useLayoutEffect(() => {
    new THREE.TextureLoader().load(
      staticFile(src),
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        setTex(t);
      },
      undefined,
      (e) => cancelRender(e),
    );
  }, [src]);
  useEffect(() => {
    if (!tex) return;
    advance(performance.now());
    continueRender(handle);
  }, [tex, advance, handle]);
  return tex;
};

/* ---------- materials ---------- */
// Glow that is brighter where the surface turns away from the camera (atmosphere, hologram rim).
export const rimMaterial = (color: string, power: number, strength: number, side: THREE.Side) =>
  new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, power: { value: power }, strength: { value: strength } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float power; uniform float strength; varying vec3 vN; varying vec3 vV;
      void main() { float d = abs(dot(normalize(vN), normalize(vV))); float a = pow(1.0 - d, power) * strength; gl_FragColor = vec4(color * a, a); }`,
    side,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

/* ---------- objects ---------- */
// Digital globe: navy sphere, cyan latitude/longitude grid, atmosphere glow. Continents are
// optional: put <LandDots> (ThreeKitProps.tsx, Natural Earth data) inside as a child, and lower
// `grid` (line opacity, default 0.35) to ±0.12 so the dots stand out.
export const HoloGlobe: React.FC<{ radius: number; rotation: THREE.Euler; grid?: number; children?: React.ReactNode }> = ({ radius: R, rotation, grid: gridOpacity = 0.35, children }) => {
  const { grid, nodes, rim, halo } = useMemo(() => {
    const seg: number[] = [];
    const line = (pts: THREE.Vector3[]) => pts.slice(1).forEach((p, i) => seg.push(...pts[i].toArray(), ...p.toArray()));
    for (let lat = -60; lat <= 60; lat += 20) line(Array.from({ length: 121 }, (_, i) => onSphere(lat, -180 + i * 3, R * 1.002)));
    for (let lon = -180; lon < 180; lon += 20) line(Array.from({ length: 61 }, (_, i) => onSphere(-90 + i * 3, lon, R * 1.002)));
    const grid = new THREE.BufferGeometry();
    grid.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    const dots: number[] = [];
    for (let lat = -60; lat <= 60; lat += 20) for (let lon = -180; lon < 180; lon += 20) dots.push(...onSphere(lat, lon, R * 1.004).toArray());
    const nodes = new THREE.BufferGeometry();
    nodes.setAttribute("position", new THREE.Float32BufferAttribute(dots, 3));
    return { grid, nodes, rim: rimMaterial(C3.cyan, 2.6, 1.1, THREE.FrontSide), halo: rimMaterial("#5fa8ff", 4.0, 0.9, THREE.BackSide) };
  }, [R]);
  return (
    <>
      <group rotation={rotation}>
        <mesh>
          <sphereGeometry args={[R, 96, 64]} />
          <meshStandardMaterial color={C3.navy} emissive="#06163a" roughness={0.55} metalness={0.15} />
        </mesh>
        <lineSegments geometry={grid}>
          <lineBasicMaterial color={C3.cyan} transparent opacity={gridOpacity} />
        </lineSegments>
        <points geometry={nodes}>
          <pointsMaterial color={C3.cyan} size={0.05} sizeAttenuation transparent opacity={0.9 * Math.min(1, gridOpacity / 0.35)} />
        </points>
        <mesh material={rim}>
          <sphereGeometry args={[R * 1.003, 96, 64]} />
        </mesh>
        {/* children rotate with the globe: pins, markers */}
        {children}
      </group>
      <mesh material={halo} scale={1.14}>
        <sphereGeometry args={[R, 96, 64]} />
      </mesh>
    </>
  );
};

// Map pin standing on a sphere at lat/lon (use as a child of HoloGlobe). `grow` 0..1 pops it
// in; `ripple` ≥ 0 is frames since the pin should start sending out rings.
export const GlobePin: React.FC<{ lat: number; lon: number; radius: number; grow: number; color: string; ripple?: number }> = ({ lat, lon, radius, grow, color, ripple }) => {
  const base = onSphere(lat, lon, radius);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), base.clone().normalize());
  const rings = ripple !== undefined && ripple >= 0 ? [0, 1, 2].map((k) => ((ripple + k * 14) % 42) / 42) : [];
  return (
    <group position={base} quaternion={q}>
      <group scale={Math.max(0.001, grow)}>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.085, 32, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
        </mesh>
        <mesh position={[0, 0.09, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.05, 0.18, 24]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
        </mesh>
      </group>
      {rings.map((r, k) => (
        <mesh key={k} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={0.05 + r * 0.55}>
          <ringGeometry args={[0.85, 1, 64]} />
          <meshBasicMaterial color={color} transparent opacity={(1 - r) * 0.8} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

// Small satellite: gold body, two blue solar panels, dish pointing at the Earth (origin).
export const Satellite: React.FC<{ position: THREE.Vector3; f: number; seed?: number; scale?: number }> = ({ position, f, seed = 0, scale = 0.78 }) => {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().negate().normalize());
  const blink = (f + seed * 11) % 30 < 6;
  return (
    <group position={position} quaternion={q} scale={scale}>
      <mesh>
        <boxGeometry args={[0.17, 0.17, 0.24]} />
        <meshStandardMaterial color="#E3A43B" metalness={0.65} roughness={0.32} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.36, 8]} />
        <meshStandardMaterial color="#c9d3e6" metalness={0.5} roughness={0.4} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.4, 0, 0]}>
          <boxGeometry args={[0.46, 0.18, 0.014]} />
          <meshStandardMaterial color={C3.blue} emissive="#0b2aa0" emissiveIntensity={0.55} metalness={0.35} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.055, 0.1, 20, 1, true]} />
        <meshStandardMaterial color="#f4f6fb" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.1, -0.06]}>
        <sphereGeometry args={[0.022, 12, 8]} />
        <meshBasicMaterial color={blink ? "#ff5a5a" : "#5a2020"} toneMapped={false} />
      </mesh>
    </group>
  );
};

// Thin line through 3D points (orbit, route). WebGL lines are 1 px: use Beam for thick ones.
export const PathLine: React.FC<{ points: THREE.Vector3[]; color?: string; opacity?: number }> = ({ points, color = "#9fdcff", opacity = 0.28 }) => {
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  return (
    <line>
      <primitive object={geo} attach="geometry" />
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  );
};

// Glowing tube between two points (a cylinder, so it stays thick at 1080p).
export const Beam: React.FC<{ from: THREE.Vector3; to: THREE.Vector3; radius: number; color: string; opacity: number }> = ({ from, to, radius, color, opacity }) => {
  const dir = to.clone().sub(from);
  if (dir.lengthSq() < 1e-8) return null;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return (
    <mesh position={from.clone().add(to).multiplyScalar(0.5)} quaternion={q} scale={[1, dir.length(), 1]}>
      <cylinderGeometry args={[radius, radius, 1, 12, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
};

// A signal: the beam grows from `from` to `to` while `progress` goes 0→1, then pulses keep
// running along it (`f` drives them). Good for satellite → phone, router → device, server → server.
export const Signal: React.FC<{ from: THREE.Vector3; to: THREE.Vector3; progress: number; f: number; color?: string; pulse?: string }> = ({ from, to, progress, f, color = C3.cyan, pulse = C3.sun }) => {
  if (progress <= 0) return null;
  const end = from.clone().lerp(to, Math.min(1, progress));
  const pulses = progress >= 1 ? [0, 1].map((j) => ((f + j * 12) % 24) / 24) : [progress];
  return (
    <>
      <Beam from={from} to={end} radius={0.035} color={color} opacity={0.22} />
      <Beam from={from} to={end} radius={0.011} color="#e9fbff" opacity={0.95} />
      {pulses.map((t, j) => (
        <mesh key={j} position={from.clone().lerp(to, t)}>
          <sphereGeometry args={[0.045, 16, 12]} />
          <meshBasicMaterial color={pulse} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
};

// Phone in 3D: rounded slab, dark bezel, screen showing a colour, an image from public/
// (anime illustration, app mock-up) or a texture (phoneScreen() in ThreeKitProps.tsx draws a
// status bar, chat bubbles, big text). Turn it with `rotation` for a reveal.
export const Phone3D: React.FC<{
  position?: [number, number, number];
  rotation?: THREE.Euler;
  scale?: number;
  screen?: string;
  image?: string;
  texture?: THREE.Texture;
  body?: string;
}> = ({ position = [0, 0, 0], rotation, scale = 1, screen = "#1d3d8f", image, texture, body = "#1b1f2a" }) => {
  const shape = useMemo(() => {
    const [w, h, r] = [1, 2.05, 0.16];
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return new THREE.ExtrudeGeometry(s, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }).translate(0, 0, -0.045);
  }, []);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={shape}>
        <meshStandardMaterial color={body} metalness={0.5} roughness={0.35} />
      </mesh>
      {image ? (
        <PhoneImage src={image} />
      ) : texture ? (
        <mesh key={texture.uuid} position={[0, 0, 0.07]}>
          <planeGeometry args={[0.9, 1.92]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      ) : (
        <mesh position={[0, 0, 0.07]}>
          <planeGeometry args={[0.9, 1.92]} />
          <meshBasicMaterial color={screen} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
};

const PhoneImage: React.FC<{ src: string }> = ({ src }) => {
  const tex = useImageTexture(src);
  // A fresh mesh once the texture exists, so the material is built with its map.
  return tex ? (
    <mesh position={[0, 0, 0.07]}>
      <planeGeometry args={[0.9, 1.92]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  ) : null;
};

// Solid cable between two points (Beam glows; this one is a plain coloured tube).
export const Cable: React.FC<{ from: THREE.Vector3; to: THREE.Vector3; radius?: number; color?: string; progress?: number }> = ({ from, to, radius = 0.035, color = "#3B82F6", progress = 1 }) => {
  if (progress <= 0) return null;
  const end = from.clone().lerp(to, Math.min(1, progress));
  const dir = end.clone().sub(from);
  if (dir.lengthSq() < 1e-8) return null;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return (
    <mesh position={from.clone().add(end).multiplyScalar(0.5)} quaternion={q} scale={[1, dir.length(), 1]}>
      <cylinderGeometry args={[radius, radius, 1, 16]} />
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.1} />
    </mesh>
  );
};

// Small desktop router (hEX/hAP style, no logo): body, five Ethernet ports on the front,
// link LEDs blinking. `glow` colours a port surround and its LED, e.g. { 1: coral } for
// ether1 = internet. routerPort(i) gives a port centre in the router's local space.
export const ROUTER = { w: 2.6, h: 0.5, d: 1.5 };
export const routerPort = (i: number) => new THREE.Vector3(-0.92 + (i - 1) * 0.43, -0.03, ROUTER.d / 2 + 0.005);
export const Router3D: React.FC<{
  f: number;
  position?: [number, number, number];
  rotation?: THREE.Euler;
  scale?: number;
  glow?: Record<number, string>;
  body?: string;
}> = ({ f, position = [0, 0, 0], rotation, scale = 1, glow = {}, body = "#2A3142" }) => (
  <group position={position} rotation={rotation} scale={scale}>
    <mesh>
      <boxGeometry args={[ROUTER.w, ROUTER.h, ROUTER.d]} />
      <meshStandardMaterial color={body} roughness={0.5} metalness={0.25} />
    </mesh>
    {/* top panel and vents */}
    <mesh position={[0, ROUTER.h / 2 + 0.006, 0]}>
      <boxGeometry args={[ROUTER.w - 0.12, 0.012, ROUTER.d - 0.12]} />
      <meshStandardMaterial color="#353E52" roughness={0.6} />
    </mesh>
    {[-0.6, -0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45, 0.6].map((x) => (
      <mesh key={x} position={[x, ROUTER.h / 2 + 0.014, -0.3]}>
        <boxGeometry args={[0.06, 0.006, 0.5]} />
        <meshStandardMaterial color="#1B2130" />
      </mesh>
    ))}
    {[1, 2, 3, 4, 5].map((i) => {
      const p = routerPort(i);
      const g = glow[i];
      const on = (f + i * 7) % 18 < 11;
      return (
        <group key={i} position={p}>
          <mesh>
            <boxGeometry args={[0.32, 0.26, 0.02]} />
            <meshStandardMaterial color={g ?? "#C9D2E3"} emissive={g ?? "#000000"} emissiveIntensity={g ? 0.6 : 0} />
          </mesh>
          <mesh position={[0, -0.01, 0.005]}>
            <boxGeometry args={[0.24, 0.18, 0.03]} />
            <meshStandardMaterial color="#0B0F18" />
          </mesh>
          <mesh position={[0.1, 0.17, 0]}>
            <sphereGeometry args={[0.024, 10, 8]} />
            <meshBasicMaterial color={g ? g : on ? "#22C55E" : "#14361F"} toneMapped={false} />
          </mesh>
        </group>
      );
    })}
    {/* power jack */}
    <mesh position={[1.12, -0.03, ROUTER.d / 2 + 0.01]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.06, 0.06, 0.03, 20]} />
      <meshStandardMaterial color="#0B0F18" />
    </mesh>
  </group>
);

// Simple open laptop: base slab and a screen hinged at the back, screen colour or glow.
export const Laptop3D: React.FC<{ position?: [number, number, number]; rotation?: THREE.Euler; scale?: number; screen?: string }> = ({
  position = [0, 0, 0],
  rotation,
  scale = 1,
  screen = "#2B50FF",
}) => (
  <group position={position} rotation={rotation} scale={scale}>
    <mesh>
      <boxGeometry args={[1.6, 0.06, 1.05]} />
      <meshStandardMaterial color="#C9D2E3" metalness={0.5} roughness={0.35} />
    </mesh>
    <mesh position={[0, 0.034, 0.12]}>
      <boxGeometry args={[1.4, 0.008, 0.62]} />
      <meshStandardMaterial color="#2A3142" />
    </mesh>
    <group position={[0, 0.03, -0.52]} rotation={[-0.32, 0, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.6, 1.0, 0.05]} />
        <meshStandardMaterial color="#C9D2E3" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.5, 0.027]}>
        <planeGeometry args={[1.44, 0.86]} />
        <meshBasicMaterial color={screen} toneMapped={false} />
      </mesh>
    </group>
  </group>
);
