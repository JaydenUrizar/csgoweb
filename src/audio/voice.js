// Robotic announcer: a small formant speech synthesiser (glottal buzz -> 3 formant filters, noise for fricatives/bursts)
// fed with ARPAbet-like phrases, wrapped with tone stings and a radio/robot colour. Fully procedural.
import { osc, ring, buzzWave, chain, noiseBuffer } from './dsp.js';
import { reg } from './registry.js';

const V_ = { // vowels: F1,F2,F3
  AA: [730, 1090, 2440], AE: [660, 1720, 2410], AH: [640, 1190, 2390], AO: [570, 840, 2410], EH: [530, 1840, 2480], ER: [490, 1350, 1690],
  IH: [390, 1990, 2550], IY: [270, 2290, 3010], UH: [440, 1020, 2240], UW: [300, 870, 2240],
};
const DIPH = { AY: ['AA', 'IY'], AW: ['AA', 'UW'], EY: ['EH', 'IY'], OW: ['AO', 'UW'], OY: ['AO', 'IY'] };
const SONOR = { M: [250, 1100, 2200, 0.55], N: [250, 1700, 2600, 0.55], NG: [250, 1500, 2500, 0.5], L: [360, 1300, 2900, 0.8], R: [310, 1060, 1380, 0.9], W: [290, 610, 2150, 0.75], Y: [260, 2070, 3020, 0.8] };
const FRIC = { S: [7200, 2.2, 4500, 0.55, 0], SH: [3400, 1.6, 2000, 0.6, 0], F: [5200, 0.5, 1200, 0.28, 0], TH: [6000, 0.6, 1800, 0.24, 0], HH: [1800, 0.5, 400, 0.3, 0], Z: [7000, 2.2, 4500, 0.35, 1], V: [4500, 0.5, 1200, 0.2, 1], DH: [5500, 0.6, 1800, 0.2, 1], ZH: [3200, 1.6, 2000, 0.35, 1] };
const STOP = { T: [4800, 1.5, 0], D: [3600, 1.2, 1], K: [2200, 1.4, 0], G: [1800, 1.2, 1], P: [1100, 0.6, 0], B: [900, 0.6, 1], CH: [3600, 1.2, 0], JH: [3200, 1.2, 1] };

/** Speak phoneme tokens. Returns end time (relative). */
export function speak(V, phon, { f0 = 112, when = 0, speed = 1, gain = 1, dest = null } = {}) {
  const ac = V.ac, t0 = V.t + when, out = dest || V.out;
  const toks = phon.trim().split(/\s+/);
  // total duration estimate
  const dur = (tok) => { if (tok === '_') return 0.13; const b = tok.replace(/\d/, ''); const st = /1/.test(tok); if (V_[b] || DIPH[b]) return (st ? 0.19 : 0.11) / speed; if (SONOR[b]) return 0.085 / speed; if (FRIC[b]) return (b === 'S' || b === 'SH' ? 0.11 : 0.08) / speed; if (STOP[b]) return (b === 'CH' || b === 'JH' ? 0.1 : 0.075) / speed; return 0.08; };
  let total = 0; for (const k of toks) total += dur(k);
  // sources
  const src = ac.createOscillator(); src.setPeriodicWave(buzzWave(ac, 40, 1.15));
  const vg = ac.createGain(); vg.gain.setValueAtTime(0.0001, t0); src.connect(vg);
  const nz = ac.createBufferSource(); nz.buffer = noiseBuffer(ac, 'white'); nz.loop = true;
  const ng = ac.createGain(); ng.gain.setValueAtTime(0.0001, t0);
  const nbp = ac.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 4000; nbp.Q.value = 1; nz.connect(nbp); nbp.connect(ng);
  const mix = ac.createGain(); mix.gain.value = 1;
  const F = [0, 1, 2].map((i) => { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = [5, 8, 11][i]; f.frequency.value = [500, 1500, 2500][i]; const g = ac.createGain(); g.gain.value = [1.0, 0.85, 0.5][i] * 9; vg.connect(f); f.connect(g); g.connect(mix); return f; });
  // aspiration through the formants for H/breath
  ng.connect(mix);
  let t = t0, base = f0;
  src.frequency.setValueAtTime(f0, t0);
  let last = { F: [500, 1500, 2500], v: 0 };
  const setF = (fs, at, tc = 0.018) => { for (let i = 0; i < 3; i++) F[i].frequency.setTargetAtTime(fs[i], at, tc); };
  const voiced = (at, len, level) => { vg.gain.setTargetAtTime(level, at, 0.012); vg.gain.setTargetAtTime(0.0001, at + len - 0.02, 0.014); };
  let idx = 0;
  for (const tok of toks) {
    const b = tok.replace(/\d/, ''), stress = /1/.test(tok), d = dur(tok), prog = idx / Math.max(1, toks.length - 1); idx++;
    const pitch = base * (1 - 0.14 * prog) * (stress ? 1.07 : 1);
    src.frequency.setTargetAtTime(pitch, t, 0.02);
    if (tok === '_') { t += d; continue; }
    if (V_[b]) { setF(V_[b], t); voiced(t, d, stress ? 1.0 : 0.75); }
    else if (DIPH[b]) { const [a, c] = DIPH[b]; setF(V_[a], t); setF(V_[c], t + d * 0.55, 0.05); voiced(t, d, stress ? 1.0 : 0.8); }
    else if (SONOR[b]) { const s = SONOR[b]; setF(s, t); voiced(t, d, s[3]); }
    else if (FRIC[b]) { const [fc, q, hp, lv, vc] = FRIC[b]; nbp.frequency.setValueAtTime(fc, t); nbp.Q.setValueAtTime(q, t); ng.gain.setTargetAtTime(lv * 1.5, t, 0.008); ng.gain.setTargetAtTime(0.0001, t + d - 0.02, 0.01); if (vc) { setF([300, 1300, 2500], t); voiced(t, d, 0.35); } if (b === 'HH') setF(last.F, t, 0.05); }
    else if (STOP[b]) {
      const [fc, q, vc] = STOP[b], burstAt = t + d * 0.55;
      if (vc) { setF([300, 1300, 2400], t); voiced(t, d * 0.5, 0.3); }
      nbp.frequency.setValueAtTime(fc, burstAt); nbp.Q.setValueAtTime(q, burstAt);
      ng.gain.setValueAtTime(0.0001, burstAt); ng.gain.linearRampToValueAtTime(1.7, burstAt + 0.004); ng.gain.exponentialRampToValueAtTime(0.0001, burstAt + (b === 'CH' || b === 'JH' ? 0.07 : 0.03));
    }
    t += d;
  }
  src.start(t0); nz.start(t0); const e = t + 0.15; src.stop(e); nz.stop(e);
  // radio / robot colour: band limit, slight saturation, metallic comb
  const tail = chain(V, mix, { hp: 220, lp: 5200, sat: 0.35 });
  const cg = ac.createGain(); cg.gain.value = 0.6 * gain;
  const dl = ac.createDelay(0.05); dl.delayTime.value = 0.0036; const fb = ac.createGain(); fb.gain.value = 0.42; dl.connect(fb); fb.connect(dl);
  tail.connect(cg); tail.connect(dl); dl.connect(cg); cg.connect(out);
  V.end = Math.max(V.end, e - V.t + 0.05);
  return t - t0;
}

