import { buildTestMap } from '../src/ai/nav/testmap.js';
import { NavSystem } from '../src/ai/nav/system.js';
import * as THREE from 'three';
const m = buildTestMap(); const sys = new NavSystem(m, {seed:1}); sys.build();
const g=sys.g; const a=new THREE.Vector3(),b=new THREE.Vector3();
let c0=process.cpuUsage(); let exp=0, n=0;
for (let i=0;i<300;i++){ g.nodePos((i*7919)%g.N,a); g.nodePos((i*104729+555)%g.N,b);
  const S=sys.sync; const s=g.nearest(a.x,a.y,a.z), e=g.nearest(b.x,b.y,b.z); S.begin(s,e,1.15); S.step(1e9); exp+=S.expanded; n++; }
let c=process.cpuUsage(c0); console.log('astar only: avg cpu us', (c.user+c.system)/n, 'avg expansions', exp/n);
c0=process.cpuUsage(); const p0=sys.pathStats.expanded;
for (let i=0;i<300;i++){ g.nodePos((i*7919)%g.N,a); g.nodePos((i*104729+555)%g.N,b); sys.path(a,b,{noCache:true}); }
c=process.cpuUsage(c0); console.log('full path avg cpu us', (c.user+c.system)/300);
for (const w of [1.0,1.5,2,3]) { c0=process.cpuUsage(); exp=0; let len=0; for (let i=0;i<300;i++){ g.nodePos((i*7919)%g.N,a); g.nodePos((i*104729+555)%g.N,b); const p=sys.path(a,b,{noCache:true,weight:w}); len+=p.dist; exp+=sys.pathStats.expanded; sys.pathStats.expanded=0; } c=process.cpuUsage(c0); console.log('w',w,'cpu us',(c.user+c.system)/300,'exp',exp/300,'len',len/300); }
