import { PHYS_HZ } from './config.js';
// Owns the frame loop. Modules register with engine.add({ fixedUpdate(dt), update(dt, alpha), render? }).
// Deterministic test stepping: engine.advance(seconds) runs sim without wall-clock (used by tools/*).
export function createEngine(ctx) {
  const systems = [];
  const STEP = 1 / PHYS_HZ;
  let acc = 0, last = performance.now(), running = true, raf = 0;
  const engine = {
    time: 0, tick: 0, timeScale: 1, frame: 0, dtSmooth: 1 / 60, paused: false,
    add(sys, priority = 0) { sys.__prio = priority; systems.push(sys); systems.sort((a, b) => a.__prio - b.__prio); return sys; },
    remove(sys) { const i = systems.indexOf(sys); if (i >= 0) systems.splice(i, 1); },
    stepFixed() {
      for (const s of systems) s.fixedUpdate?.(STEP);
      engine.time += STEP; engine.tick++;
    },
    frameUpdate(dt, alpha) { for (const s of systems) s.update?.(dt, alpha); },
    /** Advance simulation by `seconds` of game time then render once. */
    advance(seconds, { render = true } = {}) {
      const n = Math.max(1, Math.round(seconds * PHYS_HZ));
      for (let i = 0; i < n; i++) { engine.stepFixed(); if (i % 2 === 1 || i === n - 1) { engine.frameUpdate(STEP * 2, 1); ctx.input.endFrame(); } }
      if (render) ctx.render?.render?.();
    },
    loop(now) {
      raf = requestAnimationFrame(engine.loop);
      let dt = Math.min(0.1, (now - last) / 1000); last = now;
      engine.dtSmooth += (dt - engine.dtSmooth) * 0.05;
      if (engine.paused || ctx.manualStepping) return;
      dt *= engine.timeScale; acc += dt;
      let n = 0;
      while (acc >= STEP && n++ < 12) { engine.stepFixed(); acc -= STEP; }
      if (n >= 12) acc = 0;
      engine.frameUpdate(dt, acc / STEP);
      ctx.render?.render?.();
      engine.frame++;
      ctx.input.endFrame();
    },
    start() { last = performance.now(); raf = requestAnimationFrame(engine.loop); },
    stop() { cancelAnimationFrame(raf); },
  };
  return engine;
}
