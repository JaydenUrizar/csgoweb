// Screen-space effects. Everything routes to ctx.render.screen.* when the render piece provides it; otherwise a tiny
// DOM overlay reproduces flash / whiteout / tint / damage so the game stays readable with a stubbed renderer.
const css = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');

export function createScreen(ctx) {
  let el = null, dmg = null, ready = false;
  const st = { flash: 0, fcol: 0xffffff, fdecay: 3, white: 0, whiteHold: 0, tint: 0, tcol: 0xff2030, dmg: 0, dang: 0 };
  const native = () => ctx.render?.screen;
  function build() {
    if (ready) return; ready = true;
    const host = document.getElementById('ui') || document.body;
    el = document.createElement('div'); el.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;z-index:3;mix-blend-mode:normal';
    dmg = document.createElement('div'); dmg.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;z-index:3';
    host.appendChild(el); host.appendChild(dmg);
  }
  const api = {
    flash(color = 0xffffff, amount = 1, decay = 3) { const s = native(); if (s?.flash) return s.flash(color, amount, decay); build(); st.fcol = color; st.flash = Math.max(st.flash, amount); st.fdecay = decay; },
    whiteout(t = 1.5) { const s = native(); if (s?.whiteout) return s.whiteout(t); build(); st.whiteHold = Math.max(st.whiteHold, t); st.white = 1; },
    blur(a) { native()?.blur?.(a); },
    tint(color, amount) { const s = native(); if (s?.tint) return s.tint(color, amount); build(); st.tcol = color; st.tint = amount; },
    damage(dirRad = 0, amount = 0.3) { const s = native(); if (s?.damage) return s.damage(dirRad, amount); build(); st.dmg = Math.min(1, st.dmg + amount); st.dang = dirRad; },
    shake(a = 0.2, decay = 6) { ctx.render?.shake?.(a, decay); },
    clear() { native()?.clear?.(); st.flash = st.white = st.whiteHold = st.tint = st.dmg = 0; },
    /** named dispatcher used by ctx.vfx.screen(name, params) */
    run(name, p = {}) {
      switch (name) {
        case 'flash': api.flash(p.color ?? 0xffffff, p.amount ?? 0.4, p.decay ?? 4); break;
        case 'whiteout': api.whiteout(p.t ?? p.seconds ?? 1.2); break;
        case 'blur': api.blur(p.amount ?? 0.5); break;
        case 'tint': api.tint(p.color ?? 0xff2030, p.amount ?? 0.1); break;
        case 'damage': api.damage(p.dir ?? 0, p.amount ?? 0.3); break;
        case 'shake': api.shake(p.amount ?? 0.25, p.decay ?? 6); break;
        case 'pulse': api.flash(p.color ?? 0xffffff, p.amount ?? 0.35, 5); api.shake(p.shake ?? 0.5); break;
        case 'hit': api.flash(p.color ?? 0xffffff, p.amount ?? 0.05, 9); break;
        case 'clear': api.clear(); break;
        default: break;
      }
    },
    update(dt) {
      if (!ready) return;
      let a = 0, col = st.fcol;
      if (st.flash > 0.002) { a = Math.min(1, st.flash); st.flash *= Math.exp(-st.fdecay * dt); } else st.flash = 0;
      if (st.whiteHold > 0 || st.white > 0.002) {
        if (st.whiteHold > 0) st.whiteHold -= dt; else st.white *= Math.exp(-1.6 * dt);
        if (st.white > a) { a = st.white; col = 0xffffff; }
      }
      if (st.tint > 0.001 && a < st.tint) { a = st.tint; col = st.tcol; }
      el.style.background = css(col); el.style.opacity = a.toFixed(3);
      if (st.dmg > 0.003) { st.dmg *= Math.exp(-3.5 * dt); dmg.style.opacity = Math.min(1, st.dmg * 1.4).toFixed(3); dmg.style.background = 'radial-gradient(ellipse at center, rgba(255,40,50,0) 55%, rgba(255,40,50,.85) 100%)'; } else { st.dmg = 0; dmg.style.opacity = '0'; }
    },
  };
  return api;
}
