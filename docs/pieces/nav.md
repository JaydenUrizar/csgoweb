# Nav — navgrid & pathing (piece `nav`, round 1)
Code: `src/ai/nav.js` (ctx glue) + `src/ai/nav/{config,graph,search,regions,tactics,system,debug,validate,testmap}.js`. Everything is generated from `ctx.map.collider` + `ctx.map.bounds`; regenerated on map events (`map:ready|built|change…`), when the collider signature changes (polled), or `ctx.nav.rebuild(opts)`. Pure modules run in Node.

## How it works
0.5 m multi-level columnar grid. Node = standable surface found by downward FrontSide rays (slope <= 45 deg), 2.0 m headroom (up-ray), and a step-aware capsule clearance (r 0.36+0.08 margin, geometry <= 0.45 m high is stepped over, as in `player/simulate.js`). 8-neighbour walk edges (ramps verified by mid-ray, no corner cutting), jump-up links (0.45..1.1 m, reach 1.5), drop links (<= 4.5 m, cost grows). Pruned to the strongly-connected component holding the spawns/sites. Weighted A* (w 1.5, indexed heap, generation stamps, zero per-query alloc), wall-proximity cost, LRU path cache, string pulling with cell-quad LOS (capsule-safe) that never cuts across jump/drop links. Areas = map callouts flooded along the graph + auto "<Callout> NE" zones.
Crux Station: 16.9k nodes, build ~0.5 s, path avg ~0.45 ms / p50 0.3 ms for random 60 m pairs (shared CPU), 0% failures.

## API (`ctx.nav`; points may be Vector3 or actors)
`path(from,to,{danger,team,weight,smooth,noCache}) -> Vector3[]|null` (start excluded, last=goal; `.flags[i]` 0 walk/1 jump/2 drop arriving at i, `.dist`, `.jumps`) · `requestPath(from,to,cb)` time-sliced (fixed expansion budget, deterministic) · `eta`, `pathLength`, `sitesToSpawnRouteTimes(speed)` · `nearestNode`, `nodePos`, `snap`, `isWalkable`, `groundY`, `areaAt(pos)->callout name`, `areas()` · `visible(a,b,{eye,eyeA,eyeB,ignoreSmoke})` (BVH eye rays + `ctx.combat.utility.blocksLine`), `exposure`, `sightDistance` · `coverPoints(near,from,radius,{max})`, `holdAngles(pos)`, `holdSpots(near,toward,radius)`, `randomPointNear(pos,r,{minRadius,dy,minWall,visibleFrom})`, `randomPoint` · `danger.add(pos,amount,radius,team,{los})/at/decay/clear/leastDangerous` (feeds path cost with `{danger:w,team}`; auto-decays, 12 s half-life) · `rebuild(opts)`, `useMap(obj)`.
Tuning: `ctx.nav.config` (src/ai/nav/config.js).

## Inspect
- `http://localhost:5173/?test=1&seed=1&scene=nav-debug&view=top` (`view=iso`, `&map=test` swaps in the stress-test level, `&edges=1`). Coloured nodes = areas (dark = wall-adjacent), magenta = jump links, yellow = drop links, coloured polylines = sample paths, cyan cones = cover points (white line = peek spot), yellow/orange rays = hold angles.
- Console: `ctx.nav.debug.draw(true)`, `.stats(200)` (nodes, buildMs, avgPathUs, failRate), `.benchmark(n)`, `.validate(2000)`, `.showCover(pos,from)`, `.showDanger()`, `.camera('top'|'iso'|null)`.
- `node tools/nav_validate.mjs` (stress-test map, Node only) / `--map=game` (real map via headless Chromium): 2000 random pairs, capsule sweep of every path, deterministic re-run, route times. Test map: PASS. Crux Station: 2000/2000 reachable, 0 clipping except a few crossings of one map seam near (26,1.5,-32) (see docs/requests/map-from-nav-1.md).

## Known gaps
No dynamic obstacles/doors; no ladders; hold-angle quality heuristics are simple; area labels sprites in the overlay not verified; A* ~0.3-0.5 ms for long routes (cache/slicing hide it, hierarchical search would cut it further).
