// Settings screen: Controls (rebinding, sensitivity, eDPI), Video, Audio (live tones), Crosshair designer, Viewmodel & HUD.
import { h, ICON, keyLabel, makeControls } from './ui.js';
import { createCrosshairDesigner } from './crosshair.js';

// Values used when core's settings.js doesn't define a key (see docs/pieces/menu.md for the full key list).
export const SD = {
  sensitivity: .35, invertY: false, rawInput: true, fov: 100, mouseDpi: 800, quality: 'high', resolutionScale: 100, showFps: false, motionBlur: false, screenShake: 1,
  colorblind: 'off', volume: .8, sfxVolume: 1, musicVolume: .5, voiceVolume: 1, hudScale: 1, autoBhop: false, playerName: 'You',
  viewmodel: { fov: 68, offsetX: 0, offsetY: 0, offsetZ: 0, bob: 1 }, difficulty: 'pro', side: 'random', map: 'crux',
};
// Mirror of core/input.js DEFAULT_KEYS as action -> [primary, secondary]. Kept in sync via ctx.input.bindings?.() if core exposes it.
export const DEFAULT_BINDS = {
  forward: ['KeyW'], back: ['KeyS'], left: ['KeyA'], right: ['KeyD'], jump: ['Space'], crouch: ['ControlLeft', 'KeyC'], walk: ['ShiftLeft'],
  reload: ['KeyR'], use: ['KeyE'], inspect: ['KeyF'], drop: ['KeyG'], lastWeapon: ['KeyQ'],
  slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'], slot5: ['Digit5'], utilitySwap: ['KeyZ'],
  buy: ['KeyB'], scoreboard: ['Tab'], map: ['KeyM'], ping: ['KeyV'],
};
export const BIND_GROUPS = [
  ['Movement', [['forward', 'Move forward'], ['back', 'Move back'], ['left', 'Strafe left'], ['right', 'Strafe right'], ['jump', 'Jump'], ['crouch', 'Crouch / slide'], ['walk', 'Walk (quiet)']]],
  ['Combat', [['fire', 'Fire', 'Mouse0'], ['aim', 'Scope / aim', 'Mouse2'], ['reload', 'Reload'], ['use', 'Use / arm beacon'], ['inspect', 'Inspect tagger'], ['drop', 'Drop tagger'], ['lastWeapon', 'Last tagger']]],
  ['Loadout', [['slot1', 'Primary'], ['slot2', 'Sidearm'], ['slot3', 'Grip (Tap)'], ['slot4', 'Utility'], ['slot5', 'Beacon / kit'], ['utilitySwap', 'Cycle utility']]],
  ['Team & interface', [['buy', 'Buy menu'], ['scoreboard', 'Scoreboard'], ['map', 'Map'], ['ping', 'Ping / callout']]],
];
export const ACTION_LABEL = Object.fromEntries(BIND_GROUPS.flatMap(([, l]) => l.map((a) => [a[0], a[1]])));

