// Centre prompts (+ progress ring), round banners, objective notices, toasts, flash-blind coordination.
import { clamp, easeOut, easeOutBack, h, teamName, txt, fmtMoney, reasonLabel } from './core.js';
import { icon } from './icons.js';

export const css = `
.prm{position:absolute;left:50%;top:60%;transform:translate(-50%,0);text-align:center;pointer-events:none;will-change:opacity}
.prm .row{display:inline-flex;align-items:center;gap:9px;padding:5px 14px 5px 8px;border-radius:3px;background:linear-gradient(180deg,rgba(16,20,30,.78),rgba(8,10,17,.78));box-shadow:0 0 0 1px rgba(255,255,255,.1) inset,0 3px 10px rgba(0,0,0,.35);font:600 20px/24px var(--font);letter-spacing:.06em;color:#fff;text-transform:uppercase;white-space:nowrap}
.prm .key{min-width:24px;height:24px;padding:0 6px;box-sizing:border-box;border-radius:4px;background:#f2f4f8;color:#111722;font:700 16px/24px var(--font);text-align:center;box-shadow:0 2px 0 #7b8494,0 3px 4px rgba(0,0,0,.5);text-transform:none}
.prm .hint{margin-top:5px;font:600 13px/14px var(--font);letter-spacing:.14em;color:rgba(255,255,255,.7);text-shadow:0 1px 2px #000;text-transform:uppercase}
.prm.sm .row{font-size:16px;line-height:20px;padding:3px 12px 3px 7px}
.ring{position:absolute;left:50%;top:50%;width:92px;height:92px;margin:-46px 0 0 -46px;opacity:0;pointer-events:none;will-change:opacity,transform}
.ring svg{width:100%;height:100%;display:block;transform:rotate(-90deg);filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))}
.ring .pc{position:absolute;left:0;right:0;top:100%;margin-top:6px;text-align:center;font:700 18px/18px var(--font);letter-spacing:.14em;color:#fff;text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,.6);white-space:nowrap}
.ban{position:absolute;left:0;right:0;top:104px;height:104px;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;opacity:0;will-change:opacity,transform}
.ban .band{position:absolute;left:18%;right:18%;top:50%;height:74px;margin-top:-37px;background:linear-gradient(90deg,rgba(8,10,18,0),rgba(8,10,18,.6) 20%,rgba(8,10,18,.68) 50%,rgba(8,10,18,.6) 80%,rgba(8,10,18,0));transform-origin:50% 50%;will-change:transform}
.ban .band:before,.ban .band:after{content:"";position:absolute;left:12%;right:12%;height:2px;background:linear-gradient(90deg,rgba(255,255,255,0),var(--bc,#fff),rgba(255,255,255,0))}
.ban .band:before{top:0}.ban .band:after{bottom:0}
.ban .t{position:relative;font:700 40px/40px var(--font);letter-spacing:.09em;text-transform:uppercase;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.35),0 0 24px rgba(0,0,0,.55);will-change:transform}
.ban .t em{font-style:normal;color:var(--bc,#fff)}
.ban .s{position:relative;margin-top:3px;font:600 15px/18px var(--font);letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.88);text-shadow:0 1px 3px #000}
.ban .m{position:relative;margin-top:1px;font:600 13px/16px var(--font);letter-spacing:.16em;text-transform:uppercase;color:#ffd25a;text-shadow:0 1px 3px #000;height:16px}
.nt{position:absolute;left:50%;top:92px;transform:translateX(-50%);pointer-events:none;opacity:0;will-change:opacity,transform}
.nt .in{display:flex;align-items:center;gap:8px;padding:4px 14px 4px 9px;border-radius:14px;background:rgba(10,13,22,.78);box-shadow:0 0 0 1px var(--nc,rgba(255,255,255,.2)) inset,0 3px 10px rgba(0,0,0,.4);font:600 16px/20px var(--font);letter-spacing:.08em;text-transform:uppercase;color:#fff;white-space:nowrap}
.nt .in svg{width:18px;height:18px;color:var(--nc,#fff)}
.toasts{position:absolute;left:22px;bottom:128px;display:flex;flex-direction:column;gap:2px;pointer-events:none;width:360px}
.ts{font:600 15px/18px var(--font);letter-spacing:.03em;color:rgba(255,255,255,.88);text-shadow:0 1px 2px #000,0 0 6px rgba(0,0,0,.7);will-change:opacity,transform}
.ts b{color:#8fe3a0;font-weight:700}.ts.bad{color:#ff9d8c}.ts.ok{color:#9dffb4}.ts.info b{color:#8fd8ff}
.flashfx{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;will-change:opacity}
.blindchip{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;font:700 15px/16px var(--font);letter-spacing:.24em;color:#111;background:rgba(255,255,255,.9);padding:3px 12px;border-radius:12px;opacity:0;pointer-events:none;will-change:opacity}
.blindchip svg{width:16px;height:16px}
`;

