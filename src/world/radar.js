// Procedural top-down radar (multi-level). Browser-only (canvas). 1 px = 1/PPM m.
import * as THREE from 'three';
import { NX, NZ, X0, Z0, idx } from './grid.js';
import { ZONES } from './layout.js';

const PPM = 8;
export function buildRadar(grid, extraRects, sites, callouts) {
  const W = NX * PPM, Hh = NZ * PPM;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = Hh; return [c, c.getContext('2d')]; };
  const worldToPx = (x, z) => [(x - X0) * PPM, (z - Z0) * PPM];
  const UPPER = 2.2;
  const draw = (level) => {
    const [c, g] = mk();
    g.fillStyle = '#0b1114'; g.fillRect(0, 0, W, Hh);
    const cellFill = (i, j, col) => { g.fillStyle = col; g.fillRect(i * PPM, j * PPM, PPM + 0.6, PPM + 0.6); };
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const k = idx(i, j); if (!grid.open[k]) continue;
      const h = (grid.h[k * 4] + grid.h[k * 4 + 1] + grid.h[k * 4 + 2] + grid.h[k * 4 + 3]) / 4;
      const water = grid.surf[k] === 4; const up = h >= UPPER;
      let l = 0.42 + Math.max(-0.12, Math.min(0.2, h * 0.05));
      const zn = ZONES[grid.zoneNames[grid.zone[k]]];
      let r = 70 + l * 70, gg = 92 + l * 70, b = 92 + l * 60;
      if (zn && zn.trim === 0xff7a2f) { r += 18; } if (zn && zn.trim === 0x2fd0ff) { b += 22; gg += 8; }
      if (water) { r = 40; gg = 120; b = 130; }
      if (level === 'upper' && !up) { r *= 0.45; gg *= 0.45; b *= 0.45; }
      if (level === 'ground' && up) { r *= 0.8; gg *= 0.8; b *= 0.8; }
      cellFill(i, j, `rgb(${r | 0},${gg | 0},${b | 0})`);
    }
    for (const rc of extraRects) { // catwalk deck etc (always upper level)
      const [x0, y0] = worldToPx(rc.x0, rc.z0), [x1, y1] = worldToPx(rc.x1, rc.z1);
      g.fillStyle = level === 'upper' ? 'rgb(150,170,178)' : 'rgba(110,125,130,0.7)'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.strokeStyle = 'rgba(230,240,240,0.9)'; g.lineWidth = 2; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }
    // wall outlines: draw edges between open and solid cells
    g.strokeStyle = 'rgba(210,225,225,0.55)'; g.lineWidth = 1.4; g.beginPath();
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const k = idx(i, j); if (!grid.open[k]) continue;
      if (i + 1 < NX && !grid.open[idx(i + 1, j)]) { g.moveTo((i + 1) * PPM, j * PPM); g.lineTo((i + 1) * PPM, (j + 1) * PPM); }
      if (i > 0 && !grid.open[idx(i - 1, j)]) { g.moveTo(i * PPM, j * PPM); g.lineTo(i * PPM, (j + 1) * PPM); }
      if (j + 1 < NZ && !grid.open[idx(i, j + 1)]) { g.moveTo(i * PPM, (j + 1) * PPM); g.lineTo((i + 1) * PPM, (j + 1) * PPM); }
      if (j > 0 && !grid.open[idx(i, j - 1)]) { g.moveTo(i * PPM, j * PPM); g.lineTo((i + 1) * PPM, j * PPM); }
    }
    g.stroke();
    // height steps (ramps/ledges) hatch: cells with strong slope
    g.fillStyle = 'rgba(255,255,255,0.10)';
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const k = idx(i, j); if (!grid.open[k]) continue; const a = grid.h[k * 4], d = grid.h[k * 4 + 3]; if (Math.abs(a - d) > 0.05 && ((i + j) & 1) === 0) g.fillRect(i * PPM, j * PPM, PPM, PPM); }
    // sites
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const id of ['A', 'B']) { const s = sites[id]; const [px, py] = worldToPx(s.center.x, s.center.z); g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(px, py, s.plant.radius * PPM, 0, 7); g.fill(); g.fillStyle = '#ffffff'; g.font = `900 ${PPM * 7}px Arial`; g.fillText(id, px, py + 2); }
    g.font = `700 ${PPM * 1.7}px Arial`; g.fillStyle = 'rgba(235,245,245,0.78)';
    for (const co of callouts) { if (co.radar === false) continue; const [px, py] = worldToPx(co.pos.x, co.pos.z); g.fillText(co.name.toUpperCase(), px, py); }
    return c;
  };
  const ground = draw('ground'), upper = draw('upper');
  const mkTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
  const radar = {
    ppm: PPM, width: W, height: Hh, bounds: { minX: X0, maxX: X0 + NX, minZ: Z0, maxZ: Z0 + NZ }, upperY: UPPER,
    levels: [{ name: 'ground', minY: -10, maxY: UPPER, canvas: ground, texture: mkTex(ground) }, { name: 'upper', minY: UPPER, maxY: 40, canvas: upper, texture: mkTex(upper) }],
    canvas: ground, texture: null,
    /** world (x,z) -> normalized radar UV (0..1, v down = +z) written into out {x,y} */
    worldToRadar(x, z, out = { x: 0, y: 0 }) { out.x = (x - X0) / NX; out.y = (z - Z0) / NZ; return out; },
    /** world -> pixel in the level canvases */
    worldToPixel(x, z, out = { x: 0, y: 0 }) { out.x = (x - X0) * PPM; out.y = (z - Z0) * PPM; return out; },
    levelAt(y) { return y >= UPPER - 0.3 ? 'upper' : 'ground'; },
    canvasFor(y) { return y >= UPPER - 0.3 ? upper : ground; },
  };
  radar.texture = radar.levels[0].texture;
  return radar;
}
