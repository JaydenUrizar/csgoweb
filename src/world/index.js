import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
// PLACEHOLDER map module — owner: `map` piece. Contract: docs/ARCHITECTURE.md §map.
export function create(ctx) {
  const group = new THREE.Group(); ctx.render.scene.add(group);
  const collGeos = [];
  const box = (x, y, z, w, h, d, color = 0xc9b28a) => {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 }));
    m.castShadow = m.receiveShadow = true; group.add(m); collGeos.push(g.clone().toNonIndexed());
  };
  box(0, -1, 0, 120, 1, 120, 0xb8a27c);
  box(-8, 0, -6, 6, 3, 2); box(8, 0, 6, 6, 3, 2); box(0, 0, -20, 3, 2, 3, 0xa98f66);
  const geo = mergeGeometries(collGeos.map((g) => { const c = g.clone(); for (const k of Object.keys(c.attributes)) if (k !== 'position') c.deleteAttribute(k); return c; }));
  geo.boundsTree = new MeshBVH(geo);
  const collider = new THREE.Mesh(geo); collider.visible = false;
  const ray = new THREE.Raycaster();
  return {
    group, collider, name: 'placeholder',
    spawns: { ember: [{ pos: new THREE.Vector3(0, 0, 30), yaw: 0 }], tide: [{ pos: new THREE.Vector3(0, 0, -30), yaw: Math.PI }] },
    sites: {}, callouts: [], bounds: new THREE.Box3(new THREE.Vector3(-60, -5, -60), new THREE.Vector3(60, 30, 60)),
    /** Raycast against static world collision. Returns {point, normal, distance} | null */
    raycast(origin, dir, far = 500) {
      ray.set(origin, dir); ray.far = far; ray.firstHitOnly = true;
      const h = ray.intersectObject(collider, false)[0]; if (!h) return null;
      return { point: h.point, normal: h.face.normal.clone(), distance: h.distance };
    },
    fixedUpdate() {}, update() {},
  };
}
