# tagger — ballistics, recoil, inventory (src/combat/*.js except viewmodel/, utility/)

Files: `taggers.js` (12 defs, spray patterns, constants) · `ballistics.js` (inaccuracy, damage/armour, hitboxes) · `core.js` (inventory, fire loop, hitscan, pickups, utility-slot input) · `range.js` (`?scene=range`) · `index.js` (wires viewmodel + utility). Tests: `tools/combat_test.mjs` + `tools/plot_spray.py`.

## Inspect
* `?test=1&seed=1&scene=range[&tagger=arc][&bay=main|pen|wall]` — flat range: static/crouched/armoured/strafing dummies, distance markers, penetration lanes (wood/glass/stone, x=24/30/36), spray wall with exact 1-degree grid at 20 m. Overlay shows inaccuracy, recoil index, TTK. Keys: `[` `]` tagger, `T` bay, `Y` reset, `U` dummy armour. Works with stubbed map/characters (installs its own collider/raycast).
* Script: `__game.hold({fire:true}); __game.advance(0.5)`; `ctx.combat.debug.{state(),give(a,id),range.{bay,setTagger,reset,stats,impacts}}`.
* Headless numbers/plots: `node tools/combat_test.mjs [--trials 40]` -> `shots/tagger/{spray_<id>.png,spray_all.png,ttk.md,accuracy.md}` + ~75 PASS/FAIL checks (CS2 damage, rates, accuracy rules, inventory, bursts, bolt, shotgun reload, wallbang, events).

## Model (CS2 numbers, 1 u = 0.0254 m)
* Damage: base x hitgroup (head 4, stomach 1.25, leg 0.75) x `rangeMod^(d/12.7 m)`; armour: `armorPen` share to health, half of the rest absorbed by armour; helmet only covers head, legs uncovered; truncated to ints. Friendly fire off (bullets pass teammates).
* Inaccuracy (deg): stance + move x f(speed) + air + fire-accumulation; f = 0 under 34 % of max speed (shift-walk / counter-strafe accurate), 1 at max. Per-actor seeded RNG -> reproducible.
* Spray: fixed per-weapon pattern `patternAt(def, idx)` (shot 0 = (0,0)); bullets use pattern x recoilScale; camera shows 45 % of it (`VIEW_TRACK`); index decays after the cycle +grace over `recover.stand/crouch`.
* Penetration: `def.pen` m x material (`glass 2.4, thin 1.6, wood 1, ...`), solid map walls default 0.15; thin = `map.thinWalls` / `hit.thin`. Exit found by back-ray; tag events carry `wallbang`, `through` (surface).
* Fire: cycle accumulates (`nextFire += cycle`), semi-auto edge + 70 ms buffer, bursts (twin 2, halo 3), AWP scope levels 1/2 + auto unscope + resume after bolt, shells reload interruptible, auto reload on empty, switch cancels reload, draw times, Q last weapon, G drop, E swap-pickup / auto-pickup into empty slot, drops on tag-out.

## Contract extras (ctx.combat)
`equipped(a)` -> weapon state `{id,def,mag,reserve,state,t,scoped,scopeLevel,burst,reloadProgress}` (utility/beacon get a pseudo object) · `inventory(a)` (`slots{1,2,3}`, `current` slot number, `previous`, `utility[]`, `utilSel`) · `give/buy/drop(a, slot|id)/remove(a,id)/reset(a,{keep,revive})/resetLoadout(a,{keepWeapons})/switchTo/reload/command(a,cmd)` · `applyTag(hit)` · `crosshairSpread(a)` 0..1 · `inaccuracy(a)` deg · `aimPunch(a)` -> `{pitch,yaw}` rad (camera offset) · `zoom(a)`, `scopeFov(a)`, `sensScale(a)` · `speedMult(a)` (x knife speed, includes weapon, scope, hit-slow) / `maxSpeed(a)` m/s.
* Bots: set `actor.ai.cmd = {fire,aim,reload,drop,use,last,inspect,slot,dir?}` (read every tick) or `combat.command(actor, cmd)`. Aim = `actor.yaw/pitch` (or `cmd.dir`). Semi-auto/burst re-fire every time `cmd.fire` is held and ready. Utility slot (4): fire = strong, aim = weak, both = medium; thrown on release via `utility.throw`.
* Events emitted: `weapon:fire {actor,tagger,origin,dir,hitscan,hit:[{point,normal,surface,actor?}]}` (vfx/audio consume it), `weapon:reload {stage:'start'|'in'|'commit'|'end'|'cancel'}`, `weapon:switch`, `weapon:scope {scoped,level}`, `weapon:empty`, `weapon:pickup|drop {pos}`, `impact {point,normal,surface}` (world hits only), `tag:hit`, `tag:out` (+`headshot`), `buy`, `credits`. Combat does not call `ctx.audio`/`ctx.vfx` for these (they bind the events); it only calls `vfx.impact` for penetration entry/exit.
* Combat updates `actor.stats` damage/tags/outs/crowns/assists; kill reward = `taggers[id].killReward` (match pays). Damage only in phases warmup/live/armed/roundEnd (or no match); firing blocked in freeze/halftime/matchEnd.

## Round 2 changes
Inaccuracy tables now CS2-real (AK stand 0.40 deg, run 10.4 deg; Pip/USP rangeMod 0.99), fire-accumulation noise cut so the AK pattern stays readable, Negev tightens when sustained (`tighten`), AK recovery 0.43 s. Speed fraction uses `ctx.player.runSpeed x weapon speed` (move applies `speedMult`). Semi-auto/burst held through draw fires once ready; `weapon:scope` also on AWP re-scope; viewmodel/utility updates try/caught (error reported once in ctx.errors); mouse wheel cycles weapons; damage refused outside warmup/live/armed (roundEnd, halftime, matchEnd -> no tag events); firing blocked when `match.frozen/paused`.

## Tuning
All in `taggers.js` (`inacc(...)` tables, `pattern`, `recover`, `penPower/penDmg`, `cycle/rpm`); `VIEW_TRACK`; materials in `ballistics.js`.

## Known gaps
CS2 spray curves are authored from memory (AK/M4 hand-keyed, others procedural), not data-mined. No body-penetration, no per-weapon first-shot-after-stop timing, mouse-wheel switching absent (input module consumes wheel), scope overlay left to HUD/viewmodel, knife has no alternating-swing variants. Moving-target and bot hits depend on `characters.hitTest` (Ray with custom `.far`; hitgroup string normalised); falls back to built-in capsule hitboxes for actors without `actor.model`.
