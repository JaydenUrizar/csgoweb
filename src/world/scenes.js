// ?scene=map-overview  (&view=top|long|... , &roofs=0|1 , &hud=1 keeps UI). Window.__game.ctx.map.debug.setView(name) at runtime.
import * as THREE from 'three';

export const VIEWS = {
  top:        { pos: [0, 156, 3], tgt: [0, 0, 3], fov: 40, up: [0, 0, -1], roofs: false, sky: false, nofog: true },
  long:       { pos: [38, 1.7, 44], tgt: [38, 2.0, -10], fov: 80 },
  'long-doors': { pos: [38, 1.7, 36], tgt: [38, 2.5, 20], fov: 80 },
  'a-ramp':   { pos: [38, 3.0, -10], tgt: [34, 1.8, -28], fov: 85 },
  'a-ledge':  { pos: [45, 5.4, -43], tgt: [30, 1.5, -26], fov: 80 },
  'a-door':   { pos: [10, 1.7, -43], tgt: [30, 2.0, -38], fov: 85 },
  'catwalk-stairs': { pos: [16, 4.6, -29], tgt: [32, 1.5, -28], fov: 85 },
  mid:        { pos: [0, 1.7, 36], tgt: [0, 1.8, 0], fov: 80 },
  'mid-doors': { pos: [0, 1.7, 20], tgt: [0, 2.2, 6], fov: 85 },
  hub:        { pos: [-8, 1.7, 8], tgt: [4, 2.2, -14], fov: 85 },
  'hub-arches': { pos: [0, 1.7, 6], tgt: [0, 2.2, -24], fov: 85 },
  catwalk:    { pos: [14.5, 4.6, -3], tgt: [14.5, 3.8, -26], fov: 85 },
  palace:     { pos: [-14, 1.7, -18], tgt: [8, 2.4, -22], fov: 85 },
  'b-site':   { pos: [-31, -0.2, -15], tgt: [-33, -1.2, -34], fov: 85 },
  'b-tunnel': { pos: [-33, 1.7, 12], tgt: [-33, 1.6, -14], fov: 85 },
  'tunnel-bend': { pos: [-39, 1.7, 26], tgt: [-39, 1.6, 8], fov: 85 },
  'b-window': { pos: [-17, 1.7, -34], tgt: [-30, 0.2, -34], fov: 85 },
  'b-balcony': { pos: [-42, 3.0, -44], tgt: [-30, -1.0, -28], fov: 85 },
  'tide-spawn': { pos: [0, 1.7, -39], tgt: [0, 2.4, -49], fov: 85 },
  'ember-spawn': { pos: [0, 1.7, 39.5], tgt: [0, 2.4, 49], fov: 85 },
  'cine-a':   { pos: [56, 46, 20], tgt: [32, 0, -26], fov: 48, nofog: true },
  'cine-b':   { pos: [-56, 46, 20], tgt: [-32, -1, -28], fov: 48, nofog: true },
  'cine-mid': { pos: [0, 52, 74], tgt: [0, 0, 0], fov: 52, nofog: true },
  'cine-long': { pos: [78, 30, 62], tgt: [34, 0, 4], fov: 50, nofog: true },
};

export function registerScenes(ctx, map) {
  const state = { view: null, sys: null, hid: [] };
  const cam = () => ctx.render.camera;
  function apply() {
    const v = VIEWS[state.view]; if (!v) return;
    const c = cam(); c.fov = v.fov; c.near = 0.05; c.far = 600; c.updateProjectionMatrix();
    c.up.set(...(v.up || [0, 1, 0])); c.position.set(...v.pos); c.lookAt(...v.tgt);
  }
  function setView(name) {
    if (!VIEWS[name]) return false; state.view = name;
    map.setRoofsVisible(VIEWS[name].roofs !== false && ctx.params.get('roofs') !== '0'); map.setSkylineVisible(VIEWS[name].sky !== false);
    if (VIEWS[name].nofog) { state.fog = state.fog || ctx.render.scene.fog; ctx.render.scene.fog = null; } else if (state.fog) ctx.render.scene.fog = state.fog;
    if (!state.sys) { state.sys = { update() { apply(); } }; ctx.engine.add(state.sys, 99999); }
    apply(); return true;
  }
  function clear() { if (state.sys) { ctx.engine.remove(state.sys); state.sys = null; } map.setRoofsVisible(true); cam().up.set(0, 1, 0); }
  map.debug = Object.assign(map.debug || {}, { setView, clear, views: Object.keys(VIEWS), VIEWS });
  ctx.debugScenes['map-overview'] = async () => {
    if (ctx.params.get('hud') !== '1') {
      try { ctx.menu?.backdrop?.leave?.(); } catch (e) { /* ignore */ }
      document.documentElement.classList.remove('fx-menu');
      for (const el of document.body.children) if (el.id !== 'app' && el.tagName !== 'SCRIPT' && el.tagName !== 'CANVAS') { el.style.display = 'none'; state.hid.push(el); }
    }
    try { ctx.characters?.setVisible?.(false); ctx.combat?.viewmodel?.setVisible?.(false); } catch (e) { /* ignore */ }
    setView(ctx.params.get('view') || 'top');
  };
}
