// Signage & painted decals: one transparent atlas (canvas) + one merged quad mesh. Browser-only (canvas).
import * as THREE from 'three';
import { heightAt } from './grid.js';
import { rngf } from './textures.js';

const FLOOR_TEXT = [
  // text, x, z, rot(deg: 0 reads towards -Z), width m, colour, sub
  ['EMBER SPAWN', 0, 42.2, 0, 9.5, 0xffa05a], ['TIDE SPAWN', 0, -42.2, 180, 9.0, 0x7fe3ff],
  ['LONG', 38, 17, 0, 5.2, 0xfff0c8], ['LONG DOORS', 38, 23.5, 0, 6.4, 0xfff0c8], ['PIT', 45.5, 14, 0, 2.6, 0xfff0c8], ['A RAMP', 38, -7.5, 0, 4.6, 0xfff0c8], ['OUTER LONG', 26, 43, 90, 5.4, 0xfff0c8],
  ['MID', 0, 28, 0, 4.2, 0xfff0c8], ['MID DOORS', 0, 19, 0, 4.6, 0xfff0c8], ['HUB', 0, 4, 0, 3.4, 0xfff0c8], ['SHORT', 14.5, 6, 0, 3.4, 0xfff0c8], ['CATWALK', 14.5, -21, 0, 3.8, 0x3a444c],
  ['PALACE', -8, -21, 0, 4.6, 0xfff0c8], ['TIDE MID', 0, -33, 180, 4.4, 0xfff0c8], ['WINDOW ROOM', -14.5, -32, 180, 5.4, 0xfff0c8],
  ['B TUNNELS', -33, 34, 0, 4.2, 0xfff0c8], ['TUNNELS', -23, 43, 270, 4.6, 0xfff0c8], ['UPPER TUNNEL', -33, 1, 0, 4.4, 0xfff0c8], ['TUNNEL MOUTH', -33, -10, 0, 4.4, 0xfff0c8],
  ['A DOOR', 19, -43, 90, 4.0, 0xfff0c8], ['B DOOR', -19, -43, 270, 4.0, 0xfff0c8], ['B CONNECTOR', -19, -23, 270, 5.0, 0xfff0c8],
  ['LEDGE', 44.5, -40, 0, 3.2, 0x3a444c], ['BALCONY', -42, -41, 0, 3.8, 0x3a444c], ['TERRACE', 17, -29, 90, 4.0, 0x3a444c], ['EAST ROOM', 9, -32, 180, 3.6, 0xfff0c8],
];
const WALL_TEXT = [
  // text, x, y, z, nx, nz, w
  ['B TUNNELS', -15.95, 5.3, 43, 1, 0, 4.4], ['LONG', 15.95, 5.3, 43, -1, 0, 3.2], ['MID', 0, 5.8, 15.05, 0, 1, 2.6], ['MID DOORS', 0, 5.8, 9.95, 0, -1, 4.0],
  ['LONG DOORS', 38, 6.0, 30.05, 0, 1, 5.0], ['A SITE', 17.95, 5.3, -43, 1, 0, 3.4], ['B SITE', -17.95, 5.3, -43, -1, 0, 3.4],
  ['B CONNECTOR', -17.05, 5.4, -23, 1, 0, 4.6], ['B WINDOW', -19.95, 4.8, -34, 1, 0, 3.4], ['SHORT', 9.95, 5.4, 7, -1, 0, 2.6],
  ['PALACE', 0, 5.7, -13.95, 0, 1, 3.0], ['TUNNEL', -33, 6.2, -13.95, 0, 1, 3.4],
];

