import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { buildCourse } from '../../src/player/course.js';
import { createSim } from '../../src/player/simulate.js';
import { createActor } from '../../src/core/actor.js';
const c = buildCourse();
const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(c.positions, 3));
geo.boundsTree = new MeshBVH(geo);
console.log('tris', c.positions.length/9);
const col = { geometry: geo };
const sim = createSim({ collider: () => col, emit: (t, d) => { if (t!=='footstep') console.log('ev', t, JSON.stringify({s:d.speed, h:d.height})); }, surfaceAt: () => 'stone' });
const a = createActor({ name: 'x', team: 'ember', isPlayer: true });
a.pos.set(0, 0, 0);
const cmd = { forward: 1, right: 0, jump: false, crouch: false, walk: false, yaw: 0, pitch: 0 };
for (let i = 0; i < 240; i++) { sim.simulate(a, cmd, 1/120); if (i%20==0) console.log(i, a.pos.toArray().map(v=>v.toFixed(3)).join(','), a.move.speed.toFixed(3), a.move.onGround); }
