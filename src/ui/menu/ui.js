// Small DOM kit: element factory, inline icons, form controls, sound hooks, keyboard + gamepad spatial navigation.
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(9)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
}
const I = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
export const ICON = {
  play: I('<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>'),
  target: I('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>'),
  locker: I('<path d="M12 6.5a2.2 2.2 0 1 0-2.2-2.2M12 6.5v2L3.5 14.5a1.2 1.2 0 0 0 .7 2.2h15.6a1.2 1.2 0 0 0 .7-2.2L12 8.5"/>'),
  gear: I('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5l1.6 2.6 3-.6.8 3 2.9 1-.9 2.9 2 2.3-2.4 1.9.2 3.1-3 .4-1.3 2.8-2.7-1.4-2.7 1.4-1.3-2.8-3-.4.2-3.1L2.6 13.7l2-2.3-.9-2.9 2.9-1 .8-3 3 .6z"/>'),
  help: I('<circle cx="12" cy="12" r="9"/><path d="M9.2 9.4a2.9 2.9 0 1 1 4.2 2.6c-.9.5-1.4 1-1.4 2M12 17.2v.1"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.1"/>'),
  keyboard: I('<rect x="2.5" y="6" width="19" height="12" rx="1.5"/><path d="M6 10h.1M9.5 10h.1M13 10h.1M16.5 10h.1M6 14h12"/>'),
  monitor: I('<rect x="2.5" y="4" width="19" height="13" rx="1.5"/><path d="M8 21h8M12 17v4"/>'),
  speaker: I('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
  cross: I('<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>'),
  gun: I('<path d="M2.5 9h13l2 1.5h3.5V13h-4l-1.4 4.5h-3.2L11 13H8.5L7 16H4l1-4.5-2.5-.7z"/>'),
  x: I('<path d="M5 5l14 14M19 5L5 19"/>'),
  chev: I('<path d="M9 5l7 7-7 7"/>'),
  full: I('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  check: I('<path d="M4.5 12.5l5 5 10-11"/>'),
  vol: I('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/>'),
  star: '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" fill="#ffd25a"/></svg>',
  bolt: I('<path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/>'),
};

export const KEYNAME = {
  Space: 'Space', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', AltLeft: 'L Alt', AltRight: 'R Alt',
  Tab: 'Tab', Enter: 'Enter', Backspace: 'Bksp', CapsLock: 'Caps', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  Mouse0: 'Mouse 1', Mouse1: 'Mouse 3', Mouse2: 'Mouse 2', MetaLeft: 'Win', MetaRight: 'Win',
};
export function keyLabel(code) {
  if (!code) return '';
  if (KEYNAME[code]) return KEYNAME[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Num ' + code.slice(6).replace('Multiply', '*').replace('Add', '+').replace('Subtract', '-').replace('Decimal', '.').replace('Divide', '/');
  if (/^F\d+$/.test(code)) return code;
  return code;
}

/** Sound hooks: delegated hover/click/focus events -> ctx.events ui:hover / ui:click (audio piece listens). */
export function wireSfx(root, ctx) {
  let last = 0, lastEl = null;
  const SEL = 'button,[role=tab],[role=switch],input[type=range],.fx-tg,.fx-kc';
  const emit = (t, d) => ctx.events.emit(t, d);
  root.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.(SEL); if (!el || el === lastEl || el.disabled) return; lastEl = el;
    const n = performance.now(); if (n - last < 45) return; last = n; emit('ui:hover', { el: el.className });
  });
  root.addEventListener('pointerout', (e) => { if (!e.relatedTarget || !root.contains(e.relatedTarget)) lastEl = null; else if (e.target.closest?.(SEL) === lastEl && !lastEl.contains(e.relatedTarget)) lastEl = null; });
  root.addEventListener('click', (e) => { const el = e.target.closest?.(SEL); if (el && !el.disabled && el.type !== 'range') emit('ui:click', { el: el.className }); });
  root.addEventListener('focusin', (e) => { if (e.target.matches?.(':focus-visible')) { const n = performance.now(); if (n - last > 45) { last = n; emit('ui:hover', { kbd: true }); } } });
  let lastTick = 0;
  root.addEventListener('input', (e) => { if (e.target.type === 'range') { const n = performance.now(); if (n - lastTick > 55) { lastTick = n; emit('ui:tick', { v: e.target.value }); emit('ui:hover', { slider: true }); } } });
}

/** Form controls bound to accessor pairs. All return { el, refresh() }. */
export function makeControls(ctx) {
  const uiEvt = (t, d) => ctx.events.emit(t, d);
  function slider({ min = 0, max = 1, step = .01, get, set, fmt = (v) => String(v), unit = '', ticks, def, label }) {
    const input = h('input', { type: 'range', min, max, step, 'aria-label': label || 'value' });
    const val = h('div', { class: 'fx-val' });
    const wrap = h('div', { class: 'fx-sl' }, input);
    if (ticks) for (const t of ticks) wrap.append(h('i', { class: 'tick', style: { left: `calc(${(t - min) / (max - min) * 100}% + ${(.5 - (t - min) / (max - min)) * 14}px)` } }));
    const paint = () => { const v = +input.value; input.style.setProperty('--p', ((v - min) / (max - min) * 100).toFixed(2) + '%'); val.innerHTML = fmt(v) + (unit ? `<small>${unit}</small>` : ''); };
    input.addEventListener('input', () => { paint(); set(+input.value); });
    input.addEventListener('dblclick', () => { if (def != null) { input.value = def; paint(); set(def); uiEvt('ui:click'); } });
    const refresh = () => { input.value = get(); paint(); };
    refresh();
    return { el: h('div', { class: 'ct-slider', style: { display: 'contents' } }, wrap, val), input, refresh };
  }
  function toggle({ get, set, label }) {
    const b = h('button', { class: 'fx-tg', role: 'switch', 'aria-label': label || 'toggle' });
    const paint = () => { const v = !!get(); b.classList.toggle('on', v); b.setAttribute('aria-checked', v); };
    b.addEventListener('click', () => { set(!get()); paint(); });
    paint(); return { el: b, refresh: paint };
  }
  function pills(options, { get, set }) {
    const el = h('div', { class: 'fx-pill', role: 'radiogroup' });
    const btns = options.map(([v, label]) => h('button', { role: 'radio', onClick: () => { set(v); paint(); } }, label));
    const paint = () => btns.forEach((b, i) => { const on = options[i][0] === get(); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    el.append(...btns); paint(); return { el, refresh: paint };
  }
  function numberBox({ min, max, step = 1, get, set, width }) {
    const el = h('input', { class: 'fx-num', type: 'number', min, max, step, style: width ? { width } : null });
    el.addEventListener('focus', () => { ctx.input && (ctx.input.captureKeys = true); el.select(); });
    el.addEventListener('change', () => { let v = parseFloat(el.value); if (!isFinite(v)) v = get(); v = Math.min(max, Math.max(min, v)); el.value = v; set(v); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.blur(); e.stopPropagation(); });
    const refresh = () => { el.value = get(); };
    refresh(); return { el, refresh };
  }
  function row(label, desc, control, { tall = false } = {}) {
    return h('div', { class: 'fx-row' + (tall ? ' tall' : '') }, h('div', { class: 'lb' }, h('b', null, label), desc ? h('small', null, desc) : null), h('div', { class: 'ct' }, control));
  }
  const group = (title, ...rows) => h('section', { class: 'fx-grp' }, h('h3', null, title), ...rows);
  return { slider, toggle, pills, numberBox, row, group };
}

/** Spatial keyboard/gamepad navigation inside the active scope. */
export function createNav(ctx, { getScope, onBack, onTab, isActive }) {
  const FOC = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]';
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const list = (scope) => [...scope.querySelectorAll(FOC)].filter((el) => !el.closest('[hidden],[inert]') && !el.dataset.nonav && visible(el));
  function move(dir) {
    const scope = getScope(); if (!scope) return false;
    const items = list(scope); if (!items.length) return false;
    let cur = document.activeElement; if (!scope.contains(cur) || cur === scope) cur = null;
    if (!cur) { items[0].focus(); return true; }
    const cr = cur.getBoundingClientRect(), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
    let best = null, bs = 1e9;
    for (const el of items) {
      if (el === cur) continue; const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const dx = x - cx, dy = y - cy;
      let p, q;
      if (dir === 'left') { p = -dx; q = Math.abs(dy); if (r.right > cr.left + 2 && dx >= 0) continue; }
      else if (dir === 'right') { p = dx; q = Math.abs(dy); if (r.left < cr.right - 2 && dx <= 0) continue; }
      else if (dir === 'up') { p = -dy; q = Math.abs(dx) * .5; if (dy >= 0) continue; }
      else { p = dy; q = Math.abs(dx) * .5; if (dy <= 0) continue; }
      if (p <= 0) continue;
      const s = p + q * 2.2 + (dir === 'left' || dir === 'right' ? q * 2 : 0); if (s < bs) { bs = s; best = el; }
    }
    if (best) { best.focus({ preventScroll: true }); best.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); return true; }
    return false;
  }
  function focusFirst(scope = getScope()) {
    if (!scope) return; const pref = scope.querySelector('[data-autofocus]'); const t = pref && visible(pref) ? pref : list(scope)[0]; t?.focus({ preventScroll: true });
  }
  function onKey(e) {
    if (!isActive()) return;
    const t = e.target; const tag = t?.tagName; const isText = tag === 'INPUT' && !/range|checkbox|button/.test(t.type);
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[e.key]) {
      const d = map[e.key];
      if (tag === 'INPUT' && t.type === 'range' && (d === 'left' || d === 'right')) return; // native slider stepping
      if (isText && (d === 'left' || d === 'right')) return;
      if (tag === 'SELECT') return;
      e.preventDefault(); if (move(d)) ctx.events.emit('ui:hover', { kbd: true }); return;
    }
    if (e.key === 'Escape') { if (isText) { t.blur(); e.preventDefault(); return; } e.preventDefault(); onBack?.(); return; }
    if (e.key === 'Tab' && onTab && e.shiftKey === false && false) onTab(1);
    if ((e.key === '[' || e.key === ']' ) && !isText) { onTab?.(e.key === ']' ? 1 : -1); }
    if (e.key === 'q' || e.key === 'e') { /* reserved */ }
  }
  addEventListener('keydown', onKey, true);
  // gamepad
  let held = {}, tNext = {};
  function pad() {
    if (!isActive()) return;
    const pads = navigator.getGamepads?.(); const gp = pads && [...pads].find((p) => p && p.connected); if (!gp) return;
    const now = performance.now(); const b = gp.buttons; const ax = gp.axes;
    const st = { left: b[14]?.pressed || ax[0] < -.55, right: b[15]?.pressed || ax[0] > .55, up: b[12]?.pressed || ax[1] < -.55, down: b[13]?.pressed || ax[1] > .55, a: b[0]?.pressed, b: b[1]?.pressed, lb: b[4]?.pressed, rb: b[5]?.pressed };
    for (const k of Object.keys(st)) {
      const on = !!st[k];
      if (on && (!held[k] || now > tNext[k])) {
        const first = !held[k]; tNext[k] = now + (first ? 320 : 110);
        if (['left', 'right', 'up', 'down'].includes(k)) {
          const el = document.activeElement;
          if (el && el.type === 'range' && (k === 'left' || k === 'right')) { const stp = +el.step || 1; el.value = +el.value + (k === 'right' ? stp : -stp); el.dispatchEvent(new Event('input', { bubbles: true })); }
          else if (move(k)) ctx.events.emit('ui:hover', { pad: true });
        } else if (first && k === 'a') { const el = document.activeElement; if (el && el !== document.body) el.click(); }
        else if (first && k === 'b') onBack?.();
        else if (first && k === 'lb') onTab?.(-1);
        else if (first && k === 'rb') onTab?.(1);
      }
      held[k] = on;
    }
  }
  return { move, focusFirst, list, pad, dispose() { removeEventListener('keydown', onKey, true); } };
}
