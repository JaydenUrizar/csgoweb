// Centre-screen canvas: crosshair (dynamic gap), hit markers, damage-direction arcs. Plus sniper scope overlay.
// Everything is drawn in raw device pixels so 1-2 px lines stay razor sharp at any HUD scale.
import { clamp, damp, easeOut, h, hexRgb } from './core.js';

export const css = `
.fx-cv{position:fixed;left:50%;top:50%;pointer-events:none;transform:translate(-50%,-50%)}
.scope{position:fixed;inset:0;pointer-events:none;opacity:0;will-change:opacity}
.scope svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.scope .sc-zoom{position:absolute;left:50%;top:calc(50% + 2px);transform:translate(-50%,0);font:600 12px/1 var(--font);letter-spacing:.18em;color:rgba(255,255,255,.55);text-shadow:0 1px 2px #000}
`;

const SIZE = 720; // css px of the canvas square
const MAXHIT = 6, MAXDMG = 8;

export function create(H) {
  const cv = h('canvas', 'fx-cv', H.abs);
  const c2 = cv.getContext('2d');
  const scope = h('div', 'scope', H.abs);
  const sv = h('div', '', scope);
  const zoomLbl = h('div', 'sc-zoom', scope);
  let dpr = 1, W = 0, Hh = 0, q = 1, cx = 0, cy = 0, dirty = true;

  const hits = []; const dmgs = [];
  const st = { gap: 0, spread: 0, sig: '', hideXh: false, scopeA: 0, scopeKind: '', scopeVis: 0, cfgv: -1, last: 0 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; Hh = innerHeight;
    q = Hh / 720;
    const px = Math.round(SIZE * dpr / 2) * 2;      // even backing store => exact centre pixel
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    cv.style.width = cv.style.height = (px / dpr) + 'px';
    cx = cy = px / 2; dirty = true; st.scopeKind = '';
  }
  H.onResize.push(resize); resize();

  // -------------------------------------------------- events
  H.bus.on('tag:hit', (d) => {
    const v = H.view;
    if (d.attacker && d.attacker === v && d.victim !== v) {
      const crown = d.hitgroup === 'head' || d.hitgroup === 'crown';
      if (hits.length >= MAXHIT) hits.shift();
      hits.push({ t0: H.T, kind: crown ? 'crown' : 'body', dur: crown ? 0.42 : 0.3 });
    }
    if (d.victim && d.victim === v && d.attacker !== v) {
      if (dmgs.length >= MAXDMG) dmgs.shift();
      const a = d.attacker; let dx = 0, dz = 0;
      if (a?.pos && v.pos) { dx = a.pos.x - v.pos.x; dz = a.pos.z - v.pos.z; }
      else if (d.dir) { dx = -d.dir.x; dz = -d.dir.z; }
      dmgs.push({ t0: H.T, a, dx, dz, dmg: d.damage || 20 });
    }
  });
  H.bus.on('tag:out', (d) => {
    if (d.attacker && d.attacker === H.view && d.victim !== H.view) {
      hits.length = 0; hits.push({ t0: H.T, kind: 'out', dur: 0.75, crown: d.hitgroup === 'head' || d.hitgroup === 'crown' });
    }
  });
  H.bus.on('reset', () => { hits.length = 0; dmgs.length = 0; dirty = true; });

  // -------------------------------------------------- crosshair
  const STYLES = { classic: 0, dot: 1, circle: 2, t: 3, cross: 0 };
  function drawCrosshair(cfg, gapCss, col, alpha) {
    const dq = dpr * q; // device px per 720p-css px
    const style = STYLES[String(cfg.style || 'classic').toLowerCase()] ?? 0;
    const tD = Math.max(1, Math.round((cfg.thickness ?? 1.6) * dq * 1.0));
    const lenD = Math.max(2, Math.round((cfg.size ?? 5) * 1.6 * dq));
    const gapD = Math.round(Math.max(0, gapCss) * dq);
    const oD = cfg.outline === false ? 0 : Math.max(1, Math.round(dq * 0.85));
    const [r, g, b] = hexRgb(col);
    const fill = `rgba(${r},${g},${b},${alpha})`, edge = `rgba(0,0,0,${0.85 * alpha})`;
    const lo = tD >> 1, hi = tD - lo;                // pixel split around centre
    const rect = (x0, y0, w, hh) => {
      if (oD) { c2.fillStyle = edge; c2.fillRect(x0 - oD, y0 - oD, w + oD * 2, hh + oD * 2); }
    };
    const fillRect = (x0, y0, w, hh) => { c2.fillStyle = fill; c2.fillRect(x0, y0, w, hh); };
    const arms = (top) => {
      const list = [[cx + gapD, cy - lo, lenD, tD], [cx - gapD - lenD, cy - lo, lenD, tD], [cx - lo, cy + gapD, tD, lenD]];
      if (top) list.push([cx - lo, cy - gapD - lenD, tD, lenD]);
      for (const a of list) rect(a[0], a[1], a[2], a[3]);
      for (const a of list) fillRect(a[0], a[1], a[2], a[3]);
    };
    const dot = (sz) => { const s = Math.max(tD, sz), l = s >> 1; rect(cx - l, cy - l, s, s); fillRect(cx - l, cy - l, s, s); };
    if (style === 0) { arms(true); if (cfg.dot) dot(tD + (tD & 1 ? 0 : 0)); }
    else if (style === 3) { arms(false); if (cfg.dot) dot(tD); }
    else if (style === 1) { dot(Math.round(tD * 2.2 + (tD & 1 ? 0 : 1))); }
    else {
      const rad = gapD + lenD * 0.9 + tD; c2.lineWidth = tD; c2.lineCap = 'butt';
      if (oD) { c2.strokeStyle = edge; c2.lineWidth = tD + oD * 2; c2.beginPath(); c2.arc(cx + 0.0, cy + 0.0, rad, 0, 7); c2.stroke(); }
      c2.strokeStyle = fill; c2.lineWidth = tD; c2.beginPath(); c2.arc(cx, cy, rad, 0, 7); c2.stroke();
      if (cfg.dot !== false) dot(tD);
    }
  }

  // -------------------------------------------------- hit markers
  function drawHit(m, age) {
    const p = age / m.dur; if (p >= 1) return false;
    const dq = dpr * q;
    const pop = age < 0.07 ? 1.35 - 0.35 * (age / 0.07) : 1;
    const a = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5;
    const crown = m.kind === 'crown', out = m.kind === 'out';
    let r0 = (crown ? 7 : 5.5) * dq * pop + (out ? easeOut(Math.min(1, p * 1.6)) * 4 * dq : 0);
    let len = (crown ? 8.5 : 6.5) * dq * (out ? 1.45 : 1) * pop;
    const w = Math.max(1.5, (crown ? 2.6 : 2.0) * dq * (out ? 1.35 : 1));
    const col = out ? [255, 84, 64] : crown ? [255, 112, 76] : [255, 255, 255];
    c2.lineCap = 'butt';
    for (let pass = 0; pass < 2; pass++) {
      c2.lineWidth = pass ? w : w + 2 * dq * 0.9;
      c2.strokeStyle = pass ? `rgba(${col[0]},${col[1]},${col[2]},${a})` : `rgba(0,0,0,${0.55 * a})`;
      c2.beginPath();
      for (let k = 0; k < 4; k++) {
        const sx = k & 1 ? -1 : 1, sy = k & 2 ? -1 : 1, d = Math.SQRT1_2;
        c2.moveTo(cx + sx * r0 * d, cy + sy * r0 * d); c2.lineTo(cx + sx * (r0 + len) * d, cy + sy * (r0 + len) * d);
      }
      c2.stroke();
    }
    if (out) {         // tag-out: expanding ring + shard ticks
      const rr = (10 + 34 * easeOut(p)) * dq;
      c2.lineWidth = Math.max(1, 1.8 * dq * (1 - p * 0.6));
      c2.strokeStyle = `rgba(255,${m.crown ? 200 : 220},170,${0.85 * (1 - p)})`;
      c2.beginPath(); c2.arc(cx, cy, rr, 0, 7); c2.stroke();
      c2.fillStyle = `rgba(255,236,200,${0.9 * (1 - p)})`;
      for (let k = 0; k < 8; k++) {
        const an = k * Math.PI / 4 + 0.39, rd = (16 + 30 * easeOut(p)) * dq, s = (2.2 * (1 - p) + 0.6) * dq;
        c2.fillRect(cx + Math.cos(an) * rd - s, cy + Math.sin(an) * rd - s, s * 2, s * 2);
      }
    } else if (crown) {  // crown: two small chevrons above
      c2.lineWidth = Math.max(1.5, 1.8 * dq); c2.strokeStyle = `rgba(255,214,120,${a})`;
      const yy = cy - (r0 + len + 6 * dq), ww = 5 * dq;
      c2.beginPath(); c2.moveTo(cx - ww, yy + 3 * dq); c2.lineTo(cx, yy - 2 * dq); c2.lineTo(cx + ww, yy + 3 * dq); c2.stroke();
    }
    return true;
  }

  // -------------------------------------------------- damage arcs
  function drawDmg(m, age, view) {
    const life = 2.6; if (age >= life) return false;
    const a0 = age < 0.08 ? age / 0.08 : 1, fade = age < 0.9 ? 1 : 1 - (age - 0.9) / (life - 0.9);
    let dx = m.dx, dz = m.dz;
    if (m.a?.alive !== false && m.a?.pos && view?.pos) { dx = m.a.pos.x - view.pos.x; dz = m.a.pos.z - view.pos.z; }
    const y = view?.yaw || 0, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
    const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz) - Math.PI / 2;
    const dq = dpr * q, rad = 112 * dq + (1 - a0) * 10 * dq;
    const half = (0.2 + clamp(m.dmg / 100, 0, 1) * 0.18);
    const al = a0 * clamp(fade, 0, 1);
    c2.lineCap = 'round';
    c2.lineWidth = 9 * dq; c2.strokeStyle = `rgba(0,0,0,${0.28 * al})`;
    c2.beginPath(); c2.arc(cx, cy, rad, ang - half - 0.02, ang + half + 0.02); c2.stroke();
    c2.lineWidth = 5.5 * dq; c2.strokeStyle = `rgba(255,74,60,${0.95 * al})`;
    c2.beginPath(); c2.arc(cx, cy, rad, ang - half, ang + half); c2.stroke();
    c2.lineWidth = 1.6 * dq; c2.strokeStyle = `rgba(255,200,180,${0.85 * al})`;
    c2.beginPath(); c2.arc(cx, cy, rad, ang - half + 0.03, ang + half - 0.03); c2.stroke();
    return true;
  }

  // -------------------------------------------------- scope overlay
  function buildScope(kind) {
    const w = W, hh = Hh, r = hh * (kind === 'halo' ? 0.4 : 0.46), mx = w / 2, my = hh / 2;
    const lance = kind !== 'halo';
    let s = `<svg viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none">`;
    s += `<path fill="#000" fill-rule="evenodd" d="M0 0H${w}V${hh}H0Z M${mx - r} ${my}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z"/>`;
    s += `<circle cx="${mx}" cy="${my}" r="${r}" fill="none" stroke="rgba(0,0,0,.9)" stroke-width="3"/>`;
    s += `<circle cx="${mx}" cy="${my}" r="${r - 2}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="2"/>`;
    // soft inner vignette
    s += `<defs><radialGradient id="scv" cx="50%" cy="50%" r="50%"><stop offset="78%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".55"/></radialGradient></defs>`;
    s += `<circle cx="${mx}" cy="${my}" r="${r}" fill="url(#scv)"/>`;
    const k = 'stroke="#0a0a0a" stroke-linecap="butt"';
    if (lance) {   // duplex reticle: thick outer posts, hair centre
      const gap = r * 0.06, th = Math.max(1, hh / 900);
      s += `<g ${k}><path d="M${mx - r} ${my}H${mx - gap}M${mx + gap} ${my}H${mx + r}M${mx} ${my - r}V${my - gap}M${mx} ${my + gap}V${my + r}" stroke-width="${th}" opacity=".9"/>`;
      s += `<path d="M${mx - r} ${my}H${mx - r * 0.3}M${mx + r * 0.3} ${my}H${mx + r}M${mx} ${my - r}V${my - r * 0.3}M${mx} ${my + r * 0.3}V${my + r}" stroke-width="${th * 5}"/></g>`;
      s += `<circle cx="${mx}" cy="${my}" r="${Math.max(1.2, hh / 700)}" fill="rgba(255,60,50,.9)"/>`;
    } else {       // halo: thin cross + mil ticks + ring
      const th = Math.max(1, hh / 1000);
      s += `<g ${k} opacity=".92"><path d="M${mx - r} ${my}H${mx + r}M${mx} ${my - r}V${my + r}" stroke-width="${th}"/>`;
      for (let i = 1; i <= 6; i++) { const o = i * r / 7, t = i % 2 ? 4 : 7; s += `<path d="M${mx + o} ${my - t}V${my + t}M${mx - o} ${my - t}V${my + t}M${mx - t} ${my + o}H${mx + t}M${mx - t} ${my - o}H${mx + t}" stroke-width="${th}"/>`; }
      s += `</g><circle cx="${mx}" cy="${my}" r="${r * 0.22}" fill="none" stroke="#0a0a0a" stroke-width="${th * 1.5}"/>`;
      s += `<circle cx="${mx}" cy="${my}" r="${Math.max(1.4, hh / 600)}" fill="rgba(255,70,60,.95)"/>`;
    }
    sv.innerHTML = s + '</svg>'; zoomLbl.textContent = lance ? '8×' : '3×';
    st.scopeKind = kind;
  }

  // -------------------------------------------------- per-frame
  return {
    update(dt) {
      const R = H.R, v = H.view, cfg = H.xhairCfg();
      // ---- spread smoothing (fast open, slower close)
      let target = 0;
      if (v) {
        let sp; try { sp = R.combat?.crosshairSpread?.(v); } catch {}
        if (typeof sp !== 'number' || Number.isNaN(sp)) {
          const speed = v.vel ? Math.hypot(v.vel.x, v.vel.z) : 0;
          sp = clamp(speed / 7, 0, 1) * 0.8 * (v.crouching ? 0.6 : 1) + (v.onGround === false ? 0.55 : 0);
        }
        target = clamp(sp, 0, 1.5);
      }
      st.spread = damp(st.spread, target, target > st.spread ? 46 : 14, dt);
      if (Math.abs(st.spread - target) < 0.0015) st.spread = target;
      const eq = v ? R.combat?.equipped?.(v) : null;
      const scoped = !!(eq && eq.scoped);
      const sid = eq?.def?.id || '';
      const kind = scoped ? (sid === 'halo' ? 'halo' : 'lance') : '';
      // ---- scope overlay fade
      const ta = scoped && !R.combat?.viewmodel?.drawsScopeOverlay ? 1 : 0;
      if (ta && st.scopeKind !== kind) buildScope(kind);
      st.scopeA = damp(st.scopeA, ta, 40, dt); if (Math.abs(st.scopeA - ta) < 0.01) st.scopeA = ta;
      const so = st.scopeA.toFixed(2); if (st.scopeVis !== so) { st.scopeVis = so; scope.style.opacity = so; }
      // ---- crosshair visibility
      const hide = !v || v.alive === false || scoped || H.hidden || H.flags.noCrosshair || (H.menuOpen);
      let gap = (cfg.gap ?? 3) * 1.15 + (cfg.dynamic === false ? 0 : st.spread * 15);
      const g2 = Math.round(gap * 8);
      const col = cfg.color || '#6dff9a';
      const sig = `${g2}|${hide ? 1 : 0}|${col}|${cfg.style}|${cfg.size}|${cfg.thickness}|${cfg.dot}|${cfg.outline}|${q}|${dpr}`;
      const anim = hits.length || dmgs.length;
      if (sig === st.sig && !anim && !dirty) return;
      st.sig = sig; dirty = false;
      c2.clearRect(0, 0, cv.width, cv.height);
      if (dmgs.length && v) { for (let i = dmgs.length - 1; i >= 0; i--) if (!drawDmg(dmgs[i], H.T - dmgs[i].t0, v)) dmgs.splice(i, 1); }
      if (!hide) drawCrosshair(cfg, g2 / 8, col, H.xhairAlpha ?? 1);
      for (let i = hits.length - 1; i >= 0; i--) if (!drawHit(hits[i], H.T - hits[i].t0)) hits.splice(i, 1);
      if (hits.length || dmgs.length) dirty = true; // draw one more frame to clear once empty
    },
    // exposed for the gallery / debug
    debug: { hits, dmgs, state: st },
    pushHit(kind) { hits.push({ t0: H.T, kind, dur: kind === 'out' ? 0.75 : kind === 'crown' ? 0.42 : 0.3 }); },
  };
}
