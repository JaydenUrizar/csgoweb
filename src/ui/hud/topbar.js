// Top-centre strip: team alive pips (avatar tiles), round timer / beacon fuse, score, round text.
import { clamp, h, txt, flag, style, tf, fmtTime, hashStr, teamName, hexRgb } from './core.js';
import { icon } from './icons.js';

export const css = `
.top{position:absolute;left:50%;top:6px;transform:translateX(-50%);display:flex;align-items:flex-start;gap:0;filter:drop-shadow(0 2px 6px rgba(0,0,0,.45))}
.top .side{display:flex;gap:4px;align-items:flex-start}
.top .side.l{margin-right:5px}.top .side.r{margin-left:5px}
.pip{position:relative;width:34px;height:36px;flex:none}
.pip .av{position:absolute;left:0;top:0;width:34px;height:34px;border-radius:3px;overflow:hidden;box-shadow:0 0 0 2.5px var(--tc,#888),0 1px 0 2.5px rgba(0,0,0,.4);transition:filter .25s,opacity .25s}
.pip .av svg{display:block;width:100%;height:100%}
.pip:before{content:'';position:absolute;left:0;right:0;top:-5px;height:3px;border-radius:2px;background:var(--tc,#888);opacity:.95}
.pip .hp{position:absolute;left:1px;right:1px;bottom:0;height:3px;background:rgba(0,0,0,.55);overflow:hidden;border-radius:1px}
.pip .hp b{position:absolute;inset:0;background:#fff;transform-origin:0 0;will-change:transform}
.pip.me .av{box-shadow:0 0 0 2px #fff,0 0 0 4px rgba(0,0,0,.35)}
.pip.dead .av{filter:grayscale(1) brightness(.42) contrast(.9);opacity:.85}
.pip.dead .hp{opacity:0}
.pip .x{position:absolute;left:0;top:0;width:34px;height:34px;display:none;align-items:center;justify-content:center;color:rgba(255,255,255,.92)}
.pip.dead .x{display:flex}.pip .x svg{width:18px;height:18px;filter:drop-shadow(0 1px 1px #000)}
.pip .bc{position:absolute;right:-3px;top:-4px;width:15px;height:15px;border-radius:50%;background:#101522;color:#ffd25a;display:none;align-items:center;justify-content:center;box-shadow:0 0 0 1px rgba(255,210,90,.7)}
.pip .bc svg{width:11px;height:11px}.pip.carrier .bc{display:flex}
.mid{position:relative;width:104px;height:58px;border-radius:3px;overflow:hidden;background:linear-gradient(180deg,rgba(24,29,42,.86),rgba(12,15,24,.86));box-shadow:0 0 0 1px rgba(255,255,255,.09) inset,0 1px 0 rgba(0,0,0,.5)}
.mid .glow{position:absolute;inset:0;background:radial-gradient(90% 80% at 50% 45%,rgba(255,90,50,.65),rgba(255,90,50,0) 75%);opacity:0;will-change:opacity}
.mid .lbl{position:absolute;left:0;right:0;top:3px;text-align:center;font:600 10px/10px var(--font);letter-spacing:.2em;color:rgba(255,255,255,.55);text-transform:uppercase;white-space:nowrap}
.mid .time{position:absolute;left:0;right:0;top:12px;text-align:center;font:700 27px/28px var(--font);letter-spacing:.02em;color:#fff;font-variant-numeric:tabular-nums;text-shadow:0 1px 2px rgba(0,0,0,.7)}
.mid.armed .time{color:#ffd25a}.mid.warn .time{color:#ff6b57}
.mid .time svg{display:none;width:20px;height:11px;vertical-align:-1px;margin-right:4px}
.mid.armed .time svg{display:inline-block}
.mid .sc{position:absolute;left:0;right:0;bottom:5px;display:flex;justify-content:center;align-items:baseline;gap:0;font:700 17px/17px var(--font)}
.mid .sc b{width:44px;text-align:center;font-variant-numeric:tabular-nums;text-shadow:0 1px 1px rgba(0,0,0,.6)}
.mid .sc i{width:1px;height:12px;background:rgba(255,255,255,.22);align-self:center}
.mid .bar{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.08)}
.mid .bar b{position:absolute;inset:0;background:var(--barc,#fff);transform-origin:0 0;will-change:transform}
.topsub{position:absolute;left:50%;top:68px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;white-space:nowrap;font:600 13px/14px var(--font);letter-spacing:.06em;color:rgba(255,255,255,.82);text-shadow:0 1px 2px #000,0 0 6px rgba(0,0,0,.6)}
.topsub .vs{font-style:italic;font-weight:600;opacity:.95}
.topsub .rt{padding:1px 7px;border-radius:2px;background:rgba(10,13,22,.6);box-shadow:0 0 0 1px rgba(255,255,255,.12) inset;font-size:11px;letter-spacing:.16em;text-transform:uppercase}
.topsub .rt.mp{background:rgba(255,90,60,.22);box-shadow:0 0 0 1px rgba(255,120,80,.6) inset;color:#ffd6c8}
`;

