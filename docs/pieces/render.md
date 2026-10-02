# Piece: render — Rendering, lighting & post-FX (owner: render)

Files: `src/render/**` (index.js entry; helpers in `materials.js`, `textures.js`, `sky.js`, `post.js`, `scenes.js`).
Everything below is the STABLE contract — other pieces may code against it now. Always use `ctx.render?.materials?.flat?.(...) ?? fallback`.

## ctx.render (top level)
```
renderer, scene, camera (PerspectiveCamera, world), viewScene, viewCamera (first-person viewmodel pass),
sun (DirectionalLight), sunDir (Vector3, unit, points FROM origin TOWARD the sun), hemi, sky (Object3D dome),
render()                    // called by engine each frame: world -> post -> viewmodel pass -> screen fx
resize()                    // auto on window resize
setQuality('low'|'medium'|'high'|'ultra')   // also driven by settings.quality via 'settings:change'
quality                     // current preset name
setViewmodelFov(deg)        // default 68 (also follows settings.viewmodel.fov)
setFov(deg)                 // world camera fov convenience (player normally sets camera.fov itself)
shake(amount, decay=6)      // additive camera-space trauma (amount ~0..1, ~0.15 small hit, 0.6 explosion). Uses settings.screenShake
follow(pos)                 // sun shadow frustum follows this world point (auto-follows camera if never called)
setTimeOfDay / setSky(opts) // {sunElevationDeg, sunAzimuthDeg, sunColor, skyTop, skyHorizon, fogColor, fogDensity} live retune
info()                      // {calls, triangles, points, lines, geometries, textures, quality, scale, fps}
layers = { world:0, actor:1, fx:2, viewmodel:3 }
screen = {
  flash(color=0xffffff, amount=1, decay=3),   // additive full-screen colour flash that decays (amount 0..1)
  blur(amount),                               // 0..1 radial+ring blur. Holds 0.12 s after the last call then fades (so call every frame while active, or once for a pulse); 0 clears
  tint(color, amount),                        // screen colour tint (edge-weighted), amount 0..1. Holds 0.15 s after last call then fades; 0 clears
  damage(dirRad, amount),                     // chromatic-aberration + red-ish edge pulse; dirRad = screen-space angle of hit (0 = from ahead)
  whiteout(t),                                // flash-bang whiteout: t = seconds of full white; then fades ~2.5 s. Call again to extend.
  clear(),
}
addPostPass(pass)                             // extra three EffectComposer pass appended before output
debug = { screens(), setExposure(x), setSunAngle(elDeg, azDeg), toggle(name,bool) /* 'bloom','ssao','grain','vignette','shadows','fxaa' */, stats() }
```
Layers: world geometry uses layer 0 (default). Actors/fx layer 1/2 are still rendered by the main camera (camera enables 0,1,2). The viewScene (own lights, own camera) is rendered in a second pass over the finished post buffer with depth cleared. Objects in viewScene should be plain Meshes using `ctx.render.materials.*` (or their own materials — they will be lit by viewScene lights: a soft key + rim + hemi).

