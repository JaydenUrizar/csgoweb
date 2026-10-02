// Procedural canvas textures for the map. Mostly neutral/light so per-vertex colours drive the hue.
import * as THREE from 'three';

function rngf(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const mk = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const grey = (v, a = 1) => `rgba(${v | 0},${v | 0},${(v * 0.97) | 0},${a})`;

function speckle(ctx, w, h, r, n, amt, dark = true) {
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, s = 0.6 + r() * 1.6, v = dark ? 40 + r() * 60 : 230;
    ctx.fillStyle = `rgba(${v},${v * 0.9},${v * 0.75},${amt * (0.4 + r() * 0.6)})`;
    ctx.fillRect(x, y, s, s);
  }
}
/** wraps drawing so features crossing the edge tile seamlessly */
function wrapDraw(w, h, fn) { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) fn(dx, dy); }

function blocks(w, h, rows, wMin, wMax, seed, base = 224, joint = 0.6) {
  const [c, ctx] = mk(w, h); const r = rngf(seed);
  ctx.fillStyle = grey(base); ctx.fillRect(0, 0, w, h);
  const rh = h / rows;
  for (let row = 0; row < rows; row++) {
    const y = row * rh;
    const use = []; let acc = 0;
    while (acc < w) { const bw = wMin + r() * (wMax - wMin); use.push(bw); acc += bw; }
    if (acc - w > use[use.length - 1] * 0.6 && use.length > 2) { acc -= use.pop(); }
    const k = w / use.reduce((a, b) => a + b, 0); let off = 0;
    for (const bw0 of use) {
      const bw = bw0 * k; const tone = base - 26 + r() * 42;
      const grd = ctx.createLinearGradient(0, y, 0, y + rh);
      grd.addColorStop(0, grey(tone + 12)); grd.addColorStop(1, grey(tone - 10));
      ctx.fillStyle = grd; ctx.fillRect(off, y, bw, rh);
      // chipped corner
      if (r() < 0.35) { ctx.fillStyle = `rgba(90,70,50,${0.25 + r() * 0.25})`; const cx = r() < 0.5 ? off : off + bw - 10; ctx.beginPath(); ctx.moveTo(cx, y + rh); ctx.lineTo(cx + 8 + r() * 6, y + rh); ctx.lineTo(cx + 3, y + rh - 5 - r() * 6); ctx.closePath(); ctx.fill(); }
      // joint
      ctx.fillStyle = `rgba(60,46,32,${joint})`; ctx.fillRect(off, y + rh - 2.5, bw, 3); ctx.fillRect(off + bw - 2, y, 3, rh);
      ctx.fillStyle = 'rgba(255,255,240,0.18)'; ctx.fillRect(off + 1, y + 1, bw - 3, 1.5);
      off += bw;
    }
  }
  speckle(ctx, w, h, r, 2600, 0.14); speckle(ctx, w, h, r, 900, 0.1, false);
  // weathering streaks
  for (let i = 0; i < 14; i++) { const x = r() * w, y = r() * h * 0.6, len = 40 + r() * 140; const g = ctx.createLinearGradient(0, y, 0, y + len); g.addColorStop(0, 'rgba(70,50,30,0.0)'); g.addColorStop(0.4, `rgba(70,50,30,${0.05 + r() * 0.06})`); g.addColorStop(1, 'rgba(70,50,30,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, 6 + r() * 14, len); }
  return c;
}

function plaster(seed) {
  const w = 1024, [c, ctx] = mk(w); const r = rngf(seed);
  ctx.fillStyle = grey(238); ctx.fillRect(0, 0, w, w);
  for (let i = 0; i < 130; i++) { const x = r() * w, y = r() * w, rad = 30 + r() * 110; const dark = r() < 0.55; wrapDraw(w, w, (dx, dy) => { const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad); g.addColorStop(0, dark ? `rgba(120,95,70,${0.05 + r() * 0.06})` : 'rgba(255,255,255,0.09)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2); }); }
  // peeled patches showing the block work beneath
  for (let n = 0; n < 4; n++) {
    const px = r() * (w - 150), py = r() * (w - 150), pw = 60 + r() * 110, ph = 50 + r() * 100;
    ctx.save(); ctx.beginPath(); ctx.moveTo(px, py); for (let a = 0; a <= 12; a++) { const t = a / 12; ctx.lineTo(px + pw * t, py + (r() - 0.5) * 12); } for (let a = 0; a <= 10; a++) { const t = a / 10; ctx.lineTo(px + pw + (r() - 0.5) * 14, py + ph * t); } for (let a = 12; a >= 0; a--) { const t = a / 12; ctx.lineTo(px + pw * t, py + ph + (r() - 0.5) * 12); } for (let a = 10; a >= 0; a--) { const t = a / 10; ctx.lineTo(px + (r() - 0.5) * 14, py + ph * t); } ctx.closePath(); ctx.clip();
    ctx.fillStyle = grey(196); ctx.fillRect(px - 10, py - 10, pw + 20, ph + 20);
    for (let yy = py; yy < py + ph + 30; yy += 32) { ctx.fillStyle = 'rgba(60,46,32,0.4)'; ctx.fillRect(px - 10, yy, pw + 20, 2.5); let xx = px - r() * 60; while (xx < px + pw) { ctx.fillRect(xx, yy, 2.5, 32); xx += 60 + r() * 50; } }
    ctx.restore();
    ctx.strokeStyle = 'rgba(80,60,40,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  speckle(ctx, w, w, r, 20000, 0.1); speckle(ctx, w, w, r, 6000, 0.12, false);
  for (let i = 0; i < 3; i++) { let x = r() * w, y = r() * w; ctx.strokeStyle = 'rgba(70,50,30,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (r() - 0.5) * 22; y += 8 + r() * 12; ctx.lineTo(x, y); } ctx.stroke(); }
  return c;
}

function flagstone(seed) {
  const w = 512, [c, ctx] = mk(w); const r = rngf(seed);
  ctx.fillStyle = grey(222); ctx.fillRect(0, 0, w, w);
  const rows = [128, 128, 128, 128]; let y = 0;
  for (const rh of rows) {
    let acc = 0; const ws = []; while (acc < w - 90) { const bw = 100 + r() * 110; ws.push(bw); acc += bw; } const last = w - acc; ws.push(last < 60 ? ws.pop() + last : last);
    const k = w / ws.reduce((a, b) => a + b, 0); let x = 0;
    for (const bw0 of ws) { const bw = bw0 * k; const tone = 212 + r() * 34 - 12; ctx.fillStyle = grey(tone); ctx.fillRect(x + 1, y + 1, bw - 2, rh - 2);
      const g = ctx.createLinearGradient(x, y, x + bw, y + rh); g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.10)'); ctx.fillStyle = g; ctx.fillRect(x + 1, y + 1, bw - 2, rh - 2);
      ctx.fillStyle = 'rgba(70,55,40,0.55)'; ctx.fillRect(x, y, bw, 3); ctx.fillRect(x, y, 3, rh);
      ctx.fillStyle = 'rgba(255,250,235,0.22)'; ctx.fillRect(x + 3, y + 3, bw - 5, 1.5);
      if (r() < 0.3) { ctx.strokeStyle = 'rgba(70,55,40,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + r() * bw, y + 3); ctx.lineTo(x + r() * bw, y + rh); ctx.stroke(); }
      x += bw; }
    y += rh;
  }
  speckle(ctx, w, w, r, 4200, 0.16); speckle(ctx, w, w, r, 800, 0.1, false);
  return c;
}

function brickPave(seed) {
  const w = 512, [c, ctx] = mk(w); const r = rngf(seed);
  ctx.fillStyle = 'rgb(120,96,74)'; ctx.fillRect(0, 0, w, w);
  const bw = 64, bh = 32;
  for (let row = 0; row < w / bh; row++) for (let col = 0; col < w / bw; col++) {
    const x = col * bw + (row % 2 ? bw / 2 : 0) - (row % 2 ? bw : 0) * 0 , y = row * bh; const tone = 205 + r() * 40 - 8;
    wrapDraw(w, 0, (dx) => { const g = ctx.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, grey(tone + 10)); g.addColorStop(1, grey(tone - 8)); ctx.fillStyle = g; ctx.fillRect(x + dx + 1.5, y + 1.5, bw - 3, bh - 3); });
    if (r() < 0.12) { ctx.fillStyle = 'rgba(60,40,30,0.25)'; ctx.fillRect(x + 4, y + 4, bw - 10, bh - 10); }
  }
  speckle(ctx, w, w, r, 3500, 0.15);
  return c;
}

function sand(seed) {
  const w = 256, [c, ctx] = mk(w); const r = rngf(seed);
  ctx.fillStyle = grey(236); ctx.fillRect(0, 0, w, w);
  for (let i = 0; i < 26; i++) { const y = r() * w; wrapDraw(w, w, (dx, dy) => { ctx.strokeStyle = `rgba(150,120,80,${0.05 + r() * 0.05})`; ctx.lineWidth = 2 + r() * 3; ctx.beginPath(); ctx.moveTo(dx, y + dy); for (let x = 0; x <= w; x += 16) ctx.lineTo(x + dx, y + dy + Math.sin(x * 0.05 + i) * 4 + (r() - 0.5) * 2); ctx.stroke(); }); }
  speckle(ctx, w, w, r, 5200, 0.15); speckle(ctx, w, w, r, 2000, 0.16, false);
  for (let i = 0; i < 26; i++) { const x = r() * w, y = r() * w; ctx.fillStyle = `rgba(120,100,80,${0.2 + r() * 0.2})`; ctx.beginPath(); ctx.ellipse(x, y, 1.5 + r() * 2.5, 1 + r() * 2, r() * 3, 0, 7); ctx.fill(); }
  return c;
}

function tileTex(seed) {
  const w = 256, [c, ctx] = mk(w); const r = rngf(seed); const n = 4, s = w / n;
  ctx.fillStyle = 'rgb(210,214,206)'; ctx.fillRect(0, 0, w, w);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const t = 232 + r() * 20 - 10; const x = i * s, y = j * s;
    const g = ctx.createLinearGradient(x, y, x + s, y + s); g.addColorStop(0, grey(t + 14)); g.addColorStop(0.5, grey(t)); g.addColorStop(1, grey(t - 14));
    ctx.fillStyle = g; ctx.fillRect(x + 2.5, y + 2.5, s - 5, s - 5);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x + 4, y + 4, s * 0.45, 2); ctx.fillRect(x + 4, y + 4, 2, s * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(x + 4, y + s - 6, s - 8, 2);
    if ((i + j) % 2 === 0) { ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 10, y + s / 2); ctx.lineTo(x + s / 2, y + 10); ctx.lineTo(x + s - 10, y + s / 2); ctx.lineTo(x + s / 2, y + s - 10); ctx.closePath(); ctx.stroke(); }
  }
  speckle(ctx, w, w, r, 800, 0.08);
  return c;
}

function roofTex(seed) {
  const w = 256, [c, ctx] = mk(w); const r = rngf(seed);
  ctx.fillStyle = grey(210); ctx.fillRect(0, 0, w, w);
  const tw = 64, th = 70;
  for (let row = -1; row < w / th + 1; row++) for (let col = 0; col < w / tw; col++) {
    const x = col * tw, y = row * th * 0.55; const tone = 200 + r() * 40 - 12;
    const g = ctx.createLinearGradient(x, y, x + tw, y); g.addColorStop(0, grey(tone - 12)); g.addColorStop(0.4, grey(tone + 8)); g.addColorStop(1, grey(tone - 14)); ctx.fillStyle = g; ctx.fillRect(x, y, tw - 1, th);
    ctx.fillStyle = 'rgba(40,20,10,0.18)'; ctx.fillRect(x, y + th - 4, tw, 3);
  }
  speckle(ctx, w, w, r, 1800, 0.1);
  return c;
}

function woodPlanks(seed, w = 256) {
  const [c, ctx] = mk(w); const r = rngf(seed); const n = 8, s = w / n;
  for (let i = 0; i < n; i++) {
    const t = 200 + r() * 40; const g = ctx.createLinearGradient(0, 0, s, 0); g.addColorStop(0, grey(t - 24)); g.addColorStop(0.5, grey(t)); g.addColorStop(1, grey(t - 30)); ctx.fillStyle = g; ctx.fillRect(i * s, 0, s, w);
    for (let k = 0; k < 9; k++) { const x = i * s + 3 + r() * (s - 6); ctx.strokeStyle = `rgba(70,45,25,${0.1 + r() * 0.16})`; ctx.lineWidth = 0.8 + r(); ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + (r() - 0.5) * 6, w * 0.3, x + (r() - 0.5) * 6, w * 0.6, x + (r() - 0.5) * 4, w); ctx.stroke(); }
    ctx.fillStyle = 'rgba(30,18,8,0.5)'; ctx.fillRect(i * s, 0, 1.6, w);
    if (r() < 0.5) { ctx.fillStyle = 'rgba(40,25,10,0.5)'; ctx.beginPath(); ctx.ellipse(i * s + s / 2, r() * w, 3, 5 + r() * 5, 0, 0, 7); ctx.fill(); }
  }
  return c;
}

function crateTex(seed) {
  const w = 256, [c, ctx] = mk(w); const r = rngf(seed);
  ctx.fillStyle = grey(200); ctx.fillRect(0, 0, w, w);
  const bd = 26; const boards = 4, bs = (w - bd * 2) / boards;
  for (let i = 0; i < boards; i++) {
    const t = 205 + r() * 34; ctx.fillStyle = grey(t); ctx.fillRect(bd, bd + i * bs, w - bd * 2, bs);
    for (let k = 0; k < 7; k++) { const y = bd + i * bs + 4 + r() * (bs - 8); ctx.strokeStyle = `rgba(70,45,25,${0.1 + r() * 0.15})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(bd, y); ctx.lineTo(w - bd, y + (r() - 0.5) * 4); ctx.stroke(); }
    ctx.fillStyle = 'rgba(30,18,8,0.55)'; ctx.fillRect(bd, bd + i * bs, w - bd * 2, 2);
  }
  // frame
  ctx.fillStyle = grey(176); ctx.fillRect(0, 0, w, bd); ctx.fillRect(0, w - bd, w, bd); ctx.fillRect(0, 0, bd, w); ctx.fillRect(w - bd, 0, bd, w);
  ctx.strokeStyle = 'rgba(30,18,8,0.6)'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, w - 3, w - 3); ctx.strokeRect(bd, bd, w - bd * 2, w - bd * 2);
  ctx.fillStyle = grey(186); ctx.save(); ctx.beginPath(); ctx.moveTo(bd, bd + 16); ctx.lineTo(bd + 16, bd); ctx.lineTo(w - bd, w - bd - 16); ctx.lineTo(w - bd - 16, w - bd); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(30,18,8,0.55)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  ctx.fillStyle = 'rgba(30,20,10,0.6)'; for (const [x, y] of [[13, 13], [w - 13, 13], [13, w - 13], [w - 13, w - 13]]) { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,240,210,0.25)'; ctx.fillRect(3, 3, w - 6, 2);
  speckle(ctx, w, w, r, 900, 0.14);
  return c;
}

function metalPanel(seed, ribbed = false) {
  const w = 256, [c, ctx] = mk(w); const r = rngf(seed);
  ctx.fillStyle = grey(224); ctx.fillRect(0, 0, w, w);
  if (ribbed) { for (let x = 0; x < w; x += 16) { const g = ctx.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, grey(250)); g.addColorStop(0.35, grey(224)); g.addColorStop(0.65, grey(190)); g.addColorStop(1, grey(150)); ctx.fillStyle = g; ctx.fillRect(x, 0, 16, w); } }
  else {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const x = i * 128, y = j * 128; ctx.fillStyle = grey(214 + r() * 20); ctx.fillRect(x + 3, y + 3, 122, 122); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, 124, 124); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x + 4, y + 4, 118, 2); for (const [rx, ry] of [[12, 12], [116, 12], [12, 116], [116, 116]]) { ctx.fillStyle = 'rgba(40,40,40,0.55)'; ctx.beginPath(); ctx.arc(x + rx, y + ry, 2.6, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x + rx - 1, y + ry - 1.5, 1.5, 1.5); } }
  }
  speckle(ctx, w, w, r, 1500, 0.12);
  for (let i = 0; i < 8; i++) { const x = r() * w, y = r() * w; const g = ctx.createLinearGradient(0, y, 0, y + 90); g.addColorStop(0, 'rgba(90,60,30,0)'); g.addColorStop(0.3, 'rgba(90,60,30,0.09)'); g.addColorStop(1, 'rgba(90,60,30,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, 5 + r() * 10, 90); }
  return c;
}

function deckTex(seed) {
  const w = 256, [c, ctx] = mk(w); const r = rngf(seed);
  ctx.fillStyle = grey(196); ctx.fillRect(0, 0, w, w);
  const s = 32;
  for (let j = 0; j < w / s; j++) for (let i = 0; i < w / s; i++) {
    const x = i * s + (j % 2 ? s / 2 : 0); wrapDraw(w, 0, (dx) => { ctx.save(); ctx.translate(x + dx + s / 2, j * s + s / 2); ctx.rotate(((i + j) % 2 ? 0.78 : -0.78)); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(-12, -2.4, 24, 4.8); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-12, 2.4, 24, 1.6); ctx.restore(); });
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, w, 3); ctx.fillRect(0, 0, 3, w);
  speckle(ctx, w, w, r, 1200, 0.16);
  return c;
}

function clothStripes(seed) {
  const w = 128, [c, ctx] = mk(w); const r = rngf(seed);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#f1e6c8' : '#c4573a'; ctx.fillRect(i * 16, 0, 16, w); }
  for (let y = 0; y < w; y += 3) { ctx.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.03})`; ctx.fillRect(0, y, w, 1); }
  speckle(ctx, w, w, r, 300, 0.08);
  return c;
}

function waterTex(seed) {
  const w = 256, [c, ctx] = mk(w); const r = rngf(seed);
  const g = ctx.createLinearGradient(0, 0, w, w); g.addColorStop(0, '#2aa6a6'); g.addColorStop(1, '#1a8d9a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
  for (let i = 0; i < 46; i++) { const x = r() * w, y = r() * w, len = 30 + r() * 60; wrapDraw(w, w, (dx, dy) => { ctx.strokeStyle = `rgba(230,255,250,${0.1 + r() * 0.2})`; ctx.lineWidth = 1 + r() * 1.6; ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.bezierCurveTo(x + dx + len * 0.3, y + dy - 8, x + dx + len * 0.6, y + dy + 8, x + dx + len, y + dy); ctx.stroke(); }); }
  return c;
}

export function makeTextures(anisotropy = 8) {
  const T = {};
  const add = (key, canvas, repeat = true) => {
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; T[key] = t;
  };
  add('wall', blocks(512, 512, 8, 96, 190, 11, 226));
  add('plaster', plaster(23));
  add('floor', flagstone(31));
  add('brick', brickPave(41));
  add('sand', sand(51));
  add('tile', tileTex(61));
  add('roof', roofTex(71));
  add('wood', woodPlanks(81));
  add('crate', crateTex(91), true);
  add('metal', metalPanel(101));
  add('ribbed', metalPanel(111, true));
  add('deck', deckTex(121));
  add('cloth', clothStripes(131));
  add('water', waterTex(141));
  return T;
}
export { rngf };
