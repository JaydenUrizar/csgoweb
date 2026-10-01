// Builds one actor model: skinned mesh + bone hierarchy + attach points + held-tagger management.
import * as THREE from 'three';
import { createBones, getBodyGeometry, B } from './body.js';
import { createActorMaterial, applySpecToMaterial } from './material.js';
import { fallbackGun, classOf } from './weapons.js';
import { completeSpec, teamColor } from './defaults.js';

const mk = (name, parent, x = 0, y = 0, z = 0) => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); parent.add(o); return o; };
const mkFoot = (sgn) => ({ sgn, p: new THREE.Vector3(), sp: new THREE.Vector3(), mode: 0, t: 0, yaw: 0, pitch: 0, lift: 0, stanceU: 0.5, idleT: 0, ready: false });

export function buildModel(ctx, actor, specIn) {
  const spec = completeSpec(specIn, actor.team), tc = teamColor(actor.team);
  const { root, bones } = createBones(); root.rotation.order = 'YXZ';
  const geo = getBodyGeometry(spec.helmet.shape, spec.visor.shape, spec.back.model);
  const mat = createActorMaterial(); applySpecToMaterial(mat, spec, tc);
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.name = 'athlete'; mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh); root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones); mesh.bind(skeleton);
  root.userData.actorId = actor.id;

  const chest = bones[B.chest], head = bones[B.head];
  const attach = {
    head: mk('head', head, 0, 0.04, 0), visor: mk('visor', head, 0, 0.01, -0.16), back: mk('back', chest, 0, 0.1, 0.3),
    shoulderL: mk('shoulderL', chest, -0.31, 0.24, 0), shoulderR: mk('shoulderR', chest, 0.31, 0.24, 0),
    handR: mk('handR', bones[B.handR], 0, -0.05, 0), handL: mk('handL', bones[B.handL], 0, -0.05, 0),
    trailEmitter: mk('trailEmitter', bones[B.pelvis], 0, 0.1, 0.28), nameplate: mk('nameplate', head, 0, 0.42, 0),
    hip: mk('hip', bones[B.pelvis], 0.24, 0, 0),
  };
  const pivot = mk('weaponPivot', chest); attach.weapon = pivot;

  const m = {
    actor, id: actor.id, root, mesh, mat, u: mat.userData.u, bones, skeleton, attach, pivot, spec, teamColor: tc,
    // kinematic state
    rp: new THREE.Vector3().copy(actor.pos), prev: new THREE.Vector3().copy(actor.pos), cur: new THREE.Vector3().copy(actor.pos), lastRp: new THREE.Vector3().copy(actor.pos),
    gy: actor.pos.y, hipsYaw: actor.yaw, turning: false, vx: 0, vz: 0, vy: 0, speed: 0, moving: false, vlx: 0, vlz: 0, accX: 0, accZ: 0,
    phase: 0, feet: [mkFoot(-1), mkFoot(1)], feetInit: false, airW: 0, wasGround: true, jumpT: 9, landT: 9, slideW: 0, crouch: 0, plantW: 0, plantMode: 0,
    treadmill: false, legOffset: 0, twist: 0, time: Math.random() * 10,
    // springs [x, v]
    sp: { kz: [0, 0], kp: [0, 0], kr: [0, 0], fp: [0, 0], fr: [0, 0], fy: [0, 0], hp: [0, 0], hr: [0, 0], land: [0, 0], recoilChest: [0, 0], bob: [0, 0] },
    // timers
    fireT: 9, reload: null, sw: null, throwT: -1, meleeT: -1, hitFlash: 0, swapPending: null,
    held: { id: null, cls: 'none', obj: null, cache: new Map(), muzzle: null, ball: null },
    dbg: null, tag: null, spawnT: -1, visible: true, firstPerson: false, hidden: false, auto: false, alive: actor.alive,
    joints: null, hitDbg: null, label: null,
  };
  m.feet[0].yaw = m.feet[1].yaw = actor.yaw;
  root.position.copy(actor.pos);
  return m;
}

/** Swap cosmetics (rebuilds geometry + material; keeps rig state). */
export function applyCosmetics(m, specIn) {
  const spec = completeSpec(specIn, m.actor.team); m.spec = spec;
  const geo = getBodyGeometry(spec.helmet.shape, spec.visor.shape, spec.back.model);
  if (m.mesh.geometry !== geo) m.mesh.geometry = geo;
  applySpecToMaterial(m.mat, spec, m.teamColor);
}

const _glow = { pistol: 0x66e0ff, smg: 0xffd166, rifle: 0xff9a4a, sniper: 0xb388ff, shotgun: 0xff6a6a, lmg: 0x7dffb0, melee: 0xff5fd0, grenade: 0xffffff, carry: 0xffcf4a };

/** Show the world model for tagger `id` in the right hand (creates on first use, cached per actor). */
export function setHeld(ctx, m, id, cls, skin) {
  const h = m.held;
  if (h.obj) h.obj.visible = false;
  h.id = id; h.cls = cls;
  if (!id && cls === 'none') { h.obj = null; h.muzzle = null; return; }
  const key = (id || cls) + '|' + (skin ? JSON.stringify(skin) : '');
  let obj = h.cache.get(key);
  if (!obj) {
    try { obj = ctx.combat?.viewmodel?.worldModel?.(id, skin) || null; } catch { obj = null; }
    if (!obj) obj = fallbackGun(cls, _glow[cls] ?? 0x66e0ff);
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    m.pivot.add(obj); h.cache.set(key, obj);
  }
  obj.visible = !m.firstPerson; h.obj = obj; h.muzzle = obj.getObjectByName('muzzle') || null;
}

export function disposeModel(m) {
  m.root.removeFromParent();
  m.skeleton.dispose(); m.mat.dispose();
  for (const o of m.held.cache.values()) o.removeFromParent();
  m.held.cache.clear();
}
export { classOf };
