# Architecture & module contracts

Stack: **Three.js r186 + Vite**, plain ES modules, no framework. Physics/sim: fixed 120 Hz. Collision & raycasts: **three-mesh-bvh**.
Dev server: `npm run dev` (already running on :5173 during builds). Test URL: `http://localhost:5173/?test=1&seed=1` (deterministic manual stepping, fake pointer-lock).

## Boot & context
`src/main.js` builds a **ctx** object and instantiates modules in the order listed in `src/modules.js`. Each module file exports `create(ctx)` → API object, stored as `ctx.<key>`. Optional hooks on the API: `fixedUpdate(dt)` (120 Hz), `update(dt, alpha)` (per rendered frame), `dispose()`. A module that throws is replaced by a stub so the game still boots. Modules only talk via `ctx.*` APIs and the **event bus** (`ctx.events.on/emit`). Never import another module's internals.

Core (owned by `core` lead, do not modify without a `docs/requests/core-*.md` note): `src/core/{events,input,engine,actor,config,settings,rng,stub}.js`, `src/main.js`, `src/modules.js`.

### Shared entities
`createActor()` (`src/core/actor.js`) = every participant. Fields: `pos` (feet), `vel`, `yaw`, `pitch`, `hp`, `armor`, `alive`, `team` (`'ember'|'tide'`), `inventory`, `credits`, `stats`, `cosmetics`, `hasBeacon`, and module-owned scratch `move`, `ai`, `model`. Helpers `eyePos()`, `forward()`. `ctx.actors` = array of all actors, `ctx.localActor` = human.
Coordinate system: metres, Y up, yaw 0 faces −Z. Player: 1.8 m tall, 0.36 m radius, eye 1.62 m (crouch 1.25 m / eye 1.12).

### ctx keys & who owns them
| key | folder | owner piece | must expose |
|---|---|---|---|
| `render` | `src/render/` | render | `renderer, scene, camera, viewScene, viewCamera, render(), resize(), setQuality(q), materials` (shared material factory: `mat.toon/flat/emissive/glass`), `shake(amount)`, `addPost*`, `setBlur/flash/tint` screen effect hooks used by vfx/combat, `sunDir`, `info()` |
| `map` | `src/world/` | map | `group, collider (BVH mesh), raycast(origin,dir,far), spawns{ember[],tide[]}, sites{A,B:{center,radius,…}}, callouts[], bounds, surfaceAt(point)->'stone'|'metal'|'wood'|'glass'|'sand'…, thinWalls (penetrable), triggers` |
| `nav` | `src/ai/nav.js` | nav | `path(from,to)->Vector3[]`, `nearestNode`, `coverPoints`, `visible(a,b)`, `randomPointNear`, danger heat helpers |
| `characters` | `src/characters/` | avatars | `spawn(actor)` builds & attaches model, `update` animates from actor state (run/strafe/crouch/aim/fire/reload/throw/plant/tagged-out), `hitTest(ray, ignoreActor)->{actor,hitgroup,point,distance}`, `tagOut(actor,dir)` shatter effect, `setVisible`, `muzzleWorldPos(actor)` |
| `cosmetics` | `src/cosmetics/` | cosmetics | `catalog` (suits, helmets, visors, patterns, trails, tagger skins, emotes, charms, tag-out effects, name plates), `getLoadout(actor)`, `setLoadout`, `apply(actor)`, `randomLoadout(rng)`, persistent storage, preview renderer `renderPreview(canvas, loadout)` |
| `vfx` | `src/vfx/` | vfx | `tracer(from,to,color,style)`, `impact(point,normal,surface)`, `muzzleFlash(actor|viewmodel,tagger)`, `shards(point,color)` tag-out, `haze/strobe/pulse` effect instances, `decal`, `screen(name,params)`, particle pool with GPU-friendly instancing |
| `audio` | `src/audio/` | audio | `play(name, {pos,gain,pitch,actor})`, `music.set(state)`, `announce(id)`, `setListener(camera)`, `unlock()`, surfaces & footsteps, mixer buses, occlusion, ducking, `sounds` catalogue |
| `combat` | `src/combat/` | tagger + utility | `taggers` defs, per-actor inventory logic (`give, buy, switch, drop, reload`), fire loop with recoil/spread/inaccuracy model, hitscan+penetration, damage & falloff, `applyTag()`, viewmodel rig (first-person hands+tagger+animations: draw/idle/walk-bob/fire/reload/inspect/scope), scope overlay, grenades (Haze/Strobe/Pulse) with arc preview & physics, `equipped(actor)` |
| `player` | `src/player/` | move | human controller (movement, collision, crouch/slide/jump/bhop/ledge, camera bob/tilt/fov/landing dip, mouse look, footstep events), `actor` |
| `ai` | `src/ai/bots.js` | bots | `createBot(team,name,difficulty)`, brains driving `actor.move`-compatible input each tick (movement using the *same* movement function the player uses via `ctx.player.simulate(actor, cmd, dt)` — never fake it), perception, aim/reaction model, tactics (rush/hold/lurk/rotate/execute), utility use, callouts, planting/defusing |
| `match` | `src/match/` | flow | state machine (`warmup|buy|freeze|live|armed|roundEnd|halftime|matchEnd`), economy, spawn placement, beacon logic, score, MVP, `ctx.match.state`, events, scoreboard data model, buy-menu data & purchase API, bots spawn/fill |
| `hud` | `src/ui/hud/` | hud | DOM/CSS + canvas HUD reading `ctx.match`, `ctx.combat`, actors; crosshair, radar, tag feed, damage indicators, hit markers, spectator UI, scoreboard overlay, buy menu UI, round banners, beacon prompts |
| `menu` | `src/ui/menu/` | menu | main menu (with live 3D backdrop), mode select (Match, Practice Range, Locker), settings (controls, video, audio, crosshair designer, viewmodel), pause, loading/boot screen, tutorial/onboarding, end-of-match |

