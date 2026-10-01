// Local-player blind presentation: white-out + frozen afterimage of the moment of the flash.
// Own DOM overlay (above the 3D canvas, below the HUD) with exact per-flash timing.
export function createScreenFx(ctx) {
  let root = null, white = null, after = null, actx = null, ok = false;
  const st = { active: false, t: 0, dur: 0, hold: 0, amount: 0, wantSnap: false, level: 0, afterLevel: 0 };
  function build() {
    if (root || typeof document === 'undefined') return;
    try {
      const host = document.getElementById('app') || document.body;
      root = document.createElement('div'); root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden;contain:strict';
      after = document.createElement('canvas'); after.width = 480; after.height = 270; after.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0;filter:blur(2.5px) saturate(0.55) brightness(1.18) contrast(1.05);transform:scale(1.02)';
      white = document.createElement('div'); white.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;will-change:opacity';
      root.append(after, white); host.appendChild(root); actx = after.getContext('2d'); ok = true;
    } catch { ok = false; }
  }
  function patchRender() {
    const r = ctx.render; if (!r || r.__utilSnapPatched || typeof r.render !== 'function') return;
    try { const orig = r.render; r.render = function (...a) { const res = orig.apply(this, a); if (st.wantSnap) snapshot(); return res; }; r.__utilSnapPatched = true; } catch {}
  }
  function snapshot() {
    st.wantSnap = false; const cv = ctx.render?.renderer?.domElement; if (!cv || !actx) return;
    try { const ar = cv.height / Math.max(1, cv.width); const w = 480, h = Math.max(1, Math.round(w * ar)); if (after.height !== h) after.height = h; actx.drawImage(cv, 0, 0, w, h); st.snapped = true; } catch {}
  }
  return {
    state: st,
    /** amount 0..1, dur seconds total, hold seconds fully white */
    disabled: false,
    trigger(amount, dur, hold) {
      if (this.disabled) return;
      build(); patchRender(); st.active = true; st.t = 0; st.dur = dur; st.hold = hold; st.amount = amount; st.wantSnap = true; st.snapped = false;
    },
    update(dt) {
      if (!st.active) { if (st.level !== 0) { st.level = 0; apply(); } return; }
      st.t += dt;
      const t = st.t, u = Math.min(1, Math.max(0, (t - st.hold) / Math.max(0.01, st.dur - st.hold)));
      if (t >= st.dur) { st.active = false; st.level = 0; st.afterLevel = 0; apply(); return; }
      st.level = t < st.hold ? 1 : Math.pow(1 - u, 2.2);
      const atk = Math.min(1, t / 0.05);   // instant but not a single-frame pop
      st.level *= atk;
      st.afterLevel = t < st.hold * 0.85 ? 0 : Math.min(1, (t - st.hold * 0.85) / 0.15) * Math.pow(1 - u, 1.25) * (0.55 + 0.4 * st.amount);
      apply();
    },
    clear() { st.active = false; st.level = st.afterLevel = 0; apply(); },
    dispose() { root?.remove(); root = null; },
  };
  function apply() {
    // NOTE: ctx.render.screen.whiteout(hold) is a fire-and-forget fixed 2.4 s decay; we need per-flash timing, so we drive our own overlay.
    const own = true;
    if (ok) { white.style.opacity = own ? String(st.level.toFixed(3)) : '0'; after.style.opacity = st.snapped ? String(st.afterLevel.toFixed(3)) : '0'; }
  }
}
