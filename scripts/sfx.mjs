// Sound effects for the videos (clicks, keys, taps, whooshes, pops, chimes, …), synthesised from
// oscillators, noise and filters with a seeded random generator: nothing is downloaded or licensed,
// and running it again writes byte-identical files.
//   npm run sfx                       in a project folder: public/sfx/<name>-<i>.wav + src/sfx.json
//   node scripts/sfx.mjs <folder>     any project or the skill template
//   node scripts/sfx.mjs --list       names, variants and lengths only
// Every sound has several variants; components/Sfx.tsx picks one per use (seeded), so the same
// action twice in a video does not sound copy-pasted. src/sfx.json lists the variant lengths.
// Levels are baked in relative to the Gemini narration (speech ≈ -15…-18 dBFS RMS, peaks ≈ -2):
// keys sit ≈15 dB under the voice, hits and chimes ≈8–12 dB under, so <Sfx volume> stays ≤ 1.
// Since 16 Oct 2026 a few recorded sounds (boom, scratch, trombone, laugh, applause, crickets, …)
// come from licensed library files in ../media/sfx-mixkit/ (RECORDED below): copied, trimmed and
// set to the same levels; the synthesised sounds are unchanged.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SR = 48000;
const TAU = Math.PI * 2;
const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const dir = path.resolve(args.find((a) => !a.startsWith("--")) ?? ".");

// ---------- building blocks ----------
const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 2166136261);
const rng = (seed) => {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const U = (r, a, b) => a + (b - a) * r();
const N = (sec) => Math.max(1, Math.round(sec * SR));
const buf = (sec) => new Float32Array(N(sec));
const noise = (r, n) => Float32Array.from({ length: n }, () => r() * 2 - 1);

// Zero-delay-feedback state-variable filter: stays stable while the cutoff sweeps every sample.
// fc: Hz or (i) => Hz. mode: "lp" | "bp" (unity peak) | "hp".
function svf(x, fc, q, mode) {
  const y = new Float32Array(x.length);
  const k = 1 / q;
  let ic1 = 0, ic2 = 0;
  for (let i = 0; i < x.length; i++) {
    const f = Math.min(typeof fc === "function" ? fc(i) : fc, SR * 0.45);
    const g = Math.tan((Math.PI * f) / SR);
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x[i] - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    y[i] = mode === "lp" ? v2 : mode === "bp" ? k * v1 : x[i] - k * v1 - v2;
  }
  return y;
}
const lp = (x, fc, q = 0.707) => svf(x, fc, q, "lp");
const hp = (x, fc, q = 0.707) => svf(x, fc, q, "hp");
const bp = (x, fc, q = 1) => svf(x, fc, q, "bp");

// Multiply in place by an envelope e(t seconds).
const shape = (x, e) => {
  for (let i = 0; i < x.length; i++) x[i] *= e(i / SR);
  return x;
};
const decay = (tau, attack = 0) => (t) => (attack > 0 ? Math.min(1, t / attack) : 1) * Math.exp(-t / tau);
// Noise burst: filtered white noise with a fast exponential decay.
const burst = (r, sec, tau, filt) => shape(filt(noise(r, N(sec))), decay(tau));

// Sine whose pitch glides exponentially from f0 to f1 (time constant tauP) and decays with tauA.
function tone(sec, f0, f1, tauP, tauA, attack = 0.0005, harmonics = [1]) {
  const x = buf(sec);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / Math.max(tauP, 1e-6));
    ph += (TAU * f) / SR;
    let s = 0;
    harmonics.forEach((a, h) => (s += a * Math.sin(ph * (h + 1))));
    x[i] = s * Math.min(1, t / attack) * Math.exp(-t / tauA);
  }
  return x;
}
// Damped resonance ("mode"): the ring of plastic, metal or wood after a hit.
const mode = (f, tau, sec = Math.min(tau * 7, 2)) => tone(sec, f, f, 1, tau, 0.0001);

