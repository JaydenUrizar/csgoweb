// Bottom HUD: charge (health) + armor with animated bars, credits with delta ticks, ammo + reload, weapon slot list.
import { clamp, damp, easeOut, h, txt, flag, tf, style, fmtMoney, readLoadout, reasonLabel } from './core.js';
import { icon, NAMES } from './icons.js';

export const css = `
.vit{position:absolute;left:22px;bottom:16px;display:flex;align-items:flex-end;gap:26px}
.blk{position:relative;width:118px;height:56px;color:#fff;filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))}
.blk .ico{position:absolute;left:0;top:7px;width:20px;height:20px;color:rgba(255,255,255,.9)}
.blk .ico svg{width:100%;height:100%;display:block}
.blk .num{position:absolute;left:24px;top:-2px;font:700 50px/50px var(--font);letter-spacing:.005em;font-variant-numeric:tabular-nums;text-shadow:0 2px 3px rgba(0,0,0,.65),0 0 10px rgba(0,0,0,.4);transform-origin:0 70%;will-change:transform}
.blk .bar{position:absolute;left:0;right:0;bottom:0;height:5px;background:rgba(0,0,0,.5);box-shadow:0 0 0 1px rgba(255,255,255,.1) inset;overflow:hidden;border-radius:1px}
.blk .bar u{position:absolute;inset:0;transform-origin:0 0;will-change:transform;text-decoration:none}
.blk .bar .tr{background:#fff;opacity:.85}
.blk .bar .fl{background:linear-gradient(90deg,#d9f7ff,#fff)}
.blk.hp.mid .num{color:#ffe7a0}.blk.hp.low .num{color:#ff5b4a}
.blk.hp.mid .bar .fl{background:#ffd25a}.blk.hp.low .bar .fl{background:#ff5540}
.blk.ar.zero{opacity:.55}
.blk.ar .bar .fl{background:linear-gradient(90deg,#b9d6ff,#e8f2ff)}
.money{position:absolute;left:22px;bottom:80px;height:34px;display:flex;align-items:center;font:700 32px/32px var(--font);color:#f2f7ff;text-shadow:0 2px 3px rgba(0,0,0,.7),0 0 8px rgba(0,0,0,.4);font-variant-numeric:tabular-nums;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
.money .cur{color:#8fe3a0;margin-right:2px;font-size:26px}
.money.low{color:#ffb4a8}
.money .dl{position:absolute;left:100%;margin-left:10px;top:4px;white-space:nowrap;font:700 22px/24px var(--font);opacity:0;will-change:transform,opacity}
.money .dl.up{color:#7dff9b}.money .dl.dn{color:#ff7a68}
.money .dl small{font:600 13px/24px var(--font);letter-spacing:.08em;opacity:.8;margin-left:6px;text-transform:uppercase;color:#fff}
.ammo{position:absolute;right:24px;bottom:16px;width:220px;height:66px;text-align:right;color:#fff;filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))}
.ammo .wn{position:absolute;right:0;top:-18px;font:600 15px/16px var(--font);letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.78);text-shadow:0 1px 2px #000}
.ammo .row{position:absolute;right:0;top:-3px;display:flex;align-items:baseline;justify-content:flex-end;gap:8px;white-space:nowrap}
.ammo .mag{font:700 54px/54px var(--font);font-variant-numeric:tabular-nums;text-shadow:0 2px 3px rgba(0,0,0,.65),0 0 10px rgba(0,0,0,.4);transform-origin:100% 70%}
.ammo .dv{width:2px;height:26px;background:rgba(255,255,255,.45);align-self:center;margin:0 1px;box-shadow:0 1px 2px rgba(0,0,0,.5)}
.ammo .res{font:600 30px/30px var(--font);font-variant-numeric:tabular-nums;color:rgba(255,255,255,.72);min-width:34px;text-align:left;text-shadow:0 1px 2px rgba(0,0,0,.7)}
.ammo.low .mag{color:#ffc93d}.ammo.empty .mag{color:#ff5b4a}
.ammo .mb{position:absolute;left:0;right:0;bottom:0;height:5px;background:rgba(0,0,0,.5);box-shadow:0 0 0 1px rgba(255,255,255,.1) inset;border-radius:1px;overflow:hidden}
.ammo .mb u{position:absolute;inset:0;transform-origin:0 0;background:#fff;text-decoration:none;will-change:transform}
.ammo.low .mb u{background:#ffc93d}.ammo.empty .mb u{background:#ff5b4a}.ammo.reload .mb u{background:#8fd8ff}
.ammo .rl{position:absolute;left:0;top:6px;font:700 13px/14px var(--font);letter-spacing:.2em;color:#8fd8ff;text-shadow:0 1px 2px #000;opacity:0}
.ammo.reload .rl{opacity:1}
.ammo.util .row,.ammo.none .row{display:none}
.ammo.util .mb,.ammo.none .mb{display:none}
.ammo .cnt{position:absolute;right:0;top:0;font:700 48px/48px var(--font);display:none}
.ammo.util .cnt{display:block}
.slots{position:absolute;right:0;bottom:108px;display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.slot{position:relative;display:flex;align-items:center;justify-content:flex-end;height:32px;min-width:120px;padding:0 28px 0 14px;color:rgba(230,238,250,.62);filter:drop-shadow(0 1px 2px rgba(0,0,0,.65))}
.slot .sn{position:absolute;right:8px;top:2px;font:700 11px/11px var(--font);opacity:.85}
.slot .ic{height:26px;width:auto;aspect-ratio:120/48;display:block}
.slot .ic-g{width:26px;aspect-ratio:1}
.slot.cur{color:#fff;background:linear-gradient(270deg,rgba(14,18,28,.72),rgba(14,18,28,0));height:40px;min-width:150px}
.slot.cur .ic{height:32px}.slot.cur .ic-g{width:32px}
.slot.cur .sn{top:4px;color:#ffd25a;opacity:1}
.slot .ct{position:absolute;left:auto;right:30px;bottom:1px;font:700 11px/11px var(--font);color:#fff;text-shadow:0 1px 1px #000}
.slot.pop{animation:none}
.lowfx{position:fixed;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse 75% 70% at 50% 50%,rgba(120,0,0,0) 45%,rgba(200,20,10,.55) 100%);will-change:opacity}
.hitfx{position:fixed;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse 80% 75% at 50% 50%,rgba(255,40,20,0) 55%,rgba(255,50,30,.42) 100%);will-change:opacity}
`;

