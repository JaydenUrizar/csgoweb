# viewmodel — first-person hands, taggers & animation (src/combat/viewmodel/**)

Built entirely in code (no assets). Entry `index.js` (`createViewmodel(ctx)` -> `ctx.combat.viewmodel`), imported by `src/combat/index.js`.

## Files
`geo.js` faceted mesh builder (box/cyl/side-profile/ring, bevels, per-vertex shade) · `mats.js` per-tagger material set (body/trim/dark/grip/glass/glow/core/vent) + `CosmeticSpec.taggerSkin` patterns (solid, stripes, hex, camo, circuit, chevron, gradient, wear) · `builder.js` model builder (movable parts, ammo-gauge segments, anchors) · `m_pistols.js` pip twin judge · `m_longarms.js` zip hum arc rail halo lance scatter storm · `m_misc.js` tap, haze strobe pulse, beacon kit vest · `kit.js` shared pieces (grips, cells, emitters) · `hands.js` gloved hands (articulated fingers/thumb, armour plate, cuff, sleeve to shoulder, team-colour trim from `ctx.cosmetics.resolve(...).suit`) · `anim.js` springs/easing/clips · `clips.js` keyframed clips (draw, holster, empty, inspect, reload per weapon, bolt, pump, shell reload, melee x3, throws, plant/disarm) · `profiles.js` per-weapon feel (rest pose, kick springs, flash, heat, timings) · `fx.js` muzzle flash (faceted star+cones+glow+point light), ejected glowing cells (pooled), swing trail · `gallery.js` `?scene=viewmodel-gallery`.

## API (contract in docs/ARCHITECTURE.md)
`setTagger(id, skin, {instant,time})` (holster old -> swap -> draw) · `event(name,payload)` fire|reloadStart|reloadEnd|draw|holster|inspect|scopeIn|scopeOut|throw|melee|empty|heat (+ ammo, plant, disarm, progress) · `worldModel(id, skin)` (merged geometry, ~1 m, origin grip, barrel -Z, `userData:{length,muzzle,gripR,gripL,hold,cls}`) · `muzzle` · `update(dt,{speed,onGround,crouch,walking,aimPunch,lookDelta,scoped,hp,ammo,ammoMax,...})` · `setVisible`. Extras: `fovMul`/`scopeT`/`scoped` (world fov multiplier while scoping), `muzzleWorld(out, depth)`, `busy`, `action`, `heat`.
Events consumed from the bus: `jump`, `land`, `footstep` (bob sync), `beacon:arm|disarm` (+ `armed|armCancel|disarmed|disarmCancel`) -> beacon/kit arm animation, then restores previous tagger. Events emitted: `viewmodel:mark {id,name}` (magrelease, magin, boltback, boltfwd, pumpback, pumpfwd, pinpull, cylopen, lidopen, ... for audio), `viewmodel:release`, `viewmodel:throw`, `viewmodel:scope`.
Reload timing is driven by the tagger's `dur` (mag insert lands at u=0.55 = the tagger's `stage:'in'`, commit at 0.9). Shell reload (`shell:true`) builds a per-shell loop clip (start .45 / each .5 / end .4). `throw` without `stage` plays a one-shot pin-pull + cock + swing with the grenade leaving at `delay`.

## Round 2 changes
* **Draw calls**: `uber.js` = one MeshStandardMaterial shading 10 sub-materials by per-vertex id (palette/PBR/emissive uniforms). Each tagger = one opaque mesh per movable part (+ glass); ammo gauge is baked into the part geometry (per-vertex id rewrite). Hands are ONE SkinnedMesh each (bones for fingers/thumb/sleeve). Viewmodel now ~5-8 draw calls (was ~92).
* Rest pose (profiles.js): long arms moved closer + yawed so the left side profile runs diagonally into the lower right; receivers slimmed (root.scale.x .86), panel seams/selector/ejection-port details (`kit.panels`), two-tone arc receiver.
* Skins tint the weapon's own gunmetal (strength .5, desaturated) at reduced pattern contrast -> hazard default is a muted khaki finish, furniture/dark parts stay readable.
* Scope: `drawsScopeOverlay` getter is true until the weapon has hidden (scopeT>.9) so the HUD reticle never shows over the raising lens. First-frame-at-camera flash fixed (rig hidden until first pose).
* Bigger rifle muzzle flash + smoke puffs; lance bolt cycle rolls the rifle and raises the right hand; beacon keypad taps; grenade held higher/closer with wind-up kept in frame; sleeve is a detailed dark tactical forearm (strap, plate, team trim).