// Mix src into dst at `at` seconds; stereo dst is [L, R] with optional pan -1..1.
function mix(dst, src, at = 0, gain = 1, pan = 0) {
  const o = Math.round(at * SR);
  const chans = Array.isArray(dst) ? dst : [dst];
  const g = chans.length === 2 ? [Math.cos(((pan + 1) * Math.PI) / 4), Math.sin(((pan + 1) * Math.PI) / 4)].map((v) => v * Math.SQRT2) : [1];
  chans.forEach((c, ch) => {
    for (let i = 0; i < src.length && o + i < c.length; i++) if (o + i >= 0) c[o + i] += src[i] * gain * g[ch];
  });
  return dst;
}
const stereo = (sec) => [buf(sec), buf(sec)];

// Note frequencies used by the chimes.
const NOTE = { A5: 880, B5: 987.8, C6: 1046.5, D6: 1174.7, E6: 1318.5, Fs6: 1480, G5: 784, G6: 1568, A6: 1760, B6: 1975.5, Cs6: 1108.7, D5: 587.3, Fs5: 740 };

// Struck bar (marimba-like): fundamental plus the bar's high, fast-dying partials.
const bar = (f, tau, sec = tau * 6) => {
  const x = tone(sec, f, f, 1, tau, 0.0012);
  mix(x, tone(sec, f * 3.93, f * 3.93, 1, tau * 0.28, 0.0008), 0, 0.22);
  mix(x, tone(sec, f * 9.2, f * 9.2, 1, tau * 0.1, 0.0005), 0, 0.07);
  return x;
};
// Small bell: inharmonic partials, the high ones die first; a detuned twin gives a slow shimmer.
const bell = (f, tau, sec = tau * 5) => {
  const x = buf(sec);
  [[1, 1, 1], [1.0016, 0.5, 1], [2, 0.42, 0.55], [2.76, 0.28, 0.38], [4.07, 0.15, 0.22], [5.4, 0.09, 0.14]].forEach(([m, a, d]) =>
    mix(x, tone(sec, f * m, f * m, 1, tau * d, 0.0015), 0, a),
  );
  return x;
};

// ---------- the sounds ----------
// Each entry: [variants, (r, i) => Float32Array | [L, R], peak dBFS]
const press = (r, fm, g) => {
  const x = burst(r, 0.04, 0.0007, (n) => hp(n, 1800));
  mix(x, mode(U(r, 2800, 4200) * fm, 0.0025), 0, 0.7);
  mix(x, mode(U(r, 5200, 7400) * fm, 0.0012), 0, 0.4);
  mix(x, mode(U(r, 900, 1500) * fm, 0.006), 0, 0.25);
  return x.map((v) => v * g);
};
const keyStroke = (r, body, bodyTau, bodyAmp, noiseFc, noiseTau, upAt, upAmp, rattles = 0) => {
  const x = buf(upAt + 0.05);
  mix(x, burst(r, 0.03, noiseTau, (n) => bp(n, noiseFc, 0.9)));
  mix(x, mode(U(r, 1700, 2600), 0.007), 0, 0.32);
  mix(x, mode(U(r, 3300, 4800), 0.0035), 0, 0.26);
  mix(x, mode(U(r, 5500, 7000), 0.0015), 0, 0.06);
  mix(x, tone(0.2, body, body * 0.9, 0.02, bodyTau, 0.0012), 0, bodyAmp);
  mix(x, burst(r, 0.01, 0.0008, (n) => bp(n, 3000, 1)), U(r, 0.003, 0.008), 0.35); // bottom-out
  for (let k = 0; k < rattles; k++) mix(x, burst(r, 0.01, 0.0006, (n) => bp(n, U(r, 2500, 5000), 1.5)), U(r, 0.006, 0.026), U(r, 0.12, 0.25)); // stabiliser
  mix(x, burst(r, 0.02, 0.001, (n) => bp(n, noiseFc * 1.3, 1)), upAt, upAmp); // key coming back up
  mix(x, mode(U(r, 2300, 3400), 0.003), upAt, upAmp * 0.45);
  return x;
};
// Whoosh: noise through a band-pass that sweeps up to a peak and back down, panned across.
function whoosh(r, i, D, peakAt, f0, f1, f2, q, body, air) {
  const out = stereo(D);
  const n = N(D), pk = peakAt * n;
  const fc = (k) => (k < pk ? f0 * (f1 / f0) ** (k / pk) : f1 * (f2 / f1) ** ((k - pk) / (n - pk)));
  const env = (t) => {
    const p = t / D;
    return p < peakAt ? (p / peakAt) ** 2.2 : ((1 - p) / (1 - peakAt)) ** 1.7;
  };
  const nz = lp(noise(r, n), 7000);
  const sig = shape(bp(nz, fc, q), env);
  mix(sig, shape(lp(nz, 380), env), 0, body);
  mix(sig, shape(hp(nz, 5000), env), 0, air);
  const dir = i % 2 ? 1 : -1;
  for (let k = 0; k < n; k++) {
    const pan = dir * (-0.7 + (1.4 * k) / n);
    out[0][k] = sig[k] * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    out[1][k] = sig[k] * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  }
  return out;
}
// Soft square-ish tone (odd harmonics, low-passed) for beeps and buzzers.
const square = (sec, f, env, fc = 1600) => {
  const x = buf(sec);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let s = 0;
    for (let h = 1; h <= 9; h += 2) s += Math.sin(TAU * f * h * t) / h;
    x[i] = s * env(t);
  }
  return lp(x, fc);
};
const gate = (attack, hold, release) => (t) => Math.min(1, t / attack) * (t < attack + hold ? 1 : Math.exp(-(t - attack - hold) / release));

