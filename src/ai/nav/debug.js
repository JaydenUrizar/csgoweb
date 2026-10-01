// In-world debug overlay for the navgrid: nodes (coloured by area), jump/drop links, sample paths, cover points, hold angles, stats.
import * as THREE from 'three';
import { LINK_JUMP } from './config.js';
import { buildTestMap } from './testmap.js';
import { validatePaths } from './validate.js';

export function createDebug(ctx, nav, sys) {
  const group = new THREE.Group(); group.name = 'nav-debug'; group.visible = false; ctx.render?.scene?.add(group);
  let on = false, panel = null, edgesOn = false, camMode = null, camSys = null, info = '';
  const parts = { nodes: null, links: null, edges: null, paths: null, cover: null, labels: null, danger: null };
  const col = new THREE.Color();
  const clear = (k) => { const o = parts[k]; if (!o) return; group.remove(o); o.traverse?.((c) => { c.geometry?.dispose?.(); c.material?.map?.dispose?.(); c.material?.dispose?.(); }); parts[k] = null; };
  const line = (pts, color, opacity = 1) => { const g = new THREE.BufferGeometry().setFromPoints(pts); return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, fog: false, depthTest: false })); };

  function buildNodes() {
    clear('nodes'); clear('links'); clear('edges'); clear('labels'); const g = sys.g; if (!g || !g.N) return;
    const pos = new Float32Array(g.N * 3), c = new Float32Array(g.N * 3);
    for (let i = 0; i < g.N; i++) {
      pos[i * 3] = g.px[i]; pos[i * 3 + 1] = g.py[i] + 0.07; pos[i * 3 + 2] = g.pz[i];
      col.setHSL((g.region[i] * 0.618) % 1, 0.7, g.wall[i] === 0 ? 0.35 : 0.58); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    parts.nodes = new THREE.Points(geo, new THREE.PointsMaterial({ size: 3.5, vertexColors: true, sizeAttenuation: false, fog: false, depthTest: false, transparent: true, opacity: 0.9 }));
    parts.nodes.renderOrder = 5; parts.nodes.frustumCulled = false; group.add(parts.nodes);
    const lp = [], lc = [];
    for (let i = 0; i < g.N; i++) for (let p = g.lstart[i]; p < g.lstart[i + 1]; p++) {
      const j = g.lto[p], jump = g.ltype[p] === LINK_JUMP; col.set(jump ? 0xff40ff : 0xffd030);
      const ax = g.px[i], ay = g.py[i] + 0.1, az = g.pz[i], bx = g.px[j], by = g.py[j] + 0.1, bz = g.pz[j], top = Math.max(ay, by) + (jump ? 0.9 : 0.4);
      let px = ax, py = ay, pz = az;
      for (let s = 1; s <= 5; s++) { const t = s / 5, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t + Math.sin(t * Math.PI) * (top - Math.max(ay, by)); lp.push(px, py, pz, x, y, z); for (let k = 0; k < 2; k++) lc.push(col.r, col.g, col.b); px = x; py = y; pz = z; }
    }
    if (lp.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3)); parts.links = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, fog: false, depthTest: false })); parts.links.renderOrder = 6; parts.links.frustumCulled = false; group.add(parts.links); }
    if (edgesOn) {
      const ep = []; for (let i = 0; i < g.N; i++) for (let k = 0; k < 4; k++) { const j = g.nb[i * 8 + k]; if (j >= 0) ep.push(g.px[i], g.py[i] + 0.05, g.pz[i], g.px[j], g.py[j] + 0.05, g.pz[j]); }
      const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3)); parts.edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x336655, fog: false })); parts.edges.frustumCulled = false; group.add(parts.edges);
    }
    // area labels
    const lab = new THREE.Group();
    for (const a of g.areas) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d');
      x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 12, 256, 40); x.fillStyle = a.callout ? '#ffffff' : '#a0b4c8'; x.fillText(a.name, 128, 43);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true, fog: false }));
      sp.position.set(a.cx, a.cy + 2.2, a.cz); sp.scale.set(8, 2, 1); sp.renderOrder = 10; lab.add(sp);
    }
    parts.labels = lab; group.add(lab);
  }

  function samplePaths(n = 6, seed = 5) {
    clear('paths'); if (!sys.ready) return [];
    const root = new THREE.Group(), g = sys.g; let s = seed; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const a = new THREE.Vector3(), b = new THREE.Vector3(), out = [];
    const sphere = new THREE.SphereGeometry(0.14, 6, 4);
    for (let i = 0; i < n; i++) {
      g.nodePos(Math.floor(r() * g.N), a); g.nodePos(Math.floor(r() * g.N), b);
      const p = sys.path(a, b, { noCache: true }); if (!p) continue;
      const pts = [a.clone().add(new THREE.Vector3(0, 0.25, 0)), ...p.map((q) => q.clone().add(new THREE.Vector3(0, 0.25, 0)))];
      col.setHSL(i / n, 1, 0.55); root.add(line(pts, col.getHex()));
      p.forEach((q, k) => { const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: p.flags[k] === 1 ? 0xff40ff : p.flags[k] === 2 ? 0xffd030 : col.getHex(), fog: false, depthTest: false })); m.position.copy(q).y += 0.25; root.add(m); });
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), new THREE.MeshBasicMaterial({ color: col.getHex() })); st.position.copy(a).y += 0.7; root.add(st);
      out.push({ from: a.clone(), to: b.clone(), pts: p.length, dist: +p.dist.toFixed(1), jumps: p.jumps });
    }
    parts.paths = root; group.add(root); return out;
  }

  /** Cover points for a viewer at `near` against a threat at `from` (defaults: local actor + a point 14 m ahead). */
  function showCover(near, from) {
    clear('cover'); if (!sys.ready) return [];
    const la = ctx.localActor; near = near || la?.pos; if (!near) return [];
    if (!from) { const f = la ? la.forward(new THREE.Vector3()) : new THREE.Vector3(0, 0, -1); f.y = 0; f.normalize(); from = sys.snap(near.clone().addScaledVector(f, 14)) || near.clone().addScaledVector(f, 14); }
    const cps = sys.tactics.coverPoints(near, from, 14, { max: 8 }), root = new THREE.Group();
    const th = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0xff3030 })); th.position.copy(from).y += 1.6; root.add(th);
    for (const c of cps) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 6), new THREE.MeshBasicMaterial({ color: 0x30e0ff, fog: false, depthTest: false })); m.position.copy(c.pos).y += 0.5; root.add(m);
      root.add(line([c.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), from.clone().add(new THREE.Vector3(0, 1.6, 0))], 0x30e0ff, 0.25));
      if (c.peek) root.add(line([c.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), c.peek.clone().add(new THREE.Vector3(0, 0.2, 0))], 0xffffff));
    }
    for (const h of sys.tactics.holdAngles(near)) root.add(line([near.clone().add(new THREE.Vector3(0, 1.62, 0)), h.point], h.kind === 'long' ? 0xffee00 : h.kind === 'mid' ? 0xffaa00 : 0xff6600, 0.8));
    parts.cover = root; group.add(root); return cps.map((c) => ({ pos: c.pos.toArray(), score: +c.score.toFixed(2), peek: !!c.peek }));
  }

  function showDanger() {
    clear('danger'); if (!sys.ready) return; const g = sys.g, arr = sys.dangers.get('any') || [...sys.dangers.values()][0]; if (!arr) return;
    const p = [], c = []; for (let i = 0; i < g.N; i++) if (arr[i] > 0.05) { p.push(g.px[i], g.py[i] + 0.4, g.pz[i]); const v = Math.min(1, arr[i] / 2); c.push(1, 1 - v, 0.1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    parts.danger = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.35, vertexColors: true, fog: false })); parts.danger.frustumCulled = false; group.add(parts.danger);
  }

  function ensurePanel() {
    if (panel || typeof document === 'undefined') return;
    panel = document.createElement('pre'); panel.style.cssText = 'position:fixed;left:8px;top:8px;margin:0;padding:8px 10px;background:rgba(5,10,20,.78);color:#bfe;font:12px/1.35 ui-monospace,monospace;z-index:9999;pointer-events:none;border-radius:4px;white-space:pre';
    document.body.appendChild(panel);
  }
  function refreshPanel() {
    if (!panel) return; const s = sys.ready ? sys.g.stats : null; if (!s) { panel.textContent = 'NAV: not built'; return; }
    const la = ctx.localActor; const area = la ? sys.areaAt(la.pos) : '-';
    panel.textContent = `NAV  nodes ${s.nodes}  walk ${s.walkEdges}  jump ${s.jumpLinks}  drop ${s.dropLinks}\nbuild ${s.buildMs.toFixed(0)} ms  areas ${s.areas}  pruned ${s.rawNodes - s.nodes}  cell ${s.cell} m\n${info}\narea at player: ${area}`;
  }
  function refresh() { buildNodes(); samplePaths(); showCover(); const b = sys.statsReport(150); info = `paths: avg ${b.avgPathUs} us  p95 ${b.p95PathUs} us  fail ${(b.failRate * 100).toFixed(1)}% (${b.pairs} pairs)`; refreshPanel(); return b; }

  const api = {
    group, get on() { return on; },
    /** Show/hide the overlay (builds lazily). */
    draw(v = true) { on = !!v; group.visible = on; if (on) { ensurePanel(); if (panel) panel.style.display = ''; if (!parts.nodes) refresh(); else refreshPanel(); } else if (panel) panel.style.display = 'none'; return on; },
    refresh, samplePaths, showCover, showDanger, edges(v) { edgesOn = !!v; if (on) buildNodes(); },
    labels(v) { if (parts.labels) parts.labels.visible = !!v; },
    stats: (n = 200) => sys.statsReport(n),
    benchmark: (n = 200) => sys.benchmark(n),
    validate: (pairs = 2000, seed = 1) => validatePaths(sys, { pairs, seed }),
    /** camera: 'top' | 'iso' | 'player' (null = leave to player) */
    camera(mode) { camMode = mode; if (mode) { ctx.map?.setRoofsVisible?.(false); ctx.combat?.viewmodel?.setVisible?.(false); } },
    /** Swap in the built-in stress-test level (visible geometry) — handy for comparing behaviour. */
    useTestMap() {
      const m = buildTestMap(); const mesh = new THREE.Mesh(m.collider.geometry, new THREE.MeshStandardMaterial({ color: 0xb8a27c, flatShading: true, roughness: 0.9 }));
      m.group.add(mesh); ctx.render.scene.add(m.group); if (ctx.map?.group) ctx.map.group.visible = false; nav.useMap(m); if (on) refresh(); return m;
    },
    update() {
      if (!on) return;
      if (camMode && ctx.render?.camera && sys.ready) {
        const b = sys.g.bounds, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, span = Math.max(b.max.x - b.min.x, b.max.z - b.min.z), cam = ctx.render.camera;
        if (camMode === 'top') { cam.position.set(cx, span * 0.95, cz + 0.01); cam.rotation.set(-Math.PI / 2, 0, 0, 'YXZ'); }
        else if (camMode === 'iso') { cam.position.set(cx, span * 0.7, cz + span * 0.62); cam.lookAt(cx, 0, cz); }
      }
      if ((ctx.engine?.frame ?? 0) % 30 === 0 || ctx.manualStepping) refreshPanel();
    },
  };
  return api;
}