## Round 3 changes
* **Framing**: `fitRest()` (index.js) projects the muzzle through the view camera and shifts the rest pose so long-arm muzzles sit at NDC (+0.25,-0.12) ~ (0.62,0.56) of the screen (CS2), clear of the crosshair; refits on aspect change. Guns pushed back ~25% smaller. `viewmodel.muzzle` follows the fitted pose.
* Skins only lightly tint body (22 %) / trim / glow so each tagger keeps its identity colour; reload hand uses an upright grab (fingers up, forearm from below) so fingers stay attached; reload/inspect keep the gun low-right / whole weapon mid-frame; pistols yawed to show the slide side; pistol slide detail; scope eyepiece no longer shows a glowing reticle; melee pivots about the hand (bigger arc) with a shorter ribbon; spectating another actor or a dead local actor hides the viewmodel; gloves/sleeves lighter with gauntlet cuff, plates, straps.

## Round 4 changes
* `fitRest` now covers every class (pistol muzzle ~(0.65,0.63), melee tip, grenade, gear); Judge/pips pushed back (~30% smaller); flash scale capped by muzzle distance from screen centre (`fcap`) so it never reaches the crosshair.
* Left shoulder moved out/down (diagonal support arm), thinner sleeve, round fingers; distinct per-tagger base colours (zip teal/lime, hum blue/white, scatter wood, lance black/crimson, rail steel-blue); SMG model shortened; strobe redesigned (graphite flashbang); beacon rest tilted so the keypad faces the camera; bigger walk bob; Lance hides during unscope so the eyepiece never fills the screen.

## Inspect
* `http://localhost:5173/?test=1&seed=1&scene=viewmodel-gallery[&tagger=arc][&anim=reload][&bg=mid|sand|light|dark][&skin=0..5][&mode=world][&auto=1][&orbit=yaw,pitch,dist]`. Handle `window.__vmGallery {list, show(id,skin), play(anim), set(state), look(dx,dy), orbit(yaw,pitch,dist), setMode('world')}`. anims: idle draw holster fire burst reload inspect empty melee throw plant scope walk run sprint jump look.
* Contact sheets: `node tools/viewmodel_sheet.mjs --taggers arc,pip|all --anims reload,fire|all --frames 9 --size 640x360 --full --out shots/viewmodel/sheets` (one PNG per tagger x anim, frames tiled). Default crop = lower-right viewmodel region; `--full` for whole frame. (The shared box can be very loaded: `open()` waits up to 400 s.)
* Real game: `?test=1&seed=1` then `__game.ctx.combat.debug.give(__game.ctx.localActor,'arc')`; `ctx.combat.viewmodel.debug.{state(),play(clip),clips(),setHeat(v),setAmmo(m,M)}`.

## Tuning
`profiles.js` (rest pose cm/deg, `kick`, `flash`, `heat`, `weight`, timings) · `clips.js` (keyframes in cm/deg; `MAG` table = cell pivots/grab offsets per rifle) · `index.js` update() compose block (bob/sway/breathing/sprint constants) · viewmodel settings from `ctx.settings.get('viewmodel')` {fov, offsetX/Y/Z, bob}.

## Known gaps
* Left hand does not hold the pin in the one-shot throw (hand is mostly off-screen); beacon/kit animations are simple loops.
* Storm lid/hand contact and Judge cylinder/hand overlap are approximate; revolver has no speed-loader prop.
* No separate left-handed mirror; no per-weapon inspect variants beyond the shared tilt/spin (part motions in inspect are limited).
* Scope overlay is drawn by hud (`drawsScopeOverlay` not set here); viewmodel only does the scope-in pose and `fovMul`.