const SOUNDS = {
  // Mouse click: press, then a softer release.
  click: [4, (r) => mix(mix(buf(0.16), press(r, 1, 1)), press(r, U(r, 1.05, 1.15), U(r, 0.35, 0.5)), U(r, 0.055, 0.09)), -10],
  // Finger tap on a phone screen: a short soft knock.
  tap: [4, (r) => {
    const f = U(r, 650, 1050);
    const x = tone(0.12, f, f * 0.82, 0.015, U(r, 0.01, 0.016), 0.0008);
    mix(x, mode(f * 2.6, 0.004), 0, 0.18);
    return mix(x, burst(r, 0.01, 0.0006, (n) => lp(n, 5000)), 0, 0.3);
  }, -15],
  // Mechanical keyboard: letter keys, space bar (deeper, rattles), enter (punchier).
  key: [12, (r) => keyStroke(r, U(r, 170, 320), U(r, 0.012, 0.022), 0.55, U(r, 1500, 3200), 0.0015, U(r, 0.06, 0.11), U(r, 0.25, 0.4)), -16],
  space: [3, (r) => keyStroke(r, U(r, 100, 150), 0.035, 0.8, U(r, 1300, 1800), 0.0025, U(r, 0.09, 0.14), 0.35, 2), -15],
  enter: [3, (r) => keyStroke(r, U(r, 140, 200), 0.028, 0.7, U(r, 2000, 2800), 0.002, U(r, 0.08, 0.12), 0.4, 1), -13],
  // Phone keyboard tick.
  softkey: [6, (r) => {
    const f = U(r, 1600, 2600);
    const x = mode(f, 0.0025, 0.04);
    mix(x, mode(f * 2.2, 0.001, 0.04), 0, 0.3);
    return mix(x, burst(r, 0.01, 0.0004, (n) => hp(n, 3000)), 0, 0.4);
  }, -20],
  // Scene transitions and big moves; swipe = short UI slide.
  whoosh: [6, (r, i) => whoosh(r, i, [0.38, 0.45, 0.5, 0.42, 0.6, 0.75][i], U(r, 0.42, 0.58), U(r, 250, 450), U(r, 1800, 3500), U(r, 500, 900), U(r, 0.9, 1.6), 0.6, 0.15), -14],
  swipe: [4, (r, i) => whoosh(r, i, U(r, 0.18, 0.28), U(r, 0.3, 0.4), U(r, 700, 1000), U(r, 3000, 5000), U(r, 1600, 2400), 0.8, 0.2, 0.25), -17],
  // Something appears: pop (pitch drops) and blip (pitch rises).
  pop: [6, (r) => {
    const f = U(r, 600, 1100), e = U(r, 0.4, 0.55);
    const x = tone(0.16, f, f * e, 0.012, U(r, 0.03, 0.045), 0.0012);
    mix(x, tone(0.16, f * 2, f * 2 * e, 0.012, 0.025, 0.0012), 0, 0.12);
    return mix(x, burst(r, 0.01, 0.0005, (n) => lp(n, 6000)), 0, 0.25);
  }, -17],
  blip: [4, (r) => {
    const f = U(r, 350, 500);
    return tone(0.16, f, f * U(r, 2, 2.6), 0.015, 0.04, 0.0015, [1, 0, 0.1]);
  }, -17],
  // Counter step / clock tick: small wood block.
  tick: [4, (r) => {
    const f = U(r, 1500, 2300);
    const x = mode(f, 0.006, 0.05);
    mix(x, mode(f * 2.75, 0.002, 0.05), 0, 0.35);
    mix(x, mode(f * 5.1, 0.0008, 0.05), 0, 0.15);
    return mix(x, burst(r, 0.01, 0.0003, (n) => hp(n, 3000)), 0, 0.3);
  }, -18],
  // Chimes.
  ding: [4, (r, i) => {
    const x = bell([NOTE.C6, NOTE.E6, NOTE.D6, NOTE.A5][i] * U(r, 0.997, 1.003), U(r, 0.7, 1), 1.6);
    return mix(x, burst(r, 0.01, 0.0005, (n) => hp(n, 4000)), 0, 0.15);
  }, -17],
  notif: [4, (r, i) => {
    const notes = [["E6", "B6"], ["C6", "G6"], ["G5", "D6", "G6"], ["A5", "E6"]][i];
    const gap = U(r, 0.08, 0.11), tau = U(r, 0.16, 0.22);
    const x = buf(gap * notes.length + tau * 6);
    notes.forEach((n, k) => mix(x, bar(NOTE[n], k === notes.length - 1 ? tau * 1.6 : tau), k * gap, 1));
    return x;
  }, -17],
  success: [3, (r, i) => {
    const notes = [["C6", "E6", "G6"], ["D6", "Fs6", "A6"], ["A5", "Cs6", "E6", "A6"]][i];
    const gap = U(r, 0.065, 0.085);
    const x = buf(gap * notes.length + 1.2);
    notes.forEach((n, k) => {
      const last = k === notes.length - 1, tau = last ? 0.55 : 0.28;
      mix(x, bar(NOTE[n], tau, tau * 5), k * gap, 0.7);
      mix(x, bell(NOTE[n], tau, tau * 5), k * gap, 0.35);
    });
    return x;
  }, -17],
  // Wrong / rejected: two low soft buzzes (or one longer one).
  error: [3, (r, i) => {
    const f = U(r, 170, 230);
    if (i === 2) return square(0.3, f, (t) => gate(0.004, 0.17, 0.03)(t) * (1 - 0.1 * t), 1400);
    const x = buf(0.3);
    mix(x, square(0.14, f, gate(0.004, 0.07, 0.02)));
    return mix(x, square(0.14, f * (i ? 1 : 0.84), gate(0.004, 0.07, 0.02)), U(r, 0.13, 0.15));
  }, -21],
  // Monitoring alarm: two-tone beeps.
  alarm: [2, (r, i) => {
    const [a, b] = [[NOTE.A5, 660], [NOTE.B5, NOTE.Fs5]][i];
    const x = buf(0.62);
    for (let k = 0; k < 4; k++) mix(x, shape(tone(0.12, k % 2 ? b : a, k % 2 ? b : a, 1, 1e9, 0.003, [1, 0, 0.3, 0, 0.12]), (t) => Math.max(0, Math.min(1, (0.12 - t) / 0.01))), k * 0.15);
    return x;
  }, -22],
  // Impact for a big word slamming in: low punch, a mid layer phones can play, a bit of grit.
  thud: [3, (r) => {
    const f0 = U(r, 110, 150), f1 = U(r, 42, 55);
    const x = tone(0.6, f0, f1, 0.045, U(r, 0.14, 0.2), 0.001);
    mix(x, tone(0.6, f0 * 2.4, f1 * 2.4, 0.045, 0.06, 0.001), 0, 0.35);
    mix(x, burst(r, 0.2, 0.02, (n) => lp(n, 900)), 0, 0.6);
    mix(x, burst(r, 0.02, 0.0012, (n) => hp(n, 2500)), 0, 0.35);
    return x.map((v) => Math.tanh(1.5 * v) / Math.tanh(1.5));
  }, -16],
  // Build-up before a reveal (use <Sfx end={…}>): rising filtered noise and tone, decorrelated L/R.
  riser: [2, (r, i) => {
    const D = [1, 1.5][i], n = N(D);
    const env = (t) => (t / D) ** 2.2 * Math.min(1, (D - t) / 0.025);
    const fc = (k) => 250 * (5500 / 250) ** ((k / n) ** 1.3);
    // Tone gliding 200 → 800 Hz (exponential), with a little vibrato.
    const glide = Float32Array.from({ length: n }, (_, k) => Math.sin(TAU * 200 * D * ((4 ** (k / n) - 1) / Math.log(4)) + 0.4 * Math.sin((TAU * 5 * k) / SR)));
    return [0, 1].map(() => mix(shape(bp(noise(r, n), fc, 2.5), env), shape(Float32Array.from(glide), env), 0, 0.15));
  }, -13],
  // Phone camera / screenshot.
  shutter: [2, (r) => {
    const hit = (fm) => {
      const x = burst(r, 0.06, 0.0018, (n) => hp(n, 2000));
      mix(x, mode(U(r, 3000, 3800) * fm, 0.006), 0, 0.5);
      return mix(x, mode(U(r, 1000, 1400) * fm, 0.012), 0, 0.35);
    };
    const x = buf(0.2), at = U(r, 0.05, 0.08);
    mix(x, hit(1));
    mix(x, burst(r, at, 0.015, (n) => bp(n, 6000, 2)), 0.004, 0.1);
    return mix(x, hit(0.9), at, 0.75);
  }, -14],
  // Toggle switch.
  switch: [3, (r) => {
    const x = buf(0.06);
    mix(x, burst(r, 0.02, 0.0006, (n) => hp(n, 2000)));
    mix(x, mode(U(r, 2200, 2800), 0.004, 0.04), 0, 0.6);
    return mix(x, burst(r, 0.02, 0.0005, (n) => hp(n, 3000)), U(r, 0.012, 0.02), 0.4);
  }, -16],
  // Chat message sent (rising "fwip") / received (two soft bubbles).
  send: [3, (r) => {
    const f = U(r, 420, 520);
    const x = tone(0.2, f, f * U(r, 2.8, 3.4), 0.05, 0.05, 0.005);
    return mix(x, shape(bp(noise(r, N(0.2)), (k) => 1000 * 6 ** Math.min(1, k / N(0.12)), 1.2), decay(0.05, 0.005)), 0, 0.35);
  }, -17],
  receive: [3, (r) => {
    const f = U(r, 1100, 1400), up = U(r, 1.3, 1.5), gap = U(r, 0.07, 0.09);
    const note = (g) => tone(0.25, g * 0.92, g, 0.012, 0.07, 0.002, [1, 0.08]);
    return mix(mix(buf(gap + 0.3), note(f)), note(f * up), gap);
  }, -16],
  // Digital glitch (hacked, error, data corrupted): random bit-crushed noise and tone fragments.
  glitch: [3, (r) => {
    const D = U(r, 0.22, 0.38), x = buf(D);
    for (let t = 0; t < D - 0.012; ) {
      const len = Math.min(U(r, 0.012, 0.035), D - t), n = N(len), kind = r(), amp = U(r, 0.4, 1);
      let seg;
      if (kind < 0.2) seg = new Float32Array(n);
      else if (kind < 0.6) {
        const hold = Math.round(SR / U(r, 1500, 6000));
        let v = 0;
        seg = Float32Array.from({ length: n }, (_, k) => (k % hold === 0 ? (v = Math.round((r() * 2 - 1) * 8) / 8) : v));
      } else {
        const f = U(r, 150, 1800);
        seg = Float32Array.from({ length: n }, (_, k) => (Math.sin((TAU * f * k) / SR) > 0 ? 0.6 : -0.6));
      }
      mix(x, shape(seg, (s) => Math.min(1, s / 0.001, (len - s) / 0.001)), t, amp);
      t += len;
    }
    return x;
  }, -19],
  // Marker / pen stroke (striking a myth, circling a number).
  scribble: [3, (r) => {
    const D = U(r, 0.35, 0.55), rate = U(r, 8, 12), ph = U(r, 0, 3);
    const nz = noise(r, N(D));
    const x = bp(nz, U(r, 2500, 4200), 1.2);
    mix(x, lp(nz, 1200), 0, 0.2);
    return shape(x, (t) => (0.25 + 0.75 * Math.abs(Math.sin(Math.PI * rate * t + ph)) ** 1.5) * Math.min(1, t / 0.02, (D - t) / 0.06));
  }, -19],
  // Sparkle (AI, "magic", something new): scattered high pings across the stereo field.
  sparkle: [3, (r) => {
    const out = stereo(0.9), count = Math.round(U(r, 10, 16));
    for (let k = 0; k < count; k++) {
      const f = U(r, 2500, 6500), tau = U(r, 0.04, 0.12);
      mix(out, mode(f, tau, tau * 6), (k / count) ** 1.3 * 0.6 + U(r, 0, 0.03), 1 - (0.6 * k) / count, U(r, -0.8, 0.8));
    }
    return out;
  }, -18],
  // Phone vibrating on a table.
  buzz: [2, (r, i) => {
    const bursts = i ? [[0, 0.5]] : [[0, 0.28], [0.4, 0.28]];
    const x = buf(i ? 0.55 : 0.72);
    for (const [at, len] of bursts) {
      const f = U(r, 150, 175);
      const s = Float32Array.from({ length: N(len) }, (_, k) => ((((k * f) / SR) % 1) * 2 - 1) * (0.7 + 0.3 * r()));
      mix(x, shape(lp(s, 1200), gate(0.02, len - 0.05, 0.015)), at);
    }
    return x;
  }, -19],
};

