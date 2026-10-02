// Killer recap card (shown for ~5 s after the local actor is tagged out): killer, tagger, remaining charge, damage dealt/taken.
import { clamp, easeOut, h, teamName } from './core.js';
import { icon, hasIcon, NAMES } from './icons.js';

export const css = `
.recap{position:absolute;left:22px;top:236px;width:262px;opacity:0;pointer-events:none;will-change:opacity,transform;color:#fff}
.recap .cd{position:relative;padding:7px 11px 8px;border-radius:3px;background:linear-gradient(180deg,rgba(24,18,22,.96),rgba(12,10,14,.96));box-shadow:0 0 0 1px rgba(255,255,255,.12) inset,0 6px 18px rgba(0,0,0,.5);border-left:3px solid var(--kc,#ff5a48)}
.recap .hl{font:700 11px/12px var(--font);letter-spacing:.24em;color:#ff9d8f;text-transform:uppercase}
.recap .kr{display:flex;align-items:center;gap:8px;margin-top:3px}
.recap .kn{flex:1;min-width:0;font:700 22px/24px var(--font);letter-spacing:.03em;color:var(--kc,#fff);text-shadow:0 1px 2px rgba(0,0,0,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.recap .kw{display:flex;align-items:center;gap:5px;height:22px;color:#fff}
.recap .kw .ic-w{height:20px;width:auto;aspect-ratio:120/48}.recap .kw .ic-g{width:16px;height:16px;color:#ffd25a}
.recap .st{margin-top:5px;display:flex;gap:12px;font:600 12px/14px var(--font);letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.recap .st b{font:700 16px/14px var(--font);color:#fff;margin-left:4px;font-variant-numeric:tabular-nums}
.recap .st .g b{color:#8fe3a0}.recap .st .t b{color:#ff8b7a}
.recap .bar{margin-top:5px;height:3px;background:rgba(255,255,255,.14);border-radius:1px;overflow:hidden}.recap .bar u{display:block;height:100%;background:#fff;transform-origin:0 0;text-decoration:none}
`;

export function create(H) {
  const root = h('div', 'recap', H.root, '<div class="cd"><div class="hl">Tagged out by</div><div class="kr"><div class="kn"></div><div class="kw"></div></div><div class="bar"><u></u></div><div class="st"><span class="c">Charge<b>0</b></span><span class="g">Dealt<b>0</b></span><span class="t">Taken<b>0</b></span></div></div>');
  const cd = root.querySelector('.cd'), kn = root.querySelector('.kn'), kw = root.querySelector('.kw'), hpB = root.querySelector('.st .c b'), hpU = root.querySelector('.bar u'), gB = root.querySelector('.st .g b'), tB = root.querySelector('.st .t b');
  const given = new Map(), taken = new Map();
  const S = { c: null, t0: -99, hold: 7 };
  const clear = () => { given.clear(); taken.clear(); };
  H.bus.on('tag:hit', (d) => {
    const L = H.local; if (!L) return;
    if (d.attacker === L && d.victim && d.victim !== L) given.set(d.victim.id, (given.get(d.victim.id) || 0) + (d.damage || 0));
    if (d.victim === L && d.attacker && d.attacker !== L) taken.set(d.attacker.id, (taken.get(d.attacker.id) || 0) + (d.damage || 0));
  });
  H.bus.on('round:start', clear); H.bus.on('reset', () => { clear(); S.c = null; root.style.opacity = 0; });
  H.bus.on('tag:out', (d) => {
    if (!d.victim || d.victim !== H.local) return;
    const k = d.attacker && d.attacker !== d.victim ? d.attacker : null;
    const tg = typeof d.tagger === 'string' ? d.tagger : d.tagger?.id || '';
    S.c = { k, tg, head: !!(d.headshot || d.hitgroup === 'head' || d.hitgroup === 'crown'), dealt: k ? Math.round(given.get(k.id) || 0) : 0, took: k ? Math.round(taken.get(k.id) || 0) : 0 };
    S.t0 = H.T;
    cd.style.setProperty('--kc', k ? H.pal[k.team] : '#ff5a48');
    kn.textContent = k ? k.name : 'The arena';
    kw.innerHTML = (tg && hasIcon(tg) ? icon(tg) : '') + (S.c.head ? icon('crown') : '');
    gB.textContent = S.c.dealt; tB.textContent = S.c.took;
  });
  return {
    update() {
      const c = S.c; const age = H.T - S.t0;
      const show = !!c && age > 1.3 && age < S.hold && !H.hidden && H.spec;
      if (!show) { if (c && (age >= S.hold || !H.spec)) { root.style.opacity = 0; if (!H.spec) S.c = null; } return; }
      const e = easeOut(clamp((age - 1.3) / 0.25, 0, 1)), o = clamp((S.hold - age) / 0.5, 0, 1) * e * (1 - Math.min(1, (H.overlayPrev || 0) * 1.2));
      root.style.opacity = o.toFixed(2); root.style.transform = `translateX(${((1 - e) * -16).toFixed(1)}px)`;
      if (c.k) { const hp = Math.max(0, Math.round(c.k.hp ?? 0)); hpB.textContent = c.k.alive === false ? 0 : hp; hpU.style.transform = `scaleX(${clamp(c.k.alive === false ? 0 : hp / 100, 0, 1).toFixed(3)})`; }
    },
  };
}
