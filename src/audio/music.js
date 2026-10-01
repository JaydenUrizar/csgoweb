// Adaptive procedural music: tiny 16-step sequencer + synth voices. Loop-friendly (4 bars, Am-F-C-G), mixed low.
// States: menu | buy | live | armed (tempo/intensity ride the fuse) | win | lose | off.
import { osc, noise, click, ring, midi, clamp, lerp, mulberry32, dB } from './dsp.js';

const CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];   // Am F C G (voicing around A3)
const ROOTS = [33, 29, 36, 31];
const ARP = [0, 1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 1, 2, 1, 0, 1];

// ---- instrument voices (V = {ac,t,out,r,end}) ----
const at = (V, when) => ({ ...V, t: V.t + when, end: 0 });
function kick(V, w, g = 0.8) { const v = at(V, w); osc(v, { f0: 140, f1: 44, pt: 0.05, d: 0.3, g, sat: 0.15 }); noise(v, { a: 0.0005, d: 0.012, g: g * 0.3, lp: 3000 }); }
function hat(V, w, g = 0.15, open = false) { noise(at(V, w), { a: 0.0005, d: open ? 0.16 : 0.035, g, hp: 7500 }); }
function clap(V, w, g = 0.3) { const v = at(V, w); for (const o of [0, 0.011, 0.023]) noise(v, { when: o, a: 0.0005, d: 0.02, g: g * 0.6, bp: 1600, q: 1.2 }); noise(v, { when: 0.024, a: 0.001, d: 0.14, g, bp: 1500, q: 0.8 }); }
function bass(V, w, note, dur, g = 0.4, bright = 900) { const f = midi(note), v = at(V, w); osc(v, { type: 'sawtooth', f0: f, d: dur, hold: dur * 0.15, a: 0.005, g, lp: [bright * 0.35, bright, 0.02], lpQ: 2 }); osc(v, { f0: f, d: dur * 1.1, g: g * 0.9, a: 0.005 }); }
function pad(V, w, notes, dur, g = 0.05) { const v = at(V, w); for (const n of notes) for (const dt of [-9, 0, 9]) osc(v, { type: 'sawtooth', f0: midi(n), det: dt, a: Math.min(1.2, dur * 0.4), hold: dur * 0.3, d: dur * 0.5, g, lp: [500, 1300, dur * 0.6], lpQ: 0.8 }); }
function pluck(V, w, note, g = 0.12, d = 0.28) { const f = midi(note), v = at(V, w); osc(v, { type: 'triangle', f0: f, d, g, a: 0.002, lp: [4200, 900, d] }); osc(v, { type: 'square', f0: f, d: d * 0.5, g: g * 0.35, a: 0.002, lp: [3000, 700, d * 0.5] }); }
function riser(V, w, len, g = 0.1) { noise(at(V, w), { a: len * 0.9, hold: 0.05, d: 0.1, g, bp: 400, q: 0.6, sweep: [7000, len], hp: 300 }); }

export const MUSIC_STATES = ['menu', 'buy', 'live', 'armed', 'win', 'lose', 'off'];
export const STATE_GAIN = { menu: 0.6, buy: 0.45, live: 0.4, armed: 0.45, win: 1, lose: 1 };
export const STATE_BPM = { menu: 84, buy: 100, live: 90, armed: 112, win: 110, lose: 80 };

/** Schedule one 16th step of a looping state. */
function step(V, state, i, w, sd, I = 0) {
  const s16 = i % 16, bar = ((i / 16) | 0) % 4, ch = CHORDS[bar], root = ROOTS[bar];
  if (state === 'menu') {
    if (s16 === 0) pad(V, w, [...ch, root + 24], sd * 16, 0.045);
    if (s16 % 2 === 0) pluck(V, w, ch[ARP[s16]] + (s16 % 8 === 0 ? 24 : 12), 0.07, 0.4);
    if (s16 === 0 || s16 === 8) kick(V, w, 0.35);
    if (s16 === 4 || s16 === 12) hat(V, w, 0.06);
    if (s16 === 0) bass(V, w, root, sd * 8, 0.3, 500);
  } else if (state === 'buy') {
    if (s16 % 2 === 0) bass(V, w, root + (s16 === 6 || s16 === 14 ? 12 : 0), sd * 1.6, 0.26, 700);
    if (s16 === 0) pad(V, w, ch, sd * 16, 0.035);
    if (s16 % 4 === 0) hat(V, w, 0.06);
    if (s16 === 0) kick(V, w, 0.3);
    if (s16 === 10 || s16 === 15) pluck(V, w, ch[(s16 + bar) % 3] + 24, 0.08, 0.3);
  } else if (state === 'live') {
    if (s16 === 0) { pad(V, w, [root + 12, root + 19], sd * 16, 0.04); bass(V, w, root, sd * 14, 0.14, 300); }
    if (s16 === 8 && bar % 2 === 1) pluck(V, w, ch[bar % 3] + 24, 0.05, 0.6);
    if (s16 % 8 === 0) hat(V, w, 0.025);
  } else if (state === 'armed') {
    const lvl = I;    // 0..1
    if (s16 % 4 === 0) kick(V, w, 0.5);
    if (s16 % 2 === 0 || lvl > 0.5) bass(V, w, root, sd * 1.7, 0.22 + lvl * 0.1, 500 + lvl * 1500);
    if (s16 % 2 === 0 || lvl > 0.35) hat(V, w, 0.05 + lvl * 0.06, s16 % 8 === 6);
    if (lvl > 0.2 && s16 % 2 === 1) pluck(V, w, ch[ARP[s16]] + 24, 0.06 + lvl * 0.05, 0.16);
    if (lvl > 0.55 && (s16 === 4 || s16 === 12)) clap(V, w, 0.16);
    if (lvl > 0.75 && s16 === 0 && bar % 2 === 1) riser(V, w, sd * 16, 0.07);
    if (s16 === 0 && bar === 0) pad(V, w, ch, sd * 16, 0.03);
  }
}
/** One-shot stingers (win / lose), relative to V.t. Returns duration. */
function sting(V, state) {
  if (state === 'win') {
    [57, 60, 64, 69, 72, 76, 81].forEach((n, i) => { pluck(V, i * 0.11, n + 12, 0.16, 0.7); });
    pad(V, 0, [57, 64, 69, 72], 3.4, 0.05); bass(V, 0, 33, 1.6, 0.4, 700); kick(V, 0, 0.6); kick(V, 0.77, 0.5); clap(V, 0.77, 0.25);
    ring(V, { when: 0.77, f: 1760, ratios: [1, 1.5, 2, 3], d: 2.2, g: 0.07 });
    return 4;
  }
  [57, 53, 50, 45].forEach((n, i) => { pluck(V, i * 0.32, n, 0.16, 1.0); });
  pad(V, 0, [45, 48, 52], 3.6, 0.05); bass(V, 0.3, 29, 2.2, 0.3, 350);
  return 4;
}

