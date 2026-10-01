// Tagger sound design: multi-layer procedural reports + mechanism stages for all 12 taggers.
// Layers per shot: click transient -> crack (band noise) -> tonal body (pitch-enveloped) -> zap (energy chirp) -> sub -> tail -> mechanism.
import { osc, noise, click, ring, chain, dB } from './dsp.js';
import { reg } from './registry.js';

const RR = [1, 0.965, 1.035, 0.985];      // round-robin pitch offsets
const RRC = [1, 1.09, 0.93, 1.04];        // round-robin crack colour offsets

/** Mechanical clack: transient + band noise + body thunk + optional metallic ring. */
export function clack(V, when, { f = 2400, g = 0.4, d = 0.02, metal = 0.5, body = 180 } = {}) {
  const J = 1 + (V.r() - 0.5) * 0.12;
  click(V, { when, g: g * 0.9, hp: f * 0.6 * J, d: 0.004 });
  noise(V, { when, a: 0.0004, d, g: g * 0.6, bp: f * J, q: 2.2 });
  osc(V, { when, f0: body * 1.5 * J, f1: body, pt: 0.012, d: d * 1.8, g: g * 0.8 });
  if (metal > 0) ring(V, { when, f: f * 0.75 * J, ratios: [1, 2.32, 3.71], decays: [1, 0.6, 0.35], gains: [1, 0.5, 0.3], d: 0.16, g: g * metal * 0.55 });
}
/** Slide / friction sweep. */
export function slide(V, when, dur, { f0 = 600, f1 = 1800, g = 0.2, q = 1.3 } = {}) {
  noise(V, { when, a: dur * 0.35, hold: dur * 0.15, d: dur * 0.5, g, bp: f0, q, sweep: [f1, dur], hp: 200 });
}

function gun(V, P) {
  const { r, fp } = V, o = V.o, rr = (o.rr | 0) & 3, pit = (o.pitch || 1) * RR[rr];
  const J = (x, p = 0.07) => x * (1 + (r() * 2 - 1) * p);
  const gk = (fp ? 1 : 0.8), tailK = (fp ? 1 : 1.5) * 0.75, tailD = fp ? 1 : 1.45, BK = 0.5, SK = 0.3;
  const c = P.crack;
  click(V, { g: (P.click ?? 0.6) * gk * 0.45, hp: J(P.clickHp ?? 2600), d: 0.003 });
  noise(V, { a: 0.0003, d: c.d * (fp ? 1 : 1.2), g: c.g * gk * 1.5, bp: J(c.f * RRC[rr], 0.06), q: c.q ?? 0.8, hp: (c.hp ?? 500) * 1.2, lp: (c.lp ?? 9000) * (fp ? 1 : 0.5), sat: c.sat ?? 0.2 });
  const b = P.body;
  osc(V, { f0: J(b.f0, 0.03) * pit, f1: b.f1 * pit, pt: b.pt, d: b.d * (fp ? 1 : 0.9), g: b.g * BK * (fp ? 1 : 0.85), sat: b.sat ?? 0.15, type: b.type ?? 'sine' });
  if (P.body2) osc(V, { f0: P.body2.f0 * pit, f1: P.body2.f1 * pit, pt: P.body2.pt, d: P.body2.d, g: P.body2.g * BK * gk, type: P.body2.type ?? 'triangle', sat: 0.25 });
  if (P.zap) osc(V, { type: P.zap.type ?? 'sawtooth', f0: J(P.zap.f0) * pit, f1: P.zap.f1 * pit, pt: P.zap.pt, d: P.zap.d, g: P.zap.g * gk, lp: P.zap.lp ?? 5000, hp: P.zap.hp ?? 200 });
  if (P.sub) osc(V, { f0: P.sub.f * pit * 1.2, f1: P.sub.f * pit, pt: 0.05, d: P.sub.d, g: P.sub.g * SK * (fp ? 1 : 0.35) });
  const t = P.tail;
  noise(V, { kind: 'pink', a: 0.002, d: t.d * tailD, g: t.g * tailK, hp: t.hp ?? 90, lp: [t.hi * (fp ? 1 : 0.6), t.lo, t.d * tailD], when: t.delay ?? 0.004 });
  if (P.ring) ring(V, { f: P.ring.f * pit, ratios: P.ring.ratios, decays: P.ring.decays, gains: P.ring.gains, d: P.ring.d, g: P.ring.g * (fp ? 1 : 0.6), when: 0.002 });
  if (P.mech && fp) clack(V, P.mech.t, { f: P.mech.f, g: P.mech.g, d: 0.02, metal: P.mech.metal ?? 0.4, body: P.mech.body ?? 200 });
  if (P.extra) P.extra(V, { J, rr, gk, fp, pit });
}

