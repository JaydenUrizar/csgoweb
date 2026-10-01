// Audio graph: buses, limiter, ducking, deafening, HRTF positional voices with distance / air absorption / occlusion,
// reverb sends (open / tunnel / room), voice budget. Works on AudioContext and OfflineAudioContext.
import { SOUNDS } from './registry.js';
import { mulberry32, clamp, lerp } from './dsp.js';
import { makePresetIR } from './reverb.js';

const OCC_GAIN = [1, 0.62, 0.42, 0.28], OCC_FC = [22000, 2600, 1250, 700];
const GRID = 0.75, OCC_TTL = 0.3;

export function createMixer(ac, { offline = false, world = null, log = null } = {}) {
  const g = (v = 1) => { const n = ac.createGain(); n.gain.value = v; return n; };
  const bq = (type, f, q = 0.7, gain = 0) => { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = gain; return n; };

  // ---- master chain ----
  const master = g(1), makeup = g(5), comp = ac.createDynamicsCompressor(), lim = ac.createDynamicsCompressor(), clip = ac.createWaveShaper(), outG = g(0.92);
  comp.threshold.value = -12; comp.knee.value = 12; comp.ratio.value = 2.5; comp.attack.value = 0.006; comp.release.value = 0.2;
  lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.09;
  const cv = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const x = (i / 2047) * 2 - 1, a = Math.abs(x); cv[i] = a < 0.8 ? x : Math.sign(x) * (0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2)); }
  clip.curve = cv;
  master.connect(makeup); makeup.connect(comp); comp.connect(lim); lim.connect(clip); clip.connect(outG); outG.connect(ac.destination);
  const analyser = ac.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.5; outG.connect(analyser);

  // ---- buses ----
  const bus = {};
  bus.sfx = { in: g(), duck: g(), deaf: bq('lowpass', 22000, 0.5), deafG: g(), vol: g(1) };
  bus.sfx.in.connect(bus.sfx.duck); bus.sfx.duck.connect(bus.sfx.deaf); bus.sfx.deaf.connect(bus.sfx.deafG); bus.sfx.deafG.connect(bus.sfx.vol); bus.sfx.vol.connect(master);
  bus.ui = { in: g(), vol: g(1) }; bus.ui.in.connect(bus.ui.vol); bus.ui.vol.connect(master);
  bus.voice = { in: g(), vol: g(0.95) }; bus.voice.in.connect(bus.voice.vol); bus.voice.vol.connect(master);
  bus.music = { in: g(), eq: bq("peaking", 2800, 0.8, -6), duck: g(), vol: g(0.1) };
  bus.music.in.connect(bus.music.eq); bus.music.eq.connect(bus.music.duck); bus.music.duck.connect(bus.music.vol); bus.music.vol.connect(master);

  // ---- reverb sends ----
  const rv = { send: g(1), out: g(0.42), wet: {} };
  const rvHp = bq('highpass', 220); rv.send.connect(rvHp);
  for (const k of ['open', 'tunnel', 'room']) {
    const c = ac.createConvolver(); c.buffer = makePresetIR(ac, k); c.normalize = true;
    const w = g(k === 'open' ? 1 : 0); rv.wet[k] = w; rvHp.connect(c); c.connect(w); w.connect(rv.out);
  }
  rv.out.connect(bus.sfx.duck);

  // ---- listener ----
  const L = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1, ux: 0, uy: 1, uz: 0, rx: 1, ry: 0, rz: 0 };
  const lis = ac.listener;
  function setListener(x, y, z, fx, fy, fz, ux, uy, uz) {
    L.x = x; L.y = y; L.z = z; L.fx = fx; L.fy = fy; L.fz = fz; L.ux = ux; L.uy = uy; L.uz = uz;
    L.rx = fy * uz - fz * uy; L.ry = fz * ux - fx * uz; L.rz = fx * uy - fy * ux;
    if (lis.positionX) {
      lis.positionX.value = x; lis.positionY.value = y; lis.positionZ.value = z;
      lis.forwardX.value = fx; lis.forwardY.value = fy; lis.forwardZ.value = fz; lis.upX.value = ux; lis.upY.value = uy; lis.upZ.value = uz;
    } else { lis.setPosition?.(x, y, z); lis.setOrientation?.(fx, fy, fz, ux, uy, uz); }
  }

  // ---- occlusion (cheap, cached) ----
  const occCache = new Map(); let occHits = 0, occLast = 0;
  function occlusion(sx, sy, sz, now) {
    if (!world?.hits) return 0;
    const key = `${Math.round(sx / GRID)},${Math.round(sy / GRID)},${Math.round(sz / GRID)}|${Math.round(L.x / GRID)},${Math.round(L.y / GRID)},${Math.round(L.z / GRID)}`;
    const c = occCache.get(key); if (c && now - c.t < OCC_TTL) return c.v;
    const dx = sx - L.x, dz = sz - L.z, hl = Math.hypot(dx, dz) || 1, px = -dz / hl * 1.8, pz = dx / hl * 1.8;
    const ey = L.y; let v = world.hits(L.x, ey, L.z, sx, sy, sz); occHits++;
    if (v > 0) {   // diffraction: are there gaps around the obstacle?
      const a = world.hits(L.x, ey, L.z, sx + px, sy, sz + pz), b = world.hits(L.x, ey, L.z, sx - px, sy, sz - pz); occHits += 2;
      v = lerp(v, Math.min(v, a, b), 0.5);
    }
    if (occCache.size > 300) { for (const [k, e] of occCache) if (now - e.t > OCC_TTL) occCache.delete(k); if (occCache.size > 300) occCache.clear(); }
    occCache.set(key, { t: now, v }); return v;
  }
  const occGain = (v) => { const i = Math.min(2, Math.floor(v)), f = clamp(v - i, 0, 1); return lerp(OCC_GAIN[i], OCC_GAIN[i + 1], f); };
  const occFc = (v) => { const i = Math.min(2, Math.floor(v)), f = clamp(v - i, 0, 1); return Math.exp(lerp(Math.log(OCC_FC[i]), Math.log(OCC_FC[i + 1]), f)); };

  // ---- voices ----
  const counts = Object.create(null), rrc = Object.create(null); let active = 0, spatialActive = 0, played = 0, dropped = 0, seedCtr = 1;
  const MAX_VOICES = 72, MAX_SPATIAL = 30;
  const ctl = { reverb: 1, sfx: 1 };
  const rand32 = () => (Math.random() * 4294967296) | 0;

  function play(name, o = {}) {
    const def = SOUNDS[name]; if (!def) return null;
    if (!offline && ac.state !== 'running') return null;
    if ((counts[name] | 0) >= def.voices && def.prio < 8) { dropped++; return null; }
    if (active >= MAX_VOICES && def.prio < 5) { dropped++; return null; }
    const fp = o.fp ?? !!o.isLocal;
    const has3d = def.spatial && o.pos && !fp;
    let dist = 0, sx = 0, sy = 0, sz = 0, dg = 1, fc = 22000, occV = 0;
    if (has3d) {
      sx = o.pos.x; sy = o.pos.y; sz = o.pos.z;
      dist = Math.hypot(sx - L.x, sy - L.y, sz - L.z);
      if (dist > def.maxDist) { dropped++; return null; }
      dg = dist <= def.ref ? 1 : def.ref / (def.ref + def.roll * (dist - def.ref));
      if (dg < 0.004) { dropped++; return null; }
      if (spatialActive >= MAX_SPATIAL && def.prio < 4 && dist > 25) { dropped++; return null; }
    }
    const now = ac.currentTime, t = now + (o.delay || 0) + 0.004;
    const inG = g(def.gain * (o.gain ?? 1));
    const rr = o.rr ?? (rrc[name] = ((rrc[name] | 0) + 1) & 1023);
    const seed = o.seed ?? (offline ? 0x9e3779b1 ^ (name.length * 2654435761) ^ (rr * 40503) : rand32() ^ (seedCtr++ * 2654435761));
    const V = { ac, t, out: inG, r: mulberry32(seed), fp, o: { ...o, rr, dist }, end: 0.05, name };
    if (o.pitch && o.pitch !== 1) V.o.pitch = o.pitch;
    try { def.fn(V, V.o); } catch (e) { if (!play._warned) { play._warned = true; console.error('[audio] sound failed', name, e); (window.__errors ||= []).push('audio ' + name + ': ' + (e?.stack || e)); } try { inG.disconnect(); } catch {} return null; }
    const nodes = [inG]; let panner = null, lp = null, dgN = null, sendN = null, pan2 = null;
    const dest = bus[def.bus]?.in || bus.sfx.in;
    if (has3d) {
      lp = bq('lowpass', 22000, 0.6); dgN = g(1); panner = ac.createPanner();
      panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 1; panner.rolloffFactor = 0; panner.maxDistance = 20000;
      panner.coneInnerAngle = 360; panner.coneOuterAngle = 360;
      if (panner.positionX) { panner.positionX.value = sx; panner.positionY.value = sy; panner.positionZ.value = sz; } else panner.setPosition(sx, sy, sz);
      inG.connect(lp); lp.connect(dgN); dgN.connect(panner); panner.connect(dest);
      nodes.push(lp, dgN, panner);
      if (def.send > 0) { sendN = g(0); dgN.connect(sendN); sendN.connect(rv.send); nodes.push(sendN); }
    } else {
      let n = inG;
      if (o.pan && ac.createStereoPanner) { pan2 = ac.createStereoPanner(); pan2.pan.value = clamp(o.pan, -1, 1); n.connect(pan2); n = pan2; nodes.push(pan2); }
      n.connect(dest);
      if (def.send > 0) { sendN = g(def.send * ctl.reverb * 0.6 * (o.send ?? 1)); n.connect(sendN); sendN.connect(rv.send); nodes.push(sendN); }
    }
    const geo = (v) => {   // (re)apply distance / air / occlusion to node params
      const d = has3d ? Math.hypot(v.x - L.x, v.y - L.y, v.z - L.z) : 0;
      const dgv = d <= def.ref ? 1 : def.ref / (def.ref + def.roll * (d - def.ref));
      const air = clamp(19000 / (1 + d / 13), 1300, 20000);
      const og = occGain(occV), of = occFc(occV);
      const cutoff = Math.min(air, of), gain = dgv * og;
      const tt = ac.currentTime;
      lp.frequency.setValueAtTime(cutoff, Math.max(t - 0.001, tt)); dgN.gain.setValueAtTime(gain, Math.max(t - 0.001, tt));
      if (sendN) sendN.gain.setValueAtTime(def.send * ctl.reverb * clamp(0.6 + d / 45, 0.6, 2.4) * dgv * Math.sqrt(og) * (o.send ?? 1), Math.max(t - 0.001, tt));
    };
    if (has3d) { occV = o.occ ?? occlusion(sx, sy, sz, now); geo({ x: sx, y: sy, z: sz }); spatialActive++; }
    active++; counts[name] = (counts[name] | 0) + 1; played++;
    let dead = false;
    const dispose = () => { if (dead) return; dead = true; active--; counts[name]--; if (has3d) spatialActive--; for (const n of nodes) { try { n.disconnect(); } catch {} } };
    if (!offline) setTimeout(dispose, (V.end + (o.delay || 0) + 0.6) * 1000);
    log?.(name, o, dist, occV);
    return {
      name, def, dist, occ: occV, end: t + V.end,
      setPos(x, y, z) { if (dead || !has3d) return; if (panner.positionX) { panner.positionX.value = x; panner.positionY.value = y; panner.positionZ.value = z; } geo({ x, y, z }); },
      setGain(v) { if (!dead) inG.gain.setTargetAtTime(def.gain * v, ac.currentTime, 0.03); },
      stop(fade = 0.05) { if (dead) return; const n = ac.currentTime; inG.gain.cancelScheduledValues(n); inG.gain.setTargetAtTime(0.0001, n, fade / 3); setTimeout(dispose, fade * 1000 + 200); },
    };
  }

  // ---- dynamics / effects ----
  const hold = (p, now) => { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now); else p.cancelScheduledValues(now); };
  function duck(target, depth = 0.5, attack = 0.02, holdT = 0.2, release = 0.5) {
    const node = target === 'music' ? bus.music.duck : target === 'sfx' ? bus.sfx.duck : target === 'voice' ? bus.voice.vol : null; if (!node) return;
    const p = node.gain, now = ac.currentTime, base = target === 'voice' ? 0.95 : 1; hold(p, now);
    p.setTargetAtTime(depth * base, now, attack / 3); p.setTargetAtTime(base, now + attack + holdT, release / 3);
  }
  /** Ear-ring: muffle + dip the sfx bus, duck music; amount 0..1. */
  function deafen(amount = 1, dur = 3) {
    amount = clamp(amount, 0, 1); if (amount < 0.05) return;
    const now = ac.currentTime, f = bus.sfx.deaf.frequency, gn = bus.sfx.deafG.gain, holdT = 0.25 + amount * 0.9, tc = dur / 3.2;
    hold(f, now); hold(gn, now);
    f.setValueAtTime(lerp(20000, 450, amount), now); f.setTargetAtTime(22000, now + holdT, tc);
    gn.setValueAtTime(lerp(1, 0.22, amount), now); gn.setTargetAtTime(1, now + holdT, tc);
    duck('music', lerp(0.7, 0.06, amount), 0.02, holdT + dur * 0.4, dur * 0.6);
  }
  let roomTarget = { open: 1, tunnel: 0, room: 0 };
  function setRoom(w) {
    roomTarget = w; const now = ac.currentTime;
    for (const k of ['open', 'tunnel', 'room']) { const p = rv.wet[k].gain; p.setTargetAtTime((w[k] ?? 0) * (k === 'open' ? 0.85 : k === 'tunnel' ? 1.0 : 0.9), now, 0.35); }
  }
  setRoom(roomTarget);
  function setVolumes({ master: m, sfx, music, ui }) {
    const now = ac.currentTime;
    if (m != null) master.gain.setTargetAtTime(m, now, 0.02);
    if (sfx != null) { bus.sfx.vol.gain.setTargetAtTime(sfx, now, 0.02); bus.ui.vol.gain.setTargetAtTime(Math.min(1, sfx * (ui ?? 1)), now, 0.02); }
    if (music != null) bus.music.vol.gain.setTargetAtTime(music * 0.13, now, 0.05);
  }
  return {
    ac, bus, master, analyser, play, duck, deafen, setRoom, setListener, setVolumes, occlusion, listener: L, ctl,
    get roomTarget() { return roomTarget; },
    setWorld(w) { world = w; },
    stats: () => ({ active, spatialActive, played, dropped, occHits, counts: { ...counts } }),
    dispose() { try { master.disconnect(); } catch {} },
  };
}
