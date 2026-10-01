import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWorld } from '../src/combat/utility/world.js';
import { stepGrenade, makeGrenade } from '../src/combat/utility/sim.js';
const boxes=[];const box=(x,y,z,w,h,d)=>{const g=new THREE.BoxGeometry(w,h,d).toNonIndexed();g.translate(x,y+h/2,z);g.deleteAttribute('normal');g.deleteAttribute('uv');boxes.push(g)};
box(0,-1,0,100,1,100); box(3,0,0,0.1,4,20); // thin wall
const geo=mergeGeometries(boxes);geo.boundsTree=new MeshBVH(geo);const mesh=new THREE.Mesh(geo);
const W=createWorld({map:{collider:mesh}});
function run(){ const g=makeGrenade(); g.pos.set(0,1.6,0); g.vel.set(16,4,0); const log=[]; let t=0; for(let i=0;i<1200&&!g.rest;i++){stepGrenade(g,1/120,W,null,(gg,s)=>log.push([+(i/120).toFixed(2),+gg.pos.x.toFixed(2),+gg.pos.y.toFixed(2),+s.toFixed(1)])); t=i;} return {t,pos:g.pos.toArray().map(v=>+v.toFixed(3)),log}}
console.log(JSON.stringify(run())); console.log(JSON.stringify(run().pos));
const g=makeGrenade(); g.pos.set(0,1.6,0); g.vel.set(3,2,0); for(let i=0;i<1200&&!g.rest;i++)stepGrenade(g,1/120,W,null); console.log('slow',g.pos.toArray(),g.rest,g.age);