## ctx.render.materials  (all cached by args where cheap; materials are shared — do NOT mutate them; clone() first)
```
flat(color, o?)            // faceted low-poly look. MeshStandardMaterial, flatShading:true, roughness .85, metalness 0.
                           //   o: { roughness, metalness, vertexColors (true to use geometry 'color' attr from bakeVertexAO), emissive, emissiveIntensity, map, side, transparent, opacity }
toon(color, o?)            // soft 3-band gradient-lit (MeshToonMaterial + generated gradientMap). same o.
emissive(color, intensity=2, o?)   // MeshBasicMaterial, colour multiplied >1 so bloom picks it up (toneMapped:false). o:{transparent,opacity,side}
glass(color=0x9fdcff, opacity=0.28, o?)   // transparent, depthWrite:false, physical-ish sheen with env reflections
metal(color, rough=0.35, o?)       // metalness .9 using the PMREM sky env
textured(kind, color=0xffffff, o?) // kind: sand|brick|concrete|metal|tile|wood|grass|water|grid|rubber. small mipmapped, anisotropic, tiled RepeatWrapping canvas textures.
                                   //   o: { repeat:[u,v], flat:true (faceted normals), roughness, vertexColors, uvScale }
                                   //   NOTE: textures are sized for ~1 texel/2 cm... use geometry UVs 0..1 per metre (world-scale UVs) for best results, see `worldUV(geometry, scale=1)` below.
team(teamId, o?)           // 'ember'|'tide' team-colour suit material: satin, slightly emissive rim, faceted. Never mutate.
hologram(color=0x66e0ff, o?)  // additive fresnel scanline holographic material (animated; time uniform updated by render()).
unlit(color, o?)           // MeshBasicMaterial, fog-aware, toneMapped:true.
gradient(top, bottom, o?)  // vertex-height gradient toon-ish lit material (nice for props / sky cards)
setVertexColorAO(mat)      // helper: returns the material with vertexColors on (call if your geometry has 'color' attr)
worldUV(geometry, scale=1) // writes triplanar-ish box-projected 'uv' into a non-indexed geometry in metres*scale (call once at build time)
```
All colours accept hex numbers, css strings or THREE.Color.

## ctx.render.bakeVertexAO(geometry, { samples=24, radius=2.5, strength=0.65, bvh=null, tint=0xffffff, groundBounce=0x000000 })
Bakes ambient-occlusion (+ optional cool sky/warm ground tint) into a `color` vertex attribute (non-indexed geometry preferred; converts if indexed). Uses three-mesh-bvh raycasts against the geometry itself (or `bvh` mesh if given). Returns the geometry. Use with `materials.flat(color, {vertexColors:true})`. Synchronous; ~1–2 ms per 1000 vertices at 24 samples — do at load time only. Pass `samples:0` to skip (fills white).

## Screen-effect conventions for other pieces
* damage taken: `ctx.render.screen.damage(angle, dmg/100)` + `ctx.render.shake(0.12+dmg/300)`
* flash-bang: `ctx.render.screen.whiteout(seconds)` (seconds = full-white duration)
* explosion / pulse: `ctx.render.shake(0.5)`; `ctx.render.screen.flash(0xffffff, 0.35, 5)`
* low-hp: `ctx.render.screen.tint(0xff2030, 0.12)` (refresh each frame)

## Inspect (critic / builders)
* `?test=1&seed=1&scene=render-gallery` — material spheres/panels lit by the golden-hour sun, sky, shadows, bloom emissives, glass.
* `?scene=render-fx` — auto-cycles flash, blur, tint, damage, whiteout, shake (deterministic with `__game.advance(s)`).
* `__game.ctx.render.debug.*`, `__game.ctx.render.setQuality('low')`.
* `node tools/shot.mjs shots/render/gallery.png --params "test=1&seed=1&scene=render-gallery" --adv 1`

