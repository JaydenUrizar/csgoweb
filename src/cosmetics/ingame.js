// In-game rendering of cosmetics that the athlete mesh doesn't draw itself: charms (hang from the `hip` attach point) and trails (emitted at `trailEmitter`).
// Pooled: one additive + one alpha particle system for the whole match (2 draw calls), charms are 2-4 meshes per actor.
import * as THREE from 'three';
import { ParticleSystem, SHAPE } from './preview/fx.js';
import { buildCharmObject } from './preview/charm.js';

export function createIngame(ctx) {
  const glow = new ParticleSystem(1600, { additive: true }), solid = new ParticleSystem(500, { additive: false });
  let added = false, time = 0;
  const v = new THREE.Vector3(), cam = new THREE.Vector3();
  function ensure() { if (added || !ctx.render?.scene) return; ctx.render.scene.add(glow.points, solid.points); glow.points.frustumCulled = solid.points.frustumCulled = false; added = true; }

  function emitTrail(m, dt, sp) {
    const t = m.spec.trail; if (!t || t.type === 'none') return;
    const a = m.actor, e = m.attach.trailEmitter; e.getWorldPosition(v);
    const bx = -a.vel.x * 0.25, bz = -a.vel.z * 0.25, c1 = t.color, c2 = t.color2;
    m.__tacc = (m.__tacc || 0) + dt * Math.min(1, sp / 6);
    switch (t.type) {
      case 'sparks': { const r = 70; m.__tacc *= 1; while (m.__tacc * r >= 1) { m.__tacc -= 1 / r; glow.emit(v.x, 0.12, v.z, bx + (Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 1.6, bz + (Math.random() - 0.5) * 1.2, 0.45 + Math.random() * 0.35, 0.1, 0.01, c1, c2, SHAPE.spark, 9, 0.6, 1); } break; }
      case 'ribbon': case 'comet': { const r = 110; while (m.__tacc * r >= 1) { m.__tacc -= 1 / r; glow.emit(v.x, v.y - 0.1, v.z, bx * 0.2, 0, bz * 0.2, 0.75, t.type === 'comet' ? 0.2 : 0.14, 0.0, Math.random() < 0.5 ? c1 : c2, c2, SHAPE.glow, 0, 0.8, 0.9); } break; }
      case 'pixels': { const r = 45; while (m.__tacc * r >= 1) { m.__tacc -= 1 / r; solid.emit(v.x + (Math.random() - 0.5) * 0.3, 0.2 + Math.random() * 1.3, v.z + (Math.random() - 0.5) * 0.3, bx * 0.3, (Math.random() - 0.5) * 0.3, bz * 0.3, 0.9 + Math.random() * 0.5, 0.09, 0.09, Math.random() < 0.5 ? c1 : c2, c2, SHAPE.square, 0, 1.2, 1, 0, 0, 0.03); } break; }
      case 'petals': { const r = 28; while (m.__tacc * r >= 1) { m.__tacc -= 1 / r; solid.emit(v.x + (Math.random() - 0.5) * 0.3, 0.4 + Math.random() * 1.0, v.z + (Math.random() - 0.5) * 0.3, bx * 0.3, 0.3 + Math.random() * 0.4, bz * 0.3, 1.4 + Math.random() * 0.8, 0.13, 0.1, Math.random() < 0.6 ? c1 : c2, c1, SHAPE.petal, 0.3, 1.2, 1, (Math.random() - 0.5) * 7, 2.4); } break; }
    }
  }
  return {
    update(dt) {
      const C = ctx.characters; if (!C?.models) return; ensure(); time += dt;
      const camera = ctx.render?.camera; if (camera) camera.getWorldPosition(cam);
      for (const m of C.models.values()) {
        if (m.isPreview || !m.spec) continue;
        const show = m.visible && !m.hidden && !m.firstPerson && !m.tag && m.actor.alive !== false;
        // charm
        const key = JSON.stringify(m.spec.charm);
        if (m.__ckey !== key) { m.__ckey = key; if (m.__charm) { m.__charm.group.removeFromParent(); m.__charm.dispose?.(); } m.__charm = buildCharmObject(m.spec.charm, 1.35); if (m.__charm) { m.attach.hip.add(m.__charm.group); m.__charm.group.position.set(0.03, 0.04, 0); } }
        if (m.__charm) { m.__charm.group.visible = show; if (show) m.__charm.update(time + m.id, Math.max(-0.5, Math.min(0.5, -(m.vx || 0) * 0.05))); }
        // trail
        if (show && m.spec.trail?.type !== 'none') {
          const sp = Math.hypot(m.actor.vel.x, m.actor.vel.z);
          if (sp > 2.2 && (!camera || cam.distanceToSquared(m.actor.pos) < 2500)) emitTrail(m, dt, sp);
        }
      }
      if (camera && ctx.render?.renderer) { const r = ctx.render.renderer; const sc = r.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); glow.setScale(sc); solid.setScale(sc); }
      glow.update(dt); solid.update(dt); glow.tintPass(); solid.tintPass();
    },
    stats: () => ({ glow: glow.n, solid: solid.n }),
    dispose() { glow.points.removeFromParent(); solid.points.removeFromParent(); glow.dispose(); solid.dispose(); },
  };
}
