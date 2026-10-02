# Map — Crux Station (piece `map`, round 1)

Code: `src/world/` — `grid.js` (heightfield skeleton: watertight walls by construction), `layout.js` (regions, zone palettes), `terrain.js` (AO-baked vertex-colour meshing, wall bands, stairs, collision), `props.js` + `dress.js` (arches, tunnel roofs, catwalk, props, windows/murals/lamps), `decals.js` (signage atlas: floor callouts, plaques, windows, murals), `skyline.js`, `radar.js`, `collision.js` (BVH), `data.js` (spawns, sites, nodes, paths), `scenes.js`, `verify.mjs`.

## Layout (metres, -Z north; Ember south, Tide north)
Ember Spawn (z 38..50) has 3 exits: W -> B Tunnels (4 bends, 6 m wide, roofed), centre -> Mid Lane -> Mid Doors (4 m gate) -> Hub (x +-10) -> 3 Arches -> Palace (fountain), E -> Outer Long -> Long Doors -> Long (60 m AWP lane, Pit, Cargo, Long Ramp) -> A Site (upper courtyard y=1.5, NE; Ledge platform y=3.6 with stairs + jump boxes; plinth = default plant). Short ramp (hub NE) -> Catwalk deck (y=3.0, over the Palace east end) -> Terrace -> Catwalk Stairs onto A. B Site is the lower plaza (y=-1.4, NW) reached by Tunnel Mouth (ramp), B Connector (from Palace), B Door (from Tide), and B Window (jump-through, boost steps in plaza / bench in Window Room). Balcony y=1.2, canal.
Timings at 6.5 m/s (verify.mjs): Ember -> A 15.5 s, B 14.9 s; Tide -> A 6.4 s, B 6.0 s; A<->B rotation 11.0 s (73 m via Tide Spawn).

## ctx.map API
`group, collider (BVH mesh; geometry.boundsTree), bvh, raycast(o,d,far)->{point,normal,distance,surface,thin,owner}, raycastThrough(o,d,far,maxHits)` (steps through thin walls), `visible(a,b)`, `spawns{ember[5],tide[5]}:[{pos,yaw}]`, `sites{A,B}:{center,radius,y,plant:{center,radius},objects}`, `callouts[{name,pos,radius}]`, `calloutAt(p)`, `bounds`, `playBounds`, `surfaceAt(p)` (stone|sand|metal|wood|water|grass), `thinWalls[{box,surface,mul,name}]`, `thinWallAt(p)`, `triggers` (site, buyzone), `objectsAtSites{A,B}`, `lightProbes`, `lamps`, `heightAt(x,z)`, `radar`, `nodes{list,byId,paths,ofType(t)}`, `setRoofsVisible`, `debug`.
`radar`: `canvas/texture` (ground), `levels[{name:'ground'|'upper',canvas,texture}]`, `canvasFor(y)`, `levelAt(y)`, `worldToRadar(x,z,out)->{x,y}` normalised 0..1 (v down = +z), `worldToPixel`, `ppm`=8.
Nodes: `{id,type: plant|hold|choke|angle|cover|lurk|entry, team, site:'A'|'B'|'MID', pos, yaw (0=-Z), note, width?, elevated?}`; paths: ember-long/short/mid-b/tunnels, tide-a/b, rotate-*.
Collision: terrain slopes/stairs are smooth ramps; props are AABB/octagon prisms; arches use real extruded triangles. Min jump-up in the map 0.55-0.75; widest step-free gaps 4 m+.

## Inspect
- `node src/world/verify.mjs` — Node-only traversal (capsule r 0.36/h 1.8, steps <=0.75), reachability, leak and node-validity check, path timings.
- `http://localhost:5173/?test=1&seed=1&scene=map-overview&view=top` (views: `ctx.map.debug.views`; `&roofs=0`, `&hud=1`). Runtime: `__game.ctx.map.debug.setView('a-ramp')` then `__game.advance(0.2)`.
- `node tools/shot.mjs shots/map/x.png --params "test=1&seed=1&scene=map-overview&view=long"`.
- Budget: 61 map meshes, ~31k render tris, 5.7k collision tris.

## Known gaps / next
Rooftops are plain; facades repeat windows; no instanced foliage variety; murals are procedural shapes not illustrations; AO is grid-based (no baked prop-to-wall contact except contact rings); no real point lights (emissives only, `ctx.map.lamps` lists positions); doors are static props; one canal only; water is a flat animated texture.