function drawFloorText(c, w, h, spec) {
  c.clearRect(0, 0, w, h);
  const fs = h * 0.62; c.font = `900 ${fs}px "Arial Narrow","Barlow Condensed","Helvetica Neue",Arial,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  let size = fs; while (c.measureText(spec.text).width > w * 0.9 && size > 8) { size -= 2; c.font = `900 ${size}px "Arial Narrow","Barlow Condensed","Helvetica Neue",Arial,sans-serif`; }
  const col = '#' + spec.color.toString(16).padStart(6, '0');
  c.lineJoin = 'round'; c.lineWidth = Math.max(3, h * 0.07); c.strokeStyle = 'rgba(40,28,16,0.55)'; c.strokeText(spec.text, w / 2, h / 2 + h * 0.02);
  c.fillStyle = col; c.globalAlpha = 0.93; c.fillText(spec.text, w / 2, h / 2 + h * 0.02); c.globalAlpha = 1;
  // chevron underline
  const tw = c.measureText(spec.text).width; c.fillStyle = col; c.globalAlpha = 0.75; c.fillRect(w / 2 - tw / 2, h * 0.88, tw, Math.max(2, h * 0.04)); c.globalAlpha = 1;
  // erode
  const r = rngf(spec.text.length * 13 + 7); c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < w * h / 260; i++) { c.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.5})`; c.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } c.globalCompositeOperation = 'source-over';
}
function drawLetter(c, w, h, spec) {
  c.clearRect(0, 0, w, h); const col = '#' + spec.color.toString(16).padStart(6, '0');
  c.lineWidth = w * 0.045; c.strokeStyle = col; c.globalAlpha = 0.9; c.beginPath(); c.arc(w / 2, h / 2, w * 0.43, 0, 7); c.stroke();
  c.lineWidth = w * 0.012; c.beginPath(); c.arc(w / 2, h / 2, w * 0.36, 0, 7); c.stroke(); c.globalAlpha = 1;
  c.font = `900 ${w * 0.5}px "Arial Black","Arial Narrow",Arial,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.strokeStyle = 'rgba(40,28,16,0.5)'; c.lineWidth = w * 0.03; c.strokeText(spec.text, w / 2, h / 2 + h * 0.03); c.fillStyle = '#fff4d8'; c.fillText(spec.text, w / 2, h / 2 + h * 0.03);
}
function drawEmblem(c, w, h, spec) {
  c.clearRect(0, 0, w, h); const col = '#' + spec.color.toString(16).padStart(6, '0'); const cx = w / 2, cy = h / 2;
  const hex = (r) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); };
  c.strokeStyle = col; c.lineWidth = w * 0.05; hex(w * 0.44); c.stroke(); c.lineWidth = w * 0.015; hex(w * 0.36); c.stroke();
  c.fillStyle = col; c.globalAlpha = 0.85; c.beginPath();
  if (spec.kind === 'ember') { c.moveTo(cx, cy - w * 0.26); c.quadraticCurveTo(cx + w * 0.22, cy - w * 0.02, cx + w * 0.1, cy + w * 0.2); c.quadraticCurveTo(cx, cy + w * 0.28, cx - w * 0.1, cy + w * 0.2); c.quadraticCurveTo(cx - w * 0.22, cy - w * 0.02, cx, cy - w * 0.26); }
  else { c.moveTo(cx - w * 0.22, cy - w * 0.12); c.quadraticCurveTo(cx - w * 0.1, cy - w * 0.26, cx, cy - w * 0.1); c.quadraticCurveTo(cx + w * 0.1, cy + w * 0.06, cx + w * 0.22, cy - w * 0.1); c.lineTo(cx + w * 0.22, cy + w * 0.04); c.quadraticCurveTo(cx + w * 0.1, cy + w * 0.2, cx, cy + w * 0.06); c.quadraticCurveTo(cx - w * 0.1, cy - w * 0.1, cx - w * 0.22, cy + w * 0.06); }
  c.fill(); c.globalAlpha = 1;
}
function drawPad(c, w, h, spec) { c.clearRect(0, 0, w, h); const col = '#' + spec.color.toString(16).padStart(6, '0'); c.strokeStyle = col; c.globalAlpha = 0.75; c.lineWidth = w * 0.07; c.beginPath(); c.arc(w / 2, h / 2, w * 0.4, 0, 7); c.stroke(); c.lineWidth = w * 0.025; c.beginPath(); c.arc(w / 2, h / 2, w * 0.28, 0, 7); c.stroke(); c.globalAlpha = 1; }
function drawWindow(c, w, h, spec) {
  c.clearRect(0, 0, w, h); const r = rngf(spec.seed * 7 + 3); const sh = ['#2a9d9f', '#c4673d', '#6b8e4e', '#3b6f8f', '#8a5a36', '#d9a441'][spec.seed % 6];
  const bx = w * 0.16, bw = w * 0.68, top = h * 0.08, arch = bw * 0.5;
  const path = () => { c.beginPath(); c.moveTo(bx, h * 0.92); c.lineTo(bx, top + arch); c.arc(bx + bw / 2, top + arch, bw / 2, Math.PI, 0); c.lineTo(bx + bw, h * 0.92); c.closePath(); };
  // frame
  c.save(); c.translate(0, 0); path(); c.lineWidth = w * 0.1; c.strokeStyle = '#efe0b8'; c.stroke(); c.restore();
  path(); const g = c.createLinearGradient(0, top, 0, h); g.addColorStop(0, '#2c3a46'); g.addColorStop(1, '#15191f'); c.fillStyle = g; c.fill();
  c.save(); path(); c.clip(); c.fillStyle = 'rgba(120,170,200,0.25)'; c.fillRect(bx, top, bw * 0.4, h); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(bx + bw / 2 - 1.5, top, 3, h); c.fillRect(bx, h * 0.5, bw, 3); c.restore();
  // sill
  c.fillStyle = '#d8c79a'; c.fillRect(bx - w * 0.07, h * 0.92, bw + w * 0.14, h * 0.06); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(bx - w * 0.07, h * 0.97, bw + w * 0.14, h * 0.025);
  if (spec.kind === 'shutter') { c.fillStyle = sh; c.fillRect(bx, top + arch * 0.6, bw, h * 0.92 - top - arch * 0.6); c.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = top + arch * 0.7; y < h * 0.92; y += 5) c.fillRect(bx, y, bw, 1.6); }
  else if (spec.kind === 'window') { c.fillStyle = sh; c.fillRect(0, top + arch * 0.8, bx - 2, h * 0.92 - top - arch * 0.8); c.fillRect(bx + bw + 2, top + arch * 0.8, w - bx - bw - 2, h * 0.92 - top - arch * 0.8); c.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = top + arch * 0.9; y < h * 0.92; y += 5) { c.fillRect(0, y, bx - 2, 1.5); c.fillRect(bx + bw + 2, y, w - bx - bw - 2, 1.5); } }
  else { c.strokeStyle = '#1a1a1a'; c.lineWidth = 2.2; for (let x = bx + 6; x < bx + bw; x += 8) { c.beginPath(); c.moveTo(x, top + arch * 0.4); c.lineTo(x, h * 0.92); c.stroke(); } c.beginPath(); c.moveTo(bx, h * 0.6); c.lineTo(bx + bw, h * 0.6); c.stroke(); }
  void r;
}
function drawMural(c, w, h, spec) {
  c.clearRect(0, 0, w, h); const r = rngf(spec.seed + 5); const col = '#' + spec.color.toString(16).padStart(6, '0'); const cream = '#f3e4bd';
  c.globalAlpha = 0.9; c.fillStyle = col;
  if (spec.kind === 'chevrons') { const n = 5, s = w / n; for (let i = 0; i < n; i++) { c.beginPath(); c.moveTo(i * s, h * 0.15); c.lineTo(i * s + s * 0.5, h * 0.55); c.lineTo(i * s + s, h * 0.15); c.lineTo(i * s + s, h * 0.38); c.lineTo(i * s + s * 0.5, h * 0.78); c.lineTo(i * s, h * 0.38); c.closePath(); c.fill(); } }
  else if (spec.kind === 'triangles') { const n = 4, s = w / n; for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? cream : col; c.beginPath(); c.moveTo(i * s, h * 0.9); c.lineTo(i * s + s / 2, h * 0.1); c.lineTo(i * s + s, h * 0.9); c.closePath(); c.fill(); } c.fillStyle = col; c.fillRect(0, h * 0.9, w, h * 0.06); }
  else if (spec.kind === 'stripes') { for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? cream : col; c.fillRect(0, h * (0.1 + i * 0.2), w, h * 0.14); } }
  else { c.beginPath(); c.arc(w / 2, h * 0.55, h * 0.36, 0, 7); c.fill(); c.fillStyle = cream; c.beginPath(); c.arc(w / 2, h * 0.55, h * 0.22, 0, 7); c.fill(); c.strokeStyle = col; c.lineWidth = h * 0.05; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * h * 0.42, h * 0.55 + Math.sin(a) * h * 0.42); c.lineTo(w / 2 + Math.cos(a) * h * 0.52, h * 0.55 + Math.sin(a) * h * 0.52); c.stroke(); } }
  c.globalAlpha = 1; c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < w * h / 55; i++) { c.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`; c.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 4); }
  for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(0,0,0,0.9)'; const x = r() * w, y = r() * h; c.beginPath(); c.ellipse(x, y, 4 + r() * 14, 3 + r() * 8, r() * 3, 0, 7); c.fill(); }
  c.globalCompositeOperation = 'source-over';
}
function drawPlaque(c, w, h, spec) {
  c.clearRect(0, 0, w, h); const r = 8; c.fillStyle = '#17535a'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, r); c.fill(); c.strokeStyle = '#f3e4bd'; c.lineWidth = 3; c.beginPath(); c.roundRect(6, 6, w - 12, h - 12, r - 2); c.stroke();
  let size = h * 0.56; c.font = `900 ${size}px "Arial Narrow","Barlow Condensed",Arial,sans-serif`; while (c.measureText(spec.text).width > w * 0.84 && size > 8) { size -= 2; c.font = `900 ${size}px "Arial Narrow","Barlow Condensed",Arial,sans-serif`; }
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff4d8'; c.fillText(spec.text, w / 2, h / 2 + h * 0.03);
}
const DRAW = { ftext: drawFloorText, letter: drawLetter, emblem: drawEmblem, pad: drawPad, window: drawWindow, shutter: drawWindow, grille: drawWindow, mural: drawMural, plaque: drawPlaque };

