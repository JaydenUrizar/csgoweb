// In-world debug overlay for the navgrid. Layers (toggle with debug.layers({...})):
//   nodes  - walkable nodes, one colour per area, bright outline where areas meet, dark = wall-adjacent
//   labels - area names     links - jump (magenta) / drop (yellow) links as thin lines     paths - sample routes
//   cover  - cover points (cyan cones, white = peek spot) + hold-angle rays      edges - walk edges      danger - heat
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LINK_JUMP } from './config.js';
import { buildTestMap } from './testmap.js';
import { validatePaths, coverageReport, tacticsBench } from './validate.js';

export function createDebug(ctx, nav, sys) {
  const group = new THREE.Group(); group.name = 'nav-debug'; group.visible = false; ctx.render?.scene?.add(group);
  let on = false, panel = null, camMode = null, info = '', fit = { cx: 0, cz: 0, ext: 100, extX: 100, extZ: 100 }, hidden = [];
  const L = { nodes: true, labels: true, links: false, paths: true, cover: true, edges: false, danger: false };
  const parts = {};
  const col = new THREE.Color(), V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const clear = (k) => { const o = parts[k]; if (!o) return; group.remove(o); o.traverse?.((c) => { c.geometry?.dispose?.(); c.material?.map?.dispose?.(); c.material?.dispose?.(); }); parts[k] = null; };
  const mat = (o) => new THREE.LineBasicMaterial({ fog: false, depthTest: false, transparent: true, ...o });
  const fat = (pts, color, width = 3, opacity = 1) => {
    const g = new LineGeometry(); g.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
    const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthTest: false, worldUnits: false });
    const r = ctx.render?.renderer?.getSize?.(new THREE.Vector2()); m.resolution.set(r?.x || 1280, r?.y || 720); const l = new Line2(g, m); l.renderOrder = 7; l.frustumCulled = false; return l;
  };
  const unit = () => Math.max(1, fit.ext / 70);          // world size scaling so markers stay readable when the whole map is on screen

  function buildNodes() {
    for (const k of ['nodes', 'links', 'edges', 'labels']) clear(k); const g = sys.g; if (!g || !g.N) return;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < g.N; i++) { x0 = Math.min(x0, g.px[i]); x1 = Math.max(x1, g.px[i]); z0 = Math.min(z0, g.pz[i]); z1 = Math.max(z1, g.pz[i]); }
    fit = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, extX: x1 - x0 + 8, extZ: z1 - z0 + 8, ext: Math.max(x1 - x0, z1 - z0) + 8 };
    if (L.nodes) {
      const pos = new Float32Array(g.N * 3), c = new Float32Array(g.N * 3);
      for (let i = 0; i < g.N; i++) {
        pos[i * 3] = g.px[i]; pos[i * 3 + 1] = g.py[i] + 0.08; pos[i * 3 + 2] = g.pz[i];
        let border = false; for (let k = 0; k < 8; k += 2) { const j = g.nb[i * 8 + k]; if (j >= 0 && g.region[j] !== g.region[i]) { border = true; break; } }
        if (border) col.setRGB(1, 1, 1); else col.setHSL((g.region[i] * 0.381966) % 1, 0.75, g.wall[i] === 0 ? 0.32 : 0.55);
        c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      parts.nodes = new THREE.Points(geo, new THREE.PointsMaterial({ size: 4, vertexColors: true, sizeAttenuation: false, fog: false, depthTest: false, transparent: true, opacity: 0.95 }));
      parts.nodes.renderOrder = 5; parts.nodes.frustumCulled = false; group.add(parts.nodes);
    }
    if (L.links) {
      const lp = [], lc = [];
      for (let i = 0; i < g.N; i++) for (let p = g.lstart[i]; p < g.lstart[i + 1]; p++) {
        const j = g.lto[p], jump = g.ltype[p] === LINK_JUMP; col.set(jump ? 0xff40ff : 0xffd030);
        lp.push(g.px[i], g.py[i] + 0.2, g.pz[i], g.px[j], g.py[j] + 0.2, g.pz[j]); for (let k = 0; k < 2; k++) lc.push(col.r, col.g, col.b);
      }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
      parts.links = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, fog: false, depthTest: false, transparent: true, opacity: 0.55 })); parts.links.renderOrder = 6; parts.links.frustumCulled = false; group.add(parts.links);
    }
    if (L.edges) {
      const ep = []; for (let i = 0; i < g.N; i++) for (let k = 0; k < 4; k++) { const j = g.nb[i * 8 + k]; if (j >= 0) ep.push(g.px[i], g.py[i] + 0.05, g.pz[i], g.px[j], g.py[j] + 0.05, g.pz[j]); }
      const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3)); parts.edges = new THREE.LineSegments(eg, mat({ color: 0x66ffcc, opacity: 0.5 })); parts.edges.frustumCulled = false; group.add(parts.edges);
    }
    if (L.labels && typeof document !== 'undefined') {
      const lab = new THREE.Group(), u = unit();
      for (const a of g.areas) {
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const x = cv.getContext('2d');
        x.font = 'bold 54px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 12; x.strokeStyle = '#000'; x.lineJoin = 'round'; x.strokeText(a.name, 256, 50); x.fillStyle = a.callout ? '#ffffff' : '#9fd0ff'; x.fillText(a.name, 256, 50);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true, fog: false }));
        sp.position.set(a.cx, a.cy + 1.5, a.cz); sp.scale.set(8 * u * (a.callout ? 1 : 0.75), 1.5 * u * (a.callout ? 1 : 0.75), 1); sp.renderOrder = 10; lab.add(sp);
      }
      parts.labels = lab; group.add(lab);
    }
  }

  function samplePaths(n = 4, seed = 5) {
    clear('paths'); if (!sys.ready || !L.paths) return [];
    const root = new THREE.Group(), g = sys.g, u = unit(); let s = seed; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const a = new THREE.Vector3(), b = new THREE.Vector3(), out = []; const sphere = new THREE.SphereGeometry(0.16 * u, 8, 6), cone = new THREE.ConeGeometry(0.4 * u, 1.2 * u, 8);
    for (let i = 0; i < n; i++) {
      g.nodePos(Math.floor(r() * g.N), a); g.nodePos(Math.floor(r() * g.N), b);
      const p = sys.path(a, b, { noCache: true }); if (!p) continue;
      col.setHSL((i * 0.27 + 0.02) % 1, 1, 0.55); const hex = col.getHex();
      const pts = [a.clone(), ...p].map((q) => V3(q.x, q.y + 0.35, q.z));
      root.add(fat(pts, hex, 4));
      p.forEach((q, k) => { const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: p.flags[k] === 1 ? 0xff40ff : p.flags[k] === 2 ? 0xffd030 : 0xffffff, depthTest: false, fog: false, transparent: true })); m.position.set(q.x, q.y + 0.35, q.z); m.renderOrder = 8; root.add(m); });
      const st = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: hex, depthTest: false, fog: false })); st.rotation.x = Math.PI; st.position.set(a.x, a.y + 1.4 * u, a.z); st.renderOrder = 9; root.add(st);
      const en = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 * u), new THREE.MeshBasicMaterial({ color: hex, depthTest: false, fog: false })); en.position.set(b.x, b.y + 0.9 * u, b.z); en.renderOrder = 9; root.add(en);
      out.push({ from: a.clone(), to: b.clone(), pts: p.length, dist: +p.dist.toFixed(1), jumps: p.jumps });
    }
    parts.paths = root; group.add(root); return out;
  }

  /** Cover points for a viewer at `near` against a threat at `from` (defaults: local actor + a point 14 m ahead). */
  function showCover(near, from) {
    clear('cover'); if (!sys.ready || !L.cover) return [];
    const la = ctx.localActor, A = sys.map?.sites?.A?.center; near = near || (camMode && A ? V3(A.x, A.y, A.z) : la?.pos); if (!near) return [];
    const u = unit();
    if (!from && camMode) { const dx = fit.cx - near.x, dz = fit.cz - near.z, l = Math.hypot(dx, dz) || 1; const q = V3(near.x + dx / l * 16, near.y, near.z + dz / l * 16); from = sys.snap(q) || q; }
    if (!from) { const f = la ? la.forward(new THREE.Vector3()) : V3(0, 0, -1); f.y = 0; f.normalize(); from = sys.snap(near.clone().addScaledVector(f, 14)) || near.clone().addScaledVector(f, 14); }
    const cps = sys.tactics.coverPoints(near, from, 14, { max: 6 }), root = new THREE.Group();
    const th = new THREE.Mesh(new THREE.OctahedronGeometry(0.6 * u), new THREE.MeshBasicMaterial({ color: 0xff3030, depthTest: false, fog: false })); th.position.set(from.x, from.y + 1.6 * u, from.z); th.renderOrder = 9; root.add(th);
    const me = new THREE.Mesh(new THREE.SphereGeometry(0.5 * u, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, fog: false })); me.position.set(near.x, near.y + 1.2 * u, near.z); me.renderOrder = 9; root.add(me);
    for (const c of cps) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.4 * u, 1.3 * u, 8), new THREE.MeshBasicMaterial({ color: 0x20e0ff, depthTest: false, fog: false })); m.position.set(c.pos.x, c.pos.y + 0.7 * u, c.pos.z); m.renderOrder = 9; root.add(m);
      root.add(fat([V3(c.pos.x, c.pos.y + 1.4, c.pos.z), V3(from.x, from.y + 1.6, from.z)], 0x20e0ff, 2, 0.45));
      if (c.peek) root.add(fat([V3(c.pos.x, c.pos.y + 0.3, c.pos.z), V3(c.peek.x, c.peek.y + 0.3, c.peek.z)], 0xffffff, 4));
    }
    for (const h of sys.tactics.holdAngles(near)) root.add(fat([V3(near.x, near.y + 1.62, near.z), h.point], h.kind === 'long' ? 0xffee00 : h.kind === 'mid' ? 0xffaa00 : 0xff6600, 2, 0.85));
    parts.cover = root; group.add(root); return cps.map((c) => ({ pos: c.pos.toArray(), score: +c.score.toFixed(2), peek: !!c.peek }));
  }

  function showDanger() {
    clear('danger'); if (!sys.ready) return; const g = sys.g, arr = sys.dangers.get('any') || [...sys.dangers.values()][0]; if (!arr) return;
    const p = [], c = []; for (let i = 0; i < g.N; i++) if (arr[i] > 0.05) { p.push(g.px[i], g.py[i] + 0.4, g.pz[i]); const v = Math.min(1, arr[i] / 2); c.push(1, 1 - v, 0.1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    parts.danger = new THREE.Points(geo, new THREE.PointsMaterial({ size: 6, vertexColors: true, sizeAttenuation: false, fog: false, depthTest: false })); parts.danger.frustumCulled = false; group.add(parts.danger);
  }

  function ensurePanel() {
    if (panel || typeof document === 'undefined') return;
    panel = document.createElement('pre'); panel.dataset.nav = '1'; panel.style.cssText = 'position:fixed;left:10px;top:10px;margin:0;padding:10px 12px;background:rgba(5,10,20,.85);color:#c8f5e0;font:12px/1.35 ui-monospace,monospace;z-index:2147483000;pointer-events:none;border-radius:4px;white-space:pre';
    document.body.appendChild(panel);
  }
  function refreshPanel() {
    if (!panel) return; const s = sys.ready ? sys.g.stats : null; if (!s) { panel.textContent = 'NAV: not built'; return; }
    const la = ctx.localActor; const area = la && !camMode ? sys.areaAt(la.pos) : '-';
    panel.textContent = `NAV  nodes ${s.nodes}  walk-edges ${s.walkEdges}  jump/mantle ${s.jumpLinks}  drop ${s.dropLinks}\nbuild ${s.buildMs.toFixed(0)} ms  areas ${s.areas}  spots ${s.spots}  pruned ${s.rawNodes - s.nodes}  cell ${s.cell} m${sys.building ? '  REBUILD ' + (sys.progress * 100 | 0) + '%' : ''}\n${info}\nlegend: dot colour = area (white = border, dark = wall-adjacent)  lines = sample paths\ncyan cone = cover vs red threat, white = peek spot, yellow rays = hold angles\narea at player: ${area}`;
  }
  function refresh() { buildNodes(); samplePaths(); showCover(); if (L.danger) showDanger(); const b = sys.statsReport(150); info = `paths: avg ${b.avgPathUs} us  p95 ${b.p95PathUs} us  fail ${(b.failRate * 100).toFixed(1)}% (${b.pairs} random pairs)`; refreshPanel(); return b; }

  const api = {
    group, get on() { return on; },
    /** Show/hide the overlay (builds lazily). */
    draw(v = true) { on = !!v; group.visible = on; if (on) { ensurePanel(); if (panel) panel.style.display = ''; if (!parts.nodes) refresh(); else refreshPanel(); } else if (panel) panel.style.display = 'none'; return on; },
    refresh, samplePaths, showCover, showDanger,
    /** Toggle layers: debug.layers({links:true, edges:true, labels:false, paths:true, cover:true, nodes:true, danger:true}) */
    layers(o) { Object.assign(L, o || {}); if (on) refresh(); return { ...L }; },
    edges(v) { return api.layers({ edges: !!v }); }, links(v) { return api.layers({ links: !!v }); },
    labels(v) { return api.layers({ labels: !!v }); },
    stats: (n = 200) => sys.statsReport(n),
    benchmark: (n = 200) => sys.benchmark(n),
    validate: (pairs = 2000, seed = 1) => validatePaths(sys, { pairs, seed }),
    coverage: (n = 3000) => coverageReport(sys, n),
    tacticsBench: (n = 150) => { for (let i = 0; i < 600 && sys.bg; i++) sys.step(); return tacticsBench(sys, n); },
    /** camera: 'top' | 'iso' | null (null leaves the camera to the player). Hides roofs/skyline/viewmodel while active. */
    camera(mode) {
      camMode = mode;
      if (mode) { ctx.map?.setRoofsVisible?.(false); ctx.map?.setSkylineVisible?.(false); ctx.combat?.viewmodel?.setVisible?.(false); ctx.characters?.setVisible?.(false); const c = ctx.render?.camera; if (c) { c.fov = 45; c.near = 0.5; c.far = 900; c.updateProjectionMatrix(); } if (ctx.render?.scene) ctx.render.scene.fog = null; }
    },
    /** Replace the dressed map by a flat grey render of the exact collision mesh the navgrid was built from (what nav 'sees'). */
    backdrop(v = true) {
      clear('backdrop');
      if (ctx.map?.group) ctx.map.group.visible = !v;
      if (v && sys.map?.collider?.geometry) { const m = new THREE.Mesh(sys.map.collider.geometry, new THREE.MeshLambertMaterial({ color: 0x8c96a0, flatShading: true })); m.frustumCulled = false; parts.backdrop = m; group.add(m); if (ctx.render?.scene) ctx.render.scene.background = new THREE.Color(0x1a2230); }
    },
    /** Hide every DOM overlay except the nav panel (clean screenshots). */
    hideUI() { for (const el of document.body.children) if (el.id !== 'app' && el.tagName !== 'SCRIPT' && el.tagName !== 'CANVAS' && !el.dataset?.nav && el.style.display !== 'none') { el.style.display = 'none'; hidden.push(el); } },
    /** Swap in the built-in stress-test level (visible geometry). */
    useTestMap() {
      const m = buildTestMap(); const mesh = new THREE.Mesh(m.collider.geometry, new THREE.MeshStandardMaterial({ color: 0xb8a27c, flatShading: true, roughness: 0.9 }));
      m.group.add(mesh); ctx.render.scene.add(m.group); if (ctx.map?.group) ctx.map.group.visible = false; nav.useMap(m); if (on) refresh(); return m;
    },
    update() {
      if (!on) return;
      if (camMode && ctx.render?.camera && sys.ready) {
        const cam = ctx.render.camera, t = Math.tan(cam.fov * Math.PI / 360), asp = cam.aspect || 16 / 9;
        const h = Math.max(fit.extZ / (2 * t), fit.extX / (2 * t * asp)) * 1.14;
        if (camMode === 'top') { cam.position.set(fit.cx, h, fit.cz + 0.01); cam.rotation.set(-Math.PI / 2, 0, 0, 'YXZ'); }
        else if (camMode === 'iso') { cam.position.set(fit.cx, h * 0.78, fit.cz + h * 0.62); cam.lookAt(fit.cx, 0, fit.cz - fit.ext * 0.04); }
      }
      if ((ctx.engine?.frame ?? 0) % 30 === 0 || ctx.manualStepping) refreshPanel();
    },
  };
  return api;
}