export function createSettingsUI(ctx, { toast, onClose, sfxTone }) {
  const S = ctx.settings;
  const kit = makeControls(ctx);
  const get = (k) => { const v = S.get(k); return v === undefined ? SD[k] : v; };
  const put = (k, v) => S.set(k, v);
  const refreshers = [];
  const R = (c) => { refreshers.push(c.refresh); return c.el; };
  const row = kit.row, group = kit.group;

  // ---------------- key bindings ----------------
  const cur = () => { const o = S.get('keybinds') || {}; const r = {}; for (const a of Object.keys(DEFAULT_BINDS)) r[a] = (o[a] || DEFAULT_BINDS[a]).slice(0, 2); return r; };
  let capturing = null, capBtn = null;
  const chips = new Map();
  const saveBinds = (b) => { S.set('keybinds', b); ctx.menu_applyBinds?.(); paintKeys(); };
  function startCapture(action, slot, btn) {
    cancelCapture(); capturing = { action, slot }; capBtn = btn; btn.classList.add('cap'); btn.textContent = 'Press a key…'; ctx.input.captureKeys = true;
    addEventListener('keydown', onCapKey, true);
  }
  function cancelCapture() { if (!capturing) return; removeEventListener('keydown', onCapKey, true); capBtn?.classList.remove('cap'); capturing = null; capBtn = null; paintKeys(); }
  function onCapKey(e) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const { action, slot } = capturing;
    if (e.code === 'Escape') { cancelCapture(); return; }
    if (e.code === 'Backspace' || e.code === 'Delete') { const b = cur(); b[action][slot] = null; b[action] = b[action].filter((x, i) => x || i === 0).slice(0, 2); if (!b[action].length) b[action] = [null]; removeEventListener('keydown', onCapKey, true); capturing = null; saveBinds(b); return; }
    if (['MetaLeft', 'MetaRight', 'ContextMenu'].includes(e.code)) return;
    const b = cur(); let moved = null;
    for (const a of Object.keys(b)) if (a !== action || true) b[a] = b[a].map((c, i) => { if (c === e.code && !(a === action && i === slot)) { moved = a; return null; } return c; });
    b[action][slot] = e.code; removeEventListener('keydown', onCapKey, true); capturing = null; capBtn = null;
    saveBinds(b); if (moved) toast(`${keyLabel(e.code)} moved from ${ACTION_LABEL[moved]}`);
  }
  function keyRow(a) {
    const [action, label, locked] = a;
    const r = h('div', { class: 'fx-kb' }, h('div', { class: 'an' }, label));
    if (locked) { r.append(h('div', { class: 'fx-kc lock' }, keyLabel(locked)), h('div', { class: 'fx-kc lock empty' }, '')); return r; }
    const mk = (slot) => { const btn = h('button', { class: 'fx-kc', 'aria-label': `${label} key ${slot + 1}`, onClick: () => startCapture(action, slot, btn) }); chips.set(action + slot, btn); return btn; };
    r.append(mk(0), mk(1)); return r;
  }
  function paintKeys() { const b = cur(); for (const [k, btn] of chips) { const a = k.slice(0, -1), s = +k.slice(-1); const c = b[a]?.[s]; btn.textContent = c ? keyLabel(c) : '—'; btn.classList.toggle('empty', !c); btn.classList.remove('cap'); } }

  // ---------------- controls tab ----------------
  const degPer = () => ctx.player?.sensDegPerCount ?? .12605;   // degrees per mouse count at settings.sensitivity == 1
  const csFactor = () => degPer() / .022;
  const cs = () => get('sensitivity') * csFactor();
  const readout = h('div', { class: 'fx-ro' });
  const paintRo = () => {
    const dpi = get('mouseDpi'), c = cs(), edpi = c * dpi, cm360 = 360 / (c * .022 * dpi) * 2.54;
    readout.replaceChildren(...[['CS2 sensitivity', c.toFixed(2), ''], ['eDPI', Math.round(edpi), ''], ['cm / 360°', cm360.toFixed(1), 'cm'], ['deg / count', (c * .022).toFixed(4), '°']].map(([l, v, u]) => h('div', null, h('small', null, l), h('b', null, v, u ? h('i', null, u) : null))));
  };
  refreshers.push(paintRo);
  const sens = kit.slider({ min: .1, max: 8, step: .01, def: .35 * csFactor(), get: () => cs(), set: (v) => { put('sensitivity', v / csFactor()); paintRo(); }, fmt: (v) => v.toFixed(2), label: 'Sensitivity' });
  const dpiBox = kit.numberBox({ min: 100, max: 32000, step: 50, get: () => get('mouseDpi'), set: (v) => { put('mouseDpi', v); paintRo(); } });
  const name = h('input', { class: 'fx-txt', maxlength: 16, value: get('playerName'), style: { maxWidth: '16rem' }, 'aria-label': 'Callsign' });
  name.addEventListener('focus', () => { ctx.input.captureKeys = true; }); name.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') name.blur(); });
  name.addEventListener('change', () => { const v = name.value.trim().slice(0, 16) || 'You'; name.value = v; put('playerName', v); ctx.menu_nameChanged?.(); });
  refreshers.push(() => { name.value = get('playerName'); });
  const controls = () => h('div', null,
    group('Profile', row('Callsign', 'Shown on the scoreboard', name)),
    group('Mouse',
      row('Sensitivity', 'Counter-Strike scale — same feel as your CS2 sens', R(sens), { tall: true }),
      row('Mouse DPI', 'Your mouse\'s hardware DPI, for eDPI & cm/360', R(dpiBox)),
      h('div', { class: 'fx-row', style: { borderBottom: 0 } }, h('div', { class: 'lb' }, h('b', null, 'Readout')), h('div', { class: 'ct', style: { justifyContent: 'flex-start' } }, readout)),
      row('Invert Y', null, R(kit.toggle({ get: () => get('invertY'), set: (v) => put('invertY', v), label: 'Invert Y' }))),
      row('Raw input', 'Bypass OS pointer acceleration (recommended)', R(kit.toggle({ get: () => get('rawInput'), set: (v) => put('rawInput', v), label: 'Raw input' })))),
    group('View', row('Field of view', 'Wider sees more, moves the world away', R(kit.slider({ min: 80, max: 120, step: 1, def: 100, ticks: [90, 100, 110], get: () => get('fov'), set: (v) => put('fov', v), fmt: (v) => v, unit: '°', label: 'Field of view' })))),
    group('Movement', row('Auto bunny-hop', 'Hold jump to keep hopping', R(kit.toggle({ get: () => get('autoBhop'), set: (v) => put('autoBhop', v), label: 'Auto bunny hop' })))),
    ...BIND_GROUPS.map(([t, l]) => h('section', { class: 'fx-grp' }, h('h3', null, t + ' keys'), h('div', { class: 'fx-keys' }, l.map(keyRow)))),
    h('div', { class: 'fx-note' }, 'Click a key to rebind it. ', h('b', { style: { color: '#fff' } }, 'Backspace'), ' clears, ', h('b', { style: { color: '#fff' } }, 'Esc'), ' cancels. Each action has a primary and secondary key.'));

  // ---------------- video tab ----------------
  const QUALITY = [['low', 'Low', 'Fast. No shadows, light post.', 1], ['medium', 'Medium', 'Balanced for laptops.', 2], ['high', 'High', 'Soft shadows, bloom, AO.', 3], ['ultra', 'Ultra', 'Everything, at full res.', 4]];
  const qc = h('div', { class: 'fx-cards' }, QUALITY.map(([id, n, d, b]) => h('button', { class: 'fx-qc', 'data-q': id, onClick: () => { put('quality', id); ctx.render?.setQuality?.(id); paintQ(); } }, h('div', { class: 'bars' }, [1, 2, 3, 4].map((i) => h('i', { class: i <= b ? 'f' : '' }))), h('b', null, n), h('small', null, d))));
  const paintQ = () => [...qc.children].forEach((b) => b.classList.toggle('on', b.dataset.q === get('quality')));
  refreshers.push(paintQ);
  const resVal = h('span');
  const resPaint = () => { const d = Math.min(devicePixelRatio || 1, 2), s = get('resolutionScale') / 100; resVal.textContent = `${Math.round(innerWidth * d * s)} × ${Math.round(innerHeight * d * s)}`; };
  refreshers.push(resPaint);
  const fsBtn = h('button', { class: 'fx-btn sm', onClick: async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('Fullscreen blocked by browser'); } setTimeout(paintFs, 200); } });
  const paintFs = () => { fsBtn.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'; };
  refreshers.push(paintFs);
  const video = () => h('div', null,
    group('Quality', h('div', { class: 'fx-row', style: { borderBottom: 0, paddingTop: '.8rem' } }, qc),
      row('Resolution scale', 'Render below native to gain FPS', h('div', { style: { display: 'contents' } }, R(kit.slider({ min: 50, max: 100, step: 5, def: 100, get: () => get('resolutionScale'), set: (v) => { put('resolutionScale', v); ctx.render?.setResolutionScale?.(v / 100); resPaint(); }, fmt: (v) => v, unit: '%', label: 'Resolution scale' }))))),
    h('div', { class: 'fx-note', style: { marginTop: '-1rem', marginBottom: '1.6rem' } }, 'Rendering at ', resVal),
    group('Display', row('Fullscreen', 'Or press F11', fsBtn), row('Show FPS', 'Small counter, top right', R(kit.toggle({ get: () => get('showFps'), set: (v) => put('showFps', v), label: 'Show FPS' })))),
    group('Effects',
      row('Motion blur', 'Off by default — competitive clarity', R(kit.toggle({ get: () => get('motionBlur'), set: (v) => { put('motionBlur', v); ctx.render?.screen?.setMotionBlur?.(v); }, label: 'Motion blur' }))),
      row('Screen shake', 'Camera shake on impacts and pulses', R(kit.slider({ min: 0, max: 1, step: .05, def: 1, get: () => get('screenShake'), set: (v) => put('screenShake', v), fmt: (v) => Math.round(v * 100), unit: '%', label: 'Screen shake' })))),
    group('Accessibility', row('Colour-blind mode', 'Re-maps team & effect colours', R(kit.pills([['off', 'Off'], ['deuter', 'Deuter.'], ['protan', 'Protan.'], ['tritan', 'Tritan.']], { get: () => get('colorblind'), set: (v) => { put('colorblind', v); ctx.render?.setColorblind?.(v); } })))));

  // ---------------- audio tab ----------------
  const busses = [['volume', 'Master volume', 'Everything', 'master'], ['sfxVolume', 'Effects', 'Taggers, footsteps, impacts', 'sfx'], ['musicVolume', 'Music', 'Menu & round themes', 'music'], ['voiceVolume', 'Announcer & callouts', 'Voice lines', 'voice']];
  const meters = [];
  const audioRow = ([key, label, desc, bus]) => {
    const sl = kit.slider({ min: 0, max: 1, step: .01, def: SD[key], get: () => get(key), set: (v) => { put(key, v); ctx.audio?.setVolume?.(bus, v); }, fmt: (v) => Math.round(v * 100), unit: '%', label });
    const meter = h('div', { style: { display: 'flex', gap: '2px', alignItems: 'flex-end', height: '1.3rem', width: '2.6rem' } }, [0, 1, 2, 3, 4].map((i) => h('i', { style: { flex: 1, height: '25%', background: 'rgba(255,255,255,.18)', borderRadius: '1px', transition: 'height .1s, background .1s' } })));
    meters.push([bus, meter]);
    const play = h('button', { class: 'fx-btn sm', 'aria-label': `Test ${label}`, onClick: () => { testTone(bus); pulse(meter); } }, h('span', { html: ICON.play, style: { width: '.9rem', height: '.9rem', display: 'block' } }), 'Test');
    refreshers.push(sl.refresh);
    return row(label, desc, h('div', { style: { display: 'contents' } }, sl.el, meter, play));
  };
  const pulse = (m) => { [...m.children].forEach((c, i) => { setTimeout(() => { c.style.height = (35 + Math.abs(Math.sin(i * 1.7)) * 65) + '%'; c.style.background = 'var(--tide)'; }, i * 45); setTimeout(() => { c.style.height = '25%'; c.style.background = 'rgba(255,255,255,.18)'; }, 500 + i * 60); }); };
  const testTone = (bus) => {
    ctx.events.emit('ui:test', { bus });
    if (ctx.audio?.test) { try { ctx.audio.test(bus); return; } catch {} }
    sfxTone(bus);
  };
  const audio = () => h('div', null,
    group('Mixer', ...busses.map(audioRow)),
    h('div', { class: 'fx-note' }, 'Test buttons play a sample through the bus you are adjusting, so you can balance the mix before dropping in.'));

  // ---------------- crosshair tab ----------------
  const xh = createCrosshairDesigner(ctx, kit, toast);
  refreshers.push(xh.refresh);

  // ---------------- viewmodel & HUD ----------------
  const vm = () => ({ ...SD.viewmodel, ...(S.get('viewmodel') || {}) });
  const putVm = (patch) => { put('viewmodel', { ...vm(), ...patch }); paintVm(); };
  const vmSvg = h('div', { class: 'fx-vmprev', html: `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="fxvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b7ea8"/><stop offset=".55" stop-color="#cfd9e4"/></linearGradient></defs><rect width="320" height="100" fill="url(#fxvg)"/><rect y="100" width="320" height="80" fill="#a08a63"/><path d="M0 100h320" stroke="rgba(0,0,0,.2)"/><g id="fxvm"><g transform="translate(180 128)"><path d="M0 40 L14 -8 L92 -12 L96 -2 L44 6 L40 40Z" fill="#2c3340"/><path d="M14 -8 L92 -12 L96 -22 L30 -22Z" fill="#5a6474"/><rect x="88" y="-16" width="34" height="5" fill="#ff7a2f"/><path d="M-6 44 L20 22 L46 24 L40 52Z" fill="#c9a07c"/><path d="M60 22 L100 10 L104 24 L64 38Z" fill="#c9a07c"/></g></g><g stroke="#6dff9a" stroke-width="1.2" opacity=".9"><path d="M160 84v5M160 96v5M147 92.5h5M168 92.5h5"/></g></svg>` });
  const paintVm = () => { const v = vm(); const g = vmSvg.querySelector('#fxvm'); if (!g) return; const sc = 68 / v.fov * 1 + .0; g.setAttribute('transform', `translate(${(v.offsetX * 26).toFixed(1)} ${(-v.offsetY * 20 - v.offsetZ * 8).toFixed(1)}) translate(160 90) scale(${(sc * (1 + v.offsetZ * .05)).toFixed(3)}) translate(-160 -90)`); };
  refreshers.push(paintVm);
  const vs = (k, o) => R(kit.slider({ get: () => vm()[k], set: (v) => putVm({ [k]: v }), ...o }));
  const viewmodel = () => h('div', null,
    h('div', { class: 'fx-xh' }, h('div', null,
      group('Viewmodel', row('Viewmodel FOV', 'Independent of world FOV', vs('fov', { min: 54, max: 90, step: 1, def: 68, fmt: (v) => v, unit: '°', label: 'Viewmodel FOV' })),
        row('Offset X', 'Left / right', vs('offsetX', { min: -2, max: 2, step: .05, def: 0, fmt: (v) => v.toFixed(2), label: 'Offset X' })),
        row('Offset Y', 'Down / up', vs('offsetY', { min: -2, max: 2, step: .05, def: 0, fmt: (v) => v.toFixed(2), label: 'Offset Y' })),
        row('Offset Z', 'Back / forward', vs('offsetZ', { min: -2, max: 2, step: .05, def: 0, fmt: (v) => v.toFixed(2), label: 'Offset Z' })),
        row('Bob & sway', 'Weapon motion while moving', vs('bob', { min: 0, max: 1.5, step: .05, def: 1, fmt: (v) => Math.round(v * 100), unit: '%', label: 'Bob' })),
        h('div', { style: { display: 'flex', gap: '.5rem', marginTop: '.8rem' } }, h('button', { class: 'fx-btn sm ghost', onClick: () => putVm({ ...SD.viewmodel }) }, 'Default'), h('button', { class: 'fx-btn sm ghost', onClick: () => putVm({ fov: 62, offsetX: .35, offsetY: -.1, offsetZ: 0, bob: .5 }) }, 'Low profile'), h('button', { class: 'fx-btn sm ghost', onClick: () => putVm({ fov: 74, offsetX: 0, offsetY: 0, offsetZ: .2, bob: 1 }) }, 'Centred'))),
      group('HUD', row('HUD scale', 'Health, ammo, radar, feed', R(kit.slider({ min: .7, max: 1.3, step: .05, def: 1, ticks: [1], get: () => get('hudScale'), set: (v) => put('hudScale', v), fmt: (v) => Math.round(v * 100), unit: '%', label: 'HUD scale' }))))),
      h('div', { class: 'fx-xh-prev' }, vmSvg, h('div', { class: 'fx-note' }, 'Schematic preview. Exact placement is shown live in game — change these while standing in Practice Range.'))));

  // ---------------- shell ----------------
  const TABS = [
    { id: 'controls', label: 'Controls', icon: ICON.keyboard, build: controls, reset: ['sensitivity', 'invertY', 'rawInput', 'fov', 'mouseDpi', 'autoBhop', 'keybinds'] },
    { id: 'video', label: 'Video', icon: ICON.monitor, build: video, reset: ['quality', 'resolutionScale', 'showFps', 'motionBlur', 'screenShake', 'colorblind'] },
    { id: 'audio', label: 'Audio', icon: ICON.speaker, build: audio, reset: ['volume', 'sfxVolume', 'musicVolume', 'voiceVolume'] },
    { id: 'crosshair', label: 'Crosshair', icon: ICON.cross, build: () => xh.el, reset: ['crosshair'] },
    { id: 'viewmodel', label: 'Viewmodel & HUD', icon: ICON.gun, build: viewmodel, reset: ['viewmodel', 'hudScale'] },
  ];
  let active = 'controls';
  const pane = h('div', { class: 'fx-pane', tabIndex: -1 });
  const rail = h('div', { class: 'fx-rail', role: 'tablist' });
  const tabBtns = TABS.map((t) => h('button', { class: 'fx-tab', role: 'tab', id: 'fxtab-' + t.id, onClick: () => show(t.id), html: t.icon + `<span>${t.label}</span>` }));
  const resetBtn = h('button', { class: 'fx-btn sm ghost danger' }, 'Restore tab defaults');
  let armed = 0;
  resetBtn.addEventListener('click', () => {
    if (!armed) { armed = setTimeout(() => { armed = 0; resetBtn.textContent = 'Restore tab defaults'; }, 2600); resetBtn.textContent = 'Click again to confirm'; return; }
    clearTimeout(armed); armed = 0; resetBtn.textContent = 'Restore tab defaults';
    const t = TABS.find((x) => x.id === active);
    for (const k of t.reset) { if (k === 'keybinds') { S.set('keybinds', {}); ctx.menu_applyBinds?.(); } else if (k === 'crosshair') S.set('crosshair', { ...(ctx.settings.data && {}), ...{ style: 'classic', size: 5, gap: 3, thickness: 1.6, color: '#6dff9a', opacity: 1, dot: false, dotSize: 2, outline: true, outlineThickness: 1, dynamic: true } }); else S.set(k, structuredClone(SD[k])); }
    ctx.menu_applySettings?.(); refresh(); toast('Defaults restored');
  });
  rail.append(...tabBtns, h('div', { class: 'sp' }), h('div', { style: { padding: '0 1.2rem' } }, resetBtn));
  const cache = {};
  function show(id, first) {
    if (capturing) cancelCapture();
    if (active === 'crosshair' && id !== 'crosshair') xh.stop();
    active = id; tabBtns.forEach((b, i) => { const on = TABS[i].id === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    const t = TABS.find((x) => x.id === id);
    pane.classList.remove('swap'); pane.replaceChildren(cache[id] || (cache[id] = t.build())); void pane.offsetWidth; pane.classList.add('swap');
    [...pane.firstChild.children].forEach((c, i) => c.style?.setProperty('--i', i));
    pane.scrollTop = 0; refresh(); if (id === 'crosshair') xh.start();
    if (id === 'controls') paintKeys();
  }
  function refresh() { paintRo(); refreshers.forEach((f) => { try { f(); } catch {} }); paintKeys(); }
  const el = h('div', { class: 'fx-screen fx-settings' },
    h('div', { class: 'fx-layer fx-dim' }),
    h('div', { class: 'fx-card fx-sheet', role: 'dialog', 'aria-label': 'Settings' },
      h('div', { class: 'fx-sh-head' }, h('h2', null, 'Set', h('i', null, 'tings')), h('span', { class: 'fx-spacer' }), h('span', { class: 'fx-hint', style: { font: '600 .84rem var(--disp)', letterSpacing: '.14em', color: 'var(--mute)', textTransform: 'uppercase' } }, h('span', { class: 'fx-key' }, '['), h('span', { class: 'fx-key' }, ']'), 'Switch tab'), h('button', { class: 'fx-x', 'aria-label': 'Close settings', onClick: () => onClose?.(), html: ICON.x })),
      h('div', { class: 'fx-sh-body' }, rail, pane),
      h('div', { class: 'fx-sh-foot' }, h('span', { class: 'fx-hint' }, h('span', { class: 'fx-key' }, 'Esc'), 'Back'), h('span', { class: 'fx-hint' }, h('span', { class: 'fx-key' }, '↑ ↓ ← →'), 'Navigate'), h('span', { class: 'fx-hint' }, h('span', { class: 'fx-key' }, 'Enter'), 'Select'), h('span', { class: 'fx-spacer' }), h('span', null, 'Changes save automatically'))));
  return {
    el, show, refresh, tabs: TABS.map((t) => t.id), get active() { return active; },
    cycle(d) { const i = TABS.findIndex((t) => t.id === active); show(TABS[(i + d + TABS.length) % TABS.length].id); ctx.events.emit('ui:click'); },
    open(id = active) { show(id); }, leave() { xh.stop(); cancelCapture(); },
    get capturing() { return !!capturing; },
    paintKeys,
  };
}