### Event catalogue (extend in `docs/EVENTS.md` when adding)
`boot:done`, `settings:change {key,value}`, `input:lock|unlock`,
`round:phase {phase, prev}`, `round:start {n}`, `round:end {winner, reason, n}`, `match:end {winner}`, `halftime`,
`weapon:fire {actor,tagger,origin,dir,hitscan}`, `weapon:reload {actor,tagger,stage}`, `weapon:switch {actor,tagger}`, `weapon:empty`,
`tag:hit {attacker,victim,damage,hitgroup,point,dir,tagger,armorAbsorbed}`, `tag:out {attacker,victim,tagger,hitgroup,assist,wallbang,through}`,
`footstep {actor,pos,surface,speed,crouch|walk}`, `land {actor,speed}`, `jump {actor}`,
`util:throw {actor,type}`, `util:detonate {type,pos,thrower}`, `util:blind {actor,amount}`,
`beacon:pickup|drop|arm|armed|disarm|complete {actor,site}`, `buy {actor,item,cost}`, `credits {actor,delta,reason}`,
`ui:click|hover|open|close`, `announce {id}`, `ping {actor,pos}`, `spectate {actor}`.

## Test/debug API (`window.__game`)
`advance(seconds)` deterministic sim then render, `place(x,y,z,yaw,pitch)`, `hold({forward:true,fire:true…})`, `look(dx,dy)`, `errors()`, `fps()`, `ctx` for anything else (e.g. `ctx.match.debug.forcePhase('live')`, `ctx.match.debug.startMatch({bots:true})`). Modules should add a `debug` object to their API with hooks that make their piece *inspectable* (e.g. `ctx.combat.debug.give(actor,'arc')`, `ctx.hud.debug.showAll()`, `ctx.characters.debug.pose('run')`). Scenario URL params: `?test=1` manual stepping, `?seed=N`, `?scene=<name>` optional gallery scenes each module may register via `ctx.debugScenes[name]=fn` (e.g. `?scene=tagger-arc` shows just that tagger's viewmodel; `?scene=character-gallery`; `?scene=map-overview`). Builders **must** make their piece easy to judge in isolation this way.

## Quality bar (non-negotiable)
* 60 fps target on mid-range integrated GPU (draw calls < 350, tris < 400k, no per-frame allocations in hot loops, instanced/merged static geometry, pooled particles). Headless software-GL runs slow — use `advance()` not wall clock.
* No console errors/warnings. `npm run smoke` must pass after every edit.
* Every piece is judged against **real CS2 frames** in `reference/cs2/` (screenshots `ss_*.jpg`, trailer frames `frames/t*_*.jpg` — regenerate with `tools/fetch_refs.sh` if missing).
