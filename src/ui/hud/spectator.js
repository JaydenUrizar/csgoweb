// Spectator strip (when the local actor is tagged out): who you're watching, charge, prev / next hints, respawn note.
import { clamp, easeOut, h, txt, tf, teamName } from './core.js';
import { icon } from './icons.js';
import { emblem } from './topbar.js';

export const css = `
.spec{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);width:420px;opacity:0;display:none;pointer-events:none;will-change:opacity,transform}
.spec .card{position:relative;display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:4px;background:linear-gradient(180deg,rgba(20,25,36,.9),rgba(10,13,21,.9));box-shadow:0 0 0 1px rgba(255,255,255,.1) inset,0 8px 24px rgba(0,0,0,.45);border-bottom:3px solid var(--sc,#fff)}
.spec .av{width:42px;height:42px;border-radius:3px;overflow:hidden;box-shadow:0 0 0 2px var(--sc,#fff);flex:none}.spec .av svg{width:100%;height:100%;display:block}
.spec .tx{flex:1;min-width:0}
.spec .lb{font:600 12px/12px var(--font);letter-spacing:.24em;color:rgba(255,255,255,.55);text-transform:uppercase}
.spec .nm{font:700 24px/26px var(--font);letter-spacing:.04em;color:#fff;text-shadow:0 1px 2px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spec .hpw{width:110px;text-align:right}
.spec .hpn{font:700 30px/30px var(--font);font-variant-numeric:tabular-nums;color:#fff}
.spec .hpb{margin-top:3px;height:4px;background:rgba(0,0,0,.55);border-radius:1px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.1) inset}
.spec .hpb b{display:block;height:100%;background:#fff;transform-origin:0 0}
.spec .hint{margin-top:8px;display:flex;justify-content:center;gap:22px;font:600 14px/16px var(--font);letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.72);text-shadow:0 1px 2px #000}
.spec .hint span{display:inline-flex;align-items:center;gap:6px}.spec .hint svg{width:13px;height:13px}
.spec .hint kbd{font:700 12px/16px var(--font);padding:0 6px;border-radius:3px;background:#eef1f6;color:#141a26;box-shadow:0 2px 0 #7b8494}
.spec .out{position:absolute;left:0;right:0;top:-34px;text-align:center;font:700 16px/18px var(--font);letter-spacing:.22em;color:#ffb9ad;text-transform:uppercase;text-shadow:0 1px 3px #000}
`;

export function create(H) {
  const root = h('div', 'spec', H.root, `<div class="out">Tagged out</div><div class="card"><div class="av"></div><div class="tx"><div class="lb">Spectating</div><div class="nm"></div></div><div class="hpw"><div class="hpn">100</div><div class="hpb"><b></b></div></div></div><div class="hint"><span>${icon('chevL')}<kbd>RMB</kbd> Prev</span><span><kbd>LMB</kbd> Next ${icon('chevR')}</span></div>`);
  const av = root.querySelector('.av'), nm = root.querySelector('.nm'), hpn = root.querySelector('.hpn'), hpb = root.querySelector('.hpb b'), out = root.querySelector('.out');
  const setNm = txt(nm), setHp = txt(hpn), tHb = tf(hpb), setOut = txt(out);
  const S = { a: 0, name: '' };
  return {
    update(dt) {
      const show = H.spec && !H.hidden && !!H.view && H.view !== H.local;
      S.a = show ? Math.min(1, S.a + dt * 8) : Math.max(0, S.a - dt * 10);
      const vis = S.a > 0.001; root.style.display = vis ? '' : 'none'; if (!vis) return;
      const e = easeOut(S.a); root.style.opacity = e.toFixed(2); root.style.transform = `translateX(-50%) translateY(${((1 - e) * 14).toFixed(1)}px)`;
      const v = H.view; if (!v) return;
      const col = H.pal[v.team]; root.style.setProperty('--sc', col);
      if (S.name !== v.name) { S.name = v.name; av.innerHTML = emblem(v.name); }
      setNm(v.name); setHp(String(Math.max(0, Math.round(v.hp ?? 0)))); tHb(`scaleX(${clamp((v.hp ?? 0) / 100, 0, 1).toFixed(3)})`);
      const m = H.R.match; const ph = m?.phase;
      setOut(ph === 'roundEnd' ? 'Round over' : H.local?.alive === false ? 'Tagged out — respawn next round' : '');
    },
  };
}
