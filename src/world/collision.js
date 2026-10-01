// Collision mesh + BVH + query helpers. Pure three.js / three-mesh-bvh (runs in Node for verification too).
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const SURF_OF_OWNER_DEFAULT = 'stone';

export function makeCollider(CB, groundSurface) {
  const geometry = CB.build();
  const bvh = new MeshBVH(geometry, { targetLeafSize: 12 });
  geometry.boundsTree = bvh;
  const collider = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
  collider.visible = false; collider.name = 'map-collider';
  const ownerAttr = geometry.attributes.owner, index = geometry.index;
  const owners = CB.owners;
  const _ray = new THREE.Ray(), _o = new THREE.Vector3(), _d = new THREE.Vector3();

  function ownerOfFace(faceIndex) { return owners[ownerAttr.getX(index.getX(faceIndex * 3))] || owners[0]; }

  /** first hit: {point, normal, distance, faceIndex, owner, surface} | null. `far` metres. */
  function raycast(origin, dir, far = 500, side = THREE.DoubleSide) {
    _ray.origin.copy(origin); _ray.direction.copy(dir);
    const h = bvh.raycastFirst(_ray, side, 0, far);
    if (!h) return null;
    const own = ownerOfFace(h.faceIndex);
    const n = h.face ? h.face.normal.clone() : new THREE.Vector3(0, 1, 0);
    if (n.dot(dir) > 0) n.negate();
    const surface = own.surface || groundSurface(h.point.x, h.point.y, h.point.z) || SURF_OF_OWNER_DEFAULT;
    return { point: h.point.clone(), normal: n, distance: h.distance, faceIndex: h.faceIndex, owner: own, surface, thin: own.thin || null };
  }
  /** true if segment a->b is unobstructed */
  function visible(a, b) {
    _o.copy(a); _d.subVectors(b, a); const len = _d.length(); if (len < 1e-4) return true; _d.multiplyScalar(1 / len);
    _ray.origin.copy(_o); _ray.direction.copy(_d);
    return !bvh.raycastFirst(_ray, THREE.DoubleSide, 0, len - 0.01);
  }
  /** all hits along the ray in order, stepping through thin walls only. Returns array of hits until a non-thin solid (inclusive). */
  function raycastThrough(origin, dir, far = 500, maxHits = 6) {
    const out = []; const o = origin.clone(); let travelled = 0;
    for (let i = 0; i < maxHits; i++) {
      const h = raycast(o, dir, far - travelled); if (!h) break;
      h.distance += travelled; out.push(h);
      if (!h.thin) break;
      travelled = h.distance + 0.02; o.copy(h.point).addScaledVector(dir, 0.02);
      if (travelled >= far) break;
    }
    return out;
  }
  return { collider, geometry, bvh, raycast, visible, raycastThrough, ownerOfFace };
}
