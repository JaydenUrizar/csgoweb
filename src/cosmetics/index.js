// Cosmetics & Locker — owner: `cosmetics` piece. Contract: docs/ARCHITECTURE.md (CosmeticSpec) + docs/pieces/cosmetics.md.
import { buildCatalog, BY_ID, BY_CAT, RARITY } from './catalog.js';
import { resolve as resolveLoadout, defaultLoadout, normalize, cloneLoadout, randomLoadout as randomLoadoutRaw, encodeLoadout, decodeLoadout, applySet, SLOT_CATS, sameLoadout, wearOf } from './loadout.js';
import { createStore } from './store.js';
import { createLocker } from './ui/locker.js';
import { createStage } from './preview/stage.js';
import { createIngame } from './ingame.js';
import { rng as coreRng } from '../core/rng.js';

export function create(ctx) {
  const catalog = buildCatalog();
  const store = createStore();
  const stageProbe = { last: 0 };
  let locker = null;
  const lockerApi = () => (locker ??= createLocker(ctx, api));

  // ---------------------------------------------------------------- loadouts
  const used = { ember: new Map(), tide: new Map() };
  const traits = (l) => { const sp = resolveLoadout(l); return [`s:${l.suit}`, `h:${sp.helmet.shape}`, `v:${sp.visor.shape}`, `b:${sp.back.model}`, `p:${sp.suit.pattern}`, `m:${sp.suit.material}`, `c:${sp.charm.model}`]; };
  function botLoadout(actor) {
    const team = actor.team === 'tide' ? 'tide' : 'ember'; const u = used[team]; let best = null, bestScore = 1e9;
    for (let k = 0; k < 16; k++) {   // pick the candidate sharing the fewest traits (suit, headgear, visor, back, pattern, finish, charm) with teammates
      const l = normalize(randomLoadoutRaw(coreRng, team), team); let sc = 0; for (const t of traits(l)) sc += (u.get(t) ?? 0) * (t[0] === 'h' || t[0] === 'b' || t[0] === 'p' ? 2 : 1);
      if (sc < bestScore) { best = l; bestScore = sc; if (!sc) break; }
    }
    for (const t of traits(best)) u.set(t, (u.get(t) ?? 0) + 1);
    return best;
  }
  function getLoadout(actor) {
    if (!actor) return store.loadout(store.data.side);
    const team = actor.team === 'tide' ? 'tide' : 'ember';
    if (actor.isPlayer || actor === ctx.localActor) {
      const l = store.loadout(team);
      if (!actor.cosmetics || actor.cosmetics.team !== team || !sameLoadout(actor.cosmetics, l)) actor.cosmetics = cloneLoadout(l);
      return actor.cosmetics;
    }
    if (!actor.cosmetics || !actor.cosmetics.suit) actor.cosmetics = botLoadout(actor);
    else if (actor.cosmetics.team !== team) actor.cosmetics = normalize({ ...actor.cosmetics, team }, team);
    return actor.cosmetics;
  }
  function setLoadout(target, loadout, { persist = true } = {}) {
    if (typeof target === 'string') { const team = target === 'tide' ? 'tide' : 'ember'; store.setLoadout(team, loadout); refreshLocal(); return store.loadout(team); }
    const actor = target; const team = actor.team === 'tide' ? 'tide' : 'ember'; const l = normalize(loadout, team);
    actor.cosmetics = l;
    if (persist && (actor.isPlayer || actor === ctx.localActor)) store.setLoadout(team, l);
    notify(actor); return l;
  }
  function notify(actor) {
    const spec = resolveLoadout(actor.cosmetics);
    try { ctx.characters?.applyCosmetics?.(actor, spec); ctx.characters?.refreshCosmetics?.(actor, spec); } catch { /* characters piece is optional */ }
    ctx.events.emit('cosmetics:change', { actor, loadout: actor.cosmetics, spec });
  }
  function apply(actor) { const l = getLoadout(actor); actor.cosmetics = l; notify(actor); return l; }
  function refreshLocal() { const a = ctx.localActor; if (a) { a.cosmetics = null; apply(a); } }
  function randomLoadout(rng, team = 'ember', opts) { return normalize(randomLoadoutRaw(rng ?? coreRng, team, opts), team); }

  // ---------------------------------------------------------------- progression (optional, fun): stars for playing
  function award(n, why) {
    const l = ctx.localActor ? getLoadout(ctx.localActor) : store.loadout(store.data.side);
    const before = store.level().level; store.addStars(n, l);
    const after = store.level().level; ctx.events.emit('cosmetics:stars', { delta: n, why, stars: store.stars, level: after, levelUp: after > before });
  }
  const evs = ctx.events;
  evs.on?.('round:end', (e) => { const me = ctx.localActor?.team; award(e && me && e.winner === me ? 2 : 1, 'round'); });
  evs.on?.('tag:out', (e) => { if (e?.attacker && e.attacker === ctx.localActor) award(1, 'tag'); });
  evs.on?.('match:end', () => award(5, 'match'));
  evs.on?.('boot:done', () => { if (ctx.localActor) apply(ctx.localActor); });
  evs.on?.('round:start', () => { for (const a of ctx.actors ?? []) if (!a.cosmetics || a.isPlayer) apply(a); });
  evs.on?.('halftime', () => { for (const a of ctx.actors ?? []) if (a.isPlayer) apply(a); });

  // ---------------------------------------------------------------- standalone preview renderer
  const ingame = createIngame(ctx);
  const previews = new WeakMap();
  /** renderPreview(canvas, loadout, opts?) -> handle. Own mini renderer/scene. Draws once (settled) and keeps animating unless opts.live === false. */
  function renderPreview(canvas, loadout, opts = {}) {
    let h = previews.get(canvas);
    const l = normalize(loadout ?? getLoadout(ctx.localActor) ?? defaultLoadout('ember'), loadout?.team);
    const spec = resolveLoadout(l);
    if (!h) {
      const st = createStage(canvas, { ctx, fallbackOnly: true, preserve: true, name: opts.name ?? ctx.localActor?.name ?? 'PLAYER' });
      const w = canvas.clientWidth || canvas.width || 400, hh = canvas.clientHeight || canvas.height || 500; st.resize(w, hh, opts.dpr ?? 1);
      st.setFocus(opts.focus ?? 'body'); if (opts.turntable === false) st.setTurntable(false);
      h = { stage: st, raf: 0, dead: false, update(lo, o = {}) { const nl = normalize(lo, lo?.team); st.setSpec(resolveLoadout(nl), nl.team, o.name ?? ctx.localActor?.name ?? 'PLAYER'); if (o.focus) st.setFocus(o.focus); if (o.emote) st.playEmote(o.emote); if (o.tagOut) st.playTagOut(resolveLoadout(nl).tagOutEffect, 0x9be7ff); st.render(); },
        resize(w2, h2) { st.resize(w2, h2, opts.dpr ?? 1); st.render(); }, dispose() { h.dead = true; cancelAnimationFrame(h.raf); previews.delete(canvas); st.dispose(); } };
      previews.set(canvas, h);
      st.setSpec(spec, l.team, opts.name ?? ctx.localActor?.name ?? 'PLAYER');
      for (let i = 0; i < 14; i++) st.tick(0.05); st.render();
      if (opts.live !== false && !ctx.manualStepping) { let last = performance.now(); const loop = (now) => { if (h.dead) return; h.raf = requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now; if (!document.hidden && canvas.isConnected) { st.tick(dt); st.render(); } }; h.raf = requestAnimationFrame(loop); }
      else if (opts.live !== false) h.manual = true;
    } else h.update(l, opts);
    return h;
  }

  // ---------------------------------------------------------------- api
  const api = {
    catalog, store, RARITY,
    resolve: (l, o) => resolveLoadout(l ?? getLoadout(ctx.localActor), o),
    getLoadout, setLoadout, apply, refreshLocal, randomLoadout, defaultLoadout, normalize,
    encode: encodeLoadout, decode: decodeLoadout, applySet, wearOf,
    /** Returns the resolved CosmeticSpec for an actor (memoised, no per-frame allocation). */
    specFor: (actor) => resolveLoadout(getLoadout(actor)),
    ingameStats: () => ingame.stats(),
    persistentStars: () => store.stars, award,
    renderPreview,
    openLocker: (o) => lockerApi().open(o), closeLocker: () => locker?.close(), toggleLocker() { const l = lockerApi(); l.isOpen() ? l.close() : l.open(); }, get lockerOpen() { return !!locker?.isOpen(); },
    update(dt) { try { ingame.update(dt); } catch (e) { ctx.errors?.push?.('cosmetics ingame: ' + (e?.stack || e)); } scanT -= dt; if (scanT <= 0) { scanT = 0.5; for (const a of ctx.actors ?? []) if (!a.cosmetics || a.cosmetics.team !== a.team) apply(a); } for (const h of [...(managed)]) if (h.manual) { h.stage.tick(dt); h.stage.render(); } },
    dispose() { locker?.dispose(); ingame.dispose(); },
  };
  const managed = new Set();
  let scanT = 0;
  api.debug = {
    get locker() { return lockerApi().debug; }, lockerApi: () => lockerApi(), store,
    /** all catalog items, ids only */
    ids: () => catalog.all.map((i) => i.id),
    randomSpecs: (n = 8, team = 'ember', seed = 1) => { coreRng.seed(seed); return Array.from({ length: n }, () => resolveLoadout(randomLoadout(coreRng, team))); },
  };

  // debug scene(s): ?scene=locker (& optional &lockertab=skin&side=tide)
  ctx.debugScenes ??= {};
  ctx.debugScenes.locker = async (c) => {
    const tab = c.params.get('lockertab') || c.params.get('tab') || undefined, side = c.params.get('side') || undefined;
    api.openLocker({ cat: tab, side });
    if (c.manualStepping) api.debug.locker.settle(1.6);
  };
  ctx.debugScenes['locker-preview'] = async (c) => {   // bare 3D preview filling the window (no UI)
    const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:900'; document.getElementById('ui').appendChild(cv);
    const team = c.params.get('side') === 'tide' ? 'tide' : 'ember'; coreRng.seed(+(c.params.get('seed') || 1));
    const l = c.params.get('random') ? randomLoadout(coreRng, team) : getLoadout({ team, isPlayer: true, cosmetics: null });
    const h = renderPreview(cv, l, { live: !c.manualStepping }); if (c.manualStepping) { managed.add(h); for (let i = 0; i < 20; i++) h.stage.tick(0.05); h.stage.render(); }
    window.__preview = h;
  };
  return api;
}
