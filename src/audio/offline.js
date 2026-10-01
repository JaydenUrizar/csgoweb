// Offline (non-realtime) rendering of any catalogue sound or music state -> Float32Array, for tools & analysis.
import { ensureRegistered, SOUNDS } from './catalog.js';
import { mulberry32 } from './dsp.js';
import { createMixer } from './mixer.js';
import { scheduleMusicOffline } from './music.js';

/** Full render: { sampleRate, channels:[Float32Array...], duration }.
 *  opts: seconds, fp (first-person mix, default true), dry (raw synthesis, no buses/limiter), sr, dist (m), az (deg, +right), occ (0..3 occlusion level), rr, seed, o (extra play options), intensity (music) */
export async function renderOfflineFull(name, { seconds, fp = true, dry = false, sr = 48000, dist = 0, az = 0, occ = 0, rr = 0, seed = 1, o = {}, intensity = 0.5 } = {}) {
  ensureRegistered();
  const isMusic = name.startsWith('music.');
  const def = SOUNDS[name]; if (!def && !isMusic) throw new Error('unknown sound ' + name);
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const opts = { ...o, rr, seed: seed >>> 0, fp };
  if (seconds == null) {   // dry-run into a 1-sample context to learn the tail length
    if (isMusic) seconds = name.endsWith('win') || name.endsWith('lose') ? 4.5 : 12;
    else { const t = new OAC(1, 1, sr), out = t.createGain(); const V = { ac: t, t: 0.01, out, r: mulberry32(seed), fp, o: { ...opts }, end: 0.05 }; def.fn(V, V.o); seconds = V.end + 0.12 + (dry ? 0 : 1.6 * (def.send > 0.2 ? 1 : 0.4)); }
  }
  const len = Math.max(64, Math.ceil(seconds * sr)), ac = new OAC(2, len, sr);
  if (isMusic) {
    const m = createMixer(ac, { offline: true }); scheduleMusicOffline(ac, dry ? ac.destination : m.bus.music.in, name.slice(6), seconds, { intensity });
  } else if (dry) {
    const out = ac.createGain(); out.connect(ac.destination); const V = { ac, t: 0.01, out, r: mulberry32(seed), fp, o: { ...opts }, end: 0.05 }; def.fn(V, V.o);
  } else {
    const m = createMixer(ac, { offline: true, world: { hits: () => occ } });
    m.setListener(0, 1.6, 0, 0, 0, -1, 0, 1, 0);
    const a = (az * Math.PI) / 180, pos = dist > 0 || az ? { x: Math.sin(a) * Math.max(dist, 0.01), y: 1.6, z: -Math.cos(a) * Math.max(dist, 0.01) } : null;
    m.play(name, { ...opts, pos: fp ? null : pos || { x: 0, y: 1.6, z: -0.5 }, occ: occ || undefined });
  }
  const buf = await ac.startRendering();
  return { sampleRate: sr, channels: [buf.getChannelData(0), buf.getChannelData(1)], duration: seconds };
}

/** Convenience: returns the left channel as Float32Array (with .sampleRate and .right attached). */
export async function renderOffline(name, opts = {}) {
  const r = await renderOfflineFull(name, opts); const a = r.channels[0]; a.sampleRate = r.sampleRate; a.right = r.channels[1]; return a;
}
