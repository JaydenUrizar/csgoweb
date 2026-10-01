import * as THREE from 'three';
import { buildWorld } from './world.js';
import { makeCollider } from './collision.js';
import { makeTextures } from './textures.js';
import { makeMaterials } from './materials.js';

export function create(ctx) {
  const W = buildWorld();
  const group = new THREE.Group(); group.name = 'crux-station';
  ctx.render.scene.add(group);
  const aniso = Math.min(8, ctx.render.renderer?.capabilities?.getMaxAnisotropy?.() || 4);
  const T = makeTextures(aniso);
  const M = makeMaterials(ctx, T, null);
  for (const p of W.VB.finish()) {
    const m = new THREE.Mesh(p.geometry, M[p.mat] || M.plain); m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
  const col = makeCollider(W.CB, () => 'stone');
  const spawns = { ember: [{ pos: new THREE.Vector3(0, 0, 44), yaw: 0 }], tide: [{ pos: new THREE.Vector3(0, 0, -44), yaw: Math.PI }] };
  return { group, collider: col.collider, raycast: col.raycast, spawns, sites: {}, callouts: [], bounds: new THREE.Box3(new THREE.Vector3(-50, -6, -52), new THREE.Vector3(50, 30, 52)) };
}