## Status (round 1)
Done: lean HDR pipeline (MSAA world RT + depth, depth-based SSAO half-res, dual-filter bloom with threshold ~1.7, god-ray pass, ACES + grade/vignette/grain/CA, FXAA), separate alpha-blended viewmodel pass (camera-space lit), sky dome + faceted clouds + PMREM env, texel-snapped follow sun shadow (1024-4096), fog, full materials API, bakeVertexAO (+`bakeVertexAOAsync`), screen fx, shake, dynamic resolution (off in ?test).
Quality presets: low (no MSAA/SSAO), medium (2048 shadows), high (default: MSAA4, SSAO, shafts), ultra (4096, more SSAO taps). `?q=low` overrides.
Tuning: `ctx.render.debug.fx` (exposure .85, bloom, ao, vignette, contrast, saturation), `setSky({sunElevation,sunAzimuth,skyTop,...})`.
Known gaps: single shadow cascade (R=26-40 m around view); `addPostPass` is a no-op; no SSR/DOF; menu backdrop patches ctx.render.render so `?test=1` shows the menu unless `ctx.menu.backdrop.leave()` is called (render scenes hide HUD via #ui).
Inspect: `?test=1&seed=1&scene=render-gallery`, `?scene=render-fx` (`__game.ctx.render.debug.fxScene.jump(i)`), toggles via `debug.toggle('ssao'|'bloom'|'grain'|'vignette'|'shadows'|'shafts', bool)`, `debug.stageCam.pos/look` to move the camera.

## Round 2 changes
* Ambient is now a separate near-neutral warm env palette (`sky.params.envTop/envMid/envHorizon/envGround`), env intensity 0.36, hemi 0.10, no blue fill light; sky dome desaturated; fog 0.002; bloom threshold 2.0.
* **Sky occlusion / interior ambient** (`src/render/skyocc.js`): after `ctx.map` exists, render bakes a 0.75 m grid over `ctx.map.bounds` (uses `map.raycast/heightAt/visible/lamps`) with sky openness, ceiling height and lamp pools. A global hook on `THREE.Material.prototype.onBeforeCompile` scales indirect light for every lit material under a ceiling (darker, warmer, lamp pools). No map changes needed. Toggle: `render.debug.toggle('skyocc', bool)`; tune `render.debug.skyOcc.U.uSkyOccMin / uLampK / uSkyWarm`.
* Grade: shadows desaturated + slight cool split-tone, contrast 1.14, sat 1.06. Real-map check: `node shots/render/views.mjs prefix "mid,b-tunnel,hub-arches"`.
* Mid-doors: door leaves were black only because they were in direct shadow under the arch with ambient ~0; now lit by the occluded-but-floored ambient (min 0.34).

## Round 3 changes
* Exposure 0.86, env 0.46, hemi 0.16, brighter warm env horizon/ground, toe lift (+0.045), vignette 0.10, contrast 1.2, brighter cleaner sky/horizon.
* SSAO was never running (`S.ao` typo) - now active (radius 1.2, intensity 0.8, max 0.7 darkening); toggling changes ~4-8% of pixels by >20 levels.
* Global hook also adds world-space macro/micro value variation + roughness variation to every lit material (breaks up flat floors).
* Damage effect: directional edge pulse (pow 3 around hit direction), faster decay, smaller CA.
* Stats tool: `node shots/render/game.mjs <prefix>` (11 real-match HUD-off frames) then `python3 shots/render/stats.py shots/render/<prefix>_*.png` (mine: median ~0.47, p5 ~0.15, dark<0.06 ~1%; CS2 refs `reference/cs2/ss_*.jpg`: median 0.42, p5 0.18, dark 0.6%).

## Round 4 changes
* Roofed spaces: occluded ambient capped (<=0.40x, floor 0.12), lamp contribution is now a tight 3.3 m quadratic pool (k=1.0); solid cells (pillars) borrow neighbour ambient. Viewmodel pass bypasses the sky-occlusion hook.
* Warm ground bounce gradient low on walls (hook); micro-contrast up; shadow radius 1.1 (sharper).
* Grade: sat 0.80, slight cool gain, less warm highlight tint, sun 0xffecd4/5.0, bloom 0.08 thr 2.4, shafts 0.08, contrast 1.12, toe lift. Viewmodel lights softened (key 1.5).
* Stats (11 real-match frames): median 0.38 (CS2 0.42), p5 0.13 (0.18), p95 0.79 (0.75), sat 0.27 (0.28), warm 0.10 (0.07), clipped 0.3% (1.2%).

## Round 5 changes
* `src/render/lamps.js`: nearest 6 `ctx.map.lamps` become real shader lights (wrapped quadratic falloff, 4.5-7 m, lights floors, walls, ceilings, pillars); up to 64 additive billboard halos (1 InstancedMesh, bloom core + halo). Indoor factor from the baked sky-occ grid: lamps in open air get ~20% glow/light, roofed lamps full.
* Min occluded ambient 0.22 (cap 0.52x), env 0.66, contrast 1.06, gamma lift 0.95 + toe: midtones 43% (CS2 47%), p5 0.17, near-black ~0%.
* Post sharpen (0.45 CAS-like unsharp) folded into the FXAA pass for detail.
* Stats (11 frames): median 0.44, p5 0.17, p95 0.77, sat 0.28, warm 0.10, clip 0.1% (CS2: 0.42 / 0.18 / 0.75 / 0.28 / 0.07 / 1.2%).