// ---------- recorded sounds ----------
// Licensed files (Mixkit Sound Effects Free License: free for commercial use incl. social media,
// no attribution; not to be redistributed as-is), see ../media/sfx-mixkit/README.md. One variant
// each, kept at the file's own sample rate. rms = target dBFS of the loudest 300 ms, calibrated on
// the synthesised set (thud ≈ -22, ding/notif ≈ -26, error ≈ -25, pop ≈ -30); max = seconds kept.
const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "media", "sfx-mixkit");
const RECORDED = {
  boom: ["mixkit-2299-short-bass-hit.wav", -22], // deep bass hit: a shock, a big reveal
  impact: ["mixkit-1143-cinematic-whoosh-deep-impact.wav", -24], // whoosh into a cinematic boom
  scratch: ["mixkit-702-record-player-vinyl-scratch.wav", -26], // record scratch: "wait, what?"
  trombone: ["mixkit-744-trombone-disappoint.wav", -26], // sad trombone: fail, wrong guess
  wrong: ["mixkit-950-game-show-wrong-answer-buzz.wav", -26], // game-show wrong-answer buzzer
  correct: ["mixkit-600-achievement-bell.wav", -26], // right answer, achievement
  laugh: ["mixkit-424-crowd-laugh.wav", -28], // audience laugh after a joke
  applause: ["mixkit-523-animated-small-group-applause.wav", -28], // short applause
  crickets: ["mixkit-1788-summer-crickets-loop.wav", -30, 4], // awkward silence
  drumroll: ["mixkit-566-drum-roll.wav", -28], // before an answer or a number
  rimshot: ["mixkit-579-drum-joke-accent.wav", -24], // "ba-dum-tss" after a pun
  boing: ["mixkit-2894-boing-hit-sound.wav", -26], // cartoon bounce
  fall: ["mixkit-395-cartoon-falling-whistle.wav", -27], // cartoon falling whistle: speed dropping
  coins: ["mixkit-1993-clinking-coins.wav", -26], // money, saving, price
  honk: ["mixkit-715-clown-horn-at-circus.wav", -27], // clown horn: silly mistake
  suspense: ["mixkit-674-cartoon-suspense.wav", -28], // cartoon suspense sting
  bell: ["mixkit-931-service-bell.wav", -25], // reception bell "ting!"
  dizzy: ["mixkit-746-cartoon-dazzle-hit-and-birds.wav", -26], // hit + birds circling: confused
};
// PCM 16/24-bit WAV → { rate, chans }; reads only the "data" chunk (never to the end of the file).
function readWav(file) {
  const b = fs.readFileSync(file);
  let pos = 12, fmt, data;
  while (pos + 8 <= b.length) {
    const id = b.toString("ascii", pos, pos + 4), len = b.readUInt32LE(pos + 4);
    if (id === "fmt ") fmt = { ch: b.readUInt16LE(pos + 10), rate: b.readUInt32LE(pos + 12), bits: b.readUInt16LE(pos + 22) };
    else if (id === "data") {
      data = b.subarray(pos + 8, pos + 8 + len);
      break;
    }
    pos += 8 + len + (len & 1);
  }
  if (!fmt || !data || ![16, 24].includes(fmt.bits)) throw new Error(`${path.basename(file)}: bukan WAV PCM 16/24-bit`);
  const bps = fmt.bits / 8, n = Math.floor(data.length / (bps * fmt.ch));
  const chans = Array.from({ length: Math.min(2, fmt.ch) }, () => new Float32Array(n));
  for (let i = 0; i < n; i++)
    chans.forEach((c, k) => {
      const o = (i * fmt.ch + k) * bps;
      c[i] = bps === 2 ? data.readInt16LE(o) / 32768 : data.readIntLE(o, 3) / 8388608;
    });
  return { rate: fmt.rate, chans };
}
// Trim the silence around the sound, cut to `max` seconds (0.5 s fade-out), set the loudest 300 ms
// to `rms` dBFS with the peak kept under -6 dBFS, 3 ms fade-in and 10 ms fade-out.
function finishRecorded({ rate, chans }, rms, max) {
  const pk = peakOf(chans), floor = 10 ** (-50 / 20) * pk;
  const quiet = (i) => chans.every((c) => Math.abs(c[i]) < floor);
  let a = 0, end = chans[0].length;
  while (a < end - 1 && quiet(a)) a++;
  while (end > a + 1 && quiet(end - 1)) end--;
  a = Math.max(0, a - Math.round(rate * 0.003));
  end = Math.min(chans[0].length, end + Math.round(rate * 0.01));
  if (max) end = Math.min(end, a + Math.round(rate * max));
  const cut = chans.map((c) => c.slice(a, end));
  const n = cut[0].length, w = Math.min(n, Math.round(rate * 0.3)), sq = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) sq[i + 1] = sq[i] + cut.reduce((s, c) => s + c[i] * c[i], 0) / cut.length;
  let loud = 0;
  for (let i = 0; i + w <= n; i += Math.round(rate * 0.01)) loud = Math.max(loud, (sq[i + w] - sq[i]) / w);
  const g = Math.min(10 ** (rms / 20) / (Math.sqrt(loud) || 1), 10 ** (-6 / 20) / (peakOf(cut) || 1));
  const fadeIn = Math.round(rate * 0.003), fadeOut = Math.round(rate * (max && end - a >= Math.round(rate * max) ? 0.5 : 0.01));
  return cut.map((c) => c.map((v, i) => v * g * Math.min(1, (i + 1) / fadeIn, (n - i) / fadeOut)));
}