const REASON = (r) => {
  r = String(r || '').toLowerCase();
  if (r.includes('disarm') || r.includes('defus')) return 'Beacon disarmed';
  if (r.includes('beacon') || r.includes('charg') || r.includes('complete') || r.includes('armed')) return 'Beacon armed';
  if (r.includes('elim') || r.includes('out') || r.includes('tag')) return 'All opponents tagged out';
  if (r.includes('time')) return 'Time expired';
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : '';
};

export function create(H) {
  const prm = h('div', 'prm', H.root, '<div class="row"><span class="key">E</span><span class="tx"></span></div><div class="hint"></div>');
  const prmRow = prm.querySelector('.row'), prmKey = prm.querySelector('.key'), prmTx = prm.querySelector('.tx'), prmHint = prm.querySelector('.hint');
  const setKey = txt(prmKey), setTx = txt(prmTx), setHint = txt(prmHint);
  const ring = h('div', 'ring', H.abs, `<svg viewBox="0 0 92 92"><circle cx="46" cy="46" r="40" fill="rgba(0,0,0,.28)" stroke="rgba(0,0,0,.55)" stroke-width="9"/><circle cx="46" cy="46" r="40" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="5"/><circle class="pg" cx="46" cy="46" r="40" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="butt" stroke-dasharray="251.33" stroke-dashoffset="251.33"/></svg><div class="pc"></div>`);
  const ringPg = ring.querySelector('.pg'), ringPc = ring.querySelector('.pc'); const setPc = txt(ringPc);
  const ban = h('div', 'ban', H.root, '<div class="band"></div><div class="t"></div><div class="s"></div><div class="m"></div>');
  const bandEl = ban.querySelector('.band'), bt = ban.querySelector('.t'), bs = ban.querySelector('.s'), bm = ban.querySelector('.m');
  const nt = h('div', 'nt', H.root, '<div class="in"></div>'); const ntIn = nt.querySelector('.in');
  const toasts = h('div', 'toasts', H.root);
  const flashfx = h('div', 'flashfx', H.abs);
  const blindchip = h('div', 'blindchip', H.root, icon('blind') + 'BLINDED');
  const S = { ban: null, nt: null, ts: [], prev: '', ringP: -1, flash: null, lastPhase: '', shownRound: -1, prmA: 0, ringA: 0, ringCol: '' };

  // ----------------------------------------------------------- banners
  function banner(o) { S.ban = { ...o, t0: H.T, hold: o.hold ?? 2.6 }; bt.innerHTML = o.title; bs.textContent = o.sub || ''; bm.textContent = o.meta || ''; ban.style.setProperty('--bc', o.color || '#fff'); ban.style.display = ''; }
  function notice(text, color, ic, dur = 2.6) { S.nt = { t0: H.T, dur }; ntIn.innerHTML = (ic ? icon(ic) : '') + `<span>${text}</span>`; nt.style.setProperty('--nc', color || 'rgba(255,255,255,.4)'); }
  function toast(text, kind = '') {
    const el = h('div', 'ts ' + kind, toasts, text); S.ts.push({ el, t0: H.T, a: -1 });
    while (S.ts.length > 4) S.ts.shift().el.remove();
  }
  H.toast = toast; H.notice = notice; H.banner = banner;

  H.bus.on('round:start', (d) => roundIntro(d?.n));
  H.bus.on('round:phase', (d) => onPhase(d?.phase, d?.prev));
  H.bus.on('round:end', (d) => {
    const R = H.R, m = R.match; if (!d) return;
    const w = d.winner; const col = H.pal[w] || '#fff', mine = w === H.playerTeam;
    const mvp = d.mvp || m?.mvp;
    banner({ title: `<em>${teamName(w)}</em> WIN`, sub: REASON(d.reason) || (mine ? 'Round won' : 'Round lost'), meta: mvp ? `★ MVP  ${mvp.name}` : '', color: col, hold: 4.2, kind: 'win' });
    if (H.local && m) { const lose = w !== H.playerTeam; }
  });
  H.bus.on('halftime', (hd) => {
    if (hd?.kind === 'ot' || hd?.kind === 'otHalf') { banner({ title: 'OVERTIME', sub: hd.kind === 'otHalf' ? 'Switching sides' : 'Sudden death — first to 4', color: '#ffd25a', hold: 4, kind: 'half' }); return; }
    const t = H.playerTeam; const side = H.R.match?.sideOf?.(t);
    banner({ title: 'HALFTIME', sub: side ? `Switching sides — you are now ${side === 'attack' ? 'attacking' : 'defending'}` : 'Switching sides', color: '#ffd25a', hold: 4, kind: 'half' });
  });
  H.bus.on('match:end', (d) => {
    const w = d?.winner, win = w === H.playerTeam;
    banner({ title: win ? '<em>VICTORY</em>' : 'DEFEAT', sub: `${teamName(w)} wins the match`, color: H.pal[w] || '#fff', hold: 6, kind: 'end' });
  });
  H.bus.on('beacon:pickup', (d) => notice(`${d?.actor?.name || 'Someone'} picked up the Beacon`, '#ffd25a', 'beacon'));
  H.bus.on('beacon:drop', (d) => notice('Beacon dropped', '#ffd25a', 'beacon'));
  H.bus.on('beacon:armed', (d) => { notice(`Beacon armed${d?.site ? ' at ' + d.site : ''}`, '#ff7a4a', 'beacon', 3.4); if (H.playerTeam === 'ember') toast('Beacon armed — defend the site', 'ok'); else toast('Beacon armed — disarm it!', 'bad'); });
  H.bus.on('beacon:disarm', () => notice('Beacon disarmed', H.pal.tide, 'kit'));
  H.bus.on('beacon:complete', () => notice('Beacon charged', '#ff7a4a', 'beacon'));
  H.bus.on('buy', (d) => { if (d?.actor === H.view && d.cost) toast(`Purchased <b>${d.name || d.item}</b> <span style="opacity:.7">−${fmtMoney(d.cost)}</span>`, 'info'); });
  H.bus.on('credits', (d) => { const rl = reasonLabel(d?.reason); if (d?.actor === H.view && rl && d.delta > 0 && d.reason !== 'tag') toast(`<b>+${fmtMoney(d.delta)}</b> ${rl}`, ''); });
  H.bus.on('util:blind', (d) => {
    if (d?.actor !== H.view) return;
    const amt = clamp(d.amount ?? 1, 0, 1), dur = 0.6 + amt * 3.2;
    S.flash = { t0: H.T, amt, dur };
    const sc = H.R.render?.screen; if (sc?.whiteout) { try { sc.whiteout(dur); S.flash.external = true; } catch {} }
  });
  H.bus.on('reset', () => { S.ban = null; S.nt = null; S.flash = null; for (const t of S.ts) t.el.remove(); S.ts.length = 0; S.lastPhase = ''; ban.style.opacity = 0; nt.style.opacity = 0; flashfx.style.opacity = 0; blindchip.style.opacity = 0; });

  function roundIntro(n) {
    const R = H.R, m = R.match; if (!m) return; n = n ?? m.round ?? 1; if (S.shownRound === n) return; S.shownRound = n;
    const side = m.sideOf?.(H.playerTeam) || (H.playerTeam === 'ember' ? 'attack' : 'defend');
    const team = H.playerTeam, col = H.pal[team];
    const pistol = n === 1 || n === 8; const se = m.scores?.ember ?? 0, st = m.scores?.tide ?? 0;
    const mp = Math.max(se, st) === 7;
    banner({ title: `ROUND <em>${n}</em>`, sub: side === 'attack' ? 'Attack — arm the Beacon at A or B' : 'Defend — protect both sites', meta: mp ? 'MATCH POINT' : pistol ? 'PISTOL ROUND' : '', color: col, hold: 1.4, kind: 'round' });
  }
  function onPhase(p, prev) {
    if (!p || p === S.lastPhase) return; S.lastPhase = p;
    const m = H.R.match;
    if ((p === 'buy' || (p === 'freeze' && prev !== 'buy')) && m) roundIntro(m.round);
  }

  // ----------------------------------------------------------- prompt logic
  const site = (R, v) => {
    const s = R.map?.sites; if (!s) return null;
    for (const k of Object.keys(s)) { const c = s[k]?.center; if (!c) continue; const r = (s[k].radius ?? 6) + 0.5; if (Math.hypot(v.pos.x - c.x, v.pos.z - c.z) < r) return k; }
    return null;
  };
  function choosePrompt(R, v) {
    const m = R.match; if (!m || !v || v.alive === false) return null;
    const bc = m.beacon, ph = m.phase;
    if (H.menuOpen) return null;
    if (bc) {
      const near = site(R, v);
      const mine = bc.carrier === v || v.hasBeacon;
      if (bc.state === 'arming' && (mine || bc.actor === v || near || H.mock)) return { text: 'Arming Beacon', progress: bc.progress, col: H.pal.ember, key: 'E' };
      if (bc.state === 'disarming' && (bc.actor === v || near || H.mock) && H.playerTeam === 'tide') return { text: 'Disarming Beacon', progress: bc.progress, col: H.pal.tide, key: 'E', hint: v.inventory?.kit || v.hasKit ? 'Kit: fast disarm' : '' };
      if (bc.state === 'disarming' && near) return { text: 'Disarming Beacon', progress: bc.progress, col: H.pal.tide, key: 'E' };
      if (mine && near && (ph === 'live') && (bc.state === 'carried' || !bc.state)) return { text: `Hold to arm Beacon`, hint: `Site ${near}`, key: 'E' };
      if (bc.state === 'armed' && H.playerTeam === 'tide' && bc.pos && Math.hypot(v.pos.x - bc.pos.x, v.pos.z - bc.pos.z) < 2.6) return { text: 'Hold to disarm Beacon', hint: v.hasKit ? 'Kit equipped' : '', key: 'E' };
      if (bc.state === 'dropped' && bc.pos && H.playerTeam === 'ember' && Math.hypot(v.pos.x - bc.pos.x, v.pos.z - bc.pos.z) < 2.2) return { text: 'Pick up Beacon', key: 'E' };
    }
    const eq = R.combat?.equipped?.(v);
    if (eq && (eq.def || eq.id) && eq.mag === 0 && (eq.reserve ?? 0) > 0 && eq.state !== 'reload' && !NOAM.has(eq.id || eq.def?.id)) return { text: 'Reload', key: 'R', sm: true };
    if ((ph === 'buy' || ph === 'freeze') && !H.keys.noBuyTip) return { text: 'Buy time', hint: 'Press B to open the buy menu', key: 'B', sm: true, low: true };
    return null;
  }
  const NOAM = new Set(['tap', 'haze', 'strobe', 'pulse', 'vest', 'kit', 'beacon']);

  return {
    update(dt) {
      const R = H.R, v = H.view, T = H.T;
      // ---------- prompt / ring
      const p = !H.hidden && !H.spec ? choosePrompt(R, v) : null;
      const sig = p ? p.text + p.key + (p.hint || '') : '';
      if (sig !== S.prev) { S.prev = sig; if (p) { setKey(p.key || 'E'); setTx(p.text); setHint(p.hint || ''); prm.classList.toggle('sm', !!p.sm); } }
      const ta = p ? 1 : 0; S.prmA = ta ? Math.min(1, S.prmA + dt * 9) : Math.max(0, S.prmA - dt * 9);
      const pa = ((p && p.progress != null ? 0 : S.prmA) * (1 - Math.min(1, (H.overlayPrev || 0) * 1.2))).toFixed(2); if (S.pa !== pa) { S.pa = pa; prm.style.opacity = pa; prm.style.visibility = S.prmA > 0 ? '' : 'hidden'; }
      const showRing = p && p.progress != null; const tr = showRing ? 1 : 0;
      S.ringA = tr ? Math.min(1, S.ringA + dt * 10) : Math.max(0, S.ringA - dt * 10);
      const ra = S.ringA.toFixed(2); if (S.ra !== ra) { S.ra = ra; ring.style.opacity = ra; ring.style.transform = `scale(${(0.85 + 0.15 * S.ringA).toFixed(3)})`; }
      if (showRing) {
        const pr = clamp(p.progress, 0, 1); if (Math.abs(pr - S.ringP) > 0.002) { S.ringP = pr; ringPg.style.strokeDashoffset = (251.33 * (1 - pr)).toFixed(1); setPc(`${p.text.toUpperCase()}  ${Math.round(pr * 100)}%`); }
        if (p.col !== S.ringCol) { S.ringCol = p.col; ringPg.setAttribute('stroke', p.col || '#fff'); }
      }
      if (showRing && p.progress != null) prm.style.top = 'calc(60% + 34px)';
      else if (S.prmTop !== 1) { prm.style.top = '60%'; }
      S.prmTop = showRing ? 0 : 1;

      // ---------- banner
      const b = S.ban;
      if (b) {
        const age = T - b.t0, tin = 0.42, tout = 0.5, total = tin + b.hold + tout;
        if (age > total) { S.ban = null; ban.style.opacity = 0; ban.style.display = 'none'; }
        else {
          const pin = clamp(age / tin, 0, 1), pout = clamp((age - tin - b.hold) / tout, 0, 1);
          const ov = 1 - Math.min(1, (H.overlayPrev || 0) * 1.2); const op = easeOut(pin) * (1 - pout) * ov;
          const sc = 1 + (1 - easeOutBack(pin)) * 0.18; const y = -pout * 14;
          ban.style.opacity = op.toFixed(3);
          bt.style.transform = `scale(${sc.toFixed(3)})`;
          bandEl.style.transform = `scaleY(${(0.2 + 0.8 * easeOut(pin)).toFixed(3)})`;
          ban.style.transform = `translateY(${y.toFixed(1)}px)`;
          if (b.kind === 'win') { const m2 = R.match?.mvp; const mt = m2 ? `★ MVP  ${m2.name}` : ''; if (bm.textContent !== mt && age > 0.6) bm.textContent = mt; }
        }
      }
      // ---------- notice
      const n = S.nt;
      if (n) {
        const age = T - n.t0; if (age > n.dur) { S.nt = null; nt.style.opacity = 0; }
        else { const i = easeOut(clamp(age / 0.2, 0, 1)), o = clamp((n.dur - age) / 0.4, 0, 1); nt.style.opacity = (i * o * (1 - Math.min(1, (H.overlayPrev || 0) * 1.2))).toFixed(2); nt.style.transform = `translateX(-50%) translateY(${((1 - i) * -8).toFixed(1)}px)`; }
      }
      // ---------- toasts
      for (let i = S.ts.length - 1; i >= 0; i--) {
        const o = S.ts[i], age = T - o.t0;
        if (age > 5) { o.el.remove(); S.ts.splice(i, 1); continue; }
        const a = Math.round(clamp(age / 0.15, 0, 1) * clamp((5 - age) / 0.8, 0, 1) * (1 - Math.min(1, (H.overlayPrev || 0) * 1.2)) * 100) / 100;
        if (a !== o.a) { o.a = a; o.el.style.opacity = a; }
      }
      // ---------- flash-blind
      const f = S.flash;
      if (f) {
        const age = T - f.t0; if (age > f.dur) { S.flash = null; flashfx.style.opacity = 0; blindchip.style.opacity = 0; }
        else {
          const hold = f.dur * 0.22; const o = age < 0.04 ? age / 0.04 : age < hold ? 1 : 1 - easeOut((age - hold) / (f.dur - hold));
          const val = f.external ? 0 : Math.min(1, o * (0.55 + 0.45 * f.amt)); flashfx.style.opacity = val.toFixed(3);
          blindchip.style.opacity = (o > 0.15 ? 0.9 * Math.min(1, o * 2) : 0).toFixed(2);
        }
      }
    },
    banner, notice, toast, roundIntro,
    hasBanner: () => !!S.ban,
  };
}