// ---------------- per-tagger fire parameters ----------------
const FIRE = {
  pip: { click: 0.55, crack: { f: 3300, d: 0.02, g: 0.5, q: 0.7, lp: 9000 }, body: { f0: 250, f1: 92, pt: 0.02, d: 0.13, g: 0.85 }, zap: { f0: 2000, f1: 520, pt: 0.03, d: 0.07, g: 0.2 },
    tail: { hi: 4200, lo: 800, d: 0.28, g: 0.16 }, mech: { t: 0.05, f: 2200, g: 0.11, metal: 0.3, body: 260 } },
  twin: { click: 0.6, clickHp: 3500, crack: { f: 4300, d: 0.013, g: 0.5, q: 0.7, lp: 11000 }, body: { f0: 360, f1: 150, pt: 0.012, d: 0.075, g: 0.7 }, zap: { type: 'square', f0: 3000, f1: 1000, pt: 0.02, d: 0.05, g: 0.16, lp: 6000 },
    tail: { hi: 5500, lo: 1200, d: 0.16, g: 0.13 }, mech: { t: 0.04, f: 3000, g: 0.08, metal: 0.4, body: 320 } },
  judge: { click: 0.7, clickHp: 1800, crack: { f: 1900, d: 0.055, g: 0.85, q: 0.5, sat: 0.55, hp: 250 }, body: { f0: 165, f1: 40, pt: 0.055, d: 0.5, g: 1.0, sat: 0.35 }, body2: { f0: 420, f1: 110, pt: 0.03, d: 0.16, g: 0.5 },
    sub: { f: 46, d: 0.55, g: 0.7 }, zap: { f0: 1500, f1: 300, pt: 0.05, d: 0.1, g: 0.18 },
    tail: { hi: 3200, lo: 260, d: 1.0, g: 0.36 }, ring: { f: 880, ratios: [1, 2.41, 3.93], decays: [1, 0.6, 0.4], gains: [1, 0.55, 0.3], d: 0.55, g: 0.09 }, mech: { t: 0.1, f: 1500, g: 0.2, metal: 0.8, body: 130 } },
  zip: { click: 0.5, clickHp: 3800, crack: { f: 5200, d: 0.01, g: 0.42, q: 0.8, hp: 900, lp: 11000 }, body: { f0: 430, f1: 210, pt: 0.008, d: 0.05, g: 0.5 }, zap: { f0: 3800, f1: 1500, pt: 0.01, d: 0.04, g: 0.14, lp: 7000 },
    tail: { hi: 5000, lo: 1400, d: 0.1, g: 0.1, hp: 1200 } },
  hum: { click: 0.55, clickHp: 3000, crack: { f: 3500, d: 0.015, g: 0.5, q: 0.8, hp: 700 }, body: { f0: 310, f1: 130, pt: 0.014, d: 0.08, g: 0.72 }, zap: { f0: 190, f1: 150, pt: 0.05, d: 0.09, g: 0.22, type: 'sawtooth', lp: 1800 },
    tail: { hi: 4200, lo: 900, d: 0.17, g: 0.13, hp: 200 }, ring: { f: 1400, ratios: [1, 1.5], decays: [1, 0.6], gains: [1, 0.5], d: 0.09, g: 0.05 } },
  arc: { click: 0.7, clickHp: 2200, crack: { f: 2700, d: 0.032, g: 0.85, q: 0.6, sat: 0.6, hp: 400 }, body: { f0: 210, f1: 66, pt: 0.028, d: 0.22, g: 0.98, sat: 0.3 }, body2: { f0: 520, f1: 180, pt: 0.02, d: 0.09, g: 0.4 },
    zap: { f0: 2400, f1: 380, pt: 0.05, d: 0.13, g: 0.26, lp: 6500 }, sub: { f: 60, d: 0.2, g: 0.35 },
    tail: { hi: 3800, lo: 400, d: 0.55, g: 0.3 }, mech: { t: 0.06, f: 1900, g: 0.15, metal: 0.6, body: 190 },
    extra(V, { J, gk }) { for (const [t, f] of [[0.006, 5200], [0.018, 6800], [0.034, 4300]]) noise(V, { when: t + V.r() * 0.004, a: 0.0002, d: 0.008 + V.r() * 0.008, g: 0.3 * gk, hp: J(f), q: 1 }); } },
  rail: { click: 0.5, clickHp: 3000, crack: { f: 3000, d: 0.022, g: 0.6, q: 0.7, hp: 600, sat: 0.15 }, body: { f0: 265, f1: 112, pt: 0.03, d: 0.15, g: 0.82 },
    zap: { type: 'sine', f0: 1200, f1: 3400, pt: 0.05, d: 0.09, g: 0.16, lp: 8000 }, tail: { hi: 3600, lo: 600, d: 0.34, g: 0.2, hp: 150 },
    ring: { f: 1900, ratios: [1, 2.01], decays: [1, 0.5], gains: [1, 0.35], d: 0.26, g: 0.05 }, mech: { t: 0.055, f: 2500, g: 0.09, metal: 0.4, body: 220 } },
  halo: { click: 0.4, clickHp: 2500, crack: { f: 2100, d: 0.024, g: 0.4, q: 0.6, hp: 500, sat: 0.1 }, body: { f0: 185, f1: 88, pt: 0.03, d: 0.13, g: 0.72 },
    zap: { type: 'sine', f0: 3400, f1: 900, pt: 0.06, d: 0.12, g: 0.15, lp: 8000 }, tail: { hi: 5200, lo: 700, d: 0.55, g: 0.2, hp: 200 },
    ring: { f: 880, ratios: [1, 2.76, 5.4, 8.9], decays: [1, 0.7, 0.45, 0.3], gains: [1, 0.55, 0.3, 0.16], d: 1.0, g: 0.16 } },
  lance: { click: 0.8, clickHp: 1500, crack: { f: 1500, d: 0.085, g: 1.0, q: 0.45, sat: 0.7, hp: 150 }, body: { f0: 115, f1: 27, pt: 0.09, d: 0.8, g: 1.0, sat: 0.35 }, body2: { f0: 380, f1: 80, pt: 0.05, d: 0.25, g: 0.55 },
    sub: { f: 34, d: 1.0, g: 0.8 }, zap: { f0: 5200, f1: 280, pt: 0.14, d: 0.25, g: 0.2, lp: 9000 },
    tail: { hi: 2600, lo: 170, d: 1.7, g: 0.5, hp: 50 },
    extra(V) { noise(V, { a: 0.0001, d: 0.022, g: 0.5, hp: 6000 }); } },
  scatter: { click: 0.75, clickHp: 1800, crack: { f: 1900, d: 0.065, g: 0.95, q: 0.4, sat: 0.6, hp: 200 }, body: { f0: 175, f1: 52, pt: 0.05, d: 0.32, g: 0.95, sat: 0.3 }, body2: { f0: 500, f1: 130, pt: 0.03, d: 0.14, g: 0.4 },
    sub: { f: 44, d: 0.32, g: 0.45 }, tail: { hi: 3500, lo: 300, d: 0.85, g: 0.38, hp: 80 },
    extra(V, { J, gk }) { for (let i = 0; i < 9; i++) noise(V, { when: 0.008 + V.r() * 0.07, a: 0.0002, d: 0.006 + V.r() * 0.01, g: (0.18 + V.r() * 0.15) * gk, hp: J(4200, 0.3), q: 1 }); } },
  storm: { click: 0.7, clickHp: 2000, crack: { f: 2200, d: 0.028, g: 0.75, q: 0.55, sat: 0.55, hp: 250 }, body: { f0: 135, f1: 54, pt: 0.02, d: 0.17, g: 1.0, sat: 0.3 }, body2: { f0: 300, f1: 100, pt: 0.02, d: 0.1, g: 0.4 },
    sub: { f: 58, d: 0.2, g: 0.6 }, zap: { f0: 1400, f1: 300, pt: 0.03, d: 0.07, g: 0.1 },
    tail: { hi: 2800, lo: 250, d: 0.5, g: 0.32, hp: 70 }, mech: { t: 0.035, f: 1300, g: 0.16, metal: 0.7, body: 120 },
    extra(V, { fp }) { if (fp) for (let i = 0; i < 3; i++) clack(V, 0.05 + i * 0.022 + V.r() * 0.006, { f: 1600 + i * 300, g: 0.07, d: 0.012, metal: 0.3, body: 300 }); } },
};

