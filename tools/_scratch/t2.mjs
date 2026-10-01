import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { buildCourse } from '../../src/player/course.js';
import { createSim } from '../../src/player/simulate.js';
import { createActor } from '../../src/core/actor.js';
const c = buildCourse(); const ST=c.stations;
const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(c.positions, 3)); geo.boundsTree = new MeshBVH(geo);
const sim = createSim({ collider: () => ({geometry:geo}), emit(){} , surfaceAt: () => 'stone' });
const a = createActor({ name: 'x', team: 'ember', isPlayer: true });
const s = ST[process.argv[2]||'stairs30']; console.log(s);
a.pos.set(s.x, s.y, s.z-4); a.yaw=s.yaw;
const cmd = { forward: 1, right: 0, jump: false, crouch: false, walk: false, yaw: s.yaw, pitch: 0 };
for (let i = 0; i < 400; i++) { sim.simulate(a, cmd, 1/120); if (i<45 && i>12) console.log(i, a.pos.toArray().map(v=>v.toFixed(3)).join(','), a.move.speed.toFixed(3), a.move.onGround, a.vel.y.toFixed(2)); }
