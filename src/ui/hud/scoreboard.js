// Scoreboard overlay (hold Tab): both teams, tags / outs / assists / score / credits (own team) / ping, MVP star, BOT tags, round history.
import { clamp, easeOut, h, txt, fmtMoney, fakePing, teamName } from './core.js';
import { icon } from './icons.js';

export const css = `
.sbd{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,rgba(4,6,12,.18),rgba(4,6,12,.55));opacity:0;pointer-events:none;will-change:opacity}
.sb{position:absolute;left:50%;top:15%;width:780px;transform:translateX(-50%);opacity:0;pointer-events:none;color:#fff;will-change:opacity,transform}
.sb .hdr{display:flex;align-items:center;justify-content:center;gap:16px;height:52px;border-radius:4px 4px 0 0;background:linear-gradient(180deg,rgba(24,30,44,.94),rgba(14,18,28,.94));box-shadow:0 0 0 1px rgba(255,255,255,.1) inset}
.sb .hdr .tn{font:700 26px/28px var(--font);letter-spacing:.14em;text-transform:uppercase;min-width:150px}
.sb .hdr .tn.l{text-align:right}.sb .hdr .tn.r{text-align:left}
.sb .hdr .sc{font:700 38px/38px var(--font);font-variant-numeric:tabular-nums;min-width:44px;text-align:center}
.sb .hdr .smid{text-align:center;white-space:nowrap;min-width:230px;color:rgba(255,255,255,.62);font:600 13px/15px var(--font);letter-spacing:.16em;text-transform:uppercase}
.sb .hdr .smid b{display:block;color:#fff;font-size:15px}
.sb .team{margin-top:5px;background:linear-gradient(180deg,rgba(16,20,30,.9),rgba(10,13,21,.9));box-shadow:0 0 0 1px rgba(255,255,255,.08) inset}
.sb .th,.sb .rw{display:grid;grid-template-columns:34px 1fr 78px 52px 52px 62px 62px 60px;align-items:center;column-gap:4px;padding:0 12px 0 8px}
.sb .th{height:24px;font:600 12px/14px var(--font);letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.5);border-bottom:2px solid var(--tc);background:rgba(var(--tcr),.10)}
.sb .th .n,.sb .rw .n,.sb .th .nm{text-align:left}
.sb .rows{display:flex;flex-direction:column}
.sb .rw{height:29px;font:600 17px/29px var(--font);border-bottom:1px solid rgba(255,255,255,.05);font-variant-numeric:tabular-nums}
.sb .rw .c{text-align:center}.sb .th .c{text-align:center}
.sb .rw .av{width:24px;height:24px;border-radius:2px;overflow:hidden;box-shadow:0 0 0 1.5px var(--tc)}
.sb .rw .av svg{width:100%;height:100%;display:block}
.sb .rw .nm{display:flex;align-items:center;gap:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;letter-spacing:.03em;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.sb .rw .bot{font:700 10px/12px var(--font);letter-spacing:.14em;padding:0 4px;border-radius:2px;background:rgba(255,255,255,.14);color:rgba(255,255,255,.75)}
.sb .rw .mvp{color:#ffd25a;display:inline-flex;align-items:center;gap:2px;font-size:13px}.sb .rw .mvp svg{width:14px;height:14px}
.sb .rw .bcn{color:#ffd25a;display:none}.sb .rw .bcn svg{width:22px;height:9px}.sb .rw.car .bcn{display:inline-block}
.sb .rw.me{background:linear-gradient(90deg,rgba(255,255,255,.16),rgba(255,255,255,.06))}
.sb .rw.dead{color:rgba(255,255,255,.42)}.sb .rw.dead .nm{color:rgba(255,255,255,.5)}
.sb .rw.dead .av{filter:grayscale(1) brightness(.55)}
.sb .rw .cr{color:#8fe3a0;text-align:center}.sb .rw.dead .cr{color:rgba(143,227,160,.45)}
.sb .rw .sc2{font-weight:700;text-align:center}
.sb .rw .pg{text-align:center;color:rgba(255,255,255,.5);font-size:14px}
.sb .rw.x .nm:after{content:"";}
.sb .hist{margin-top:6px;display:flex;justify-content:center;gap:3px;padding:6px 10px;background:rgba(10,13,21,.85);box-shadow:0 0 0 1px rgba(255,255,255,.08) inset;border-radius:0 0 4px 4px}
.sb .hist i{width:24px;height:14px;border-radius:2px;background:rgba(255,255,255,.08);font:700 10px/14px var(--font);text-align:center;color:rgba(0,0,0,.65);font-style:normal}
.sb .hist i.hs{margin-left:8px}
`;