// Melee: swing whoosh (fire) + thwack on contact
function tapFire(V) {
  const fp = V.fp, J = 1 + (V.r() - 0.5) * 0.1;
  noise(V, { a: 0.07, hold: 0.02, d: 0.14, g: 0.32 * (fp ? 1 : 0.8), bp: 380 * J, q: 0.9, sweep: [2400 * J, 0.16], hp: 120 });
  noise(V, { kind: 'pink', a: 0.05, d: 0.2, g: 0.16, lp: [900, 2600, 0.2], hp: 200 });
  osc(V, { f0: 190 * J, f1: 120, pt: 0.1, a: 0.04, d: 0.12, g: 0.09 });
}
function tapHit(V) {
  const J = 1 + (V.r() - 0.5) * 0.12;
  click(V, { g: 0.7, hp: 1800 });
  noise(V, { a: 0.0003, d: 0.05, g: 0.6, bp: 1500 * J, q: 0.9, sat: 0.3 });
  osc(V, { f0: 280 * J, f1: 95, pt: 0.02, d: 0.16, g: 0.9, sat: 0.2 });
  ring(V, { f: 1200 * J, ratios: [1, 2.6], decays: [1, 0.5], gains: [1, 0.4], d: 0.16, g: 0.1 });
}

// ---------------- reload / handling profiles ----------------
const PROF = {
  pip: { f: 2600, body: 220, metal: 0.5, energy: 0.0, w: 0.8 }, twin: { f: 3000, body: 260, metal: 0.6, energy: 0.0, w: 0.7 },
  judge: { f: 1700, body: 130, metal: 0.9, energy: 0.0, w: 1.15 }, zip: { f: 3300, body: 300, metal: 0.3, energy: 0.0, w: 0.75 },
  hum: { f: 2900, body: 240, metal: 0.4, energy: 0.15, w: 0.85 }, arc: { f: 2200, body: 170, metal: 0.7, energy: 0.2, w: 1.05 },
  rail: { f: 2500, body: 190, metal: 0.6, energy: 0.55, w: 1.0 }, halo: { f: 2300, body: 200, metal: 0.7, energy: 0.8, w: 0.95 },
  lance: { f: 1500, body: 120, metal: 0.9, energy: 0.3, w: 1.25 }, scatter: { f: 1800, body: 140, metal: 0.8, energy: 0.0, w: 1.1 },
  storm: { f: 1400, body: 110, metal: 0.8, energy: 0.0, w: 1.3 }, tap: { f: 2800, body: 200, metal: 0.2, energy: 0, w: 0.5 },
};
const whine = (V, when, p, dur, up = true, g = 0.08) => { if (p.energy > 0) osc(V, { type: 'sine', when, f0: up ? 500 : 1800, f1: up ? 1900 : 420, pt: dur, a: dur * 0.3, d: dur * 0.8, g: g * (0.4 + p.energy), lp: 6000, vib: 8, vibF: 30 }); };
const vol = (V) => (V.fp ? 1 : 0.55);

