// Circular rotating radar (top-left) with callout label. Uses ctx.map.radar (+ worldToRadar) when available,
// otherwise bakes a height-shaded top-down map from ctx.map.collider (chunked over several frames).
import * as THREE from 'three';
import { clamp, damp, easeOut, h, hexRgb } from './core.js';

export const css = `
.radar{position:absolute;left:16px;top:16px;width:176px;height:176px}
.radar canvas{position:absolute;inset:0;width:176px;height:176px;display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,.55))}
.callout{position:absolute;left:16px;top:196px;width:176px;height:22px;text-align:center;font:600 16px/22px var(--font);letter-spacing:.04em;color:#f4efe0;text-shadow:0 1px 2px #000,0 0 6px rgba(0,0,0,.65);text-transform:none}
.callout span{position:absolute;left:0;right:0;top:0;white-space:nowrap;will-change:transform,opacity}
`;

const R_PX = 88, RANGE = 42;           // radar radius in css px (176/2) and metres shown
const CELLS = 160;

export function create(H) {
  const root = h('div', 'radar', H.root);
  const cv = h('canvas', '', root); const g = cv.getContext('2d');
  const call = h('div', 'callout', H.root); const cA = h('span', '', call), cB = h('span', '', call);
  const st = { img: null, rect: null, w2r: null, scale: 1, lastCall: '', callT: -9, callAt: 0, bake: null, spotted: new Map(), spotAt: 0, deaths: [], lastMapKey: null, pulse: 0 };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpD = new THREE.Vector3();

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2); const px = Math.round(176 * H.k * dpr);
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    st.scale = px / 176;
  }
  H.onResize.push(resize); resize();

  // ------------------------------------------------------------ restyle the map's radar image
  // The map bakes pale floor tones, callout micro-labels and site letters into its canvas. We erase the labels
  // (known positions), keep the floor shape, and re-ink it as a dark, low-noise silhouette with crisp wall edges.
  const styled = new WeakMap();
  function stylize(src, rect, map) {
    if (!src) return src; if (styled.has(src)) return styled.get(src);
    const iw = src.width || src.naturalWidth, ih = src.height || src.naturalHeight; if (!iw || !ih || !rect) return src;
    const mpp = (rect.maxX - rect.minX) / iw;                     // metres per source px
    const sc = Math.min(1, 4 * mpp, 1400 / Math.max(iw, ih));    // aim for ~4 px per metre
    const w = Math.max(8, Math.round(iw * sc)), hh = Math.max(8, Math.round(ih * sc));
    const tc = document.createElement('canvas'); tc.width = w; tc.height = hh; const tg = tc.getContext('2d', { willReadFrequently: true });
    tg.imageSmoothingEnabled = true; tg.drawImage(src, 0, 0, w, hh);
    let id; try { id = tg.getImageData(0, 0, w, hh); } catch { styled.set(src, src); return src; }
    const d = id.data, N = w * hh;
    const open = new Uint8Array(N), lum = new Float32Array(N), mask = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3];
      const bgDist = Math.abs(r - 11) + Math.abs(g - 17) + Math.abs(b - 20);
      open[i] = a > 40 && bgDist > 26 ? 1 : 0; lum[i] = (r + g + b) / 3;
    }
    // erase labels / site letters by known bounding boxes
    const toPx = (x, z) => [(x - rect.minX) / (rect.maxX - rect.minX) * w, (z - rect.minZ) / (rect.maxZ - rect.minZ) * hh];
    const pxm = w / (rect.maxX - rect.minX);                       // processed px per metre
    const box = (cx, cz, hw, hh2) => {
      const [px, py] = toPx(cx, cz); const x0 = Math.max(1, Math.floor(px - hw)), x1 = Math.min(w - 2, Math.ceil(px + hw)), y0 = Math.max(1, Math.floor(py - hh2)), y1 = Math.min(hh - 2, Math.ceil(py + hh2));
      let ring = 0, on = 0; for (let x = x0 - 1; x <= x1 + 1; x++) for (const y of [y0 - 1, y1 + 1]) { ring++; on += open[y * w + x]; } for (let y = y0; y <= y1; y++) for (const x of [x0 - 1, x1 + 1]) { ring++; on += open[y * w + x]; }
      const plate = ring > 0 && on / ring > 0.8;      // label sits on a dark plate fully surrounded by floor: fill it in
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * w + x; if (plate) open[i] = 1; mask[i] = 1; }
    };
    for (const co of (map?.callouts || [])) { const p = co.pos; if (!p || !co.name) continue; box(p.x, p.z, (co.name.length * 1.7 * 0.66 / 2 + 1.4) * pxm, 1.9 * pxm); }
    for (const k of Object.keys(map?.sites || {})) { const c = map.sites[k].center; if (c) box(c.x, c.z, 4.6 * pxm, 4.6 * pxm); }
    // text strokes are much lighter than any floor tone: mask (and dilate) them too, wherever they are
    { const hi = new Uint8Array(N); for (let i = 0; i < N; i++) if (open[i] && lum[i] > 166) hi[i] = 1;
      for (let y = 1; y < hh - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (hi[i] || hi[i - 1] || hi[i + 1] || hi[i - w] || hi[i + w] || hi[i - w - 1] || hi[i - w + 1] || hi[i + w - 1] || hi[i + w + 1]) mask[i] = 1; } }
    // diffuse neighbours into masked open pixels
    let remaining = 0; for (let i = 0; i < N; i++) { if (mask[i] && !open[i]) mask[i] = 0; if (mask[i]) remaining++; }
    for (let it = 0; it < 40 && remaining > 0; it++) {
      const upd = [];
      for (let y = 1; y < hh - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x; if (!mask[i]) continue; let s2 = 0, c = 0;
        for (const j of [i - 1, i + 1, i - w, i + w]) if (open[j] && !mask[j]) { s2 += lum[j]; c++; }
        if (c) upd.push(i, s2 / c);
      }
      if (!upd.length) break;
      for (let k = 0; k < upd.length; k += 2) { lum[upd[k]] = upd[k + 1]; mask[upd[k]] = 0; remaining--; }
    }
    for (let i = 0; i < N; i++) if (mask[i]) { open[i] = 0; mask[i] = 0; }   // label pixels over solid rock: drop
    // morphological opening (3x3 erode + dilate) removes strokes <= 2 px: antialiased glyph residue over rock
    { const er = new Uint8Array(N);
      for (let y = 1; y < hh - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; er[i] = open[i] && open[i - 1] && open[i + 1] && open[i - w] && open[i + w] && open[i - w - 1] && open[i - w + 1] && open[i + w - 1] && open[i + w + 1] ? 1 : 0; }
      const di = new Uint8Array(N);
      for (let y = 1; y < hh - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; di[i] = er[i] || er[i - 1] || er[i + 1] || er[i - w] || er[i + w] || er[i - w - 1] || er[i - w + 1] || er[i + w - 1] || er[i + w + 1] ? 1 : 0; }
      for (let i = 0; i < N; i++) open[i] = open[i] && di[i] ? 1 : 0; }
    // drop tiny islands (leftover glyph fragments)
    { const seen = new Uint8Array(N), stack = new Int32Array(N); const minA = Math.max(30, Math.round(9 * pxm * pxm * 0.25));
      for (let s0 = 0; s0 < N; s0++) {
        if (!open[s0] || seen[s0]) continue; let sp = 0, cnt = 0; const comp = []; stack[sp++] = s0; seen[s0] = 1;
        while (sp) { const i = stack[--sp]; cnt++; comp.push(i); const x = i % w; if (x > 0 && open[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[sp++] = i - 1; } if (x < w - 1 && open[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[sp++] = i + 1; } if (i >= w && open[i - w] && !seen[i - w]) { seen[i - w] = 1; stack[sp++] = i - w; } if (i < N - w && open[i + w] && !seen[i + w]) { seen[i + w] = 1; stack[sp++] = i + w; } }
        if (cnt < minA) for (const i of comp) open[i] = 0;
      } }
    // ink
    const out = tg.createImageData(w, hh), o = out.data;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!open[i]) continue;
      const edge = x === 0 || y === 0 || x === w - 1 || y === hh - 1 || !open[i - 1] || !open[i + 1] || !open[i - w] || !open[i + w];
      const v = Math.max(0, Math.min(1, (lum[i] - 55) / 90)); const p = i * 4;
      if (edge) { o[p] = 196; o[p + 1] = 214; o[p + 2] = 232; o[p + 3] = 255; }
      else { o[p] = 32 + v * 30; o[p + 1] = 43 + v * 38; o[p + 2] = 58 + v * 44; o[p + 3] = 255; }
    }
    // inner edge pass: soften the 1px wall line into 2px for legibility
    const o2 = new Uint8ClampedArray(o);
    for (let y = 1; y < hh - 1; y++) for (let x = 1; x < w - 1; x++) {
      const p = (y * w + x) * 4; if (!o[p + 3] || o[p] > 150) continue;
      if (o[p - 4] > 150 || o[p + 4] > 150 || o[p - w * 4] > 150 || o[p + w * 4] > 150) { o2[p] = 120; o2[p + 1] = 140; o2[p + 2] = 160; }
    }
    out.data.set(o2); tg.putImageData(out, 0, 0);
    styled.set(src, tc); return tc;
  }

  // ------------------------------------------------------------ map image source
  function imgSource(map) {
    const r = map?.radar; if (!r) return null;
    const cand = r.canvas || r.image || r.img || r.texture?.image || r.texture?.source?.data || (r instanceof HTMLCanvasElement || r instanceof HTMLImageElement || (typeof ImageBitmap !== 'undefined' && r instanceof ImageBitmap) ? r : null);
    if (!cand || !(cand.width || cand.naturalWidth)) return null;
    return cand;
  }
  function mapRect(map, img) {
    const r = map.radar; let rc = r.rect || r.bounds || r.world;
    const bnds = map.bounds;
    if (!rc && bnds) rc = { minX: bnds.min.x, maxX: bnds.max.x, minZ: bnds.min.z, maxZ: bnds.max.z };
    if (rc && rc.min && rc.max) rc = { minX: rc.min.x, maxX: rc.max.x, minZ: rc.min.z, maxZ: rc.max.z };
    if (typeof map.worldToRadar === 'function' && !r.rect) {
      // derive the world rect of the image from the projection (assumes an axis-aligned linear mapping)
      try {
        const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
        const a = uv(map, 0, 0), b = uv(map, 1, 1);
        const norm = (v, s) => (Math.abs(v) > 2 ? v / s : v);
        const u0 = norm(a[0], iw), v0 = norm(a[1], ih), u1 = norm(b[0], iw), v1 = norm(b[1], ih);
        const su = u1 - u0, sv = v1 - v0;
        if (Math.abs(su) > 1e-9 && Math.abs(sv) > 1e-9) {
          const x0 = -u0 / su, x1 = (1 - u0) / su, z0 = -v0 / sv, z1 = (1 - v0) / sv;
          return { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) };
        }
      } catch {}
    }
    return rc;
  }
  function uv(map, x, z) {
    let o; try { o = map.worldToRadar(x, z); } catch {}
    if (!o) { try { o = map.worldToRadar(tmpA.set(x, 0, z)); } catch {} }
    if (Array.isArray(o)) return o; if (o && typeof o === 'object') return [o.x ?? o.u ?? 0, o.y ?? o.v ?? 0]; return [0, 0];
  }

  // ------------------------------------------------------------ fallback bake from collider
  function startBake(map) {
    const b = map.bounds; if (!b || !map.raycast) return null;
    const w = b.max.x - b.min.x, d = b.max.z - b.min.z, n = CELLS;
    return { map, n, minX: b.min.x, minZ: b.min.z, w, d, top: Math.max(b.max.y, 20) + 2, hs: new Float32Array(n * n).fill(-99), row: 0, cv: document.createElement('canvas') };
  }
  function stepBake(bk, rows) {
    const { n, map } = bk; const o = tmpA, dir = tmpD.set(0, -1, 0);
    for (let k = 0; k < rows && bk.row < n; k++, bk.row++) {
      for (let i = 0; i < n; i++) {
        o.set(bk.minX + (i + 0.5) * bk.w / n, bk.top, bk.minZ + (bk.row + 0.5) * bk.d / n);
        let hit = null; try { hit = map.raycast(o, dir, bk.top + 30); } catch {}
        bk.hs[bk.row * n + i] = hit ? hit.point.y : -99;
      }
    }
    if (bk.row >= n) finishBake(bk);
  }
  function finishBake(bk) {
    const { n, hs } = bk; bk.cv.width = bk.cv.height = 512; const c = bk.cv.getContext('2d');
    const lo = document.createElement('canvas'); lo.width = lo.height = n; const lc = lo.getContext('2d'); const id = lc.createImageData(n, n);
    // reference floor = the most common low height
    let base = 0, cnt = new Map(); for (let i = 0; i < hs.length; i++) { const k = Math.round(hs[i]); cnt.set(k, (cnt.get(k) || 0) + 1); }
    let best = 0; for (const [k, v] of cnt) if (k > -50 && v > best) { best = v; base = k; }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, hv = hs[i], o = i * 4; let r = 0, gg = 0, b = 0, a = 0;
      if (hv > -50) {
        const rel = hv - base; let edge = false;
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue; const hn = hs[yy * n + xx]; if (hn > -50 && Math.abs(hn - hv) > 0.9) edge = true; }
        if (rel < 0.7) { r = 62; gg = 78; b = 104; a = 210; }
        else { const t = clamp(rel / 6, 0, 1); r = 40 + t * 22; gg = 52 + t * 24; b = 72 + t * 30; a = 235; }
        if (edge && rel >= 0.7) { r = 176; gg = 198; b = 226; a = 255; }
      }
      id.data[o] = r; id.data[o + 1] = gg; id.data[o + 2] = b; id.data[o + 3] = a;
    }
    lc.putImageData(id, 0, 0);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(lo, 0, 0, 512, 512);
    st.img = bk.cv; st.rect = { minX: bk.minX, maxX: bk.minX + bk.w, minZ: bk.minZ, maxZ: bk.minZ + bk.d }; st.bake = null; st.baked = true;
  }

  // ------------------------------------------------------------ callouts
  function calloutAt(map, p) {
    try { const c = map?.calloutAt?.(p); if (c?.name) return c.name; if (map?.calloutAt) return ''; } catch {}
    const list = map?.callouts; if (!list || !list.length) return '';
    let best = '', bd = 1e9;
    for (let i = 0; i < list.length; i++) {
      const c = list[i]; const nm = c.name || c.label || c.id; if (!nm) continue;
      let cx, cz, rad = c.radius ?? c.r ?? 9;
      const pos = c.pos || c.center || c.position;
      if (pos) { cx = pos.x ?? pos[0]; cz = pos.z ?? pos[2]; }
      else if (c.min && c.max) { cx = (c.min.x + c.max.x) / 2; cz = (c.min.z + c.max.z) / 2; rad = Math.max(c.max.x - c.min.x, c.max.z - c.min.z) / 2 + 2; }
      else if (c.box) { cx = (c.box.min.x + c.box.max.x) / 2; cz = (c.box.min.z + c.box.max.z) / 2; rad = Math.max(c.box.max.x - c.box.min.x, c.box.max.z - c.box.min.z) / 2 + 2; }
      else continue;
      const d = Math.hypot(p.x - cx, p.z - cz) / Math.max(1, rad);
      if (d < 1 && d < bd) { bd = d; best = nm; }
    }
    return best;
  }

  // ------------------------------------------------------------ spotting
  function updateSpots(R, view) {
    const acts = R.actors || []; const T = H.T;
    const eyeA = tmpA, eyeB = tmpB, dir = tmpD;
    for (const e of acts) {
      if (!e.alive || e.team === view.team) continue;
      if (e.spotted === true || (e.spottedUntil || 0) > T) { st.spotted.set(e.id, T + 0.6); continue; }
      let seen = false;
      for (const a of acts) {
        if (!a.alive || a.team !== view.team) continue;
        const dx = e.pos.x - a.pos.x, dz = e.pos.z - a.pos.z, dist = Math.hypot(dx, dz);
        if (dist > 60) continue;
        const f = -Math.sin(a.yaw) * dx - Math.cos(a.yaw) * dz; if (f < -dist * 0.2 && dist > 4) continue;   // roughly in front (~±100°)
        if (!R.map?.raycast) { seen = dist < 25; if (seen) break; continue; }
        eyeA.set(a.pos.x, a.pos.y + 1.5, a.pos.z); eyeB.set(e.pos.x, e.pos.y + 1.4, e.pos.z);
        dir.subVectors(eyeB, eyeA); const len = dir.length(); dir.multiplyScalar(1 / len);
        let hit = null; try { hit = R.map.raycast(eyeA, dir, len); } catch {}
        if (!hit || hit.distance >= len - 0.35) { seen = true; break; }
      }
      if (seen) st.spotted.set(e.id, T + 1.4);
    }
  }
  H.bus.on('weapon:fire', (d) => { const a = d.actor; if (a && a.team !== H.view?.team) st.spotted.set(a.id, Math.max(st.spotted.get(a.id) || 0, H.T + 0.9)); });
  H.bus.on('tag:out', (d) => { const v = d.victim; if (v?.pos) { st.deaths.push({ x: v.pos.x, z: v.pos.z, t: H.T, team: v.team }); if (st.deaths.length > 12) st.deaths.shift(); } });
  H.bus.on('reset', () => { st.deaths.length = 0; st.spotted.clear(); });

  // ------------------------------------------------------------ draw
  const cIvory = 'rgba(250,240,214,';
  function draw(R, view, dt) {
    const s = st.scale, W2 = cv.width;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W2, W2);
    g.setTransform(s, 0, 0, s, 0, 0);
    const ppm = R_PX / RANGE, yaw = view.yaw || 0, cs = Math.cos(yaw), sn = Math.sin(yaw), px = view.pos.x, pz = view.pos.z;
    // background disc
    g.save(); g.beginPath(); g.arc(R_PX, R_PX, R_PX - 1, 0, 7); g.clip();
    const bg = g.createRadialGradient(R_PX, R_PX, 10, R_PX, R_PX, R_PX);
    bg.addColorStop(0, 'rgba(14,18,26,.92)'); bg.addColorStop(1, 'rgba(8,10,16,.94)');
    g.fillStyle = bg; g.fillRect(0, 0, 176, 176);
    // map
    if (st.img && st.rect) {
      const r = st.rect; g.save(); g.translate(R_PX, R_PX); g.rotate(yaw);
      g.globalAlpha = 1; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(st.img, (r.minX - px) * ppm, (r.minZ - pz) * ppm, (r.maxX - r.minX) * ppm, (r.maxZ - r.minZ) * ppm);
      g.restore();
    }
    // range rings + faint cross
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.10)';
    g.beginPath(); g.arc(R_PX, R_PX, R_PX * 0.5, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(R_PX, 6); g.lineTo(R_PX, 170); g.moveTo(6, R_PX); g.lineTo(170, R_PX); g.stroke();

    const lim = R_PX - 9;
    const put = (x, z, out) => {
      const dx = (x - px) * ppm, dz = (z - pz) * ppm; let sx = dx * cs - dz * sn, sy = dx * sn + dz * cs;
      const d = Math.hypot(sx, sy); out.clamped = false;
      if (d > lim) { sx *= lim / d; sy *= lim / d; out.clamped = true; }
      out.x = R_PX + sx; out.y = R_PX + sy; return out;
    };
    const P = { x: 0, y: 0, clamped: false };
    // sites
    const sites = R.map?.sites; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (sites) for (const k of Object.keys(sites)) {
      const c = sites[k]?.center; if (!c) continue;
      const dx = (c.x - px) * ppm, dz = (c.z - pz) * ppm; let sx = dx * cs - dz * sn, sy = dx * sn + dz * cs; const d0 = Math.hypot(sx, sy), edge = R_PX - 15;
      const cl = d0 > edge; if (cl) { sx *= edge / d0; sy *= edge / d0; }
      const X = R_PX + sx, Y = R_PX + sy;
      g.fillStyle = cl ? 'rgba(10,12,18,.55)' : 'rgba(10,12,18,.5)'; g.beginPath(); g.arc(X, Y, cl ? 10 : 13, 0, 7); g.fill();
      g.strokeStyle = cl ? 'rgba(255,214,110,.6)' : 'rgba(255,214,110,.9)'; g.lineWidth = 1.6; g.stroke();
      g.font = `700 ${cl ? 15 : 20}px "Barlow Condensed",system-ui,sans-serif`;
      g.fillStyle = cl ? 'rgba(255,224,140,.8)' : '#ffe08a'; g.fillText(k, X, Y + 0.8);
    }
    // tagged-out markers
    for (let i = st.deaths.length - 1; i >= 0; i--) {
      const d = st.deaths[i], age = H.T - d.t; if (age > 14) { st.deaths.splice(i, 1); continue; }
      put(d.x, d.z, P); if (P.clamped) continue;
      const a = age < 10 ? 0.8 : 0.8 * (1 - (age - 10) / 4);
      g.strokeStyle = d.team === view.team ? `rgba(255,255,255,${a})` : `rgba(255,90,90,${a})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(P.x - 3.2, P.y - 3.2); g.lineTo(P.x + 3.2, P.y + 3.2); g.moveTo(P.x + 3.2, P.y - 3.2); g.lineTo(P.x - 3.2, P.y + 3.2); g.stroke();
    }
    // beacon (dropped/armed) marker
    const bc = R.match?.beacon;
    if (bc && bc.pos && (bc.state === 'dropped' || bc.state === 'armed' || bc.state === 'arming' || bc.state === 'disarming')) {
      put(bc.pos.x, bc.pos.z, P); const armed = bc.state !== 'dropped'; const pl = (H.T * (armed ? 2.4 : 1.2)) % 1;
      const col = armed ? '255,90,60' : '255,214,90';
      g.strokeStyle = `rgba(${col},${0.7 * (1 - pl)})`; g.lineWidth = 1.5; g.beginPath(); g.arc(P.x, P.y, 4 + pl * 11, 0, 7); g.stroke();
      g.save(); g.translate(P.x, P.y); g.rotate(Math.PI / 4); g.fillStyle = `rgb(${col})`; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 1.4;
      g.fillRect(-3.4, -3.4, 6.8, 6.8); g.strokeRect(-3.4, -3.4, 6.8, 6.8); g.restore();
    }
    // actors
    const acts = R.actors || [];
    const palA = H.pal[view.team] || '#fff', palE = H.pal[view.team === 'ember' ? 'tide' : 'ember'];
    const dot = (a, col, isAlly) => {
      put(a.pos.x, a.pos.z, P); const dy = a.pos.y - view.pos.y;
      const rel = (a.yaw || 0) - yaw;
      if (P.clamped) {   // chevron pinned to the ring
        const ang = Math.atan2(P.y - R_PX, P.x - R_PX);
        g.save(); g.translate(P.x, P.y); g.rotate(ang); g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(3.6, 0); g.lineTo(-2.8, 3.2); g.lineTo(-1.2, 0); g.lineTo(-2.8, -3.2); g.closePath(); g.stroke(); g.fill(); g.restore(); return;
      }
      if (isAlly) {
        g.save(); g.translate(P.x, P.y); g.rotate(rel);
        g.fillStyle = `rgba(${hexRgb(col).join(',')},.22)`; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 17, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); g.closePath(); g.fill();
        g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = 3.2; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(0, -7.4); g.lineTo(5.4, 5); g.lineTo(0, 2.6); g.lineTo(-5.4, 5); g.closePath(); g.stroke();
        g.strokeStyle = '#fff'; g.lineWidth = 1.3; g.stroke(); g.fill(); g.restore();
      } else {
        const pl = 0.5 + 0.5 * Math.sin(H.T * 6 + a.id);
        g.fillStyle = `rgba(${hexRgb(col).join(',')},${0.18 + 0.12 * pl})`; g.beginPath(); g.arc(P.x, P.y, 8.5, 0, 7); g.fill();
        g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = 3.4; g.beginPath(); g.arc(P.x, P.y, 5, 0, 7); g.stroke(); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 1.4; g.beginPath(); g.arc(P.x, P.y, 5, 0, 7); g.stroke();
      }
      if (Math.abs(dy) > 3.2) {   // above / below marker
        g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath();
        if (dy > 0) { g.moveTo(P.x + 7, P.y - 1); g.lineTo(P.x + 10.4, P.y - 1); g.lineTo(P.x + 8.7, P.y - 4.2); } else { g.moveTo(P.x + 7, P.y + 1); g.lineTo(P.x + 10.4, P.y + 1); g.lineTo(P.x + 8.7, P.y + 4.2); }
        g.fill();
      }
      if (a.hasBeacon && isAlly) { g.save(); g.translate(P.x + 5.5, P.y - 5.5); g.rotate(Math.PI / 4); g.fillStyle = '#ffd25a'; g.strokeStyle = '#000'; g.lineWidth = 1; g.fillRect(-2.4, -2.4, 4.8, 4.8); g.strokeRect(-2.4, -2.4, 4.8, 4.8); g.restore(); }
    };
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i]; if (!a.alive || a === view || a.team !== view.team) continue; dot(a, palA, true);
    }
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i]; if (!a.alive || a.team === view.team) continue;
      const until = st.spotted.get(a.id); if (!until || until < H.T) continue; dot(a, palE, false);
    }
    // FOV wedge + self arrow
    const fov = (H.R.settings?.get?.('fov') || 100) * Math.PI / 180 * 0.5;
    const wg = g.createRadialGradient(R_PX, R_PX, 2, R_PX, R_PX, 60);
    wg.addColorStop(0, 'rgba(255,255,255,.26)'); wg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = wg; g.beginPath(); g.moveTo(R_PX, R_PX); g.arc(R_PX, R_PX, 60, -Math.PI / 2 - fov, -Math.PI / 2 + fov); g.closePath(); g.fill();
    g.save(); g.translate(R_PX, R_PX); g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 1.6;
    g.lineJoin = 'round'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(0, -8.4); g.lineTo(6.2, 6); g.lineTo(0, 3.2); g.lineTo(-6.2, 6); g.closePath(); g.stroke(); g.fill(); g.restore();
    g.restore();
    // ring
    g.lineWidth = 2.4; g.strokeStyle = cIvory + '.94)'; g.beginPath(); g.arc(R_PX, R_PX, R_PX - 1.4, 0, 7); g.stroke();
    g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(R_PX, R_PX, R_PX - 3.2, 0, 7); g.stroke();
    // north tick (top) is always "forward"; add small notch
    g.fillStyle = cIvory + '.95)'; g.beginPath(); g.moveTo(R_PX - 3.5, 2.6); g.lineTo(R_PX + 3.5, 2.6); g.lineTo(R_PX, 8); g.closePath(); g.fill();
  }

  // callout crossfade
  const cSet = { a: '', b: '' }; let cT = 9;
  function setCallout(name) {
    if (name === st.lastCall) return; st.lastCall = name; cB.textContent = ''; cA.textContent = name; cSet.b = ''; cSet.a = name; cT = 0; lastAlphaA = -1; lastAlphaB = -1;
  }
  let lastAlphaA = -1, lastAlphaB = -1;
  function animCallout(dt) {
    if (cT > 0.3 && lastAlphaA === 1) return; cT += dt; const p = clamp(cT / 0.22, 0, 1), e = easeOut(p);
    const aA = cSet.a ? e : 0, aB = cSet.b ? 1 - e : 0;
    if (aA !== lastAlphaA) { cA.style.opacity = aA; cA.style.transform = `translateY(${((1 - e) * 5).toFixed(2)}px)`; lastAlphaA = aA; }
    if (aB !== lastAlphaB) { cB.style.opacity = aB; cB.style.transform = `translateY(${(-e * 5).toFixed(2)}px)`; lastAlphaB = aB; }
  }

  return {
    update(dt) {
      const R = H.R, view = H.view;
      const vis = !!(view && view.pos) && !H.hidden && !H.flags.noRadar;
      root.style.display = call.style.display = vis ? '' : 'none';
      if (!vis) return;
      const map = R.map;
      const key = map?.radar || map?.bounds || (H.mock ? 'mock' : null);
      if (st.lvlSrc && st.rect) { const lv = map.radar.canvasFor(view.pos.y); const sty = lv && styled.get(lv) || (lv && stylize(lv, st.rect, map)); if (sty && st.img !== sty) st.img = sty; }
      if (key !== st.lastMapKey) { st.lastMapKey = key; st.img = null; st.rect = null; st.bake = null; st.baked = false; }
      if (!st.img) {
        const src = imgSource(map);
        if (src) { st.rect = mapRect(map, src); st.img = stylize(src, st.rect, map); st.lvlSrc = !!map.radar?.canvasFor; }
        else if (!st.bake && !st.baked && map && !map.__stub && map.raycast && map.bounds) st.bake = startBake(map);
      }
      if (st.bake) stepBake(st.bake, 10);
      st.spotAt -= dt; if (st.spotAt <= 0) { st.spotAt = 0.25; updateSpots(R, view); }
      draw(R, view, dt);
      st.callAt -= dt; if (st.callAt <= 0) { st.callAt = 0.12; setCallout(calloutAt(map, view.pos) || (H.mock ? '' : '')); }
      animCallout(dt);
    },
    debug: { st },
  };
}
