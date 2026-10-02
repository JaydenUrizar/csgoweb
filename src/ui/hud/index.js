// FLUX TAG HUD — DOM/CSS + small canvases. Reads ctx.match / ctx.combat / actors through guarded, contract-only calls.
// Debug: ctx.hud.debug.mock(true|false), ctx.hud.debug.state('live'|'buy'|...), scenes ?scene=hud-gallery | hud-icons | hud-crosshairs.
import { TEAMS } from '../../core/config.js';
import { bus, h, applyPalette, paletteKey, PALETTES, hexRgb, clamp } from './core.js';
import { sprite, icon, WEAPON_IDS, NAMES } from './icons.js';
import { create as createFx, css as fxCss } from './fx.js';
import { create as createRadar, css as radarCss } from './radar.js';
import { create as createTop, css as topCss } from './topbar.js';
import { create as createVitals, css as vitCss } from './vitals.js';
import { create as createFeed, css as feedCss } from './feed.js';
import { create as createPrompts, css as promptCss } from './prompts.js';
import { create as createBuy, css as buyCss } from './buymenu.js';
import { create as createSb, css as sbCss } from './scoreboard.js';
import { create as createSpec, css as specCss } from './spectator.js';
import { create as createRecap, css as recapCss } from './recap.js';
import { createMock } from './mock.js';
import f500 from './fonts/bc500.woff2?url';
import f600 from './fonts/bc600.woff2?url';
import f700 from './fonts/bc700.woff2?url';

const BASE_CSS = `
@font-face{font-family:"Barlow Condensed";font-weight:500;font-style:normal;font-display:swap;src:url(${f500}) format("woff2")}
@font-face{font-family:"Barlow Condensed";font-weight:600;font-style:normal;font-display:swap;src:url(${f600}) format("woff2")}
@font-face{font-family:"Barlow Condensed";font-weight:700;font-style:normal;font-display:swap;src:url(${f700}) format("woff2")}
.fxh{position:fixed;inset:0;pointer-events:none;overflow:hidden;--font:"Barlow Condensed","Rajdhani","Bahnschrift","Roboto Condensed","Arial Narrow","DejaVu Sans Condensed",system-ui,sans-serif;font-family:var(--font);color:#fff;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;user-select:none;z-index:5}
.fxh *{box-sizing:border-box}
.fxh .abs{position:absolute;inset:0;pointer-events:none}
.fxh .hroot{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none}
.fxh .hroot>*{pointer-events:none}
.fxh .hroot>.buy,.fxh .hroot>.buy *{pointer-events:auto}
.fxh .ic{display:inline-block;overflow:visible;vertical-align:middle}
.fxh .ic-w{aspect-ratio:120/48;height:1em}.fxh .ic-g{width:1em;height:1em}
.fxh .bgd{position:absolute;inset:0;display:none}
.fxh.hidden .hroot,.fxh.hidden .abs>*:not(.bgd){display:none!important}
`;

