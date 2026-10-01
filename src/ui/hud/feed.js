// Tag feed (top-right): attacker -> weapon icon -> [modifiers] -> victim, team-coloured, own tags highlighted.
import { easeOut, h } from './core.js';
import { icon, hasIcon } from './icons.js';

export const css = `
.feed{position:absolute;right:14px;top:14px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;width:420px}
.kf{position:relative;display:flex;align-items:center;gap:7px;height:27px;padding:0 9px;border-radius:3px;background:linear-gradient(180deg,rgba(18,22,32,.82),rgba(9,12,19,.82));box-shadow:0 0 0 1px rgba(255,255,255,.08) inset,0 2px 6px rgba(0,0,0,.35);font:600 17px/27px var(--font);letter-spacing:.02em;white-space:nowrap;will-change:transform,opacity;color:#fff}
.kf .nm{text-shadow:0 1px 2px rgba(0,0,0,.85)}
.kf .nm.ember{color:var(--ember)}.kf .nm.tide{color:var(--tide)}
.kf .nm.none{color:#cfd6e4}
.kf .pl{color:#8b93a6;font-weight:700;margin:0 -2px}
.kf .ic{display:block;height:18px;width:auto;color:#fff;filter:drop-shadow(0 1px 1px rgba(0,0,0,.7))}
.kf .ic-w{aspect-ratio:120/48}.kf .ic-g{width:17px;height:17px}
.kf .ic.crown{color:#ffd25a}.kf .ic.wall{color:#c9d3e6}.kf .ic.smoke{color:#c7d0dd}.kf .ic.blind{color:#fff0a8}.kf .ic.ns{color:#e6eefc}
.kf.mine{box-shadow:0 0 0 2px #ff3e3e,0 2px 8px rgba(255,50,50,.25);background:linear-gradient(180deg,rgba(60,14,16,.86),rgba(30,8,10,.86))}
.kf.out{box-shadow:0 0 0 1.5px rgba(255,255,255,.8),0 2px 8px rgba(0,0,0,.4)}
.kf.assist .nm.a2{opacity:.95}
`;

const MAX = 5, LIFE = 6;

export function create(H) {
  const box = h('div', 'feed', H.root);
  const list = [];

  const nameSpan = (a) => {
    if (!a) return '<span class="nm none">World</span>';
    const t = a.team === 'ember' || a.team === 'tide' ? a.team : 'none';
    return `<span class="nm ${t}">${esc(a.name || '???')}</span>`;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const has = (x, k) => x === k || (Array.isArray(x) && x.includes(k)) || (x && typeof x === 'object' && !Array.isArray(x) && !!x[k]) || (typeof x === 'string' && x.includes(k));

  function add(d) {
    if (!d?.victim) return;
    const a = d.attacker, v = d.victim, me = H.view;
    const mine = a && a === me && v !== me, gotMe = v === me;
    const el = h('div', 'kf' + (mine ? ' mine' : gotMe ? ' out' : ''), null);
    const tg = typeof d.tagger === 'string' ? d.tagger : d.tagger?.id || d.weapon;
    let html = '';
    const th = d.through, blind = d.blind || d.attackerBlind || has(th, 'blind') || has(th, 'flash');
    if (a && a !== v) {
      if (blind) html += icon('blind', 'blind');
      html += nameSpan(a);
      if (d.assist) { const as = typeof d.assist === 'object' ? d.assist : null; html += `<span class="pl">+</span>` + (as ? nameSpan(as) : '<span class="nm none">assist</span>'); }
    }
    html += tg && hasIcon(tg) ? icon(tg) : '';
    if (d.noscope || has(th, 'noscope')) html += icon('noscope', 'ns');
    if (d.wallbang || has(th, 'wall')) html += icon('wall', 'wall');
    if (d.smoke || has(th, 'smoke') || has(th, 'haze')) html += icon('smoke', 'smoke');
    if (d.hitgroup === 'head' || d.hitgroup === 'crown') html += icon('crown', 'crown');
    if (!a || a === v) html += icon('tagout');
    html += nameSpan(v);
    el.innerHTML = html; box.appendChild(el);
    list.push({ el, t0: H.T, a: -1, x: 99 });
    while (list.length > MAX) { const o = list.shift(); o.el.remove(); }
  }
  H.bus.on('tag:out', add);
  H.bus.on('reset', () => { for (const o of list) o.el.remove(); list.length = 0; });

  return {
    update() {
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i], age = H.T - o.t0;
        if (age > LIFE) { o.el.remove(); list.splice(i, 1); continue; }
        const e = easeOut(Math.min(1, age / 0.2)), fade = age > LIFE - 0.7 ? (LIFE - age) / 0.7 : 1;
        const a = Math.round(e * fade * 100) / 100, x = Math.round((1 - e) * 36);
        if (a !== o.a || x !== o.x) { o.a = a; o.x = x; o.el.style.opacity = a; o.el.style.transform = x ? `translateX(${x}px)` : ''; }
      }
    },
    add,
  };
}
