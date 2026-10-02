// Killer recap card (shown for ~5 s after the local actor is tagged out): killer, tagger, remaining charge, damage dealt/taken.
import { clamp, easeOut, h, teamName } from './core.js';
import { icon, hasIcon, NAMES } from './icons.js';

export const css = `
.recap{position:absolute;left:50%;top:34%;width:330px;transform:translateX(-50%);opacity:0;pointer-events:none;will-change:opacity,transform;color:#fff}
.recap .cd{position:relative;padding:10px 14px 12px;border-radius:4px;background:linear-gradient(180deg,rgba(24,18,22,.97),rgba(12,10,14,.97));box-shadow:0 0 0 1px rgba(255,255,255,.14) inset,0 10px 30px rgba(0,0,0,.55);border-top:3px solid var(--kc,#ff5a48)}
.recap .hl{font:700 13px/14px var(--font);letter-spacing:.26em;color:#ff9d8f;text-transform:uppercase}
.recap .kr{display:flex;align-items:center;gap:12px;margin-top:6px}
.recap .kn{flex:1;min-width:0;font:700 30px/30px var(--font);letter-spacing:.03em;color:var(--kc,#fff);text-shadow:0 2px 3px rgba(0,0,0,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.recap .kw{display:flex;align-items:center;gap:6px;height:30px;color:#fff}
.recap .kw .ic-w{height:28px;width:auto;aspect-ratio:120/48}.recap .kw .ic-g{width:22px;height:22px;color:#ffd25a}
.recap .hp{margin-top:9px;display:flex;align-items:center;gap:8px;font:600 14px/16px var(--font);letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.75)}
.recap .hp b{font:700 22px/22px var(--font);color:#fff;min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
.recap .hp .bar{flex:1;height:5px;background:rgba(255,255,255,.14);border-radius:1px;overflow:hidden}.recap .hp .bar u{display:block;height:100%;background:#fff;transform-origin:0 0;text-decoration:none}
.recap .dm{margin-top:9px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.recap .dm div{padding:5px 8px;border-radius:3px;background:rgba(255,255,255,.07);font:600 12px/14px var(--font);letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.62)}
.recap .dm b{display:block;font:700 24px/24px var(--font);letter-spacing:.02em;color:#fff;font-variant-numeric:tabular-nums}
.recap .dm .g b{color:#8fe3a0}.recap .dm .t b{color:#ff8b7a}
`;

export function create(H) {
  const root = h('div', 'recap', H.root, '<div class="cd"><div class="hl">Tagged out by</div><div class="kr"><div class="kn"></div><div class="kw"></div></div><div class="hp"><span>Charge</span><div class="bar"><u></u></div><b>0</b></div><div class="dm"><div class="g">You dealt<b>0</b></div><div class="t">They dealt<b>0</b></div></div></div>');
  const cd = root.querySelector('.cd'), kn = root.querySelector('.kn'), kw = root.querySelector('.kw'), hpB = root.querySelector('.hp b'), hpU = root.querySelector('.hp u'), gB = root.querySelector('.dm .g b'), tB = root.querySelector('.dm .t b');
  const given = new Map(), taken = new Map();
  const S = { c: null, t0: -99, hold: 5.2 };
  const clear = () => { given.clear(); taken.clear(); };
  H.bus.on('tag:hit', (d) => {
    const L = H.local; if (!L) return;
    if (d.attacker === L && d.victim && d.victim !== L) given.set(d.victim.id, (given.get(d.victim.id) || 0) + (d.damage || 0));
    if (d.victim === L && d.attacker && d.attacker !== L) taken.set(d.attacker.id, (taken.get(d.attacker.id) || 0) + (d.damage || 0));
  });
  H.bus.on('round:start', clear); H.bus.on('reset', () => { clear(); S.c = null; });
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
      const show = !!c && age < S.hold && !H.hidden && H.spec;
      if (!show) { if (c && (age >= S.hold || !H.spec)) { root.style.opacity = 0; if (!H.spec) S.c = null; } return; }
      const e = easeOut(clamp(age / 0.25, 0, 1)), o = clamp((S.hold - age) / 0.5, 0, 1) * e * (1 - Math.min(1, (H.overlayPrev || 0) * 1.2));
      root.style.opacity = o.toFixed(2); root.style.transform = `translateX(-50%) translateY(${((1 - e) * 14).toFixed(1)}px)`;
      if (c.k) { const hp = Math.max(0, Math.round(c.k.hp ?? 0)); hpB.textContent = c.k.alive === false ? 0 : hp; hpU.style.transform = `scaleX(${clamp(c.k.alive === false ? 0 : hp / 100, 0, 1).toFixed(3)})`; }
    },
  };
}
