// Buy menu (B): CS2-style category columns, hotkeys 1-9, affordability greying, team restriction,
// owned / equipped markers, loadout summary, instant purchase feedback.
import { clamp, easeOut, h, fmtMoney, fmtTime, readLoadout, teamName } from './core.js';
import { icon, NAMES } from './icons.js';

export const css = `
.bdim{position:absolute;inset:0;background:radial-gradient(ellipse at 45% 50%,rgba(4,6,12,.58),rgba(4,6,12,.82));opacity:0;pointer-events:none;will-change:opacity}
.buy{position:absolute;left:50%;top:50%;width:962px;transform:translate(-50%,-50%);opacity:0;pointer-events:auto;will-change:opacity,transform;color:#fff}
.buy .hd{display:flex;align-items:flex-end;justify-content:space-between;padding:0 4px 8px;text-shadow:0 1px 3px #000}
.buy .hd .cash{font:700 34px/32px var(--font);letter-spacing:.02em;color:#f4f8ff;font-variant-numeric:tabular-nums}
.buy .hd .cash i{font-style:normal;color:#8fe3a0;font-size:27px;margin-right:2px}
.buy .hd .bt{font:600 17px/20px var(--font);letter-spacing:.06em;color:rgba(255,255,255,.75);text-transform:uppercase}
.buy .hd .bt b{font-weight:700;color:#fff;margin-left:8px;font-variant-numeric:tabular-nums;font-size:22px}
.buy .hd .bt.off b{color:#ff7a68}
.buy .hd .tm{font:700 15px/16px var(--font);letter-spacing:.18em;color:var(--ally);text-transform:uppercase}
.buy .main{display:flex;gap:10px}
.buy .cols{flex:1;display:flex;gap:6px;padding:10px;border-radius:5px;background:linear-gradient(180deg,rgba(20,25,36,.985),rgba(12,15,24,.985));box-shadow:0 0 0 1px rgba(255,255,255,.09) inset,0 12px 40px rgba(0,0,0,.5)}
.buy .col{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;padding-bottom:2px;border-radius:3px;transition:background .12s}
.buy .col.sel{background:rgba(255,255,255,.055);box-shadow:0 0 0 1px rgba(255,255,255,.22) inset}
.buy .ch{display:flex;gap:6px;align-items:baseline;justify-content:center;padding:1px 0 5px;border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:1px;font:700 17px/20px var(--font);letter-spacing:.06em;color:#f1f5fb;text-transform:uppercase}
.buy .ch small{font:600 13px/20px var(--font);color:rgba(255,255,255,.5)}
.it{position:relative;height:66px;border-radius:3px;background:linear-gradient(180deg,rgba(66,78,100,.42),rgba(40,48,64,.42));box-shadow:0 0 0 1px rgba(255,255,255,.12) inset;cursor:pointer;overflow:hidden;color:#dbe6f8;transition:box-shadow .08s,background .08s}
.it:hover,.it.hov{background:linear-gradient(180deg,rgba(86,100,126,.55),rgba(52,62,82,.55));box-shadow:0 0 0 2px #fff inset}
.it .hk{position:absolute;left:6px;top:4px;font:700 12px/12px var(--font);color:rgba(255,255,255,.55)}
.it .nmx{position:absolute;right:6px;top:4px;font:600 13px/13px var(--font);letter-spacing:.03em;color:rgba(255,255,255,.88);text-align:right;white-space:nowrap}
.it .pr{position:absolute;right:6px;bottom:4px;font:700 14px/14px var(--font);color:#8fe3a0;font-variant-numeric:tabular-nums;letter-spacing:.02em}
.it .ig{position:absolute;left:8px;right:8px;top:13px;bottom:14px;display:flex;align-items:center;justify-content:center;color:#d3e6ff}
.it .ig .ic{height:100%;width:auto;max-width:100%}
.it .ig .ic-g{height:100%}
.it .st{position:absolute;left:6px;bottom:4px;display:flex;gap:4px;align-items:center}
.it .st svg{width:13px;height:13px}
.it.poor{color:rgba(160,170,190,.55);background:linear-gradient(180deg,rgba(30,36,48,.55),rgba(22,26,36,.55))}
.it.poor .ig{color:rgba(178,190,214,.5)}.it.poor .pr{color:#ff8b7a}.it.poor .nmx{color:rgba(190,198,214,.5)}
.it.lock{opacity:.5}.it.lock .ig{color:rgba(150,160,180,.3)}.it.lock .pr{color:rgba(255,255,255,.4)}
.it.owned{box-shadow:0 0 0 1px rgba(143,227,160,.7) inset}
.it.eq{box-shadow:0 0 0 1.5px #ffd25a inset}
.it.owned .st .ok{color:#8fe3a0}.it.eq .st .eqm{color:#ffd25a;font:700 11px/13px var(--font);letter-spacing:.14em}
.it .fl{position:absolute;inset:0;opacity:0;pointer-events:none;background:#7dff9b;mix-blend-mode:screen}
.it .rs{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:700 12px/14px var(--font);letter-spacing:.14em;color:#fff;text-transform:uppercase;text-shadow:0 1px 3px #000;opacity:0;white-space:nowrap}
.it.empty{background:none;box-shadow:none;cursor:default;height:66px;pointer-events:none}
.buy .side{width:206px;display:flex;flex-direction:column;gap:8px}
.buy .sp{padding:10px;border-radius:5px;background:linear-gradient(180deg,rgba(20,25,36,.985),rgba(12,15,24,.985));box-shadow:0 0 0 1px rgba(255,255,255,.09) inset,0 12px 40px rgba(0,0,0,.5)}
.buy .sp h4{margin:0 0 6px;font:700 14px/16px var(--font);letter-spacing:.16em;color:rgba(255,255,255,.6);text-transform:uppercase}
.buy .prev{position:relative;height:150px;padding:0;overflow:hidden;background:radial-gradient(90% 90% at 50% 70%,rgba(var(--ally-rgb),.28),rgba(12,15,24,.92) 70%)}
.buy .prev canvas{position:absolute;inset:0;width:100%;height:100%}
.buy .prev .tn{position:absolute;left:10px;top:8px;font:700 14px/16px var(--font);letter-spacing:.18em;color:var(--ally)}
.buy .prev .fg{position:absolute;left:0;right:0;bottom:6px;text-align:center;opacity:.9}
.buy .prev .fg svg{width:92px;height:auto;color:#fff;filter:drop-shadow(0 2px 3px #000)}
.buy .ld{display:flex;flex-direction:column;gap:3px}
.buy .lr{display:flex;align-items:center;gap:8px;height:22px;color:rgba(255,255,255,.88);font:600 14px/16px var(--font);letter-spacing:.05em}
.buy .lr .ic{height:16px;width:auto;flex:none}.buy .lr .ic-g{width:16px}
.buy .lr .n{flex:1;text-transform:uppercase}.buy .lr .k{color:#ffd25a;font-weight:700}
.buy .lr.dim{opacity:.35}
.buy .info{margin-top:8px;height:38px;padding:6px 12px;border-radius:4px;background:rgba(10,13,22,.8);box-shadow:0 0 0 1px rgba(255,255,255,.08) inset;display:flex;align-items:center;gap:12px;font:600 15px/18px var(--font);letter-spacing:.02em;color:rgba(255,255,255,.86)}
.buy .info .in{font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff}
.buy .info .rw{margin-left:auto;color:#8fe3a0;white-space:nowrap}
.buy .keys{margin-top:7px;display:flex;gap:16px;justify-content:center;font:600 14px/16px var(--font);letter-spacing:.08em;color:rgba(255,255,255,.65);text-transform:uppercase;text-shadow:0 1px 2px #000}
.buy .keys b{color:#fff}
.buy .lockmsg{position:absolute;left:0;right:0;top:50%;text-align:center;font:700 24px/26px var(--font);letter-spacing:.2em;color:#ff9c8c;text-shadow:0 2px 6px #000;display:none;pointer-events:none;text-transform:uppercase}
`;