export function create(H) {
  const dim = h('div', 'sbd', H.root);
  const root = h('div', 'sb', H.root);
  const hdr = h('div', 'hdr', root, '<span class="tn l"></span><span class="sc l">0</span><span class="smid"><b></b><span></span></span><span class="sc r">0</span><span class="tn r"></span>');
  const tnL = hdr.querySelector('.tn.l'), tnR = hdr.querySelector('.tn.r'), scL = hdr.querySelector('.sc.l'), scR = hdr.querySelector('.sc.r'), mb = hdr.querySelector('.smid b'), ms = hdr.querySelector('.smid span');
  const setTnL = txt(tnL), setTnR = txt(tnR), setScL = txt(scL), setScR = txt(scR), setMb = txt(mb), setMs = txt(ms);
  const teams = {};
  const mk = (side) => {
    const t = h('div', 'team', root); const th = h('div', 'th', t, '<span></span><span class="nm">Player</span><span class="c">Credits</span><span class="c">Tags</span><span class="c">Outs</span><span class="c">Assists</span><span class="c">Score</span><span class="c">Ping</span>');
    const rows = h('div', 'rows', t); return { el: t, th, rows, map: new Map(), col: '' };
  };
  teams.a = mk('a'); teams.b = mk('b');
  const hist = h('div', 'hist', root);
  const S = { a: 0, open: false, t: 0, hkey: '', cols: {} };
  const emblemFn = { f: null };
  import('./topbar.js').then((m) => { emblemFn.f = m.emblem; S.t = 0; });

  H.bus.on('reset', () => { S.a = 0; S.t = 0; });
  function rowFor(team, a) {
    let r = team.map.get(a.id); if (r) return r;
    const el = h('div', 'rw', team.rows, `<span class="av"></span><span class="nm"><span class="pn"></span><span class="bcn">${icon('beacon')}</span><span class="mvp"></span><span class="bot" style="display:none">BOT</span></span><span class="cr"></span><span class="c t"></span><span class="c o"></span><span class="c a"></span><span class="c sc2"></span><span class="pg"></span>`);
    r = { el, av: el.querySelector('.av'), nt: txt(el.querySelector('.pn')), mvp: el.querySelector('.mvp'), bot: el.querySelector('.bot'), cr: txt(el.querySelector('.cr')), t: txt(el.querySelector('.t')), o: txt(el.querySelector('.o')), a: txt(el.querySelector('.a')), sc: txt(el.querySelector('.sc2')), pg: txt(el.querySelector('.pg')), name: '', mvpKey: '', cls: '' };
    team.map.set(a.id, r); return r;
  }
  function fill(team, list, tname, isMine, mvp, rowsById) {
    const col = H.pal[tname]; if (col !== team.col) { team.col = col; team.el.style.setProperty('--tc', col); team.el.style.setProperty('--tcr', H.rgb[tname]); }
    const stOf = (a) => rowsById?.get(a.id) || a.stats || {};
    const sorted = list.slice().sort((p, q) => (stOf(q).score ?? 0) - (stOf(p).score ?? 0) || (stOf(q).tags ?? 0) - (stOf(p).tags ?? 0));
    const seen = new Set();
    sorted.forEach((a, i) => {
      seen.add(a.id); const r = rowFor(team, a); r.el.style.order = i;
      if (r.name !== a.name) { r.name = a.name; r.av.innerHTML = emblemFn.f ? emblemFn.f(a.name) : ''; }
      r.nt(a.name + (a === H.local ? '' : ''));
      r.bot.style.display = a.isBot ? '' : 'none';
      const sx = stOf(a); const mk = mvp === a ? '1' : String(sx.mvps || 0);
      if (mk !== r.mvpKey) { r.mvpKey = mk; r.mvp.innerHTML = mvp === a ? icon('star') : (sx.mvps ? icon('star') + sx.mvps : ''); }
      const cls = 'rw' + (a === H.local ? ' me' : '') + (a.alive === false || a.tagged ? ' dead' : '') + (a.hasBeacon && a.alive !== false ? ' car' : '');
      if (cls !== r.cls) { r.cls = cls; r.el.className = cls; }
      r.cr(isMine ? fmtMoney(a.credits ?? 0) : '');
      const s = sx; r.t(String(s.tags ?? 0)); r.o(String(s.outs ?? 0)); r.a(String(s.assists ?? 0)); r.sc(String(s.score ?? 0));
      r.pg(a.isBot ? 'BOT' : String(fakePing(a)));
    });
    for (const [id, r] of team.map) if (!seen.has(id)) { r.el.remove(); team.map.delete(id); }
  }

  return {
    update(dt) {
      const R = H.R, m = R.match, ph = m?.phase;
      const want = !H.hidden && !!H.local && (!!H.flags.forceScore || !!H.ctx.input?.down?.('scoreboard') || ph === 'matchEnd' || ph === 'halftime');
      S.a = want ? Math.min(1, S.a + dt * 10) : Math.max(0, S.a - dt * 12);
      const vis = S.a > 0.001; dim.style.display = root.style.display = vis ? '' : 'none';
      if (!vis) return;
      const e = easeOut(S.a); dim.style.opacity = e.toFixed(3); root.style.opacity = e.toFixed(3); root.style.transform = `translateX(-50%) translateY(${((1 - e) * -10).toFixed(1)}px)`;
      S.t -= dt; if (S.t > 0) return; S.t = 0.2;
      const mine = H.playerTeam, foe = mine === 'ember' ? 'tide' : 'ember';
      const list = (t) => { const x = m?.teams?.[t]; return x && x.length ? x : (R.actors || []).filter((a) => a.team === t); };
      setTnL(teamName(mine)); setTnR(teamName(foe)); tnL.style.color = H.pal[mine]; tnR.style.color = H.pal[foe];
      setScL(String(m?.scores?.[mine] ?? 0)); setScR(String(m?.scores?.[foe] ?? 0)); scL.style.color = H.pal[mine]; scR.style.color = H.pal[foe];
      setMb('Crux Station'); const rn = m?.round ?? 1; setMs(`Round ${rn} · ${rn <= 7 ? 'First half' : 'Second half'} · First to 8`);
      let rows = null; try { const sbd = m?.scoreboard?.(); if (sbd) { rows = new Map(); for (const t of ['ember', 'tide']) for (const r of sbd[t]?.rows || []) rows.set(r.id, r); } } catch {}
      fill(teams.a, list(mine), mine, true, m?.mvp, rows); fill(teams.b, list(foe), foe, false, m?.mvp, rows);
      // history
      const hs = m?.history || []; const key = hs.map((x) => x.n + x.winner).join(',') + mine;
      if (key !== S.hkey) {
        S.hkey = key; let html = '';
        for (let i = 0; i < 15; i++) { const x = hs[i]; const c = x ? H.pal[x.winner] : ''; html += `<i class="${i === 7 ? 'hs' : ''}" style="${x ? `background:${c}` : ''}">${x ? (x.winner === mine ? '' : '') : i + 1}</i>`; }
        hist.innerHTML = html;
      }
    },
  };
}
