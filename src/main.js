import { createEvents } from './core/events.js';
import { createInput } from './core/input.js';
import { createEngine } from './core/engine.js';
import { createSettings } from './core/settings.js';
import { rng } from './core/rng.js';
import { MODULES } from './modules.js';
import { stub } from './core/stub.js';

// Global context handed to every module. See docs/ARCHITECTURE.md.
const ctx = {
  params: new URLSearchParams(location.search),
  actors: [], localActor: null, manualStepping: false, modules: {}, errors: (window.__errors = window.__errors || []),
};
ctx.events = createEvents();
ctx.settings = createSettings(ctx);
ctx.input = createInput(ctx);
ctx.engine = createEngine(ctx);
if (ctx.params.get('seed')) rng.seed(+ctx.params.get('seed'));
if (ctx.params.get('test')) { ctx.manualStepping = true; ctx.input.fakeLock = true; }   // ?test=1 → deterministic, driven by window.__game.advance()

window.addEventListener('error', (e) => ctx.errors.push(`${e.message} @ ${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => ctx.errors.push('unhandled: ' + (e.reason?.stack || e.reason)));

async function boot() {
  for (const [key, load] of MODULES) {
    try {
      const mod = await load();
      const api = mod.create(ctx) || stub(key);
      ctx[key] = api; ctx.modules[key] = api;
    } catch (e) {
      console.error(`[boot] module "${key}" failed`, e); ctx.errors.push(`boot:${key}: ${e?.stack || e}`);
      ctx[key] = stub(key); ctx[key].failed = true; ctx.modules[key] = ctx[key];
    }
    if (ctx[key].fixedUpdate || ctx[key].update) ctx.engine.add(ctx[key], MODULES.findIndex((m) => m[0] === key));
  }
  ctx.events.emit('boot:done');
  ctx.engine.start();
  ctx.ready = true;
}

// Debug / test API used by tools/*.mjs and by critics. Keep stable.
window.__game = {
  ctx,
  get ready() { return !!ctx.ready; },
  advance: (s, o) => ctx.engine.advance(s, o),
  render: () => ctx.render.render(),
  errors: () => ctx.errors.slice(),
  fps: () => 1 / ctx.engine.dtSmooth,
  /** Put the local actor somewhere and look somewhere. */
  place(x, y, z, yaw = 0, pitch = 0) { const a = ctx.localActor; if (!a) return; a.pos.set(x, y, z); a.yaw = yaw; a.pitch = pitch; a.vel.set(0, 0, 0); },
  hold: (actions) => ctx.input.inject(actions),
  look: (dx, dy) => ctx.input.inject({}, { dx, dy }),
};
boot().catch((e) => { console.error(e); ctx.errors.push('boot fatal: ' + (e?.stack || e)); });
