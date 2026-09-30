import * as THREE from 'three';
import { createActor } from '../core/actor.js';
// PLACEHOLDER player module — owner: `move` piece. Free-fly camera so the placeholder scene is viewable.
export function create(ctx) {
  const actor = createActor({ name: 'You', team: 'ember', isPlayer: true });
  const sp = ctx.map.spawns.ember[0]; actor.pos.copy(sp.pos); actor.yaw = sp.yaw;
  ctx.actors.push(actor); ctx.localActor = actor;
  const _f = new THREE.Vector3();
  return {
    actor,
    update(dt) {
      const md = ctx.input.consumeMouse(); const sens = 0.0022 * ctx.settings.get('sensitivity');
      actor.yaw -= md.dx * sens; actor.pitch = Math.max(-1.5, Math.min(1.5, actor.pitch - md.dy * sens));
      const i = ctx.input, sp = 8 * dt;
      const fw = (i.down('forward') ? 1 : 0) - (i.down('back') ? 1 : 0), st = (i.down('right') ? 1 : 0) - (i.down('left') ? 1 : 0);
      actor.pos.x += (-Math.sin(actor.yaw) * fw + Math.cos(actor.yaw) * st) * sp; actor.pos.z += (-Math.cos(actor.yaw) * fw - Math.sin(actor.yaw) * st) * sp;
      const c = ctx.render.camera; actor.eyePos(c.position); c.rotation.set(actor.pitch, actor.yaw, 0, 'YXZ');
    },
  };
}