const UTIL = new Set(['haze', 'strobe', 'pulse']);
const NOAMMO = new Set(['tap', 'vest', 'kit', 'beacon']);

export function create(H) {
  const money = h('div', 'money', H.root, '<span class="cur">$</span><span class="amt">0</span>');
  const amt = money.querySelector('.amt');
  const dls = []; for (let i = 0; i < 6; i++) { const d = h('div', 'dl', money); dls.push({ el: d, t0: -99, tf: tf(d), a: -1 }); }
  const vit = h('div', 'vit', H.root);
  const hp = h('div', 'blk hp', vit, `<div class="ico">${icon('charge')}</div><div class="num">100</div><div class="bar"><u class="tr"></u><u class="fl"></u></div>`);
  const ar = h('div', 'blk ar', vit, `<div class="ico">${icon('shield')}</div><div class="num">0</div><div class="bar"><u class="tr" style="display:none"></u><u class="fl"></u></div>`);
  const ammo = h('div', 'ammo', H.root, `<div class="wn"></div><div class="rl">RELOADING</div><div class="row"><span class="mag">30</span><span class="dv"></span><span class="res">90</span></div><div class="cnt">2</div><div class="mb"><u></u></div>`);
  const slotsEl = h('div', 'slots', H.root);
  const lowfx = h('div', 'lowfx', H.abs), hitfx = h('div', 'hitfx', H.abs);
  const $ = (p, s) => p.querySelector(s);
  const hpNum = $(hp, '.num'), hpTr = $(hp, '.tr'), hpFl = $(hp, '.fl'), arNum = $(ar, '.num'), arFl = $(ar, '.fl'), arIco = $(ar, '.ico');
  const setHpN = txt(hpNum), setArN = txt(arNum), setAmt = txt(amt);
  const tHpFl = tf(hpFl), tHpTr = tf(hpTr), tArFl = tf(arFl);
  const fHpMid = flag(hp, 'mid'), fHpLow = flag(hp, 'low'), fArZero = flag(ar, 'zero');
  const wn = $(ammo, '.wn'), mag = $(ammo, '.mag'), res = $(ammo, '.res'), cnt = $(ammo, '.cnt'), mbu = $(ammo, '.mb u');
  const setWn = txt(wn), setMag = txt(mag), setRes = txt(res), setCnt = txt(cnt), tMb = tf(mbu);
  const fLow = flag(ammo, 'low'), fEmpty = flag(ammo, 'empty'), fRel = flag(ammo, 'reload'), fUtil = flag(ammo, 'util'), fNone = flag(ammo, 'none');
  const fMoneyLow = flag(money, 'low');
  const S = { hp: 100, trail: 100, hpHold: 0, armor: 0, cash: 0, cashShown: 0, hitT: -9, lowA: 0, hitA: 0, slotKey: '', slots: [], sw: -9, lastArmorIco: '', eqId: '', mag: -1 };
  const setLowfx = style(lowfx, 'opacity'), setHitfx = style(hitfx, 'opacity');
  const tmpLoad = [];

  H.bus.on('credits', (d) => {
    if (!d || d.actor !== H.view || !d.delta) return;
    let s = dls.find((x) => H.T - x.t0 > 1.9) || dls[0];
    s.t0 = H.T; s.el.className = 'dl ' + (d.delta > 0 ? 'up' : 'dn');
    const rl = reasonLabel(d.reason); s.el.innerHTML = (d.delta > 0 ? '+' : '−') + '$' + Math.abs(Math.round(d.delta)).toLocaleString('en-US') + (rl ? `<small>${rl}</small>` : '');
    // stack: push others up
    S.cashDirty = true;
  });
  H.bus.on('tag:hit', (d) => { if (d.victim && d.victim === H.view) S.hitT = H.T; });
  H.bus.on('weapon:switch', (d) => { if (d.actor === H.view) S.sw = H.T; });
  H.bus.on('reset', () => { for (const d of dls) d.t0 = -99; S.trail = S.hp = 100; });
  H.bus.on('viewchange', (d) => { const v = d?.view; for (const x of dls) x.t0 = -99; if (v) { S.cash = Math.round(v.credits ?? 0); S.cashShown = S.cash; S.hp = S.trail = Math.round(v.hp ?? 100); S.hitT = -9; } });

  function rebuildSlots(list, curId) {
    const key = list.map((s) => s.slot + s.id + s.count + (s.cur ? '*' : '')).join('|');
    if (key === S.slotKey) return; S.slotKey = key;
    let html = '';
    for (const s of list) html += `<div class="slot${s.cur ? ' cur' : ''}">${icon(s.id)}${s.count > 1 ? `<span class="ct">×${s.count}</span>` : ''}<span class="sn">${s.slot}</span></div>`;
    slotsEl.innerHTML = html;
  }

  return {
    update(dt) {
      const R = H.R, v = H.view, vis = !!v && !H.hidden && !H.flags.noVitals;
      money.style.display = (vis && !H.spec) ? '' : 'none'; vit.style.display = ammo.style.display = slotsEl.style.display = vis ? '' : 'none';
      if (!vis) { setLowfx(0); return; }
      const alive = v.alive !== false;
      // ---------------- charge
      const hpv = clamp(Math.round(v.hp ?? 100), 0, 999);
      if (hpv < S.hp) S.hpHold = 0.32; S.hp = hpv;
      if (S.hp > S.trail) S.trail = S.hp; else { S.hpHold -= dt; if (S.hpHold <= 0) S.trail = damp(S.trail, S.hp, 5, dt); }
      setHpN(String(hpv));
      tHpFl(`scaleX(${clamp(hpv / 100, 0, 1).toFixed(3)})`); tHpTr(`scaleX(${clamp(S.trail / 100, 0, 1).toFixed(3)})`);
      const low = hpv <= 25 && alive, mid = hpv <= 50 && !low;
      fHpLow(low); fHpMid(mid);
      const pulse = low ? 1 + 0.07 * Math.max(0, Math.sin(H.T * 9)) ** 3 : 1; const hs = `scale(${pulse.toFixed(3)})`; if (S.hs !== hs) { S.hs = hs; hpNum.style.transform = hs; }
      // ---------------- armor
      const av = Math.round(v.armor ?? 0); setArN(String(av)); tArFl(`scaleX(${clamp(av / 100, 0, 1).toFixed(3)})`); fArZero(av <= 0);
      const aico = v.helmet ? 'helmetShield' : 'shield'; if (aico !== S.lastArmorIco) { S.lastArmorIco = aico; arIco.innerHTML = icon(aico); }
      // ---------------- low-health vignette + damage flash
      const lowT = low ? 0.42 + 0.22 * Math.sin(H.T * 8) : 0; S.lowA = damp(S.lowA, lowT, 12, dt); setLowfx(S.lowA < 0.01 ? '0' : S.lowA.toFixed(2));
      const hf = clamp(1 - (H.T - S.hitT) / 0.45, 0, 1); setHitfx(hf < 0.01 ? '0' : (hf * hf).toFixed(2));
      // ---------------- credits
      const cash = Math.round(v.credits ?? 0);
      if (cash !== S.cash) { S.cash = cash; }
      S.cashShown = Math.abs(S.cash - S.cashShown) < 1 ? S.cash : damp(S.cashShown, S.cash, 10, dt);
      setAmt(Math.round(S.cashShown).toLocaleString('en-US')); H.cashShown = S.cashShown;
      fMoneyLow(S.cash < 500 && R.match?.phase === 'buy');
      let n = 0;
      for (let i = 0; i < dls.length; i++) {
        const d = dls[i], age = H.T - d.t0, life = 1.9;
        if (age > life || age < 0) { if (d.a !== 0) { d.a = 0; d.el.style.opacity = 0; } continue; }
        const p = age / life, e = easeOut(Math.min(1, age / 0.28)); const a = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
        d.el.style.opacity = a.toFixed(2); d.tf(`translateY(${((1 - e) * 10 - p * 22 - n * 24).toFixed(1)}px) scale(${(0.85 + 0.15 * e).toFixed(3)})`); n++; d.a = 1;
      }
      // ---------------- ammo
      const eq = R.combat?.equipped?.(v); const id = eq?.id || eq?.def?.id || '';
      if (!eq || !eq.def) { fNone(true); fUtil(false); setWn(''); }
      else {
        fNone(false);
        const isUtil = UTIL.has(id), noAmmo = NOAMMO.has(id) || (eq.mag == null && !isUtil);
        fUtil(isUtil); if (noAmmo) fNone(true);
        setWn(eq.def.name || NAMES[id] || id);
        if (isUtil) { const c = R.combat?.utility?.count?.(v, id); setCnt(String(c ?? eq.mag ?? 1)); }
        else if (!noAmmo) {
          const magSize = eq.def.magSize || eq.def.mag || eq.def.magazine || Math.max(eq.mag, 1);
          setMag(String(eq.mag)); setRes(String(eq.reserve ?? 0));
          const frac = magSize ? eq.mag / magSize : 0;
          const reloading = eq.state === 'reload';
          fRel(reloading); fEmpty(eq.mag <= 0 && !reloading); fLow(!reloading && eq.mag > 0 && frac <= 0.25);
          let bar = frac;
          if (reloading) {
            const rt = eq.def.reloadTime || eq.def.reload || eq.def.reloadSec;
            bar = eq.reloadProgress ?? (rt && eq.t != null ? eq.t / rt : eq.t != null && eq.t <= 1 ? eq.t : 0);
          }
          tMb(`scaleX(${clamp(bar, 0, 1).toFixed(3)})`);
          if (eq.mag !== S.mag) { if (eq.mag < S.mag) { S.magT = H.T; } S.mag = eq.mag; }
          const bump = H.T - (S.magT || -9) < 0.09 ? 'scale(1.06)' : 'scale(1)'; if (S.mb !== bump) { S.mb = bump; mag.style.transform = bump; }
          if (frac <= 0.25 && eq.mag > 0 && !reloading) { const f = 0.55 + 0.45 * (Math.sin(H.T * 10) > 0 ? 1 : 0.35); mag.style.opacity = f.toFixed(2); } else if (S.magOp !== 1) mag.style.opacity = 1;
          S.magOp = 1;
        }
      }
      // ---------------- slots
      const list = readLoadout(R, v, tmpLoad);
      rebuildSlots(list, id);
      if (id !== S.eqId) { S.eqId = id; }
      const sw = clamp(1 - (H.T - S.sw) / 0.25, 0, 1);
      const cur = slotsEl.querySelector('.cur');
      if (cur) { const t = sw > 0 ? `translateX(${(-sw * 8).toFixed(1)}px) scale(${(1 + sw * 0.12).toFixed(3)})` : ''; if (S.swT !== t) { S.swT = t; cur.style.transform = t; cur.style.transformOrigin = '100% 50%'; } }
    },
    debug: { S },
  };
}