function reload1(V, id) {           // magazine out
  const p = PROF[id], k = vol(V), j = 1 + (V.r() - 0.5) * 0.08;
  clack(V, 0, { f: p.f * 0.9 * j, g: 0.30 * k, metal: p.metal * 0.6, body: p.body });
  slide(V, 0.03, 0.12 * p.w, { f0: 900, f1: 450, g: 0.14 * k });
  osc(V, { when: 0.17 * p.w, f0: p.body * 1.3, f1: p.body * 0.6, pt: 0.03, d: 0.09, g: 0.25 * k, sat: 0.1 });
  noise(V, { when: 0.17 * p.w, a: 0.0005, d: 0.04, g: 0.1 * k, bp: 700, q: 1 });
  whine(V, 0, p, 0.25, false, 0.05 * k);
}
function reload2(V, id) {           // magazine in
  const p = PROF[id], k = vol(V), j = 1 + (V.r() - 0.5) * 0.08;
  slide(V, 0, 0.1 * p.w, { f0: 500, f1: 1200, g: 0.16 * k });
  const t = 0.11 * p.w;
  osc(V, { when: t, f0: p.body * 1.6 * j, f1: p.body * 0.7, pt: 0.02, d: 0.13, g: 0.6 * k, sat: 0.15 });
  clack(V, t, { f: p.f * j, g: 0.42 * k, metal: p.metal, body: p.body * 0.9 });
  noise(V, { when: t, a: 0.0004, d: 0.03, g: 0.18 * k, hp: 4000 });
  whine(V, 0, p, 0.3, true, 0.08 * k);
}
function reload3(V, id) {           // chamber / charge handle
  const p = PROF[id], k = vol(V), j = 1 + (V.r() - 0.5) * 0.08;
  clack(V, 0, { f: p.f * 1.1 * j, g: 0.26 * k, metal: p.metal * 0.5, body: p.body * 1.1 });
  slide(V, 0.015, 0.09 * p.w, { f0: 700, f1: 1500, g: 0.1 * k });
  const t = 0.11 * p.w;
  clack(V, t, { f: p.f * 0.95 * j, g: 0.5 * k, metal: p.metal, body: p.body });
  ring(V, { when: t, f: p.f * 0.5, ratios: [1, 2.7, 4.6], decays: [1, 0.5, 0.3], gains: [1, 0.4, 0.2], d: 0.22, g: 0.06 * k * p.metal });
  whine(V, t, p, 0.2, true, 0.06 * k);
  if (p.energy > 0.5) osc(V, { when: t + 0.02, f0: 1400, f1: 1800, pt: 0.1, a: 0.002, d: 0.12, g: 0.04 * p.energy * k });
}
function draw(V, id) {
  const p = PROF[id], k = vol(V), j = 1 + (V.r() - 0.5) * 0.1;
  noise(V, { a: 0.05, d: 0.11, g: 0.16 * k, bp: 500 * j, q: 0.8, sweep: [1500, 0.13], hp: 150 });         // cloth / motion
  slide(V, 0.03, 0.08 * p.w, { f0: 800, f1: 1600, g: 0.07 * k });
  clack(V, 0.11 * p.w, { f: p.f * j, g: 0.30 * k, metal: p.metal, body: p.body });                          // seat
  whine(V, 0.02, p, 0.16, true, 0.05 * k);
}
function empty(V, id) {
  const p = PROF[id], k = V.fp ? 1 : 0.6, j = 1 + (V.r() - 0.5) * 0.06;
  click(V, { g: 0.55 * k, hp: 1800 });
  noise(V, { a: 0.0003, d: 0.02, g: 0.3 * k, bp: p.f * 0.5 * j, q: 2 });
  osc(V, { f0: 900 * j, f1: 380, pt: 0.02, d: 0.04, g: 0.28 * k });
  if (p.energy > 0) osc(V, { f0: 2400, f1: 900, pt: 0.05, a: 0.001, d: 0.06, g: 0.1 * p.energy * k, lp: 5000 });
}
function inspect(V, id) {
  const p = PROF[id], k = vol(V);
  noise(V, { a: 0.09, d: 0.14, g: 0.10 * k, bp: 700, q: 0.7, sweep: [1500, 0.22] });
  clack(V, 0.16, { f: p.f * 1.05, g: 0.10 * k, metal: p.metal, body: p.body });
  clack(V, 0.52 + V.r() * 0.03, { f: p.f * 0.9, g: 0.14 * k, metal: p.metal * 0.7, body: p.body });
  noise(V, { when: 0.3, a: 0.08, d: 0.18, g: 0.07 * k, bp: 1100, q: 0.6, sweep: [500, 0.2] });
  whine(V, 0.4, p, 0.3, true, 0.04 * k);
}

