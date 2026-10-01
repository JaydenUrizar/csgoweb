// Loadout model: normalise / resolve to CosmeticSpec / random / share codes. Pure functions, no DOM, no three.
import { BY_ID, BY_CAT, CATEGORIES, RARITY, RARITY_LIST, SETS, SET_BY_ID, WEARS, hue } from './catalog.js';

export const SLOT_CATS = CATEGORIES.map((c) => c.id);      // suit helmet visor pattern back trail tagOut skin charm nameplate emote
export const TEAM_HUE = { ember: 24, tide: 195 };
const other = (t) => (t === 'tide' ? 'ember' : 'tide');

const DEFAULTS = {
  ember: { suit: 'suit-clay',   helmet: 'helm-sport', visor: 'vis-slit',  pattern: 'pat-auto', back: 'back-pack', trail: 'trail-none', tagOut: 'out-shatter', skin: 'skin-hazard',  charm: 'charm-cube', nameplate: 'plate-plain', emote: 'wave' },
  tide:  { suit: 'suit-harbor', helmet: 'helm-sport', visor: 'vis-wide',  pattern: 'pat-auto', back: 'back-pack', trail: 'trail-none', tagOut: 'out-shatter', skin: 'skin-factory', charm: 'charm-orb',  nameplate: 'plate-plain', emote: 'wave' },
};

export function defaultLoadout(team = 'ember') {
  return { team, ...DEFAULTS[team === 'tide' ? 'tide' : 'ember'], skinWear: 0.03 };
}

/** Coerce anything into a valid loadout (unknown ids fall back to the team default). */
export function normalize(l, team) {
  const t = team ?? l?.team ?? 'ember';
  const d = defaultLoadout(t);
  const out = { team: t };
  for (const c of SLOT_CATS) out[c] = BY_ID[l?.[c]]?.cat === c ? l[c] : d[c];
  out.skinWear = Number.isFinite(l?.skinWear) ? Math.min(1, Math.max(0, l.skinWear)) : d.skinWear;
  return out;
}
export const cloneLoadout = (l) => ({ ...l });
export const loadoutKey = (l) => `${l.team}|${SLOT_CATS.map((c) => l[c]).join('|')}|${(l.skinWear ?? 0).toFixed(3)}`;
export function sameLoadout(a, b) { return loadoutKey(a) === loadoutKey(b); }
export function wearOf(v) { let best = WEARS[0]; for (const w of WEARS) if (v >= w.value - 0.001) best = w; return best; }