const ORDER = ['equipment', 'gear', 'pistol', 'pistols', 'sidearm', 'smg', 'smgs', 'mid-tier', 'rifle', 'rifles', 'sniper', 'shotgun', 'heavy', 'utility', 'util', 'grenade', 'grenades'];
const TITLE = { util: 'Utility', equipment: 'Equipment', gear: 'Gear', pistol: 'Pistols', pistols: 'Pistols', sidearm: 'Pistols', smg: 'SMGs', smgs: 'SMGs', rifle: 'Rifles', rifles: 'Rifles', sniper: 'Sniper', shotgun: 'Shotgun', heavy: 'Heavy', utility: 'Utility', grenade: 'Utility', grenades: 'Utility' };
const REBUY_KEY = 'fluxtag.rebuy';

export function create(H) {
  const dim = h('div', 'bdim', H.root);
  const root = h('div', 'buy', H.root);
  const hd = h('div', 'hd', root, '<div class="cash"><i>$</i><span>0</span></div><div class="tm"></div><div class="bt">Buy time remaining<b>0:00</b></div>');
  const main = h('div', 'main', root);
  const colsEl = h('div', 'cols', main);
  const side = h('div', 'side', main);
  const prev = h('div', 'sp prev', side, '<div class="tn"></div><canvas></canvas><div class="fg"></div>');
  const ldp = h('div', 'sp', side, '<h4>Loadout</h4><div class="ld"></div>');
  const ldEl = ldp.querySelector('.ld');
  const info = h('div', 'info', root, '<span class="in">Select an item</span><span class="ds"></span><span class="rw"></span>');
  const keys = h('div', 'keys', root, '<span><b>1–6</b> category</span><span><b>1–9</b> item</span><span><b>F4</b> re-buy</span><span><b>F3</b> auto-buy</span><span><b>Esc</b> back</span>');
  const lockmsg = h('div', 'lockmsg', root, 'Buy menu unavailable');
  const cashEl = hd.querySelector('.cash span'), btEl = hd.querySelector('.bt'), btB = btEl.querySelector('b'), tmEl = hd.querySelector('.tm');
  const S = { open: false, a: 0, col: null, cat: [], items: new Map(), flash: [], sig: '', hover: null, lastBuys: [], curBuys: [], catKey: '', prevDrawn: '' };
  try { S.lastBuys = JSON.parse(localStorage.getItem(REBUY_KEY) || '[]'); } catch {}

  const actor = () => H.local;
  const catalog = () => { let c = H.R.match?.catalog; if (typeof c === 'function') c = c(); return Array.isArray(c) ? c : []; };
  const catOf = (it) => String(it.category || it.slot || 'other').toLowerCase();

  function build() {
    const cat = catalog(); const key = cat.map((c) => c.id + c.cost + (c.teams || []).join('')).join(',') + '|' + H.playerTeam;
    if (key === S.catKey) return; S.catKey = key;
    const groups = new Map();
    for (const it of cat) { const k = TITLE[catOf(it)] || catOf(it); (groups.get(k) || groups.set(k, { key: catOf(it), title: TITLE[catOf(it)] || (catOf(it)[0].toUpperCase() + catOf(it).slice(1)), items: [] }).get(k)).items.push(it); }
    const cols = [...groups.values()].sort((a, b) => { const ia = ORDER.indexOf(a.key), ib = ORDER.indexOf(b.key); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    // team-restricted items sink to the bottom of each column
    for (const c of cols) c.items.sort((a, b) => (isLocked(a) - isLocked(b)) || (a.cost - b.cost));
    S.cat = cols; S.items.clear(); colsEl.innerHTML = '';
    const maxRows = Math.max(...cols.map((c) => c.items.length));
    cols.forEach((c, ci) => {
      const col = h('div', 'col', colsEl); col.dataset.ci = ci;
      h('div', 'ch', col, `<span>${ci + 1}</span><span>${c.title}</span>`);
      c.items.forEach((it, ii) => {
        const el = h('div', 'it', col, `<span class="hk">${ii + 1}</span><span class="nmx">${it.name || NAMES[it.id] || it.id}</span><div class="ig">${icon(it.id)}</div><span class="pr">${fmtMoney(it.cost)}</span><span class="st"></span><span class="rs"></span><span class="fl"></span>`);
        el.dataset.id = it.id; el.dataset.ci = ci; el.dataset.ii = ii;
        { const ic = el.querySelector('.ig .ic-w'); const k = catOf(it); if (ic) ic.style.height = ({ pistol: '58%', smg: '80%', util: '84%', gear: '84%' })[k] || '100%'; }
        el.addEventListener('click', () => purchase(it));
        el.addEventListener('mouseenter', () => { S.hover = it; });
        el.addEventListener('mouseleave', () => { if (S.hover === it) S.hover = null; });
        S.items.set(it.id, { it, el, st: el.querySelector('.st'), pr: el.querySelector('.pr'), rs: el.querySelector('.rs'), fl: el.querySelector('.fl'), cls: '', stHtml: '' });
      });
      for (let k = c.items.length; k < maxRows; k++) h('div', 'it empty', col);
    });
    S.sig = '';
  }
  const isLocked = (it) => (it.teams && it.teams.length && !it.teams.includes(H.playerTeam) ? 1 : 0);

  function owned(a, id, load) {
    if (id === 'vest') return (a.armor ?? 0) >= 100 || load.some((x) => x.id === 'vest');
    return load.some((x) => x.id === id);
  }

  function purchase(it) {
    const R = H.R, a = actor(); if (!a || !R.match?.buy) return { ok: false };
    const st = S.items.get(it.id);
    let res; try { res = R.match.buy(a, it.id); } catch (e) { res = { ok: false, reason: 'error' }; }
    if (res && res.ok) {
      S.flash.push({ id: it.id, t0: H.T, ok: true });
      S.curBuys.push(it.id);
      H.bus.emit('ui:purchase', { id: it.id });
      H.R.audio?.play?.('ui_buy'); 
      S.col = null;
      H.toastBuy?.(it);
    } else {
      S.flash.push({ id: it.id, t0: H.T, ok: false, reason: reasonText(res?.reason) });
      H.R.audio?.play?.('ui_deny');
    }
    S.sig = ''; return res;
  }
  const reasonText = (r) => ({ limit: 'Max carried', credits: 'Not enough credits', money: 'Not enough credits', team: 'Other team only', owned: 'Already owned', full: 'Slot full', phase: 'Buy time over', time: 'Buy time over', max: 'Max carried' }[String(r)] || (r ? String(r) : 'Cannot buy'));

  // ------------------------------------------------------------------ open/close & input
  function setOpen(v) {
    v = !!v; if (v === S.open) return;
    if (v && (!H.local || H.local.alive === false || H.spec)) return;
    S.open = v; H.menuOpen = v; S.col = null; S.t0 = H.T;
    if (v) { build(); S.sig = ''; S.drawPrev = true; }
    H.bus.emit(v ? 'ui:open' : 'ui:close', { name: 'buy' });
    try { H.ctx.events.emit(v ? 'ui:open' : 'ui:close', { name: 'buy' }); } catch {}
  }
  const digit = (e) => { const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code); return m ? +m[1] : 0; };
  addEventListener('keydown', (e) => {
    if (!S.open) return;
    const d = digit(e);
    if (d) { e.stopPropagation(); e.preventDefault(); if (!e.repeat) pressDigit(d); return; }
    if (e.code === 'F4') { e.preventDefault(); e.stopPropagation(); rebuy(); }
    else if (e.code === 'F3') { e.preventDefault(); e.stopPropagation(); autobuy(); }
    else if (e.code === 'Escape' || e.code === 'Backspace') { e.stopPropagation(); e.preventDefault(); if (S.col != null && e.code === 'Backspace') S.col = null; else setOpen(false); }
    else if (e.code === 'KeyB') { e.stopPropagation(); setOpen(false); }
  }, true);
  function pressDigit(d) {
    if (S.col == null) { if (d - 1 < S.cat.length) S.col = d - 1; return; }
    const c = S.cat[S.col]; const it = c?.items[d - 1]; if (it) purchase(it); else S.col = null;
  }
  function rebuy() { const a = actor(); if (!a) return; let n = 0; for (const id of S.lastBuys) { const st = S.items.get(id); if (!st) continue; const load = readLoadout(H.R, a, []); if (owned(a, id, load)) continue; const r = purchase(st.it); if (r?.ok) n++; } if (!n) H.toast?.('Nothing to re-buy', 'bad'); }
  function autobuy() {
    const a = actor(); if (!a) return; const pref = H.playerTeam === 'ember' ? ['arc', 'vest', 'strobe', 'haze'] : ['rail', 'vest', 'kit', 'haze', 'strobe'];
    for (const id of pref) { const st = S.items.get(id); if (!st) continue; if ((a.credits ?? 0) < st.it.cost) continue; const load = readLoadout(H.R, a, []); if (owned(a, id, load)) continue; purchase(st.it); }
  }
  H.bus.on('reset', () => { S.open = false; S.a = 0; H.menuOpen = false; S.flash.length = 0; });
  H.bus.on('round:start', () => { if (S.curBuys.length) { S.lastBuys = S.curBuys.slice(); try { localStorage.setItem(REBUY_KEY, JSON.stringify(S.lastBuys)); } catch {} } S.curBuys = []; });
  H.bus.on('round:phase', (d) => { if (d?.phase === 'live' || d?.phase === 'roundEnd' || d?.phase === 'freeze' && false) { /* keep open through freeze; close when live */ if (d.phase !== 'freeze') setOpen(false); } });

  // ------------------------------------------------------------------ render
  function refresh() {
    const R = H.R, a = actor(), m = R.match; if (!a) return;
    const load = readLoadout(R, a, []), cur = load.find((x) => x.cur)?.id;
    const can = m?.canBuy ? !!safe(() => m.canBuy(a)) : true;
    const credits = a.credits ?? 0;
    const sig = [Math.round(H.cashShown ?? credits), credits, can ? 1 : 0, load.map((x) => x.id + x.count + (x.cur ? '*' : '')).join(','), a.armor, S.col, H.playerTeam, S.hover?.id, S.flash.length].join('|');
    if (sig === S.sig && !S.flash.length) return; S.sig = sig;
    cashEl.textContent = Math.round(H.cashShown ?? credits).toLocaleString('en-US');
    lockmsg.style.display = can ? 'none' : 'block'; colsEl.style.opacity = can ? 1 : 0.45;
    for (const [id, st] of S.items) {
      const it = st.it, lock = isLocked(it), poor = credits < it.cost, own = owned(a, id, load), eq = id === cur;
      const c = 'it' + (lock ? ' lock' : poor ? ' poor' : '') + (own ? ' owned' : '') + (eq ? ' eq' : '');
      if (c !== st.cls) { st.cls = c; st.el.className = c; }
      const sh = own ? `${eq ? '<span class="eqm">EQUIPPED</span>' : `<span class="ok">${icon('check')}</span>`}` : lock ? `<span>${icon('lock')}</span>` : '';
      if (sh !== st.stHtml) { st.stHtml = sh; st.st.innerHTML = sh; }
    }
    S.cat.forEach((c, i) => { const col = colsEl.children[i]; if (col) col.classList.toggle('sel', S.col === i); });
    // loadout summary
    const rows = [];
    for (const x of load.slice().sort((p, q) => p.slot - q.slot)) rows.push(`<div class="lr">${icon(x.id)}<span class="n">${NAMES[x.id] || x.id}${x.count > 1 ? ' ×' + x.count : ''}</span><span class="k">${x.slot}</span></div>`);
    rows.push(`<div class="lr ${a.armor > 0 ? '' : 'dim'}">${icon(a.helmet ? 'helmetShield' : 'shield')}<span class="n">Vest ${Math.round(a.armor ?? 0)}</span></div>`);
    ldEl.innerHTML = rows.join('');
    const hv = S.hover || null; const inf = info.children;
    if (hv) { inf[0].textContent = hv.name || NAMES[hv.id] || hv.id; inf[1].textContent = hv.desc || ''; inf[2].textContent = hv.killReward ? `Tag reward ${fmtMoney(hv.killReward)}` : ''; }
    else { const cc = S.col != null ? S.cat[S.col] : null; inf[0].textContent = cc ? cc.title : (can ? 'Select an item' : ''); inf[1].textContent = cc ? 'Press 1–' + cc.items.length + ' to buy' : 'Press a number to open a category'; inf[2].textContent = ''; }
  }
  const safe = (f) => { try { return f(); } catch { return false; } };

  function drawPreview() {
    if (!S.drawPrev) return; S.drawPrev = false;
    const cv = prev.querySelector('canvas'), R = H.R, a = actor(); prev.querySelector('.tn').textContent = teamName(H.playerTeam);
    const fg = prev.querySelector('.fg'); const e0 = R.combat?.equipped?.(a); const eq = e0?.id || e0?.def?.id;
    fg.innerHTML = eq ? icon(eq) : '';
    try {
      if (R.cosmetics?.renderPreview && !R.cosmetics.__stub) { cv.width = 412; cv.height = 300; R.cosmetics.renderPreview(cv, R.cosmetics.getLoadout?.(a)); }
    } catch {}
  }

  return {
    update(dt) {
      const R = H.R;
      if (!H.mock || H.allowInputMock !== false) { if (H.ctx.input?.pressed?.('buy') && !H.hidden) setOpen(!S.open); }
      if (S.open && (H.spec || !H.local || H.local.alive === false || H.hidden)) setOpen(false);
      const ta = S.open ? 1 : 0; S.a = ta ? Math.min(1, S.a + dt * 9) : Math.max(0, S.a - dt * 11);
      const vis = S.a > 0.001; dim.style.display = root.style.display = vis ? '' : 'none';
      if (!vis) return;
      H.overlayA = Math.max(H.overlayA || 0, S.a); const e = easeOut(S.a); dim.style.opacity = e.toFixed(3); root.style.opacity = e.toFixed(3);
      root.style.transform = `translate(-50%,-50%) scale(${(0.965 + 0.035 * e).toFixed(4)})`;
      if (S.open) build();
      // header
      const m = R.match, ph = m?.phase; const t = m?.timeLeft ?? 0;
      
      const bt = m?.buyTimeLeft ?? t;
      btB.textContent = ph === 'warmup' ? '∞' : fmtTime(bt).padStart(4, '0').replace(/^(\d):/, '0$1:');
      btEl.classList.toggle('off', !(ph === 'buy' || ph === 'warmup' || ph === 'freeze'));
      tmEl.textContent = '';
      if (S.open) { drawPreview(); refresh(); }
      // flashes
      for (let i = S.flash.length - 1; i >= 0; i--) {
        const f = S.flash[i], age = H.T - f.t0, life = f.ok ? 0.5 : 0.7; const st = S.items.get(f.id);
        if (age > life || !st) { if (st) { st.fl.style.opacity = 0; st.rs.style.opacity = 0; st.el.style.transform = ''; } S.flash.splice(i, 1); S.sig = ''; continue; }
        const p = age / life;
        if (f.ok) { st.fl.style.background = '#7dff9b'; st.fl.style.opacity = (0.65 * (1 - p) ** 2).toFixed(3); st.el.style.transform = `scale(${(1 + 0.05 * Math.sin(p * Math.PI)).toFixed(3)})`; }
        else { st.fl.style.background = '#ff5a48'; st.fl.style.opacity = (0.5 * (1 - p)).toFixed(3); st.el.style.transform = `translateX(${(Math.sin(p * 30) * 4 * (1 - p)).toFixed(2)}px)`; st.rs.textContent = f.reason; st.rs.style.opacity = (p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3).toFixed(2); }
      }
    },
    open: () => setOpen(true), close: () => setOpen(false), toggle: () => setOpen(!S.open), isOpen: () => S.open, purchase: (id) => { const st = S.items.get(id); return st ? purchase(st.it) : { ok: false }; },
    selectCol: (i) => { S.col = i; S.sig = ''; }, hover: (id) => { S.hover = S.items.get(id)?.it || null; S.sig = ''; },
    debug: { S },
  };
}
