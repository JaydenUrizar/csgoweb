import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { buildCourse } from '../../src/player/course.js';
import { createSim } from '../../src/player/simulate.js';
import { createActor } from '../../src/core/actor.js';
const c = buildCourse();
const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(c.positions, 3)); geo.boundsTree = new MeshBVH(geo);
const sim = createSim({ collider: () => ({geometry:geo}), emit(){} , surfaceAt: () => 'stone' });
const a = createActor({ name: 'x', team: 'ember', isPlayer: true });
const s0=c.stations[process.argv[2]]; a.pos.set(s0.x,s0.y,s0.z); console.log(s0);
const cmd = { forward: 1, right: 0, jump: false, crouch: false, walk: false, yaw: 0, pitch: 0 };
for (let i = 0; i < 120; i++) { const b=a.pos.clone(); sim.simulate(a, cmd, 1/120); if(i%8==0) console.log(i, b.toArray().map(v=>v.toFixed(4)).join(','),'->', a.pos.toArray().map(v=>v.toFixed(4)).join(','), 'v', a.vel.toArray().map(v=>v.toFixed(3)).join(',')); }
