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

// ---- team adaptation: spec colours are made team-appropriate here (the in-game material applies the same bands) ------
function hsl(c) {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [hue(c) < 0 ? 0 : hue(c) / 360, s, l];
}
export function fromHsl(h, s, l) {
  h = ((h % 1) + 1) % 1 * 360;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}
const TEAM_H = { ember: hsl(0xff7a2f)[0], tide: hsl(0x2fd0ff)[0] };
const wrapH = (d) => d - Math.round(d);
const cl = (v, a, b) => Math.min(b, Math.max(a, v));
/** Suit body: team hue band (+-0.03), authored lightness/saturation remapped into the playable range so suits keep their own tone. */
export function teamBase(color, team) {
  const [h, s, l] = hsl(color); const th = TEAM_H[team] ?? TEAM_H.ember;
  const grey = s < 0.08;
  const nl = 0.36 + 0.11 * cl((l - 0.06) / 0.62, 0, 1), ns = 0.6 + 0.3 * cl(s, 0, 1);
  return fromHsl(th + (grey ? 0 : cl(wrapH(h - th), -0.03, 0.03)), ns, nl);
}
export function teamAccent(color) { const [h, s, l] = hsl(color); return fromHsl(h, Math.min(s, 0.55), Math.max(l, 0.72)); }
export const teamHelmet = (color) => { const [h, s, l] = hsl(color); return fromHsl(h, Math.min(s, 0.6), Math.max(l, 0.55)); };
export const teamBack = (color) => { const [h, s, l] = hsl(color); return fromHsl(h, Math.min(s, 0.7), cl(l, 0.3, 0.55)); };
export const teamGuardColor = (c, team) => teamBase(c, team);

const toLin = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4), toSrgb = (c) => c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
const TEAM_HEX = { ember: 0xff7a2f, tide: 0x2fd0ff };
/** characters lerps the visor glow 50% toward the team colour; pre-compensate so the visor you picked is the visor you see (clamped to gamut). */
export function visorCompensate(color, team) {
  const t = TEAM_HEX[team] ?? TEAM_HEX.ember; let out = 0;
  for (const sh of [16, 8, 0]) { const d = toLin(((color >> sh) & 255) / 255), tc = toLin(((t >> sh) & 255) / 255); const v = Math.min(1, Math.max(0, 2 * d - tc)); out |= Math.round(toSrgb(v) * 255) << sh; }
  return out;
}
/** Pattern colour with strong contrast against the (team-banded) suit body so patterns read in game. */
export function patternContrast(color, baseL) {
  const [h, s] = hsl(color); const l = baseL < 0.44 ? 0.9 : 0.12;
  return fromHsl(h, Math.max(0.35, Math.min(0.9, s)), l);
}
// ---- resolve -> CosmeticSpec (docs/ARCHITECTURE.md) ------------------------------------------------------
const specCache = new Map();
export function resolve(loadout, opt) {
  const guard = opt?.guard !== false; const l = normalize(loadout, typeof opt === 'string' ? opt : undefined);
  const key = loadoutKey(l) + (guard ? 'g' : '');
  let spec = specCache.get(key);
  if (spec) return spec;
  const it = {}; for (const c of SLOT_CATS) it[c] = BY_ID[l[c]];
  const suit = it.suit, pat = it.pattern;
  const patKind = pat.pattern === 'auto' ? suit.pattern : pat.pattern;
  let patColor = pat.pattern === 'auto' || pat.color == null ? suit.accent : pat.color;
  const rarityRank = Math.max(...SLOT_CATS.map((c) => it[c].rarityInfo.rank));
  const sBase = guard ? teamBase(suit.base, l.team) : suit.base;
  if (guard && patKind !== 'solid') patColor = patternContrast(patColor, hsl(sBase)[2]);
  spec = {
    suit: { base: sBase, accent: guard ? teamAccent(suit.accent) : suit.accent, pattern: patKind, patternColor: patColor, material: suit.material },
    helmet: { shape: it.helmet.shape, color: guard ? teamHelmet(it.helmet.color) : it.helmet.color, accent: it.helmet.accent },
    visor: { shape: it.visor.shape, color: it.visor.color, glow: guard ? visorCompensate(it.visor.glow, l.team) : it.visor.glow },
    back: { model: it.back.model, color: guard ? teamBack(it.back.color) : it.back.color },
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
  body += enc2(Math.round(n.skinWear * 1000));
  const all = (body + checksum(body)).toUpperCase();
  return 'FLUX-' + all.match(/.{1,4}/g).join('-');
}
export function decodeLoadout(code) {
  if (typeof code !== 'string') return null;
  let s = code.trim().toLowerCase().replace(/^flux/, '').replace(/[^0-9a-z]/g, '');
  if (s.length !== 1 + SLOT_CATS.length * 2 + 2 + 2) return null;
  const body = s.slice(0, -2);
  if (checksum(body) !== s.slice(-2)) return null;
  const team = body[0] === 't' ? 'tide' : body[0] === 'e' ? 'ember' : null; if (!team) return null;
  const l = { team };
  SLOT_CATS.forEach((c, i) => { const idx = dec2(body.slice(1 + i * 2, 3 + i * 2)); const it = BY_CAT[c][idx]; if (it) l[c] = it.id; });
  const w = dec2(body.slice(-2)); l.skinWear = w >= 0 && w <= 1000 ? w / 1000 : 0.03;
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
