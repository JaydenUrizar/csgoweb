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


## Round 2 changes
- **Perf**: ALT landmark heuristic (8 landmarks, `nav/alt.js`) + weighted A*: random 65 m routes ~0.3 ms avg / <1 ms p95 on Crux. Cover/hold now use a precomputed set of ~1000 wall-hugging *spots* (Poisson over wall-adjacent nodes) with background-filled 32-ray sight profiles: `coverPoints` ~0.3 ms, `holdSpots` ~0.6-0.9 ms, `holdAngles` ~0.2 ms (wall clock under heavy CPU contention; worst ~3-5 ms). `holdSpots` exposure is 0..1 and falls back to spots *facing* the threat bearing (visible:false) when it is out of sight.
- **Async build**: first build at boot is synchronous (~0.7 s); later map changes rebuild in a time-sliced generator (`ctx.nav.rebuild(opts,{async:true})`, `nav.progress`, `nav.building`), old data stays usable until the swap; slices ~3-30 ms. Profiles precompute in the background after each build.
- **Links**: jump links now reach 1.6 m (mantle: jump 1.05 + lip, flag 1 like jumps). Jump/drop costs raised so hop-over of planters is only taken when the walk-around is >~10 m (hop-over paths 9% -> 3%, remaining are Hub walls).
- **Coverage/robustness**: sloped-edge midpoint headroom check removes the (26,1.5,-32) seam crossings; down-scan up to 96 surfaces per column; margin 0.07; 1.6% of standable spots lack a node within 1 m (0.1% on the stress map).
- **Overlay**: `?scene=nav-debug` (default `view=top`; `&view=iso`, `&links=1`, `&edges=1`, `&labels=0`, `&cover=0`, `&paths=0`, `&backdrop=0`, `&hud=1`) hides HUD/roofs/skyline, renders the exact collision mesh in grey, area-coloured dots with white borders, fat sample-path lines, large area labels, cover cones. `debug.layers({...})`, `debug.coverage()`, `debug.tacticsBench()`, `debug.backdrop(bool)`, `debug.hideUI()`.
- `tools/nav_validate.mjs` additionally prints tactics timings, node coverage of standable spots and hop-over path count.

## Round 3 changes
- `holdSpots` is now a pure function of (graph, args): per-spot openness is computed on demand (16 rays, cached) and the background pump keeps running after a sync `build()` (previously `bg` was dropped, so 0/1031 profiles existed and results depended on history). Scoring uses **body exposure** from the threat's eye (head/chest/legs rays, smoke-aware via `hooks.blocksLine`): head/chest-only spots win over open floor. Returns `bodyExposure` (1/3 = head only), `exposure` (0..1 openness), `visible`; falls back to spots facing the bearing when the threat is not visible. `debug.holdCheck()` verifies determinism (cold/cleared/warm caches identical).
- A* movement rules: stacked mantles (<2 m run-up after a link) cost +30; a drop within 9 m of walking after a jump (hop-over) costs +16; ledge nodes (a missing neighbour that is a drop) cost x3 so routes keep off platform edges. Hop-over paths 5% -> 1.2%.
- Ramp edges must follow a continuous slope (25/50/75 % probes), so 0.5+ m vertical steps become jump links, not walk edges; jump/drop links also need a clear capsule at the midpoint (railings).
- `debug.simWalk(n)`: walks random paths with the real `ctx.player.simulate` and a pure-pursuit follower (jump on flag 1); stall rate 6.8% (critic) -> 1.3%. Printed by `nav_validate --map=game`.
- `runSpeed` 7.2 (matches player sim) for `eta`/`sitesToSpawnRouteTimes`.
