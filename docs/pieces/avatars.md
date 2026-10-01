# Piece: avatars (src/characters/**)
Procedural chunky low-poly athletes: 1.8 m, ONE skinned draw call each (~2.3k tris), 17-bone rig, per-actor shader material (role colours, patterns, team rim light/emissive strips, spawn materialise, freeze-crystal).
## Files
body.js (rig + geometry + cosmetic variants) · material.js (shader) · anim.js (locomotion/IK/actions) · weapons.js (hold poses, reload paths, fallback guns) · hitboxes.js · tagout.js (particles) · sequence.js (tag-out state) · gallery.js (scene+debug) · index.js (API, events).
## API (ctx.characters)
spawn(actor,{spec,materialise}) · remove · tagOut(actor,dir,{style}) · muzzleWorldPos(actor,out) · setVisible(actor|bool, v) · hitTest(ray,ignore,far)->{actor,hitgroup,point,distance,normal} · hitTestAll(ray,ignore,far) · attachPoint(actor,'head|visor|back|shoulderL|shoulderR|handR|handL|trailEmitter|nameplate|weapon|hip') · refreshCosmetics · setViewActor · setThirdPerson · showHitboxes · showNameplates · stats() · debug.
Models auto-spawn for every actor in ctx.actors; the view actor (localActor / `spectate` event) is hidden but still casts a shadow. Held tagger from `ctx.combat.equipped(actor)` (+ `ctx.combat.viewmodel.worldModel`, fallback boxes; a child named `muzzle` is used). Plant/disarm detected from actor.action|planting|disarming or ctx.match.beacon. Events consumed: weapon:fire/reload/switch, util:throw, tag:hit, tag:out, footstep (phase sync), land, jump, round:start, spectate. Emits character:shatter. See docs/requests/vfx-from-avatars-1.md.
## Inspect
* `?test=1&seed=1&scene=character-gallery[&layout=lineup|pair|solo|cosmetics][&page=0-4][&pose=run][&hitboxes=1][&ui=0]` — keys: [ ] page, P pair, O lineup, C cosmetics, H hitboxes, T tag-out replay, N nameplates; drag orbit, wheel zoom, click = hit test.
* `__game.ctx.characters.debug`: pose(name[,actor]), poses[], setTagger(id), trigger('fire|reload|throw|hit|land|spawn|tagout|switch'), tagOutAll(style), hitboxes(bool), cam(az,el,dist,ty,tx), layout(kind,page), stats().
* `node tools/character_sheet.mjs --poses run,crouch,reload --frames 6 --dt 0.09 --out shots/avatars/sheet` (3 angles per pose, optional animation strip).
## Tuning
gait: C/duty/h in anim.js (animate), HOLD poses & RELOAD waypoints in weapons.js, capsules CAPS in hitboxes.js, tag-out timing T_FREEZE/T_SHATTER in sequence.js, recipes in tagout.js burst().
## Known gaps
No terrain-adaptive foot IK; hands are boxy gloves (no fingers); nameplate/trail/charm only attach points (trail/charm not rendered); held weapon does not take the freeze look; reload/throw/plant timings are guesses until combat/match expose exact stages; hitTest uses capsules not boxes.
