// Procedurally generated impulse responses for the three reverb sends: open courtyard, tunnel/corridor, small room.
import { mulberry32 } from './dsp.js';

/** 3-band exponential-decay noise IR (low/mid/high T60), sparse early taps, stereo-decorrelated. */
export function makeIR(ac, { dur = 1.5, t60 = [1.5, 1, 0.5], predelay = 0.01, early = [], density = 1, flutter = null, seed = 1, damp = 3500 } = {}) {
  const sr = ac.sampleRate, len = Math.floor(sr * dur), buf = ac.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c), r = mulberry32(seed * 977 + c * 131);
    let l1 = 0, l2 = 0; const a1 = 1 - Math.exp(-2 * Math.PI * 450 / sr), a2 = 1 - Math.exp(-2 * Math.PI * damp / sr);
    const pd = Math.floor(predelay * sr);
    for (let i = pd; i < len; i++) {
      const t = (i - pd) / sr;
      let x = r() * 2 - 1;
      if (density < 1 && r() > density) x = 0;
      l1 += a1 * (x - l1); l2 += a2 * (x - l2);
      const low = l1, mid = l2 - l1, high = x - l2;
      const e = (b) => Math.exp((-6.91 * t) / t60[b]);
      let v = low * e(0) * 2.6 + mid * e(1) * 1.4 + high * e(2) * 0.7;
      v *= Math.min(1, t / 0.006);          // soft onset
      d[i] = v * (density < 1 ? 1 / Math.sqrt(density) : 1);
    }
    for (const tap of early) {               // discrete reflections (slap-back off buildings, walls)
      const i = Math.floor((tap.t + (c ? 0.0017 : 0)) * sr + predelay * sr); if (i < len - 4) { const s = (r() < 0.5 ? -1 : 1) * tap.g; d[i] += s; d[i + 1] += s * 0.55; d[i + 2] += s * 0.25; d[i + 3] += s * 0.1; }
    }
    if (flutter) for (let n = 1; n < flutter.count; n++) {   // tunnel flutter echo train
      const i = Math.floor((predelay + flutter.every * n * (1 + (c ? 0.03 : 0))) * sr); if (i < len - 4) { const s = flutter.g * Math.pow(flutter.decay, n) * (r() < 0.5 ? -1 : 1); d[i] += s; d[i + 1] += s * 0.5; d[i + 2] += s * 0.2; }
    }
  }
  return buf;
}

export const IR_PRESETS = {
  open: { dur: 1.7, t60: [1.55, 0.9, 0.3], predelay: 0.014, density: 0.4, seed: 3, damp: 2600, early: [{ t: 0.058, g: 0.55 }, { t: 0.105, g: 0.4 }, { t: 0.18, g: 0.25 }, { t: 0.29, g: 0.14 }] },
  tunnel: { dur: 2.3, t60: [2.2, 1.7, 0.85], predelay: 0.008, density: 1, seed: 5, damp: 4200, early: [{ t: 0.012, g: 0.5 }, { t: 0.02, g: 0.4 }], flutter: { every: 0.031, count: 40, g: 0.5, decay: 0.9 } },
  room: { dur: 0.75, t60: [0.62, 0.42, 0.2], predelay: 0.004, density: 1, seed: 9, damp: 3800, early: [{ t: 0.006, g: 0.6 }, { t: 0.011, g: 0.5 }, { t: 0.017, g: 0.45 }, { t: 0.024, g: 0.35 }, { t: 0.033, g: 0.3 }] },
};
export const makePresetIR = (ac, name) => makeIR(ac, IR_PRESETS[name]);
