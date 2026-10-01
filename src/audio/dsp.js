// Tiny synthesis toolkit shared by live playback and offline rendering.
// Every primitive works on any BaseAudioContext (AudioContext / OfflineAudioContext).
// A "voice" V = { ac, t, out, r, fp, o, end } : t is the absolute start time, out the destination node,
// r() a per-voice seeded random in [0,1), fp true for first-person mixes, o the play options, end the running max end time.

export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const cache = new WeakMap();
function store(ac) { let m = cache.get(ac); if (!m) { m = { noise: {}, curves: {} }; cache.set(ac, m); } return m; }

/** Cached noise buffers: 'white' | 'pink' | 'brown' (deterministic content so offline renders repeat). */
export function noiseBuffer(ac, kind = 'white') {
  const m = store(ac); if (m.noise[kind]) return m.noise[kind];
  const sr = ac.sampleRate, len = Math.floor(sr * (kind === 'white' ? 2.5 : 4));
  const buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const rnd = mulberry32(kind === 'white' ? 12345 : kind === 'pink' ? 777 : 4242);
  if (kind === 'white') for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1;
  else if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = rnd() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
  } else { let l = 0; for (let i = 0; i < len; i++) { l = (l + 0.02 * (rnd() * 2 - 1)) / 1.02; d[i] = l * 3.5; } }
  m.noise[kind] = buf; return buf;
}

/** Soft-clip curve; amount 0..1 (cached). */
export function satCurve(ac, amount) {
  const m = store(ac), k = Math.round(amount * 20) / 20; if (m.curves[k]) return m.curves[k];
  const n = 1024, c = new Float32Array(n), drive = 1 + k * 14;
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * drive) / Math.tanh(drive); }
  return (m.curves[k] = c);
}

const FLOOR = 0.0001;
/** Attack-then-exponential-decay envelope on an AudioParam. d ~ time to fall 80 dB. */
export function envAD(p, t, a, peak, d) {
  p.setValueAtTime(FLOOR, t); p.linearRampToValueAtTime(Math.max(peak, FLOOR * 2), t + Math.max(a, 0.0002));
  p.exponentialRampToValueAtTime(FLOOR, t + Math.max(a, 0.0002) + Math.max(d, 0.004));
}
/** Attack / hold / decay envelope. */
export function envAHD(p, t, a, peak, h, d) {
  p.setValueAtTime(FLOOR, t); p.linearRampToValueAtTime(Math.max(peak, FLOOR * 2), t + Math.max(a, 0.0002));
  p.setValueAtTime(Math.max(peak, FLOOR * 2), t + a + h); p.exponentialRampToValueAtTime(FLOOR, t + a + h + Math.max(d, 0.004));
}
const track = (V, e) => { if (e > V.end) V.end = e; };

/** Build filter chain after `src`: sat -> hp -> bp/lp (with optional sweeps) -> pan. Returns last node. */
export function chain(V, src, { sat = 0, hp = 0, lp = 0, bp = 0, q = 0.9, sweep = null, notch = 0, pan = 0, t = V.t, hpQ = 0.7, lpQ = 0.7 } = {}) {
  const ac = V.ac; let n = src;
  if (sat > 0) { const s = ac.createWaveShaper(); s.curve = satCurve(ac, sat); s.oversample = '2x'; n.connect(s); n = s; }
  if (hp) { const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; f.Q.value = hpQ; n.connect(f); n = f; }
  if (bp) {
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(bp, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(20, sweep[0]), t + sweep[1]);
    n.connect(f); n = f;
  }
  if (lp) {
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = lpQ;
    if (Array.isArray(lp)) { f.frequency.setValueAtTime(lp[0], t); f.frequency.exponentialRampToValueAtTime(Math.max(20, lp[1]), t + lp[2]); } else f.frequency.value = lp;
    n.connect(f); n = f;
  }
  if (notch) { const f = ac.createBiquadFilter(); f.type = 'notch'; f.frequency.value = notch; f.Q.value = 4; n.connect(f); n = f; }
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
  return n;
}