export function buildDecals(D, VB, spawns, sites) {
  const reqs = []; // {key, spec, ppm, w, h(m), place:{...}}
  const add = (spec, wm, hm, place, ppm = 60) => reqs.push({ spec, wm, hm, place, ppm, key: JSON.stringify([spec, +wm.toFixed(2), +hm.toFixed(2)]) });
  const FT_H = 0.9;
  for (const [text, x, z, rot, w, color] of FLOOR_TEXT) add({ t: 'ftext', text, color }, w, FT_H * (w > 6 ? 1.0 : 0.85), { floor: true, x, z, rot }, 64);
  add({ t: 'letter', text: 'A', color: 0xff7a2f }, 3.6, 3.6, { floor: true, x: 34.5, z: -28.5, rot: 0, lift: 0.07 }, 64);
  add({ t: 'letter', text: 'B', color: 0x2fd0ff }, 3.6, 3.6, { floor: true, x: -33, z: -31, rot: 0, lift: 0.07 }, 64);
  add({ t: 'letter', text: 'A', color: 0xffe2a0 }, 6.5, 6.5, { floor: true, x: 34.5, z: -21.5, rot: 0 }, 56);
  add({ t: 'letter', text: 'B', color: 0xc8f4ff }, 6.5, 6.5, { floor: true, x: -33, z: -38.5, rot: 0 }, 56);
  add({ t: 'emblem', kind: 'ember', color: 0xff7a2f }, 6.0, 6.0, { floor: true, x: 0, z: 46.5, rot: 0 }, 48);
  add({ t: 'emblem', kind: 'tide', color: 0x2fd0ff }, 6.0, 6.0, { floor: true, x: 0, z: -46.5, rot: 180 }, 48);
  for (const s of spawns.ember) add({ t: 'pad', color: 0xff9a4d }, 1.4, 1.4, { floor: true, x: s.x, z: s.z, rot: 0 }, 40);
  for (const s of spawns.tide) add({ t: 'pad', color: 0x5fd8ff }, 1.4, 1.4, { floor: true, x: s.x, z: s.z, rot: 0 }, 40);
  for (const [text, x, y, z, nx, nz, w] of WALL_TEXT) add({ t: 'plaque', text }, w, w * 0.2, { wall: true, c: [x, y, z], n: [nx, nz] }, 70);
  for (const d of D.decals) {
    if (d.type !== 'wall') continue;
    if (d.kind === 'window' || d.kind === 'shutter' || d.kind === 'grille') add({ t: d.kind, kind: d.kind, seed: d.seed % 6 }, d.w + 0.8, d.h, { wall: true, c: d.c, n: d.n }, 64);
    else add({ t: 'mural', kind: d.kind, color: d.color, seed: d.seed % 5 }, Math.round(d.w * 2) / 2, d.h, { wall: true, c: d.c, n: d.n }, 56);
  }
  // pack
  const AS = 2048; const cells = new Map(); let order = [];
  for (const r of reqs) if (!cells.has(r.key)) { cells.set(r.key, { r, px: Math.max(16, Math.round(r.wm * r.ppm)), py: Math.max(16, Math.round(r.hm * r.ppm)) }); order.push(r.key); }
  const pack = (scale) => { let x = 0, y = 0, rowH = 0; const sorted = order.map((k) => cells.get(k)).sort((a, b) => b.py - a.py); for (const c of sorted) { const w = Math.ceil(c.px * scale) + 2, h = Math.ceil(c.py * scale) + 2; if (x + w > AS) { x = 0; y += rowH; rowH = 0; } if (y + h > AS) return false; c.x = x + 1; c.y = y + 1; c.w = w - 2; c.h = h - 2; x += w; rowH = Math.max(rowH, h); } return true; };
  let sc = 1; while (!pack(sc) && sc > 0.3) sc *= 0.9;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = AS; const c2 = canvas.getContext('2d');
  for (const c of cells.values()) { const off = document.createElement('canvas'); off.width = c.w; off.height = c.h; const oc = off.getContext('2d'); DRAW[c.r.spec.t === 'window' || c.r.spec.t === 'shutter' || c.r.spec.t === 'grille' ? 'window' : c.r.spec.t](oc, c.w, c.h, { ...c.r.spec, text: c.r.spec.text, color: c.r.spec.color }); c2.drawImage(off, c.x, c.y); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping; texture.needsUpdate = true;
  // geometry
  const white = [1, 1, 1, 1];
  for (const r of reqs) {
    const c = cells.get(r.key); const u0 = c.x / AS, u1 = (c.x + c.w) / AS, vT = 1 - c.y / AS, vB = 1 - (c.y + c.h) / AS;
    const uv = [[u0, vB], [u1, vB], [u1, vT], [u0, vT]];   // BL, BR, TR, TL
    const p = r.place;
    if (p.floor) {
      const a = p.rot * Math.PI / 180, ux = Math.sin(a), uz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a), hw = r.wm / 2, hh = r.hm / 2;
      const corner = (sr, su) => { const x = p.x + rx * hw * sr + ux * hh * su, z = p.z + rz * hw * sr + uz * hh * su; return [x, heightAt(D.g, x, z) + 0.035 + (p.lift || 0), z]; };
      VB.quad('signs', corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), white, { uv, chunkAt: [p.x, p.z] });
    } else {
      const [nx, nz] = p.n; const rx = nz, rz = -nx, hw = r.wm / 2, hh = r.hm / 2; const o = 0.03;
      const corner = (sr, su) => [p.c[0] + rx * hw * sr + nx * o, p.c[1] + hh * su, p.c[2] + rz * hw * sr + nz * o];
      VB.quad('signs', corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), white, { uv, chunkAt: [p.c[0], p.c[2]] });
    }
  }
  return { texture, canvas, count: reqs.length, cells: cells.size, scale: sc };
}