// ---------- render ----------
const peakOf = (chans) => Math.max(...chans.map((c) => c.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
function finish(sig, peakDb) {
  const chans = Array.isArray(sig) ? sig : [sig];
  // Trim trailing near-silence (keeps 10 ms), then a 5 ms fade so nothing ends on a click.
  const floor = 10 ** (-70 / 20) * peakOf(chans);
  let end = chans[0].length;
  while (end > 1 && chans.every((c) => Math.abs(c[end - 1]) < floor)) end--;
  end = Math.min(chans[0].length, end + N(0.01));
  const g = 10 ** (peakDb / 20) / (peakOf(chans) || 1);
  // Chimes cut off while still ringing get a longer fade (up to 0.4 s) instead of an audible stop.
  const tail = Math.max(...chans.map((c) => Math.max(...Array.from(c.subarray(Math.max(0, end - N(0.01)), end), Math.abs))));
  const fade = tail > 0.01 * peakOf(chans) ? Math.min(N(0.4), Math.round(end * 0.25)) : N(0.005);
  return chans.map((c) => c.slice(0, end).map((v, i) => v * g * Math.min(1, (end - i) / fade)));
}
function wav(chans, rate = SR) {
  const n = chans[0].length, ch = chans.length;
  const b = Buffer.alloc(44 + n * ch * 2);
  b.write("RIFF", 0, "ascii");
  b.writeUInt32LE(36 + n * ch * 2, 4);
  b.write("WAVEfmt ", 8, "ascii");
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * ch * 2, 28);
  b.writeUInt16LE(ch * 2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36, "ascii");
  b.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, chans[c][i])) * 32767), 44 + (i * ch + c) * 2);
  return b;
}