export function create(ctx) {
  const ui = document.getElementById('ui') || document.body;
  const wrap = h('div', 'fxh', ui); wrap.id = 'flux-hud';
  wrap.style.pointerEvents = 'none';
  const st = document.createElement('style'); st.id = 'flux-hud-css';
  st.textContent = BASE_CSS + fxCss + radarCss + topCss + vitCss + feedCss + promptCss + buyCss + sbCss + specCss + recapCss;
  document.head.appendChild(st);
  const bgd = h('div', 'bgd', wrap);
  const abs = h('div', 'abs', wrap);
  const rt = h('div', 'hroot', wrap);
  const spr = h('div', '', rt, sprite()); spr.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';

  const H = {
    ctx, bus: bus(), T: 0, k: 1, mock: false, hidden: false, menuOpen: false, flags: {}, keys: {}, spec: false,
    root: rt, abs, wrap, bgd, onResize: [], pal: PALETTES.off, rgb: { ember: '255,122,47', tide: '47,208,255' },
    local: null, view: null, playerTeam: 'ember', specTarget: null, xhairOverride: null, cbOverride: null, scaleOverride: null, specForce: null,
    get R() { return H.mock && mock ? mock.ctx : ctx; },
    xhairCfg() { return H.xhairOverride || H._xh || (H._xh = { ...(ctx.settings?.get?.('crosshair') || {}) }); },
  };
  let mock = null;
  const dbg = { perf: 0, perfAvg: 0, frames: 0 };

  // ------------------------------------------------------------------ event forwarding (real bus -> hud bus)
  const FWD = ['round:phase', 'round:start', 'round:end', 'match:end', 'halftime', 'weapon:fire', 'weapon:reload', 'weapon:switch', 'weapon:empty', 'tag:hit', 'tag:out', 'util:throw', 'util:detonate', 'util:blind',
    'beacon:pickup', 'beacon:drop', 'beacon:arm', 'beacon:armed', 'beacon:disarm', 'beacon:complete', 'buy', 'credits', 'spectate', 'ping'];
  const offs = [];
  for (const t of FWD) offs.push(ctx.events.on(t, (d) => { if (H.mock) return; const lt = ctx.localActor?.team; if (lt) H.playerTeam = lt; H.bus.emit(t, d); }));   // integration: events fire inside the sim tick, before refreshActors(); a stale playerTeam showed Attack banners to Tide (round 1 / after halftime)
  offs.push(ctx.events.on('settings:change', (d) => { H._xh = null; H._dirtySettings = true; }));
  H.bus.on('spectate', (d) => { if (d?.actor) H.specTarget = d.actor; });

  // ------------------------------------------------------------------ components (order = update order)
  const fx = createFx(H);
  const radar = createRadar(H);
  const top = createTop(H);
  const vitals = createVitals(H);
  const feed = createFeed(H);
  H.feed = feed;
  const prompts = createPrompts(H); H.prompts = prompts;
  const buy = createBuy(H); H.buy = buy;
  const sb = createSb(H);
  const spec = createSpec(H);
  const recap = createRecap(H);
  const comps = [fx, radar, top, vitals, feed, prompts, buy, sb, spec, recap];

  // ------------------------------------------------------------------ layout / scale
  let lastScale = 0, lastW = 0, lastH = 0;
  function layout() {
    const w = innerWidth, hh = innerHeight; const hs = H.scaleOverride ?? clamp(ctx.settings?.get?.('hudScale') ?? 1, 0.5, 2);
    if (w === lastW && hh === lastH && hs === lastScale) return; lastW = w; lastH = hh; lastScale = hs;
    const k = (hh / 720) * hs; H.k = k;
    rt.style.width = (w / k) + 'px'; rt.style.height = (hh / k) + 'px'; rt.style.transform = `scale(${k})`;
    for (const f of H.onResize) f();
  }
  addEventListener('resize', layout); layout();

  // ------------------------------------------------------------------ per-frame actor/state resolution
  let lastPal = '', lastTeam = '';
  function refreshActors() {
    const R = H.R;
    const local = R.localActor || null; H.local = local;
    H.playerTeam = local?.team || R.match?.playerTeam || 'ember';
    H.spec = !!local && local.alive === false;
    let view = local;
    if (H.spec) {
      let t = H.specForce || H.specTarget;
      if (!H.mock && R.match?.spectating?.alive) t = R.match.spectating;
      if (!t || t.alive === false) { t = (R.actors || []).find((a) => a !== local && a.alive !== false && a.team === local.team) || (R.actors || []).find((a) => a.alive !== false && a !== local) || null; H.specTarget = t; }
      view = t || local;
    }
    if (view !== H._lastView) { H._lastView = view; H.view = view; H.bus.emit('viewchange', { view }); }
    H.view = view;
    const key = paletteKey(H.cbOverride ?? ctx.settings?.get?.('colorblind'));
    if (key !== lastPal || H.playerTeam !== lastTeam) {
      lastPal = key; lastTeam = H.playerTeam; H.pal = applyPalette(wrap, key, H.playerTeam);
      H.rgb = { ember: hexRgb(H.pal.ember).join(','), tide: hexRgb(H.pal.tide).join(',') };
    }
  }
  H.refreshActors = refreshActors;

  function cycleSpec(dir) {
    if (!H.mock && ctx.match?.cycleSpectate) { ctx.match.cycleSpectate(dir); return; }
    const R = H.R; let cand = (R.actors || []).filter((a) => a.alive !== false && a !== H.local); const mates = cand.filter((a) => a.team === H.local.team); if (mates.length) cand = mates;
    if (!cand.length) return; cand.sort((a, b) => (a.team === H.local.team ? 0 : 1) - (b.team === H.local.team ? 0 : 1) || a.id - b.id);
    const i = Math.max(0, cand.indexOf(H.specTarget)); const n = cand[(i + dir + cand.length) % cand.length];
    H.specTarget = n; H.specForce = null; if (!H.mock) ctx.events.emit('spectate', { actor: n });
  }

  // ------------------------------------------------------------------ mock
  function setMock(on, o) {
    on = !!on; if (on === H.mock) return api;
    if (on) { mock = mock || createMock(H); mock.on = true; H.mock = true; mock.startAuto?.(); if (o?.state) mock.apply(o.state); }
    else { H.mock = false; if (mock) mock.on = false; H.bus.emit('reset'); }
    refreshActors(); H.T += 0; return api;
  }
  const params = ctx.params;
  if (params.get('hudmock')) queueMicrotask(() => { setMock(true); const s = params.get('hudmock'); if (s !== '1' && mock) mock.apply(s); });

  // ------------------------------------------------------------------ frame
  function update(dt) {
    const t0 = performance.now();
    dt = Math.min(dt, 0.1); H.T += dt; H.overlayPrev = H.overlayA || 0; H.overlayA = 0;
    layout();
    if (H.mock && mock) mock.update(dt);
    refreshActors();
    if (H.spec && !H.mock) { if (ctx.input.pressed('fire')) cycleSpec(1); else if (ctx.input.pressed('aim')) cycleSpec(-1); }
    for (let i = 0; i < comps.length; i++) comps[i].update(dt);
    const el = performance.now() - t0; dbg.perf = el; dbg.perfAvg += (el - dbg.perfAvg) * 0.05; dbg.frames++;
  }

  // ------------------------------------------------------------------ public API
  const api = {
    update,
    dispose() { for (const o of offs) o?.(); wrap.remove(); st.remove(); },
    setVisible(v) { H.hidden = !v; wrap.classList.toggle('hidden', !v); },
    toast: (t, k) => prompts.toast(t, k), notice: (t, c, i, d) => prompts.notice(t, c, i, d), banner: (o) => prompts.banner(o),
    hitMarker: (kind = 'body') => fx.pushHit(kind),
    buy: { open: buy.open, close: buy.close, toggle: buy.toggle, isOpen: buy.isOpen },
    scoreboard: { show: (v = true) => { H.flags.forceScore = !!v; } },
    spectate: { next: () => cycleSpec(1), prev: () => cycleSpec(-1), target: () => H.specTarget },
    icons: { ids: WEAPON_IDS, html: icon },
    get hud() { return H; },
    debug: {
      H, perf: dbg,
      mock: (on, o) => setMock(on, o),
      state: (name) => { setMock(true); mock.auto = false; const ok = mock.apply(name); refreshActors(); return ok; },
      states: () => (mock || (mock = createMock(H))).states,
      auto: () => { setMock(true); mock.startAuto(); },
      /** Advance the HUD alone (no sim) — deterministic capture: seek(seconds, step). */
      step(seconds = 0.3, step = 1 / 60) { const n = Math.max(1, Math.round(seconds / step)); for (let i = 0; i < n; i++) update(step); return H.T; },
      setCrosshair(o) { H.xhairOverride = o ? { ...(ctx.settings?.get?.('crosshair') || {}), ...o } : null; },
      showAll() { setMock(true); mock.apply('live'); return true; },
      colorblind: (k) => { H.cbOverride = k; },
      bg(kind) { setBackdrop(kind); },
      get mockCtx() { return mock?.ctx; },
      fx, comps,
    },
  };

  // ------------------------------------------------------------------ backdrops for the gallery
  function setBackdrop(kind) {
    const b = bgd; if (!kind || kind === 'off' || kind === '3d') { b.style.display = 'none'; return; }
    b.style.display = 'block';
    if (kind === 'dusk') b.style.background = 'radial-gradient(120% 90% at 70% 30%,#6b4f7d 0%,#2c2f55 45%,#12162a 100%)';
    else if (kind === 'dark') b.style.background = 'linear-gradient(180deg,#20252f,#0c0f16)';
    else if (kind === 'bright') b.style.background = 'linear-gradient(180deg,#dfe9f2,#cfd8df 60%,#b9b7a8)';
    else b.innerHTML = SUN_SCENE, b.style.background = '#000';
    if (kind !== 'sun') b.innerHTML = '';
  }
  const SUN_SCENE = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%"><defs>
   <linearGradient id="bs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb3e6"/><stop offset=".55" stop-color="#e9d9b4"/><stop offset="1" stop-color="#f1c98a"/></linearGradient>
   <radialGradient id="bsun" cx=".72" cy=".3" r=".5"><stop offset="0" stop-color="#fff6d8" stop-opacity=".95"/><stop offset=".25" stop-color="#ffe8a8" stop-opacity=".35"/><stop offset="1" stop-color="#ffe8a8" stop-opacity="0"/></radialGradient>
   <linearGradient id="bw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b98d"/><stop offset="1" stop-color="#a98a63"/></linearGradient>
   <linearGradient id="bw2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b58b6a"/><stop offset="1" stop-color="#8a664d"/></linearGradient>
   <linearGradient id="bfl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9c8467"/><stop offset="1" stop-color="#5f5040"/></linearGradient>
  </defs><rect width="1600" height="900" fill="url(#bs)"/><rect width="1600" height="900" fill="url(#bsun)"/>
  <path d="M0 470 L260 430 L260 250 L520 250 L520 400 L760 380 L760 300 L1010 300 L1010 420 L1290 400 L1290 210 L1600 210 L1600 900 L0 900Z" fill="url(#bw)"/>
  <path d="M0 560 L330 520 L330 360 L600 360 L600 500 L900 470 L900 380 L1180 380 L1180 500 L1600 470 L1600 900 L0 900Z" fill="url(#bw2)" opacity=".92"/>
  <g fill="#3a2c22" opacity=".28"><rect x="280" y="290" width="40" height="70"/><rect x="380" y="290" width="40" height="70"/><rect x="800" y="330" width="46" height="60"/><rect x="900" y="330" width="46" height="60"/><rect x="1340" y="250" width="50" height="80"/><rect x="1440" y="250" width="50" height="80"/></g>
  <path d="M0 640 L1600 610 L1600 900 L0 900Z" fill="url(#bfl)"/>
  <path d="M0 640 L1600 610" stroke="#ffe9b8" stroke-opacity=".5" stroke-width="3"/>
  <g fill="#2a2018" opacity=".35"><rect x="150" y="600" width="130" height="60" rx="3"/><rect x="1180" y="590" width="170" height="70" rx="3"/><rect x="640" y="620" width="90" height="40" rx="3"/></g>
  </svg>`;

  // ------------------------------------------------------------------ scenes
  ctx.debugScenes = ctx.debugScenes || {};
  const P = (k, d) => ctx.params.get(k) ?? d;
  ctx.debugScenes['hud-gallery'] = async () => {
    setBackdrop(P('bg', 'sun'));
    const state = P('hudstate', 'live'); setMock(true); mock.auto = false;
    if (P('anim', '0') === '1') mock.startAuto(); else mock.apply(state);
    refreshActors(); api.debug.step(P('t', '0.6') * 1);
  };
  ctx.debugScenes['hud-icons'] = async () => {
    setBackdrop('dusk'); const box = h('div', '', rt);
    box.style.cssText = 'position:absolute;left:60px;top:40px;right:60px;pointer-events:none';
    let html = '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px">';
    for (const id of WEAPON_IDS) html += `<div style="background:rgba(10,14,22,.78);border-radius:4px;padding:12px 8px 8px;text-align:center;box-shadow:0 0 0 1px rgba(255,255,255,.1) inset"><div style="height:60px;color:#fff;font-size:60px;line-height:60px">${icon(id)}</div><div style="margin-top:6px;font:600 16px var(--font);letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.8)">${NAMES[id] || id}</div></div>`;
    box.innerHTML = html + '</div>';
    for (const c of comps) if (c !== fx) { /* keep HUD hidden */ }
    H.flags.noTop = H.flags.noVitals = H.flags.noRadar = H.flags.noCrosshair = true; api.debug.step(0.1);
  };
  ctx.debugScenes['hud-crosshairs'] = async () => {
    setBackdrop('sun'); setMock(true); mock.auto = false; mock.apply('live'); H.flags.noTop = H.flags.noVitals = H.flags.noRadar = true;
    const styles = [['classic', {}], ['dot', {}], ['circle', {}], ['t', {}], ['classic', { dot: true, gap: 0 }], ['classic', { gap: -2, size: 8, thickness: 2.2 }]];
    const box = h('div', '', rt); box.style.cssText = 'position:absolute;inset:0';
    // draw a strip of static previews on canvases
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 240; cv.style.cssText = 'position:absolute;left:50%;top:20%;transform:translateX(-50%);width:600px;height:120px;border-radius:4px;background:rgba(0,0,0,.35)'; box.appendChild(cv);
    api.debug.step(0.1);
  };
  return api;
}