const EMBL = [
  (c) => `<circle cx="20" cy="20" r="9" fill="${c}"/><circle cx="20" cy="20" r="4" fill="#fff" opacity=".85"/>`,
  (c) => `<path d="M20 7L33 31H7z" fill="${c}"/><path d="M20 16l6 10h-12z" fill="#fff" opacity=".8"/>`,
  (c) => `<path d="M6 14l14-8 14 8v12l-14 8-14-8z" fill="${c}"/><path d="M13 17l7-4 7 4v6l-7 4-7-4z" fill="#fff" opacity=".8"/>`,
  (c) => `<path d="M6 12l14 6 14-6v6l-14 6-14-6zM6 22l14 6 14-6v6l-14 6-14-6z" fill="${c}"/>`,
  (c) => `<rect x="9" y="9" width="22" height="22" rx="4" fill="${c}" transform="rotate(45 20 20)"/><circle cx="20" cy="20" r="4.5" fill="#fff" opacity=".85"/>`,
  (c) => `<path d="M8 30V10h5v20zM17.5 30V16h5v14zM27 30V6h5v24z" fill="${c}"/>`,
  (c) => `<path d="M20 5l4.6 10.4L36 17l-8.4 7.6L30 36l-10-6-10 6 2.4-11.4L4 17l11.4-1.6z" fill="${c}"/>`,
  (c) => `<circle cx="14" cy="15" r="6.5" fill="${c}"/><circle cx="26" cy="15" r="6.5" fill="${c}" opacity=".75"/><circle cx="20" cy="26" r="6.5" fill="${c}" opacity=".9"/>`,
];
const mixc = (hex, to, t) => { const a = hexRgb(hex), b = hexRgb(to); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; };
export function emblem(name, team) {
  const hs = hashStr(name), hue = hs % 360, k = (hs >>> 9) % EMBL.length;
  let c1 = `hsl(${hue} 70% 62%)`, c2 = `hsl(${(hue + 40) % 360} 65% 32%)`, sym = `hsl(${(hue + 180) % 360} 85% 82%)`;
  if (team) { c1 = mixc(team, '#0b0f18', 0.12); c2 = mixc(team, '#0b0f18', 0.62); sym = `hsl(${hue} 55% 92%)`; }
  const id = 'e' + (hs & 0xfffff).toString(36);
  return `<svg viewBox="0 0 40 40"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="40" height="40" fill="url(#${id})"/>${EMBL[k](sym)}</svg>`;
}

