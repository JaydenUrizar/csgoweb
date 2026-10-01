// Sound catalogue registry. Each sound is a pure synthesis function fn(V, o) that schedules nodes into V.out
// and returns nothing (V.end tracks the tail). See dsp.js for the voice object.
export const SOUNDS = Object.create(null);

const DEFAULTS = {
  bus: 'sfx',       // sfx | ui | voice | music
  spatial: true,    // positional when a position is given (third-person mix)
  ref: 4,           // panner reference distance (metres, loudness reach)
  roll: 1.15,       // distance rolloff factor
  maxDist: 90,      // culled beyond this
  send: 0.25,       // reverb send level
  gain: 1,          // nominal trim (dB-free multiplier)
  voices: 8,        // max simultaneous instances (oldest ignored beyond)
  prio: 1,          // higher survives voice stealing
  cat: 'misc',
};

export function reg(name, fn, opts = {}) {
  SOUNDS[name] = { name, fn, ...DEFAULTS, ...opts };
  return SOUNDS[name];
}
export const has = (n) => !!SOUNDS[n];
export const list = () => Object.keys(SOUNDS);
export const categories = () => { const c = {}; for (const s of Object.values(SOUNDS)) (c[s.cat] ||= []).push(s.name); return c; };