const PHRASES = {
  roundStart: 'R AW1 N D _ S T AA1 R T', matchStart: 'M AE1 CH _ S T AA1 R T', beaconArmed: 'B IY1 K AH N _ AA1 R M D', beaconDisarmed: 'B IY1 K AH N _ D IH S AA1 R M D',
  beaconCharged: 'B IY1 K AH N _ CH AA1 R JH D', tideWin: 'T AY1 D _ W IH1 N Z', emberWin: 'EH1 M B ER _ W IH1 N Z', matchPoint: 'M AE1 CH _ P OY1 N T',
  halftime: 'HH AE1 F _ T AY1 M', lastRound: 'F AY1 N AH L _ R AW1 N D', tenSeconds: 'T EH1 N _ S EH1 K AH N D Z', thirtySeconds: 'TH ER1 T IY _ S EH1 K AH N D Z',
  tideEliminated: 'T AY1 D _ IH L IH1 M AH N EY T IH D', emberEliminated: 'EH1 M B ER _ IH L IH1 M AH N EY T IH D', roundDraw: 'R AW1 N D _ D R AO1', overtime: 'OW1 V ER T AY1 M',
  victory: 'V IH1 K T ER IY', defeat: 'D IH F IY1 T', three: 'TH R IY1', two: 'T UW1', one: 'W AH1 N', go: 'G OW1', beaconDropped: 'B IY1 K AH N _ D R AA1 P T', beaconRecovered: 'B IY1 K AH N _ R IY K AH1 V ER D',
  flawless: 'F L AO1 L AH S', ace: 'EY1 S',
};
export const ANNOUNCE_IDS = Object.keys(PHRASES);
// aliases used by other pieces
export const ALIAS = { bombPlanted: 'beaconArmed', beaconPlanted: 'beaconArmed', bombDefused: 'beaconDisarmed', defused: 'beaconDisarmed', beaconComplete: 'beaconCharged', tideWins: 'tideWin', emberWins: 'emberWin', roundstart: 'roundStart', 'round-start': 'roundStart', matchpoint: 'matchPoint', '10sec': 'tenSeconds', '30sec': 'thirtySeconds', draw: 'roundDraw', half: 'halftime', gameStart: 'matchStart', countdown3: 'three', countdown2: 'two', countdown1: 'one' };
export const resolveAnnounce = (id) => (PHRASES[id] ? id : ALIAS[id] || null);

const STING = { win: [880, 1109, 1319], lose: [440, 349, 294], alert: [1319, 1319], start: [784, 988], neutral: [988, 1319] };
const KIND = { tideWin: 'win', emberWin: 'win', victory: 'win', defeat: 'lose', beaconArmed: 'alert', beaconCharged: 'alert', beaconDisarmed: 'win', tideEliminated: 'lose', emberEliminated: 'lose', roundStart: 'start', matchStart: 'start', matchPoint: 'alert', lastRound: 'alert', tenSeconds: 'alert', thirtySeconds: 'alert', roundDraw: 'neutral' };

export function registerVoice() {
  for (const id of Object.keys(PHRASES)) {
    const simple = ['three', 'two', 'one', 'go', 'ace', 'flawless'].includes(id);
    reg(`announce.${id}`, (V) => {
      const kind = KIND[id] || 'neutral', notes = STING[kind];
      let off = 0;
      if (!simple) {
        notes.forEach((f, i) => { ring(V, { when: i * 0.075, f, ratios: [1, 2, 3], decays: [1, 0.4, 0.2], gains: [1, 0.35, 0.15], d: 0.22, g: 0.14 }); osc(V, { when: i * 0.075, type: 'square', f0: f, d: 0.07, g: 0.035, lp: 3500 }); });
        off = notes.length * 0.075 + 0.1;
      }
      const dur = speak(V, PHRASES[id], { when: off, f0: id === 'defeat' || kind === 'lose' ? 100 : 114, gain: 1 });
      V.end = Math.max(V.end, off + dur + 0.2);
    }, { cat: 'announce', bus: 'voice', spatial: false, send: 0.12, prio: 8, voices: 2 });
  }
}