const IDS = ['pip', 'twin', 'judge', 'zip', 'hum', 'arc', 'rail', 'halo', 'lance', 'scatter', 'storm'];
const REACH = { pip: 7, twin: 6, judge: 11, zip: 5, hum: 6, arc: 9, rail: 8, halo: 8, lance: 16, scatter: 11, storm: 10 };
const SEND = { pip: 0.32, twin: 0.28, judge: 0.42, zip: 0.22, hum: 0.25, arc: 0.4, rail: 0.34, halo: 0.55, lance: 0.6, scatter: 0.5, storm: 0.42 };
export const TRIM = { arc: 0.8, judge: 0.55, lance: 0.55, scatter: 0.55, storm: 0.55, halo: 1.2, hum: 1.45, twin: 1.45, zip: 3 };
const MAXV = { zip: 12, hum: 10, storm: 10, twin: 10 };

export function registerWeapons() {
  for (const id of IDS) {
    reg(`tagger.${id}.fire`, (V) => gun(V, FIRE[id]), { cat: 'tagger.' + id, ref: REACH[id], roll: 1.05, maxDist: 160, send: SEND[id], voices: MAXV[id] ?? 8, prio: 3, gain: TRIM[id] ?? 1 });
  }
  reg('tagger.tap.fire', tapFire, { cat: 'tagger.tap', ref: 2.5, send: 0.05, prio: 2, gain: 2 });
  reg('tagger.tap.hit', tapHit, { cat: 'tagger.tap', ref: 4, send: 0.15, prio: 3 });
  for (const id of [...IDS, 'tap']) {
    reg(`tagger.${id}.draw`, (V) => draw(V, id), { cat: 'tagger.' + id, ref: 2, send: 0.06, maxDist: 30, prio: 1 });
    reg(`tagger.${id}.inspect`, (V) => inspect(V, id), { cat: 'tagger.' + id, ref: 2, send: 0.05, maxDist: 20, prio: 0 });
    if (id !== 'tap') {
      reg(`tagger.${id}.reload1`, (V) => reload1(V, id), { cat: 'tagger.' + id, ref: 2.5, send: 0.08, maxDist: 40, prio: 1 });
      reg(`tagger.${id}.reload2`, (V) => reload2(V, id), { cat: 'tagger.' + id, ref: 2.5, send: 0.08, maxDist: 40, prio: 1 });
      reg(`tagger.${id}.reload3`, (V) => reload3(V, id), { cat: 'tagger.' + id, ref: 2.5, send: 0.08, maxDist: 40, prio: 1 });
      reg(`tagger.${id}.empty`, (V) => empty(V, id), { cat: 'tagger.' + id, ref: 2.5, send: 0.08, maxDist: 40, prio: 2 });
    }
  }
  reg('tagger.tap.empty', (V) => empty(V, 'tap'), { cat: 'tagger.tap', ref: 2 });
  // Follow-ups
  reg('tagger.lance.bolt', (V) => {   // bolt cycle after the shot: lift, pull, push, lock
    const p = PROF.lance, k = vol(V);
    clack(V, 0, { f: 1700, g: 0.35 * k, metal: 0.8, body: 130 });
    slide(V, 0.04, 0.15, { f0: 700, f1: 1400, g: 0.13 * k });
    clack(V, 0.2, { f: 1500, g: 0.32 * k, metal: 0.9, body: 120 });
    slide(V, 0.24, 0.1, { f0: 1400, f1: 800, g: 0.1 * k });
    clack(V, 0.36, { f: 1300, g: 0.45 * k, metal: 1, body: 100 });
    ring(V, { when: 0.36, f: 800, ratios: [1, 2.6, 4.2], decays: [1, 0.5, 0.3], gains: [1, 0.4, 0.2], d: 0.3, g: 0.07 * k });
    whine(V, 0.05, p, 0.3, true, 0.05 * k);
  }, { cat: 'tagger.lance', ref: 3, send: 0.1, maxDist: 50 });
  reg('tagger.scatter.pump', (V) => {  // pump: back-forward
    const k = vol(V);
    clack(V, 0, { f: 1500, g: 0.35 * k, metal: 0.8, body: 150 });
    slide(V, 0.02, 0.12, { f0: 600, f1: 1000, g: 0.12 * k });
    clack(V, 0.17, { f: 1300, g: 0.5 * k, metal: 0.9, body: 120 });
    noise(V, { when: 0.19, a: 0.0006, d: 0.04, g: 0.12 * k, hp: 3500 });
  }, { cat: 'tagger.scatter', ref: 3, send: 0.1, maxDist: 50 });
  reg('tagger.scope.in', (V) => { noise(V, { a: 0.03, d: 0.1, g: 0.14, bp: 1200, q: 0.9, sweep: [2600, 0.12] }); clack(V, 0.08, { f: 2600, g: 0.16, metal: 0.4, body: 300 }); osc(V, { f0: 1600, f1: 2400, pt: 0.1, d: 0.12, g: 0.03 }); }, { cat: 'tagger.misc', spatial: false, bus: 'sfx', send: 0.02 });
  reg('tagger.scope.out', (V) => { noise(V, { a: 0.03, d: 0.09, g: 0.12, bp: 2400, q: 0.9, sweep: [900, 0.1] }); clack(V, 0.02, { f: 2000, g: 0.14, metal: 0.4, body: 260 }); }, { cat: 'tagger.misc', spatial: false, bus: 'sfx', send: 0.02 });
  reg('tagger.pickup', (V) => { clack(V, 0, { f: 2200, g: 0.35, metal: 0.6 }); osc(V, { when: 0.02, f0: 700, f1: 1400, pt: 0.08, d: 0.14, g: 0.12 }); }, { cat: 'tagger.misc', ref: 3, maxDist: 40 });
  reg('tagger.drop', (V) => { osc(V, { f0: 260, f1: 80, pt: 0.03, d: 0.18, g: 0.55 }); noise(V, { a: 0.0005, d: 0.06, g: 0.3, bp: 900, q: 0.8 }); clack(V, 0.03, { f: 1800, g: 0.2, metal: 0.6 }); }, { cat: 'tagger.misc', ref: 3, maxDist: 45 });
}
export { IDS as TAGGER_IDS };
