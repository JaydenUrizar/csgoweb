// Audio piece: procedural WebAudio engine. ctx.audio = { play, music, announce, setListener, unlock, duck, deafen, sounds, debug }.
// See docs/pieces/audio.md. All sounds are synthesised (src/audio/*.js); nothing is downloaded.
import * as THREE from 'three';
import { ensureRegistered, SOUNDS, categories } from './catalog.js';
import { createMixer } from './mixer.js';
import { createMusic } from './music.js';
import { resolveAnnounce, ANNOUNCE_IDS } from './voice.js';
import { resolveSurface } from './world.js';
import { renderOffline, renderOfflineFull } from './offline.js';
import { wireEvents } from './events.js';
import { makeDrone } from './world.js';
import { registerLab } from './lab.js';

export function create(ctx) {
  ensureRegistered();
  const test = !!ctx.params.get('test');
  let ac = null, mixer = null, music = null, ambience = null;
  let wantMusic = 'menu', wantIntensity = 0;
  const logRing = []; let logOn = false;
  const lp = { x: 0, y: 0, z: 0 };
  const _o = new THREE.Vector3(), _d = new THREE.Vector3();
  const isLocal = (a) => !!a && (a === ctx.localActor || a.isPlayer === true);

  // ---- world adapter for occlusion & room probing ----
  const world = {
    hits(ax, ay, az, bx, by, bz) {
      const map = ctx.map; if (!map?.raycast) return 0;
      _d.set(bx - ax, by - ay, bz - az); const len = _d.length(); if (len < 0.6) return 0; _d.multiplyScalar(1 / len);
      _o.set(ax, ay, az); let rem = len - 0.35, n = 0;
      for (let i = 0; i < 3 && rem > 0.25; i++) {
        let h = null; try { h = map.raycast(_o, _d, rem); } catch { return n; }
        if (!h || !(h.distance < rem)) break;
        n++; const adv = h.distance + 0.15; _o.addScaledVector(_d, adv); rem -= adv;
      }
      return n;
    },
    ray(ox, oy, oz, dx, dy, dz, far) {   // distance to first hit or far
      const map = ctx.map; if (!map?.raycast) return far;
      _o.set(ox, oy, oz); _d.set(dx, dy, dz);
      try { const h = map.raycast(_o, _d, far); return h ? h.distance : far; } catch { return far; }
    },
  };

  function onState() {
    if (!ac || !mixer) return;
    if (ac.state === 'running' && !music) start();
    if (ac.state === 'running') music?.start?.();
  }
  function start() {
    mixer = createMixer(ac, { world, log: (n, o, d, occ) => { if (logOn) { logRing.push({ t: performance.now() | 0, n, d: +d.toFixed(1), occ: +occ.toFixed(2), fp: !!o.fp }); if (logRing.length > 80) logRing.shift(); } } });
    applyVolumes();
    music = createMusic(mixer); music.setIntensity(wantIntensity); music.set(wantMusic);
    startAmbience();
    api.mixer = mixer;
  }
  function ensureContext() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ac = new AC({ latencyHint: 'interactive', sampleRate: 48000 }); } catch { try { ac = new AC(); } catch { return null; } }
    ac.addEventListener('statechange', onState);
    start(); if (ac.state === 'running') onState();
    return ac;
  }
  function unlock() {
    ensureContext(); if (!ac) return false;
    if (ac.state !== 'running') ac.resume?.().then(onState, () => {});
    return ac.state === 'running';
  }
  const gestures = ['pointerdown', 'keydown', 'mousedown', 'touchstart'];
  const onGesture = () => { unlock(); if (ac && ac.state === 'running') for (const g of gestures) removeEventListener(g, onGesture, true); };
  for (const g of gestures) addEventListener(g, onGesture, { capture: true, passive: true });

  function applyVolumes() {
    if (!mixer) return; const s = ctx.settings;
    mixer.setVolumes({ master: s.get('volume') ?? 0.8, sfx: s.get('sfxVolume') ?? 1, music: s.get('musicVolume') ?? 0.5 });
  }
  function startAmbience() {   // faint arena wind / air bed so silence never feels dead
    const nb = ac.createBuffer(1, ac.sampleRate * 6, ac.sampleRate), d = nb.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.2; }
    const src = ac.createBufferSource(); src.buffer = nb; src.loop = true;
    const lp1 = ac.createBiquadFilter(); lp1.type = 'lowpass'; lp1.frequency.value = 420; lp1.Q.value = 0.5;
    const g = ac.createGain(); g.gain.value = 0.05;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.11; lg.gain.value = 0.02; lfo.connect(lg); lg.connect(g.gain);
    src.connect(lp1); lp1.connect(g); g.connect(mixer.bus.sfx.in); src.start(); lfo.start(); ambience = { g, lp1 };
  }

  // ---- public play ----
  function resolve(name) {
    if (SOUNDS[name]) return name;
    let m = /^(impact|step)\.(.+)$/.exec(name); if (m) { const n = `${m[1]}.${resolveSurface(m[2])}`; if (SOUNDS[n]) return n; }
    m = /^tagger\.([^.]+)\.(.+)$/.exec(name); if (m && !SOUNDS[`tagger.${m[1]}.${m[2]}`]) { const n = `tagger.pip.${m[2]}`; if (SOUNDS[n]) return n; }
    m = /^announce\.(.+)$/.exec(name); if (m) { const a = resolveAnnounce(m[1]); if (a) return 'announce.' + a; }
    return null;
  }
  function play(name, o = {}) {
    if (!mixer) return null;
    const n = resolve(name); if (!n) return null;
    const a = o.actor, local = o.fp ?? isLocal(a);
    let pos = o.pos;
    if (!pos && a && !local && a.pos) { lp.x = a.pos.x; lp.y = a.pos.y + 1.1; lp.z = a.pos.z; pos = lp; }
    return mixer.play(n, { ...o, fp: local, pos: local ? null : pos });
  }
  const annLast = {};
  function announce(id, o = {}) {
    const a = resolveAnnounce(id); if (!a || !mixer) return null;
    const now = performance.now(); if (!o.force && annLast[a] && now - annLast[a] < 2500) return null; annLast[a] = now;   // several pieces announce the same event
    mixer.duck('music', 0.35, 0.03, 1.2, 0.8);
    return mixer.play('announce.' + a, { fp: true, ...o });
  }

  const api = {
    __audio: true,
    play, announce, unlock, resolve,
    setListener(camera) { api.camera = camera; },
    duck: (...a) => mixer?.duck(...a),
    deafen: (...a) => mixer?.deafen(...a),
    get unlocked() { return !!ac && ac.state === 'running'; },
    get context() { return ac; },
    mixer: null,
    sounds: SOUNDS,
    categories,
    announceIds: ANNOUNCE_IDS,
    music: {
      set(state, o) { wantMusic = state; music?.set(state, o); },
      get state() { return wantMusic; },
      setIntensity(x) { wantIntensity = x; music?.setIntensity(x); },
      get playing() { return music?.playing ?? 'off'; },
    },
    /** Menu: short sample on one bus ('master'|'sfx'|'music'|'voice'). */
    test(bus = 'sfx') { unlock(); const o = { fp: true }; if (bus === 'voice') return announce('roundStart', { force: true }); if (bus === 'music') return play('ui.notify', { ...o, bus: 'music', gain: 6 }); return play(bus === 'master' ? 'ui.round.win' : 'tagger.rail.fire', o); },
    setVolume(bus, v) { const k = { master: 'volume', sfx: 'sfxVolume', music: 'musicVolume' }[bus]; if (bus === 'voice') mixer?.setVolumes({ voice: v }); else if (k) ctx.settings?.set?.(k, v); },
    drone(kind = 'arm') { return mixer ? makeDrone(ac, mixer.bus.sfx.in, kind) : null; },
    isLocal, world,
    /** Listener follows this camera (default ctx.render.camera). */
    updateListener() {
      if (!mixer) return;
      const cam = api.camera || ctx.render?.camera; if (!cam) return;
      const e = cam.matrixWorld.elements;
      mixer.setListener(e[12], e[13], e[14], -e[8], -e[9], -e[10], e[4], e[5], e[6]);
    },
    update(dt) {
      if (!mixer) return;
      api.updateListener();
      events.update(dt);
      if (ambience && events.room) ambience.lp1.frequency.setTargetAtTime(events.room.indoor ? 260 : 420, ac.currentTime, 0.5);
    },
    dispose() { events.dispose(); for (const g of gestures) removeEventListener(g, onGesture, true); music?.stop(); mixer?.dispose(); try { ac?.close(); } catch {} },
    debug: {
      renderOffline, renderOfflineFull,
      list: () => Object.keys(SOUNDS),
      stats: () => ({ state: ac?.state ?? 'none', ...(mixer?.stats() ?? {}), music: music?.playing, room: events.room }),
      meter() { if (!mixer) return null; const a = mixer.analyser, buf = new Float32Array(a.fftSize); a.getFloatTimeDomainData(buf); let pk = 0, s = 0; for (const v of buf) { const x = Math.abs(v); if (x > pk) pk = x; s += v * v; } return { peakDb: 20 * Math.log10(pk || 1e-6), rmsDb: 10 * Math.log10(s / buf.length || 1e-9) }; },
      log(on = true) { logOn = on; return logRing; },
      get recent() { return logRing; },
      room: () => events.room,
      forceState: (s) => mixer?.setRoom(s),
      unlock,
    },
  };
  const events = wireEvents(ctx, api);
  registerLab(ctx, api);
  ctx.events.on('settings:change', (e) => { if (['volume', 'sfxVolume', 'musicVolume'].includes(e?.key)) applyVolumes(); });
  ctx.events.on('input:lock', () => unlock());
  if (test) unlock();
  return api;
}