function mkV(ac, out, seed) { return { ac, t: 0, out, r: mulberry32(seed), end: 0, fp: true, o: {} }; }
const barLen = (bpm) => (60 / bpm) * 4;

/** Live sequencer. */
export function createMusic(mixer) {
  const ac = mixer.ac;
  let cur = null, pending = null, nextT = 0, idx = 0, bpm = 100, intensity = 0, timer = 0, want = 'menu', running = false, sting_ = null;
  const state = { name: 'off', bus: null };
  function mkBus(name) { const b = ac.createGain(); b.gain.value = 0.0001; b.connect(mixer.bus.music.in); b.gain.setTargetAtTime(STATE_GAIN[name] ?? 1, ac.currentTime, 0.25); return b; }
  function killBus(b, fade = 0.5) { if (!b) return; b.gain.cancelScheduledValues(ac.currentTime); b.gain.setTargetAtTime(0.0001, ac.currentTime, fade / 3); setTimeout(() => { try { b.disconnect(); } catch {} }, (fade + 2.5) * 1000); }
  function begin(name) {
    killBus(state.bus, name === 'win' || name === 'lose' ? 0.25 : 0.8);
    state.name = name; state.bus = name === 'off' ? null : mkBus(name);
    idx = 0; bpm = STATE_BPM[name] ?? 100; nextT = ac.currentTime + 0.06;
    if (name === 'win' || name === 'lose') { const V = mkV(ac, state.bus, 99); V.t = nextT; sting(V, name); sting_ = { until: ac.currentTime + 4 }; } else sting_ = null;
  }
  function tick() {
    if (!running || ac.state !== 'running') return;
    const now = ac.currentTime;
    if (sting_) { if (now > sting_.until) { sting_ = null; killBus(state.bus, 0.3); state.name = 'off'; state.bus = null; } return; }
    if (state.name === 'off' || !state.bus) { if (pending) { const p = pending; pending = null; begin(p); } return; }
    const V = mkV(ac, state.bus, 1234 + idx * 7);
    while (nextT < now + 0.18) {
      if (idx % 16 === 0 && pending) { const p = pending; pending = null; begin(p); if (state.name === 'win' || state.name === 'lose') return; }
      const sd = 60 / bpm / 4; V.t = nextT; V.r = mulberry32(1234 + idx * 7);
      step(V, state.name, idx, 0, sd, intensity);
      nextT += sd; idx++;
      if (state.name === 'armed') bpm = lerp(112, 168, intensity);
    }
  }
  return {
    get state() { return want; },
    get playing() { return state.name; },
    set(name, { immediate = false } = {}) {
      if (!MUSIC_STATES.includes(name)) return; want = name;
      if (!running) return;
      if (name === state.name && !pending) return;
      if (name === 'win' || name === 'lose' || name === 'off' || immediate || state.name === 'off') { pending = null; begin(name); } else pending = name;
    },
    setIntensity(x) { intensity = clamp(x, 0, 1); },
    start() { if (running) return; running = true; timer = setInterval(tick, 30); const w = want; want = ''; this.set(w, { immediate: true }); },
    stop() { running = false; clearInterval(timer); killBus(state.bus, 0.2); state.bus = null; state.name = 'off'; },
    setVolume(v) { mixer.setVolumes({ music: v }); },
  };
}

/** Offline: render `seconds` of a music state onto ac (for tools). */
export function scheduleMusicOffline(ac, out, name, seconds, { intensity = 0.5 } = {}) {
  const V = mkV(ac, out, 1); let t = 0.05, i = 0, bpm = STATE_BPM[name] ?? 100;
  const gain = ac.createGain(); gain.gain.value = STATE_GAIN[name] ?? 1; gain.connect(out); V.out = gain;
  if (name === 'win' || name === 'lose') { V.t = 0.05; sting(V, name); return; }
  while (t < seconds) { const sd = 60 / bpm / 4; V.t = t; V.r = mulberry32(1234 + i * 7); step(V, name, i, 0, sd, intensity); t += sd; i++; if (name === 'armed') bpm = lerp(112, 168, intensity); }
}