// ---- team readability guard -------------------------------------------------------------------------------
function hsl(c) {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [hue(c), s, l];
}
function fromHsl(h, s, l) {
  if (h < 0) h = 0;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
/** If the suit body colour is a saturated hue of the ENEMY team, mute it so silhouettes stay team-readable. */
export function teamGuardColor(color, team) {
  const [h, s, l] = hsl(color);
  if (h < 0 || s < 0.42 || l < 0.12 || l > 0.9) return color;
  if (hueDist(h, TEAM_HUE[other(team)]) > 30) return color;
  return fromHsl(h, s * 0.34, l * 0.82);
}

// ---- resolve -> CosmeticSpec (docs/ARCHITECTURE.md) ------------------------------------------------------
const specCache = new Map();
export function resolve(loadout, { guard = true } = {}) {
  const l = normalize(loadout);
  const key = loadoutKey(l) + (guard ? 'g' : '');
  let spec = specCache.get(key);
  if (spec) return spec;
  const it = {}; for (const c of SLOT_CATS) it[c] = BY_ID[l[c]];
  const suit = it.suit, pat = it.pattern;
  const patKind = pat.pattern === 'auto' ? suit.pattern : pat.pattern;
  const patColor = pat.pattern === 'auto' || pat.color == null ? suit.accent : pat.color;
  const rarityRank = Math.max(...SLOT_CATS.map((c) => it[c].rarityInfo.rank));
  spec = {
    suit: { base: guard ? teamGuardColor(suit.base, l.team) : suit.base, accent: suit.accent, pattern: patKind, patternColor: patColor, material: suit.material },
    helmet: { shape: it.helmet.shape, color: it.helmet.color, accent: it.helmet.accent },
    visor: { shape: it.visor.shape, color: it.visor.color, glow: it.visor.glow },
    back: { model: it.back.model, color: it.back.color },
    trail: { type: it.trail.type, color: it.trail.color, color2: it.trail.color2 },
    tagOutEffect: it.tagOut.effect,
    taggerSkin: { pattern: it.skin.pattern, primary: it.skin.primary, accent: it.skin.accent, glow: it.skin.glow, wear: l.skinWear },
    charm: { model: it.charm.model, color: it.charm.color },
    nameplate: { style: it.nameplate.style, color: it.nameplate.color },
    emote: it.emote.anim,
    rarity: RARITY_LIST[rarityRank],
  };
  // extra (non-schema) info for UI/debug; non-enumerable so consumers iterating the spec never see it
  Object.defineProperty(spec, '_meta', { value: { team: l.team, ids: Object.fromEntries(SLOT_CATS.map((c) => [c, l[c]])), tagOutColor: it.tagOut.color, wear: wearOf(l.skinWear) }, enumerable: false });
  if (specCache.size > 400) specCache.clear();
  specCache.set(key, spec);
  return spec;
}

// ---- random ---------------------------------------------------------------------------------------------
function nextOf(rng) { return typeof rng === 'function' ? rng() : typeof rng?.next === 'function' ? rng.next() : typeof rng?.r === 'function' ? rng.r() : Math.random(); }
function weighted(rng, list, weightFn) {
  let tot = 0; for (const x of list) tot += weightFn(x);
  let r = nextOf(rng) * tot;
  for (const x of list) { r -= weightFn(x); if (r <= 0) return x; }
  return list[list.length - 1];
}
/** Team-aware, theme-coherent random loadout: a themed set most of the time (biased to the team's palette), with mixed-in extras. */
export function randomLoadout(rng, team = 'ember', { rarityBoost = 0 } = {}) {
  const t = team === 'tide' ? 'tide' : 'ember';
  const enemy = other(t);
  const out = { team: t };
  const themed = SETS.filter((s) => s.id !== 'issue' && s.team !== enemy);
  const chosenSet = nextOf(rng) < 0.68 ? weighted(rng, themed, (s) => (s.team === t ? 3 : 1.4)) : null;
  const inSet = (c) => chosenSet ? BY_CAT[c].filter((i) => i.set === chosenSet.id) : [];
  for (const c of SLOT_CATS) {
    let pool = BY_CAT[c];
    let candidates = pool.filter((i) => i.team !== enemy);
    if (!candidates.length) candidates = pool;
    const own = inSet(c).filter((i) => i.team !== enemy || i.set === chosenSet?.id);
    // 78% take the set item if the set has one for this slot
    if (own.length && nextOf(rng) < 0.82) { out[c] = weighted(rng, own, (i) => 8 + RARITY[i.rarity].weight).id; continue; }
    if (c === 'pattern' && nextOf(rng) < 0.5) { out[c] = 'pat-auto'; continue; }
    out[c] = weighted(rng, candidates, (i) => RARITY[i.rarity].weight * (1 + rarityBoost * i.rarityInfo.rank * 0.5) * (i.team === t ? 1.5 : 1)).id;
  }
  // bots love a moment of skin wear variety; suits the cosmetic always resolves through the team guard
  out.skinWear = WEARS[Math.floor(nextOf(rng) * WEARS.length)].value;
  return out;
}

// ---- share code ---------------------------------------------------------------------------------------------
const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const enc2 = (n) => B36[Math.floor(n / 36) % 36] + B36[n % 36];
const dec2 = (s) => B36.indexOf(s[0]) * 36 + B36.indexOf(s[1]);
function checksum(str) { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 1296; return enc2(h); }
export function encodeLoadout(l) {
  const n = normalize(l);
  let body = n.team === 'tide' ? 't' : 'e';
  for (const c of SLOT_CATS) body += enc2(BY_ID[n[c]].n);
  body += B36[Math.round(n.skinWear * 35)];
  const all = (body + checksum(body)).toUpperCase();
  return 'FLUX-' + all.match(/.{1,4}/g).join('-');
}
export function decodeLoadout(code) {
  if (typeof code !== 'string') return null;
  let s = code.trim().toLowerCase().replace(/^flux/, '').replace(/[^0-9a-z]/g, '');
  if (s.length !== 1 + SLOT_CATS.length * 2 + 1 + 2) return null;
  const body = s.slice(0, -2);
  if (checksum(body) !== s.slice(-2)) return null;
  const team = body[0] === 't' ? 'tide' : body[0] === 'e' ? 'ember' : null; if (!team) return null;
  const l = { team };
  SLOT_CATS.forEach((c, i) => { const idx = dec2(body.slice(1 + i * 2, 3 + i * 2)); const it = BY_CAT[c][idx]; if (it) l[c] = it.id; });
  const w = B36.indexOf(body[body.length - 1]); l.skinWear = w >= 0 ? w / 35 : 0.03;
  return normalize(l, team);
}
export function setCompletion(l, setId) {
  const s = SET_BY_ID[setId]; const have = s.items.filter((id) => SLOT_CATS.some((c) => l[c] === id)).length; return { have, total: s.items.length };
}
/** Equip a whole set: each slot that the set has an item for gets the set's item. */
export function applySet(l, setId) {
  const out = { ...l };
  for (const id of SET_BY_ID[setId].items) { const it = BY_ID[id]; out[it.cat] = id; }
  return out;
}
