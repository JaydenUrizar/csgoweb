// Persistence (localStorage, always try/catch) + slots + optional "earn stars" progression.
import { defaultLoadout, normalize, cloneLoadout, SLOT_CATS } from './loadout.js';
const KEY = 'fluxtag.cosmetics.v1';
export const SLOT_COUNT = 4;
export const STAR_LEVELS = (lvl) => 6 + lvl * 4;         // stars needed to go from level `lvl` to `lvl+1`

export function createStore() {
  const blank = () => ({
    v: 1, active: 0, side: 'ember',
    slots: Array.from({ length: SLOT_COUNT }, (_, i) => ({ name: `Loadout ${i + 1}`, ember: defaultLoadout('ember'), tide: defaultLoadout('tide') })),
    stars: 0, itemStars: {}, seen: {}, tagOutsWith: {},
  });
  let data = blank();
  let mem = null;                         // fallback if storage is unavailable
  try {
    const raw = (typeof localStorage !== 'undefined') && localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.v === 1) {
        data = Object.assign(blank(), d);
        data.slots = Array.from({ length: SLOT_COUNT }, (_, i) => {
          const s = d.slots?.[i] ?? {};
          return { name: typeof s.name === 'string' ? s.name.slice(0, 24) : `Loadout ${i + 1}`, ember: normalize(s.ember, 'ember'), tide: normalize(s.tide, 'tide') };
        });
        data.active = Math.min(SLOT_COUNT - 1, Math.max(0, d.active | 0));
        if (data.side !== 'tide') data.side = 'ember';
      }
    }
  } catch { mem = true; }
  let saveTimer = 0;
  const flush = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { mem = true; } };
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 120); };
  const store = {
    data,
    get persistent() { return !mem; },
    slot: (i = data.active) => data.slots[i],
    loadout: (team, i = data.active) => data.slots[i][team],
    setLoadout(team, l, i = data.active) { data.slots[i][team] = normalize(l, team); save(); },
    setActive(i) { data.active = Math.min(SLOT_COUNT - 1, Math.max(0, i | 0)); save(); },
    setSide(s) { data.side = s === 'tide' ? 'tide' : 'ember'; save(); },
    rename(i, name) { data.slots[i].name = String(name).slice(0, 24) || `Loadout ${i + 1}`; save(); },
    // stars ---------------------------------------------------------------------------------------
    get stars() { return data.stars; },
    addStars(n, loadout) {
      data.stars += n;
      if (loadout) for (const c of SLOT_CATS) { const id = loadout[c]; data.itemStars[id] = (data.itemStars[id] ?? 0) + n; }
      save();
    },
    level() { let lvl = 1, left = data.stars; while (left >= STAR_LEVELS(lvl)) { left -= STAR_LEVELS(lvl); lvl++; } return { level: lvl, into: left, need: STAR_LEVELS(lvl) }; },
    itemStars: (id) => data.itemStars[id] ?? 0,
    markSeen(ids) { let ch = false; for (const id of ids) if (!data.seen[id]) { data.seen[id] = 1; ch = true; } if (ch) save(); },
    isSeen: (id) => !!data.seen[id],
    flush, reset() { data.slots = blank().slots; data.active = 0; flush(); },
  };
  return store;
}
