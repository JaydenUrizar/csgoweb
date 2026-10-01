// Shared helpers for the HUD: math, DOM, palettes, actor/inventory normalisation, tiny event bus.
import { TEAMS } from '../../core/config.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
export const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeOutBack = (t) => { const c = 1.9; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
export const smooth = (t) => t * t * (3 - 2 * t);

export function h(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
/** Returns a setter that only touches the DOM when the value changed. */
export function txt(node) { let l; return (v) => { if (v !== l) { l = v; node.textContent = v; } }; }
export function flag(node, name) { let l; return (v) => { v = !!v; if (v !== l) { l = v; node.classList.toggle(name, v); } }; }
export function style(node, prop) { let l; return (v) => { if (v !== l) { l = v; node.style[prop] = v; } }; }
export function tf(node) { let l; return (v) => { if (v !== l) { l = v; node.style.transform = v; } }; }

export function reasonLabel(r) {
  r = String(r || ''); if (/^(buy|refund)/.test(r)) return '';
  return ({ win: 'Round win', loss: 'Round loss', tag: 'Tag', teamtag: 'Team tag', plant: 'Beacon armed', disarm: 'Beacon disarmed' })[r] || r;
}
export const fmtTime = (s) => { s = Math.max(0, Math.ceil(s - 1e-6)); return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`; };
export const fmtMoney = (n) => '$' + Math.round(n).toLocaleString('en-US');

export function bus() {
  const m = new Map();
  return {
    on(t, f) { (m.get(t) || m.set(t, []).get(t)).push(f); },
    emit(t, d) { const a = m.get(t); if (!a) return; for (let i = 0; i < a.length; i++) { try { a[i](d, t); } catch (e) { console.error('[hud]', t, e); (window.__errors ||= []).push('hud:' + t + ': ' + (e?.stack || e)); } } },
  };
}

// ---------------------------------------------------------------- palettes / colourblind
export const PALETTES = {
  off:  { ember: '#ff7a2f', tide: '#2fd0ff', ok: '#7dff9b', warn: '#ffc93d', bad: '#ff4d4d' },
  deut: { ember: '#ffc21a', tide: '#3d84ff', ok: '#4dc3ff', warn: '#ffd23d', bad: '#ff8a2a' },
  prot: { ember: '#ffd21a', tide: '#3d78ff', ok: '#59c8ff', warn: '#ffe14d', bad: '#ff9a3d' },
  trit: { ember: '#ff4d6a', tide: '#3ce6c8', ok: '#3ce6c8', warn: '#ffb03d', bad: '#ff4d6a' },
};
export function paletteKey(v) {
  v = String(v || 'off').toLowerCase();
  if (v.startsWith('deut')) return 'deut'; if (v.startsWith('prot')) return 'prot'; if (v.startsWith('trit') || v.startsWith('tetar')) return 'trit';
  return 'off';
}
export function hexRgb(hex) { const n = parseInt(String(hex).replace('#', ''), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function applyPalette(root, key, playerTeam) {
  const p = PALETTES[key] || PALETTES.off;
  const s = root.style;
  for (const t of ['ember', 'tide']) { s.setProperty('--' + t, p[t]); s.setProperty('--' + t + '-rgb', hexRgb(p[t]).join(',')); }
  s.setProperty('--ok', p.ok); s.setProperty('--warn', p.warn); s.setProperty('--bad', p.bad);
  const mine = playerTeam === 'tide' ? 'tide' : 'ember', foe = mine === 'ember' ? 'tide' : 'ember';
  s.setProperty('--ally', p[mine]); s.setProperty('--foe', p[foe]);
  s.setProperty('--ally-rgb', hexRgb(p[mine]).join(',')); s.setProperty('--foe-rgb', hexRgb(p[foe]).join(','));
  return p;
}
export const teamHex = (pal, team) => (pal || PALETTES.off)[team === 'tide' ? 'tide' : 'ember'] || TEAMS[team]?.css || '#fff';
export const teamName = (team) => TEAMS[team]?.name || String(team || '').toUpperCase();

// ---------------------------------------------------------------- actor helpers
let _hash = 0;
export function hashStr(s) { let x = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
export const fakePing = (a) => (a?.isBot ? 0 : 14 + (hashStr(a?.name || 'x') % 31));

/** Normalise an actor's inventory into [{slot, id, count, cur}] using combat.inventory / actor.inventory (tolerant). */
export function readLoadout(R, actor, out = []) {
  out.length = 0; if (!actor) return out;
  let inv = null; try { inv = R.combat?.inventory?.(actor); } catch {}
  inv = inv || actor.inventory; if (!inv) return out;
  const eqp = R.combat?.equipped?.(actor); const cur = (typeof inv.current === 'string' ? inv.current : null) || eqp?.id || idOf(eqp?.def) || idOf(inv.current);
  const seen = new Set();
  const push = (slot, v, count) => {
    const id = idOf(v); if (!id || seen.has(id + slot)) return; seen.add(id + slot);
    out.push({ slot, id, count: count ?? (typeof v === 'object' && v ? v.count ?? v.n : undefined) ?? 1, cur: id === cur });
  };
  const s = inv.slots;
  if (s) {
    const entries = Array.isArray(s) ? s.map((v, i) => [i + 1, v]) : Object.entries(s);
    for (const [k, v] of entries) {
      if (!v) continue;
      const slot = slotNum(k, v); if (Array.isArray(v)) { for (const u of v) push(slot, u); } else push(slot, v);
    }
  }
  if (Array.isArray(inv.utility)) { for (const u of inv.utility) push(4, u); }
  else if (inv.utility && typeof inv.utility === 'object') { for (const [k, v] of Object.entries(inv.utility)) if (v) push(4, k, typeof v === 'number' ? v : v.count ?? 1); }
  if (actor.hasBeacon && !seen.has('beacon5')) push(5, 'beacon');
  if (inv.kit && !seen.has('kit5')) push(5, 'kit');
  out.sort((a, b) => a.slot - b.slot);
  return out;
}
export function idOf(v) { return !v ? null : typeof v === 'string' ? v : v.id || v.def?.id || v.name?.toLowerCase?.() || null; }
const SLOTS = { primary: 1, main: 1, secondary: 2, sidearm: 2, pistol: 2, grip: 3, melee: 3, utility: 4, util: 4, grenade: 4, gear: 5, beacon: 5, kit: 5 };
function slotNum(k, v) { if (typeof k === 'number') return k; const n = +k; if (!Number.isNaN(n)) return n; return SLOTS[String(k).toLowerCase()] || (typeof v === 'object' && v?.slot) || 1; }
export function ownsId(R, actor, id) { const a = readLoadout(R, actor, []); return a.some((x) => x.id === id); }