export function create(H) {
  const top = h('div', 'top', H.root);
  const sl = h('div', 'side l', top), mid = h('div', 'mid', top), sr = h('div', 'side r', top);
  const glow = h('div', 'glow', mid), lbl = h('div', 'lbl', mid), time = h('div', 'time', mid, icon('beacon') + '<span></span>'), sc = h('div', 'sc', mid);
  const timeTxt = time.querySelector('span'), sA = h('b', '', sc), sep = h('i', '', sc), sB = h('b', '', sc);
  const bar = h('div', 'bar', mid), barF = h('b', '', bar);
  const sub = h('div', 'topsub', H.root), vsEl = h('span', 'vs', sub), rtEl = h('span', 'rt', sub);
  const S = { pips: { l: [], r: [] } };
  const setLbl = txt(lbl), setTime = txt(timeTxt), setA = txt(sA), setB = txt(sB), setVs = txt(vsEl), setRt = txt(rtEl);
  const fArmed = flag(mid, 'armed'), fWarn = flag(mid, 'warn'), fMp = flag(rtEl, 'mp'), setBar = tf(barF), setGlow = style(glow, 'opacity'), setBarC = style(bar, 'display');
  let lastNames = { l: '', r: '' };

  function makePip(parent) {
    const p = h('div', 'pip', parent);
    const av = h('div', 'av', p), hp = h('div', 'hp', p), hpb = h('b', '', hp), x = h('div', 'x', p, icon('tagout')), bc = h('div', 'bc', p, icon('beacon'));
    return { el: p, av, hpb, name: '', fDead: flag(p, 'dead'), fMe: flag(p, 'me'), fCar: flag(p, 'carrier'), setHp: tf(hpb), col: '' };
  }
  function ensure(side, n) { const arr = S.pips[side], par = side === 'l' ? sl : sr; while (arr.length < n) arr.push(makePip(par)); for (let i = 0; i < arr.length; i++) arr[i].el.style.display = i < n ? '' : 'none'; }
  const teamList = (R, team) => { const t = R.match?.teams?.[team]; if (t && t.length) return t; return (R.actors || []).filter((a) => a.team === team); };
  const scoreOf = (R, team) => R.match?.scores?.[team] ?? 0;

  function fillSide(side, list, team, isAlly) {
    ensure(side, Math.max(5, list.length));
    const arr = S.pips[side];
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i], a = list[i];
      if (!a) { p.el.style.visibility = 'hidden'; continue; } p.el.style.visibility = '';
      const col = H.pal[team];
      if (p.name !== a.name + col) { p.name = a.name + col; p.av.innerHTML = emblem(a.name, col); } if (p.col !== col) { p.col = col; p.el.style.setProperty('--tc', col); }
      const alive = a.alive !== false && !a.tagged;
      p.fDead(!alive); p.fMe(a === H.local); p.fCar(alive && a.hasBeacon && isAlly);
      p.setHp(`scaleX(${isAlly ? clamp((a.hp ?? 100) / 100, 0, 1).toFixed(2) : 1})`);
    }
  }

  return {
    update(dt) {
      const R = H.R, m = R.match, vis = !!(m && m.phase) && !H.hidden && !H.flags.noTop;
      top.style.display = sub.style.display = vis ? '' : 'none';
      if (!vis) return;
      const mine = H.playerTeam, foe = mine === 'ember' ? 'tide' : 'ember';
      const la = teamList(R, mine), lb = teamList(R, foe);
      fillSide('l', la, mine, true); fillSide('r', lb, foe, false);
      setA(String(scoreOf(R, mine))); setB(String(scoreOf(R, foe)));
      sA.style.color = H.pal[mine]; sB.style.color = H.pal[foe];
      const ph = m.phase, bc = m.beacon;
      const armed = ph === 'armed' || bc?.state === 'armed';
      let label = '', t = m.timeLeft ?? 0, tstr;
      switch (ph) {
        case 'warmup': label = 'Warmup'; break;
        case 'buy': case 'freeze': label = 'Buy time'; if (m.buyTimeLeft != null) t = m.buyTimeLeft; break;
        case 'live': label = 'Round ' + (m.round ?? 1); break;
        case 'armed': label = 'Beacon armed'; break;
        case 'roundEnd': label = 'Round over'; break;
        case 'halftime': label = 'Halftime'; break;
        case 'matchEnd': label = 'Match over'; break;
        default: label = String(ph);
      }
      if (armed) { t = bc?.fuseLeft ?? t; label = 'Beacon armed'; }
      tstr = ph === 'matchEnd' ? '--' : t < 10 && armed ? Math.max(0, t).toFixed(1) : fmtTime(t);
      if (ph === 'matchEnd' || ph === 'roundEnd' && !armed) tstr = fmtTime(t);
      setLbl(label); setTime(tstr);
      fArmed(armed); fWarn(!armed && ph === 'live' && t <= 10 && t > 0);
      // armed pulse (accelerating with the fuse)
      if (armed) {
        const fuse = clamp((bc?.fuseLeft ?? 35) / 35, 0, 1), hz = 1.2 + (1 - fuse) * 6.5;
        const ph01 = 0.5 + 0.5 * Math.sin(H.T * Math.PI * 2 * hz);
        setGlow((0.12 + 0.55 * ph01 * (0.6 + 0.4 * (1 - fuse))).toFixed(2));
        setBar(`scaleX(${fuse.toFixed(3)})`); barF.parentNode.style.display = ''; mid.style.setProperty('--barc', '#ff7a4a');
      } else {
        setGlow('0');
        const total = ph === 'buy' || ph === 'freeze' ? 18 : ph === 'live' ? 105 : 0;
        if (total) { setBar(`scaleX(${clamp(t / total, 0, 1).toFixed(3)})`); mid.style.setProperty('--barc', ph === 'live' ? 'rgba(255,255,255,.7)' : H.pal[mine]); barF.parentNode.style.display = ''; } else barF.parentNode.style.display = 'none';
      }
      // sub row
      const aliveA = la.filter((a) => a.alive !== false && !a.tagged).length, aliveB = lb.filter((a) => a.alive !== false && !a.tagged).length;
      setVs(`${aliveA} vs ${aliveB}`);
      const rt = m.roundType || roundType(m, mine);
      setRt(rt.text); fMp(rt.hot);
      rtEl.style.display = rt.text ? '' : 'none';
    },
  };
}

/** Round-type label: PISTOL ROUND / MATCH POINT / OVERTIME / ROUND n. */
export function roundType(m, mine) {
  const need = 8, r = m.round ?? 1, se = m.scores?.ember ?? 0, st = m.scores?.tide ?? 0;
  const mp = (se === need - 1 || st === need - 1);
  if (r === 1 || r === 8) return { text: 'Pistol round', hot: false };
  if (m.overtime) return { text: 'Overtime', hot: true };
  if (mp && se === st && se === need - 1) return { text: 'Match point · both', hot: true };
  if (mp) return { text: 'Match point', hot: true };
  if ((se + st) === 7) return { text: 'Last round of half', hot: false };
  return { text: `Round ${r} / 15`, hot: false };
}