const list = {};
const files = [];
for (const [name, [variants, make, peakDb]] of Object.entries(SOUNDS)) {
  list[name] = [];
  for (let i = 0; i < variants; i++) {
    const chans = finish(make(rng(`${name}-${i}`), i), peakDb);
    list[name].push(Number((chans[0].length / SR).toFixed(3)));
    files.push([`${name}-${i}.wav`, chans]);
  }
}
const absent = [];
for (const [name, [file, rms, max]] of Object.entries(RECORDED)) {
  const src = path.join(LIB, file);
  if (!fs.existsSync(src)) {
    absent.push(file);
    continue;
  }
  const rec = readWav(src);
  const chans = finishRecorded(rec, rms, max);
  list[name] = [Number((chans[0].length / rec.rate).toFixed(3))];
  files.push([`${name}-0.wav`, chans, rec.rate]);
}
if (absent.length) console.warn(`Peringatan: ${absent.length} file rekaman tidak ada di ${LIB} (${absent.join(", ")}), jenisnya dilewati.`);
if (listOnly) {
  for (const [name, d] of Object.entries(list)) console.log(`${name.padEnd(9)} ${d.length}×  ${d.map((s) => s.toFixed(2)).join(" ")} dtk`);
  process.exit(0);
}
if (!fs.existsSync(path.join(dir, "src"))) {
  console.error(`Tidak ada folder src/ di ${dir}. Jalankan dari folder proyek (npm run sfx) atau beri foldernya.`);
  process.exit(1);
}
const out = path.join(dir, "public", "sfx");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
let bytes = 0;
for (const [file, chans, rate] of files) {
  const b = wav(chans, rate);
  bytes += b.length;
  fs.writeFileSync(path.join(out, file), b);
}
fs.writeFileSync(path.join(dir, "src", "sfx.json"), JSON.stringify({ rate: SR, list }, null, 1) + "\n");
console.log(`${files.length} efek suara (${Object.keys(list).length} jenis) → ${path.relative(process.cwd(), out) || out} (${(bytes / 1e6).toFixed(1)} MB) + src/sfx.json`);
