// FLUX TAG — menus, settings, pause, onboarding, match-end. See docs/pieces/menu.md.
import { CSS } from './style.js';
import f500 from '../hud/fonts/bc500.woff2?url';
import f600 from '../hud/fonts/bc600.woff2?url';
import f700 from '../hud/fonts/bc700.woff2?url';
import { LOGO_CSS } from './logo.js';
import { h, wireSfx, createNav } from './ui.js';
import { createBackdrop } from './backdrop.js';
import { createSettingsUI, SD, DEFAULT_BINDS } from './settings.js';
import { buildBoot, buildMain, buildHelp, buildCredits, buildPause, buildEnd, fakeEndData } from './screens.js';
import { createTutorial } from './tutorial.js';
import { MODULES } from '../../modules.js';

const VERSION = '0.1.0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const raf = () => new Promise((r) => requestAnimationFrame(() => r()));

export function create(ctx) {
  const P = ctx.params, S = ctx.settings;
  const test = !!P.get('test'), bypass = test && P.get('menu') !== '1';
  const get = (k) => { const v = S.get(k); return v === undefined ? SD[k] : v; };
  const fast = test; // no cinematic waits under test
  const T = (ms) => (fast ? Math.min(ms, 30) : ms);

  // ------------------------------------------------------------------ DOM
  const style = document.createElement('style'); style.id = 'fx-style';
  const ff = (w, u) => `@font-face{font-family:"Barlow Condensed";font-weight:${w};font-style:normal;font-display:swap;src:url(${u}) format("woff2")}`;
  style.textContent = ff(500, f500) + ff(600, f600) + ff(700, f700) + ff(800, f700) + CSS + LOGO_CSS + '\nhtml.fx-menu #ui>:not(.fx),html.fx-nohud #ui>:not(.fx){visibility:hidden!important}\n';
  document.head.append(style);
  if (test) document.documentElement.classList.add('fx-test');
  const uiRoot = document.getElementById('ui');
  const root = h('div', { class: 'fx', lang: 'en' });
  uiRoot.append(root);
  const scrim = h('div', { class: 'fx-layer fx-scrim' }), grain = h('div', { class: 'fx-layer fx-grain' });
  const toastEl = h('div', { class: 'fx-toast', role: 'status' }), fpsEl = h('div', { class: 'fx-fps', hidden: true });
  const wipe = h('div', { class: 'fx-wipe' }, h('div', { class: 'msg' }, h('span', null, 'Loading'), h('div', { class: 'bar' }, h('i'))));
  let toastT = 0;
  const toast = (t) => { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2200); };

  // ------------------------------------------------------------------ state
  let base = 'boot';            // boot | main | pause | end | game | starting
  const overlays = [];          // stack of overlay screen names: settings | help | credits | cheat
  const focusStack = []; let lastFocus = null, lockerOpen = false, lastOpts = null, endDelay = -1, extModal = 0, cheatOpen = false, bootAbort = false;
  let inMenuWorld = false;

  // Lazy: nothing is built (and render.render is never touched) unless the menu world is actually shown.
  const econLog = [];
  ctx.events.on('round:end', (d) => { try { const p = d?.econ?.players; if (!p) return; const sum = (t) => (p[t] || []).reduce((a, r) => a + (+r.credits || 0), 0); econLog.push({ n: d.n, ember: sum('ember'), tide: sum('tide') }); } catch { /* optional */ } });
  ctx.events.on('match:start', () => { econLog.length = 0; });
  let _bd = null; const bdGet = () => (_bd ||= createBackdrop(ctx));
  const backdrop = { enter: () => bdGet()?.enter(), leave: () => _bd?.leave(), warm: () => bdGet()?.warm(), setMood: (m) => _bd?.setMood(m), suspend: (v) => _bd?.suspend(v), snapMood: () => _bd?.snapMood(), update: (dt) => _bd?.update(dt), dispose: () => _bd?.dispose(), get real() { return _bd; } };
  const prefs = () => ({ difficulty: 'pro', side: 'random', map: 'crux', ...(S.get('menuPrefs') || {}) });

  const A = {
    version: VERSION,
    pref: { get: (k) => prefs()[k], set: (k, v) => S.set('menuPrefs', { ...prefs(), [k]: v }) },
    name: () => get('playerName') || 'You',
    binds: () => bindsNow(),
    econLog: () => econLog, toast, play: (o) => play(o), playAgain: () => play(lastOpts || {}), toMenu: () => leaveMatch(), resume: () => resume(),
    confirmLeave: () => confirmLeave(), open: (n, arg) => openOverlay(n, arg), back: () => back(), openLocker: () => openLocker(),
    fullscreen: async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('Fullscreen blocked by browser'); } },
    replayTutorial: () => { S.set('tutorialDone', false); toast('Tutorial will start in your next match'); },
    tutorialSkip: () => { setTutorialDone(); tutorial.stop(); toast('Tutorial skipped — F1 shows the controls'); },
    setTutorialDone: () => setTutorialDone(), inGame: () => base === 'game',
  };
  const setTutorialDone = () => S.set('tutorialDone', true);

  // ------------------------------------------------------------------ bindings
  const bindsNow = () => { const o = S.get('keybinds') || {}; const r = {}; for (const a of Object.keys(DEFAULT_BINDS)) r[a] = o[a] || DEFAULT_BINDS[a]; return r; };
  let applied = {}; for (const [a, l] of Object.entries(DEFAULT_BINDS)) l.forEach((c) => { applied[c] = a; });
  ctx.menu_applyBinds = () => {
    const want = {}; for (const [a, l] of Object.entries(bindsNow())) l.forEach((c) => { if (c) want[c] = a; });
    for (const c of Object.keys(applied)) if (!(c in want)) ctx.input?.rebind?.(c, null);
    for (const [c, a] of Object.entries(want)) if (applied[c] !== a) ctx.input?.rebind?.(c, a);
    applied = want; screens.help?.refresh?.(); screens.cheat?.refresh?.();
  };

  // ------------------------------------------------------------------ screens
  const settings = createSettingsUI(ctx, { toast, onClose: () => back(), sfxTone: (bus) => tone(bus) });
  const boot = buildBoot();
  const main = buildMain(ctx, A);
  const help = buildHelp(ctx, A);
  const cheat = buildHelp(ctx, A, { compact: true });
  const credits = { el: buildCredits(ctx, A) };
  const pause = buildPause(ctx, A);
  let end = null;
  const tutorial = createTutorial(ctx, A);
  const screens = { boot, main, settings, help, cheat, credits, pause };
  root.append(scrim, grain, main.el, pause.el, help.el, credits.el, settings.el, cheat.el, tutorial.el, boot.el, toastEl, fpsEl, wipe);
  for (const s of [main, pause, help, credits, settings, cheat]) s.el.classList.remove('on');
  wireSfx(root, ctx);
  root.addEventListener('pointerover', (e) => { const b = e.target.closest?.('.fx-mi,.fx-pb,.fx-tab,.fx-go,.fx-seg>button'); if (b && document.activeElement !== b && root.contains(document.activeElement) && !settings.capturing && e.pointerType === 'mouse') b.focus({ preventScroll: true }); });
  ctx.menu_nameChanged = () => main.refreshName();
  ctx.menu_applySettings = () => applySettings();

  const nav = createNav(ctx, {
    getScope: () => activeScopeEl(),
    isActive: () => !lockerOpen && !settings.capturing && (overlays.length > 0 || base === 'main' || base === 'pause' || base === 'end') && !wipe.classList.contains('on'),
    onBack: () => { if (overlays.length) back(); else if (base === 'pause') resume(); },
    onTab: (d) => { if (overlays[overlays.length - 1] === 'settings') settings.cycle(d); },
  });

  // ------------------------------------------------------------------ helpers
  const setOn = (s, v) => { s.el.classList.toggle('on', v); };
  function syncHud() { const hide = base === 'pause' || base === 'end' || base === 'starting' || (base === 'game' && (overlays.length > 0 || cheatOpen)); document.documentElement.classList.toggle('fx-nohud', hide); tutorial.show(base === 'game' && !overlays.length && !cheatOpen); }
  function captureKeys(v) { if (ctx.input) ctx.input.captureKeys = v; }
  function worldMenu(v) {
    if (v === inMenuWorld) return; inMenuWorld = v;
    document.documentElement.classList.toggle('fx-menu', v);
    scrim.style.opacity = v ? 1 : 0;
    if (v) backdrop.enter(); else backdrop.leave();
  }
  function focusIn(el) { const go = () => { if (!el.contains(document.activeElement) || document.activeElement === el) nav.focusFirst(el); }; requestAnimationFrame(go); setTimeout(go, 140); setTimeout(go, 450); }
  function activeScopeEl() { const top = overlays[overlays.length - 1]; return top ? screens[top].el : screens[base]?.el; }
  function setBase(name) {
    base = name; for (const n of ['main', 'pause', 'end']) { const s = n === 'end' ? end : screens[n]; if (s) setOn(s, n === name); }
    syncHud(); captureKeys(name !== 'game'); ctx.events.emit('menu:state', { state: name });
  }
  function showOverlay(name, arg) {
    const below = activeScopeEl(); lastFocus = document.activeElement; focusStack.push(lastFocus); if (below) below.inert = true;
    overlays.push(name); setOn(screens[name], true); screens[name].el.inert = false; syncHud();
    if (name === 'settings') settings.open(arg || settings.active); if (name === 'help') help.refresh(); if (name === 'cheat') cheat.refresh();
    if (inMenuWorld) backdrop.setMood(name === 'settings' || name === 'help' || name === 'credits' ? 'side' : 'main');
    ctx.events.emit('ui:open', { owner: 'menu', name });
    if (name === 'settings') requestAnimationFrame(() => screens.settings.el.querySelector('.fx-tab.on')?.focus({ preventScroll: true })); else focusIn(screens[name].el);
  }
  function openOverlay(name, arg) { if (overlays.includes(name)) return; showOverlay(name, arg); }
  function back() {
    const name = overlays.pop(); if (!name) return; syncHud();
    if (name === 'settings') settings.leave();
    setOn(screens[name], false); const below = activeScopeEl(); if (below) below.inert = false;
    ctx.events.emit('ui:close', { owner: 'menu', name }); ctx.events.emit('ui:click');
    if (!overlays.length && inMenuWorld) backdrop.setMood('main');
    const f = focusStack.pop();  if (f && document.contains(f) && f !== document.body) (f.focus({ preventScroll: true }), setTimeout(() => f.focus({ preventScroll: true }), 60)); else focusIn(below);
  }
  function clearOverlays() { focusStack.length = 0; while (overlays.length) { const n = overlays.pop(); setOn(screens[n], false); screens[n].el.inert = false; } syncHud(); for (const s of [main, pause]) s.el.inert = false; if (end) end.el.inert = false; }

  // ------------------------------------------------------------------ main menu / boot
  async function showMain({ instant = false } = {}) {
    clearOverlays(); worldMenu(true); backdrop.setMood('main'); if (instant) backdrop.snapMood();
    setBase('main'); main.paint(); boot.el.classList.add('out'); boot.el.classList.remove('on');
    ctx.audio?.music?.set?.('menu'); focusIn(main.el);
  }
  async function runBoot() {
    const total = MODULES.length; const prog = (p, t) => boot.set(Math.min(1, p), t);
    const t0 = performance.now(); const minTime = fast ? 0 : 1900;
    const modP = () => Math.min(1, Object.keys(ctx.modules).length / total);
    prog(.05 + .3 * modP(), 'Initialising systems'); await raf();
    // fonts
    prog(.42, 'Loading typography'); try { await Promise.race([document.fonts?.ready, sleep(fast ? 50 : 1400)]); } catch {} await raf();
    prog(.6, 'Staging showcase'); await raf();
    if (!bypass) { try { backdrop.warm(); } catch (e) { ctx.errors.push('menu warm ' + e); } }
    prog(.82, 'Compiling shaders'); await raf();
    ctx.events.on('boot:done', () => {});
    prog(.95, 'Profile'); applySettings(); await raf();
    const left = minTime - (performance.now() - t0); if (left > 0) { const steps = 4; for (let i = 0; i < steps; i++) { await sleep(left / steps); prog(.95 + .05 * (i + 1) / steps, i === steps - 1 ? 'Ready' : undefined); } }
    prog(1, 'Ready'); await sleep(fast ? 0 : 220);
    if (bootAbort) return;
    await showMain();
  }

  // ------------------------------------------------------------------ match flow
  async function play({ practice = false } = {}) {
    if (base === 'starting') return;
    const pr = prefs(); const side = pr.side === 'random' ? (Math.random() < .5 ? 'ember' : 'tide') : pr.side;
    lastOpts = { practice }; const opts = { difficulty: pr.difficulty, playerTeam: side, bots: !practice, practice, mode: practice ? 'practice' : 'match', map: pr.map, name: get('playerName') };
    ctx.events.emit('ui:click'); ctx.events.emit('menu:play', opts);
    base = 'starting'; syncHud(); wipe.querySelector('.msg span').textContent = practice ? 'Entering practice range' : 'Deploying to Crux Station'; wipe.classList.add('on');
    try { ctx.audio?.unlock?.(); ctx.input?.lock?.(); } catch {}
    await sleep(T(420));
    clearOverlays(); for (const s of [main, pause]) setOn(s, false); if (end) setOn(end, false);
    worldMenu(false); scrim.style.opacity = 0;
    try {
      if (practice && ctx.debugScenes?.range) await ctx.debugScenes.range(ctx);
      else if (ctx.match?.startMatch) await ctx.match.startMatch(opts);
      if (ctx.localActor) { ctx.localActor.name = get('playerName') || ctx.localActor.name; if (ctx.match?.__stub || !ctx.match?.startMatch) ctx.localActor.team = side; }
    } catch (e) { console.error('[menu] startMatch failed', e); ctx.errors.push('menu startMatch: ' + (e?.stack || e)); toast('Could not start match'); }
    setBase('game'); ctx.engine && (ctx.engine.paused = false);
    await sleep(T(fast ? 100 : 700)); wipe.classList.remove('on');
    ctx.audio?.music?.set?.('round');
    if (!get('tutorialDone') && !bypass) tutorial.start(0);
    await sleep(T(600));
    if (base === 'game' && !ctx.input?.locked && !test) openPause();
  }
  function openPause() {
    if (base !== 'game') return;
    pause.refresh(); pause.hint(false); clearOverlays(); setBase('pause'); try { ctx.input?.unlock?.(); } catch {} ctx.engine && (ctx.engine.paused = true); try { ctx.match?.pause?.(); } catch {} tutorial.show(false);
    ctx.events.emit('ui:open', { owner: 'menu', name: 'pause' }); ctx.events.emit('game:pause', { paused: true }); focusIn(pause.el);
  }
  function finishResume() {
    if (base !== 'pause') return; clearOverlays(); setOn(pause, false);
    setBase('game'); ctx.engine && (ctx.engine.paused = false); try { ctx.match?.resume?.(); } catch {} tutorial.show(true);
    ctx.events.emit('ui:close', { owner: 'menu', name: 'pause' }); ctx.events.emit('game:pause', { paused: false }); ctx.events.emit('ui:click');
  }
  // Click-to-resume: request the lock; the pause UI only closes once the browser grants it (Esc is not a user-activation key in real Chrome).
  function resume() {
    if (base !== 'pause') return;
    try { ctx.input?.lock?.(); } catch {}
    if (ctx.input?.locked) { finishResume(); return; }
    pause.hint(true); setTimeout(() => { if (base === 'pause' && !ctx.input?.locked) pause.hint(true, true); }, 450);
  }
  function confirmLeave() {
    const box = h('div', { class: 'fx-confirm' }, h('div', { class: 'fx-card' }, h('h4', null, 'Leave match?'), h('p', null, 'Your progress in this match will be lost.'),
      h('div', { class: 'b' }, h('button', { class: 'fx-btn', 'data-autofocus': '', onClick: () => { box.remove(); pause.el.inert = false; focusIn(pause.el); } }, 'Stay'), h('button', { class: 'fx-btn danger', onClick: () => { box.remove(); leaveMatch(); } }, 'Leave'))));
    pause.el.append(box); pause.el.inert = true; box.inert = false; focusIn(box);
  }
  async function leaveMatch() {
    tutorial.stop(); if (ctx.engine) ctx.engine.paused = false; endDelay = -1; try { ctx.match?.resume?.(); } catch {}
    const m = ctx.match; const fn = m?.leaveMatch || m?.quit || m?.endMatch || m?.stopMatch || m?.leave || m?.abort;
    if (fn) { try { await fn.call(m); } catch (e) { ctx.errors.push('menu leave ' + e); } }
    else if (!test) { wipe.classList.add('on'); wipe.querySelector('.msg span').textContent = 'Returning to menu'; await sleep(200); location.reload(); return; }
    if (end) { setOn(end, false); end.el.remove(); end = null; }
    try { ctx.input?.unlock?.(); } catch {}
    setOn(pause, false); await showMain();
  }
  function showEnd(data) {
    if (base === 'end') return; tutorial.stop(); clearOverlays(); setOn(pause, false);
    if (end) end.el.remove();
    try { end = buildEnd(ctx, A, data); } catch (e) { ctx.errors.push('menu buildEnd ' + (e?.stack || e)); end = buildEnd(ctx, A, { ...fakeEndData(ctx, data?.winner || 'ember'), fake: false, teams: { ember: [], tide: [] }, history: [], econLog: [], scores: data?.scores || ctx.match?.scores || { ember: 0, tide: 0 } }); }
    root.insertBefore(end.el, tutorial.el); screens.end = end;
    setBase('end'); void end.el.offsetWidth; setOn(end, true); try { ctx.input?.unlock?.(); } catch {}
    ctx.events.emit('ui:open', { owner: 'menu', name: 'end' }); focusIn(end.el);
  }
  function tone(bus) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const ac = tone.ac || (tone.ac = new AC()); ac.resume?.();
      const t = ac.currentTime, key = { master: 'volume', sfx: 'sfxVolume', music: 'musicVolume', voice: 'voiceVolume' }[bus];
      const vol = (get('volume') ?? .8) * (bus === 'master' ? 1 : (get(key) ?? 1)) * .35;
      const o = (type, f0, f1, t0, dur, g = 1, filt) => { const os = ac.createOscillator(), gn = ac.createGain(); os.type = type; os.frequency.setValueAtTime(f0, t + t0); if (f1) os.frequency.exponentialRampToValueAtTime(f1, t + t0 + dur); gn.gain.setValueAtTime(0.0001, t + t0); gn.gain.exponentialRampToValueAtTime(vol * g, t + t0 + .012); gn.gain.exponentialRampToValueAtTime(0.0001, t + t0 + dur); let n = os; if (filt) { const f = ac.createBiquadFilter(); f.type = filt[0]; f.frequency.value = filt[1]; os.connect(f); n = f; } n.connect(gn).connect(ac.destination); os.start(t + t0); os.stop(t + t0 + dur + .05); };
      if (bus === 'master') { o('sine', 660, 0, 0, .28); o('sine', 990, 0, .12, .4, .8); o('triangle', 1320, 0, .24, .5, .4); }
      else if (bus === 'sfx') { o('square', 1500, 260, 0, .16, .8, ['lowpass', 5000]); o('sawtooth', 220, 60, 0, .22, .9, ['lowpass', 900]); o('sine', 3000, 800, .01, .08, .3); }
      else if (bus === 'music') { [220, 277.2, 329.6, 440].forEach((f, i) => o('triangle', f, 0, i * .18, .7, .7, ['lowpass', 1800])); }
      else { [180, 220, 170].forEach((f, i) => o('sawtooth', f, f * .9, i * .16, .14, .6, ['bandpass', 900 + i * 200])); }
    } catch {}
  }

  // ------------------------------------------------------------------ locker
  function openLocker() {
    const c = ctx.cosmetics;
    if (!c || c.__stub || typeof c.openLocker !== 'function') { toast('Locker unavailable'); return; }
    lockerOpen = true; document.documentElement.classList.remove('fx-menu'); setOn(main, false); backdrop.suspend(true);
    const done = () => { if (!lockerOpen) return; lockerOpen = false; backdrop.suspend(false); document.documentElement.classList.toggle('fx-menu', inMenuWorld); if (base === 'main') { setOn(main, true); backdrop.setMood('main'); focusIn(main.el); } };
    try { const r = c.openLocker({ onClose: done, side: ctx.match?.playerTeam || (prefs().side === 'tide' ? 'tide' : 'ember') }); if (r && typeof r.then === 'function') r.then(done, done); } catch (e) { ctx.errors.push('menu locker ' + e); done(); }
    const off = ctx.events.on('ui:close', (d) => { if ((d?.name || d?.id) === 'locker') { off(); done(); } });
    const esc = (e) => { if (e.code === 'Escape' && lockerOpen) setTimeout(() => { if (lockerOpen && (c.isOpen ? !c.isOpen() : !document.querySelector('#ui [data-fx-locker]'))) { /* keep open: cosmetics owns Esc */ } }, 0); };
    addEventListener('keydown', esc, { once: true });
  }

  // ------------------------------------------------------------------ settings application
  function applySettings() {
    try {
      fpsEl.hidden = !get('showFps');
      if (S.get('keybinds') && Object.keys(S.get('keybinds')).length) ctx.menu_applyBinds();
      ctx.render?.setQuality?.(get('quality'));
      if (get('resolutionScale') !== 100) ctx.render?.setResolutionScale?.(get('resolutionScale') / 100);
      for (const [b, k] of [['master', 'volume'], ['sfx', 'sfxVolume'], ['music', 'musicVolume'], ['voice', 'voiceVolume']]) ctx.audio?.setVolume?.(b, get(k));
      if (get('colorblind') !== 'off') ctx.render?.setColorblind?.(get('colorblind'));
    } catch (e) { ctx.errors.push('menu applySettings ' + e); }
  }
  ctx.events.on('settings:change', ({ key } = {}) => { if (key === 'showFps') fpsEl.hidden = !get('showFps'); });

  // ------------------------------------------------------------------ global input + pointer lock handling
  ctx.events.on('ui:open', (d) => { if (d?.owner !== 'menu') extModal++; });
  ctx.events.on('ui:close', (d) => { if (d?.owner !== 'menu') extModal = Math.max(0, extModal - 1); });
  ctx.events.on('input:unlock', () => { if (base !== 'game') return; setTimeout(() => { if (base === 'game' && !ctx.input.locked && !extModal && !lockerOpen) openPause(); }, 60); });
  ctx.events.on('input:lock', () => { if (base === 'pause' && !overlays.length && !wipe.classList.contains('on')) finishResume(); });
  ctx.events.on('locker:close', () => { if (lockerOpen) { lockerOpen = false; backdrop.suspend(false); document.documentElement.classList.toggle('fx-menu', inMenuWorld); if (base === 'main') { setOn(main, true); backdrop.setMood('main'); focusIn(main.el); } } });
  ctx.events.on('match:end', (d) => { if (base === 'game') { endDelay = 2.6; ctx._menuEndData = d; } });
  addEventListener('keydown', (e) => {
    if (e.code === 'F1') { e.preventDefault(); if (base === 'game') { cheatOpen = !cheatOpen; cheat.refresh(); setOn(cheat, cheatOpen); syncHud(); } else if (base === 'main') { overlays.includes('cheat') ? back() : openOverlay('help'); } else if (overlays[overlays.length - 1] === 'cheat') back(); return; }
    if (e.code === 'Escape' && base === 'game' && !extModal && !lockerOpen && !e.repeat) { if (cheatOpen) { cheatOpen = false; setOn(cheat, false); syncHud(); return; } openPause(); return; }
    if ((e.key === 'Enter') && base === 'main' && !overlays.length && !lockerOpen && (!document.activeElement || document.activeElement === document.body || !root.contains(document.activeElement))) { e.preventDefault(); play(); }
  });
  addEventListener('pointerdown', () => { try { ctx.audio?.unlock?.(); } catch {} }, { once: true });
  let padRaf = 0; const padLoop = () => { padRaf = requestAnimationFrame(padLoop); nav.pad(); }; padRaf = requestAnimationFrame(padLoop);

  // ------------------------------------------------------------------ gallery / debug
  const GALLERY = ['boot', 'main', 'settings:controls', 'settings:video', 'settings:audio', 'settings:crosshair', 'settings:viewmodel', 'help', 'credits', 'pause', 'end:win', 'end:loss', 'tutorial:0', 'tutorial:1', 'tutorial:2', 'tutorial:3', 'cheat'];
  async function debugShow(id) {
    bootAbort = true; tutorial.stop(); cheatOpen = false; setOn(cheat, false); clearOverlays(); wipe.classList.remove('on');
    if (end) { end.el.remove(); end = null; } ctx.engine && (ctx.engine.paused = false);
    const [k, arg] = id.split(':');
    if (k === 'boot') { worldMenu(false); boot.el.classList.remove('out'); boot.el.classList.add('on'); boot.set(.72, 'Compiling shaders'); base = 'boot'; return; }
    boot.el.classList.add('out'); boot.el.classList.remove('on');
    if (['main', 'settings', 'help', 'credits'].includes(k)) {
      await showMain({ instant: true }); backdrop.snapMood();
      if (k !== 'main') { openOverlay(k, arg); backdrop.snapMood(); }
    } else {
      worldMenu(false); scrim.style.opacity = 0; setOn(main, false);
      if (k === 'pause') { setBase('game'); openPause(); }
      else if (k === 'end') { setBase('game'); showEnd(fakeEndData(ctx, arg === 'loss' ? 'tide' : 'ember')); }
      else if (k === 'tutorial') { setBase('game'); tutorial.start(+arg || 0); tutorial.stepTo(+arg || 0); }
      else if (k === 'cheat') { setBase('game'); cheatOpen = true; cheat.refresh(); setOn(cheat, true); }
    }
    root.dataset.screen = id;
  }
  ctx.debugScenes['menu-gallery'] = async () => {
    const id = P.get('screen');
    if (id) { await debugShow(id); return; }
    let i = 0; const step = async () => { await debugShow(GALLERY[i % GALLERY.length]); root.dataset.gallery = GALLERY[i % GALLERY.length]; i++; };
    await step(); setInterval(step, +(P.get('every') || 2600));
  };

  // ------------------------------------------------------------------ boot decision
  if (bypass) { setBase('game'); captureKeys(false); boot.el.remove(); }
  else if (test && !P.get('boot')) { queueMicrotask(() => { if (bootAbort) return; bootAbort = true; boot.el.classList.add('out'); showMain({ instant: true }); }); }
  else queueMicrotask(() => { if (!bootAbort) runBoot(); });
  applySettings();

  let fpsAcc = 0;
  return {
    update(dt) {
      if (inMenuWorld) backdrop.update(dt);
      if (base === 'main') main.tick(dt);
      if (base === 'game') tutorial.update(dt);
      if (endDelay >= 0 && base === 'game') { endDelay -= dt; if (endDelay < 0) showEnd(ctx._menuEndData); }
      if (!fpsEl.hidden) { fpsAcc += dt; if (fpsAcc > .5) { fpsAcc = 0; fpsEl.textContent = Math.round(1 / (ctx.engine?.dtSmooth || .0167)) + ' FPS'; } }
    },
    get state() { return base; }, get backdrop() { return backdrop; }, settings, tutorial,
    dispose() { nav.dispose(); cancelAnimationFrame(padRaf); backdrop.dispose(); root.remove(); style.remove(); },
    debug: { show: debugShow, screens: GALLERY, get base() { return base; }, get overlays() { return overlays.slice(); }, showMain, play, openPause, resume, showEnd: (w) => showEnd(fakeEndData(ctx, w || 'ember')), tutorial, settings, get backdrop() { return backdrop; }, toast, focus: () => document.activeElement?.outerHTML?.slice(0, 120) },
  };
}