/** Oscillator layer with pitch envelope (f0 -> f1 over pt seconds), exponential decay. */
export function osc(V, { type = 'sine', f0 = 440, f1 = null, pt = 0.05, when = 0, a = 0.001, d = 0.1, g = 0.5, det = 0, dest = null, wave = null, fmF = 0, fmD = 0, vib = 0, vibF = 6, hold = 0, ...fx } = {}) {
  const ac = V.ac, t = V.t + when, o = ac.createOscillator();
  if (wave) o.setPeriodicWave(wave); else o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 != null && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + pt);
  if (det) o.detune.value = det;
  const gn = ac.createGain(); if (hold) envAHD(gn.gain, t, a, g, hold, d); else envAD(gn.gain, t, a, g, d);
  if (fmF) { const m = ac.createOscillator(), mg = ac.createGain(); m.frequency.value = fmF; mg.gain.value = fmD; m.connect(mg); mg.connect(o.frequency); m.start(t); m.stop(t + a + hold + d + 0.05); }
  if (vib) { const m = ac.createOscillator(), mg = ac.createGain(); m.frequency.value = vibF; mg.gain.value = vib; m.connect(mg); mg.connect(o.detune); m.start(t); m.stop(t + a + hold + d + 0.05); }
  const last = chain(V, o, { ...fx, t }); last.connect(gn); gn.connect(dest || V.out);
  const end = a + hold + d + 0.02; o.start(t); o.stop(t + end); track(V, t + end - V.t);
  return gn;
}

/** Noise layer with bandpass / lp / hp and optional bp sweep; random start offset in the buffer. */
export function noise(V, { kind = 'white', when = 0, a = 0.0005, d = 0.05, g = 0.5, dest = null, hold = 0, ...fx } = {}) {
  const ac = V.ac, t = V.t + when, src = ac.createBufferSource(), buf = noiseBuffer(ac, kind);
  src.buffer = buf; const len = a + hold + d + 0.05;
  const off = V.r() * Math.max(0, buf.duration - len - 0.01);
  const gn = ac.createGain(); if (hold) envAHD(gn.gain, t, a, g, hold, d); else envAD(gn.gain, t, a, g, d);
  const last = chain(V, src, { ...fx, t }); last.connect(gn); gn.connect(dest || V.out);
  src.start(t, off, len); track(V, t + len - V.t);
  return gn;
}

/** Inharmonic partials (metal / glass / bell): f * ratios, per-partial decay multipliers and gains. */
export function ring(V, { f = 1000, ratios = [1, 2.4, 3.9], decays = [1, 0.7, 0.5], gains = [1, 0.6, 0.4], d = 0.3, g = 0.3, when = 0, a = 0.0006, dest = null, det = 0, ...fx } = {}) {
  const out = V.ac.createGain(); out.gain.value = 1; const last = chain(V, out, { ...fx, t: V.t + when }); last.connect(dest || V.out);
  for (let i = 0; i < ratios.length; i++) osc(V, { f0: f * ratios[i] * (1 + (V.r() - 0.5) * det), when, a, d: d * (decays[i] ?? 0.5), g: g * (gains[i] ?? 0.3), dest: out });
  return out;
}

/** Very short broadband transient. */
export function click(V, { when = 0, g = 0.6, hp = 1800, lp = 0, d = 0.003, bp = 0, q = 1 } = {}) {
  return noise(V, { when, a: 0.00008, d, g, hp, lp, bp, q });
}

/** Periodic wave: band-limited saw with n harmonics 1/k^p roll-off (glottal / buzz timbre). */
export function buzzWave(ac, n = 32, p = 1) {
  const m = store(ac), key = 'w' + n + '_' + p; if (m.curves[key]) return m.curves[key];
  const re = new Float32Array(n + 1), im = new Float32Array(n + 1);
  for (let k = 1; k <= n; k++) im[k] = 1 / Math.pow(k, p);
  return (m.curves[key] = ac.createPeriodicWave(re, im, { disableNormalization: false }));
}

export const dB = (x) => Math.pow(10, x / 20);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
