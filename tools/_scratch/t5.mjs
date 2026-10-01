import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { buildCourse } from '../../src/player/course.js';
import { createSim } from '../../src/player/simulate.js';
import { createActor } from '../../src/core/actor.js';
const c = buildCourse();
const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(c.positions, 3)); geo.boundsTree = new MeshBVH(geo);
const sim = createSim({ collider: () => ({geometry:geo}), emit(){} , surfaceAt: () => 'stone' });
const a = createActor({ name: 'x', team: 'ember', isPlayer: true });
a.pos.set(-0.7,0,-40);
const cmd = { forward: 1, right: 0, jump: false, crouch: false, walk: false, yaw: 0.0873, pitch: 0 };
for (let i = 0; i < 400; i++) { sim.simulate(a, cmd, 1/120); if(i%20==0||(i>230&&i<245)) console.log(i, a.pos.toArray().map(v=>v.toFixed(3)).join(','),'v', a.vel.toArray().map(v=>v.toFixed(3)).join(','), a.move.speed.toFixed(2)); }