## Round 2 changes
- Facade kits (`facade.js`): per-zone stucco/brick panels with pilasters, string courses, shopfronts (door + awning + sign), balconies with railings/planters, window/shutter/grille variety, sloped-ramp walls too, terracotta eaves, pipes; tunnels get pipes/niches/hanging lamps; bunting over lanes.
- Rooftops (`roofs.js`): hip/gable roofs, flat roofs with parapets/tanks/huts/AC; 6 landmark towers (Palace bell tower, A dome tower, B minaret, etc.); skyline buildings have roofs + window decals (separate sky meshes, hidden in `view=top`).
- Props/cover (`extras.js`): lane-middle clusters (carts, cafe sets, parasols, sacks, planters), Hub block + pavilion + walls, A ruin walls/goose block/steps, kiosks in Tide Mid / Window Room / East Room, arcades.
- Sightlines: centre Hub arch closed, kiosks added -> spawn<->spawn LOS 0.3% (was 8.6%), Ember mid exit<->Tide Mid 0%. Check: `node src/world/verify.mjs los`.
- Callouts: `calloutAt` falls back to the floor zone name -> 100% floor coverage (also `zoneAt`).
- PATHS: regenerated from `PATH_SEEDS` by `node src/world/verify.mjs genpaths` (clearance 0.62, no jumps); never crosses props.
- Render glitch (black walls + white arch near Mid Doors): caused by `flatShading` derivative normals on large wall quads; map materials now use vertex normals (`flatShading=false`) and wall quads are <=5 m.
- Perf: static geometry merged into one mesh per material (26 meshes), ~60k render tris, 7.4k collision tris, 130-140 draw calls in play.

## Round 3 changes
- Tunnel identities: zones `tunapp` (ochre plaster + terracotta tile, orange lamps), `btun1` Lower (grey-green plaster, teal tile wainscot, cyan lamps), `btun2` Bend (red brick, timber/iron, amber lamps), `btun3` Upper (whitewash, blue tile, cool lamps); arched ribs every 5 m, hanging lanterns, niches, murals, per-bend plaques (`facade.js` tunnelWall, `dress.js` roofRects).
- A/B/Palace facades: arcades with engaged columns (arcade decal), colour bands, 2 m checker paving in big courts, long ramp stripes; A east loggia with trellis, north gallery, 3-tier ziggurat cover with lantern pillar; Hub stage + pillar; B stage; Palace fountain is now tiered (basin, pedestal, upper bowl, jets, four lantern plinths).
- Landmarks are unique: Palace clock tower (only one with a clock), A teal dome, B terracotta minaret, Mid red-brick campanile, tunnel-approach lighthouse, Outer Long water tower.
- Fixes: balcony side rails were solid black panels (now open bars); parasol undersides; containers get stripe + door bars and metalness 0; Window Room/East Room have no shopfronts, lower west wall + lamps; canal lamps/glow; spawn<->spawn LOS 3/9216 (was 13/6084); `rotate-a-to-b-palace` now walks the short ramp (generator forbids drops > 0.6 m).

## Round 4 changes
- Value hierarchy: tunnel zones darkened (x0.72 walls/floors, much darker ceilings/ribs), arch vault interiors darkened per passage (`dark`), floor light pools under lamps (alpha fans in the contact layer). `ctx.map.lamps` = `[{pos,color,intensity,radius,kind: wall|lantern|post|plinth|fountain}]` (125 entries).
- Hard shade: overhead arches across Long (z=21, z=-1) and Mid lane (z=26), 1.3 m tile eaves, Long portico with roof slab, loggia/gallery, gazebo.
- Tunnel floors per bend (teal tile / dark brick / grey stone / terracotta brick).
- Signature pieces: A lantern gazebo over the default + ziggurat; B lantern-market pergola with stalls; Mid market stall (breaks the straight spawn peek, spawn<->spawn LOS 0/9216).
- Mid rotation: new A Connector (Palace east end -> A, ramp x17..22). A<->B via Palace 63 m (~9.7 s at 6.5 m/s), via Tide Spawn 72 m. Paths `rotate-a-to-b-palace` / `rotate-b-to-a-palace`.
- `heightAt(x,z,y)` with `y` returns the floor under that height (null inside solid); `floorAt(x,z,y)`; `heightAt(x,z)` still terrain/rooftop for solid cells. `calloutAt` prefers the floor-zone callout (Tide Mid vs Tide Spawn fixed).

## Round 5 changes
- Baked lamp light (`lightbake.js`): lamps tessellate nearby surfaces (<=1.5-2.1 m) and modulate vertex colours by visibility-tested warm pools on floors, walls, ceilings, arch undersides (`?nobake=1` to disable; `ctx.map.stats.bake`, `stats.lampsBaked`). See `docs/requests/render-from-map-1.md` (render should reduce its own lamp diffuse). Boot cost ~1-2 s, ~150k map tris total.
- Real fixtures: lantern cages with chains/caps/frames and warm cores, bracketed wall lanterns, lamp-post lanterns.
- Hero pieces: dense B market pergola (posts on stone bases, double beams, slats, cloth, vines, string lights, lanterns, produce stalls) and A lantern gazebo (lattice, hip tile roof, benches).
- Tide Mid is now a teal-tile wall-fountain monument + obelisk (Ember Mid keeps the market stall); floor callouts are dark text with light outline on light paving; A/B letters have a dark backing disc; plaster texture tile 8 m (no repeated crack stamps); Long Ramp seam removed; skyline reduced to 2 rings, fewer towers.
- Paths are now 3D triples `[x,z,y]`; generator rejects segments whose end isn't on the same level (fixes the 3 m rise at (16.5,-26)->(18.5,-27)).
