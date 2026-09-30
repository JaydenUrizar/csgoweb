// Module registry. Order matters: later modules may use earlier ones through ctx.
// Each entry: [ctxKey, () => import(file)]. A module file exports `create(ctx)` and returns its API
// (assigned to ctx[ctxKey]). Optional API hooks: fixedUpdate(dt), update(dt, alpha), dispose().
// A module that throws in create() is replaced by a null-object so the game still boots.
export const MODULES = [
  ['render',     () => import('./render/index.js')],       // renderer, scene, camera, post-fx, lights, sky, materials
  ['map',        () => import('./world/index.js')],        // level geometry, collision BVH, spawns, sites, callouts
  ['nav',        () => import('./ai/nav.js')],             // navgrid / waypoints / pathfinding over ctx.map
  ['characters', () => import('./characters/index.js')],   // actor models, animation, hitboxes, tag-out effect
  ['cosmetics',  () => import('./cosmetics/index.js')],    // loadouts, unlocks, locker rendering data
  ['vfx',        () => import('./vfx/index.js')],          // particles, tracers, impacts, decals, screen fx
  ['audio',      () => import('./audio/index.js')],        // procedural sfx, music, spatial mix
  ['combat',     () => import('./combat/index.js')],       // taggers (weapons), hitscan, damage, viewmodel, utility
  ['player',     () => import('./player/index.js')],       // human controller: movement, camera, input -> actor
  ['ai',         () => import('./ai/bots.js')],            // bot brains
  ['match',      () => import('./match/index.js')],        // rounds, economy, objective, buy, scoreboard state
  ['hud',        () => import('./ui/hud/index.js')],       // in-game HUD
  ['menu',       () => import('./ui/menu/index.js')],      // main menu, settings, pause, locker UI, loading
];
