# Piece: vfx (owner: vfx) — src/vfx/**

GPU-pooled particles (analytic vertex-shader motion, one interleaved ring buffer, one draw for additive+alpha), instanced tracers, decals/rings, CPU-sim mesh shards, motes, beacon FX, screen fx. Spawns flush via `scene.onBeforeRender`.

## API (`ctx.vfx`)
`tracer(from,to,color,style|taggerId,{look,width,len,speed})` · `impact(point,normal,surface|'body')` · `decal(point,normal,o)` · `muzzleFlash(actor|viewmodel|'view', taggerId)` · `shards(point,color,style,{dir})` · `hitPing(point,{crown})` · `footstepDust/landPuff/slideSparks/jumpPad` · `pulse/strobe/haze(pos,o)` (self-contained; auto-listened only if combat.utility is a stub) · `beacon.{show,hide,setState,setProgress,burst}` (auto-polls `ctx.match.beacon`) · `screen(name,params)` → `ctx.render.screen.*` (DOM fallback) · `particles` (`emit(now,Spec)`, `spec()`), `longParticles`, `ambient.set({mode:'dust'|'embers',density})`, `setQuality`, `clear()`.
Events handled: weapon:fire (dedupes vs explicit combat calls), tag:hit, tag:out (skipped when `characters.handlesTagOut`), character:shatter (flash/rings/light/sparkles), footstep, land, jump, util:*, beacon:*, ping, round:phase, settings:change. `ctx.vfx.characterDriven = true`.

## Inspect
- `?test=1&seed=1&scene=vfx-lab` (add `&panel=0` to hide UI; `&fx=impact-metal`): buttons, slow-mo, "play all" timeline.
- `__game.ctx.vfx.debug.fire('impact-metal')`, `.list()`, `.cam('wide')`, `.stats()`.
- `node tools/vfx_sheet.mjs [names] --times 0.017,0.05,0.1,0.2,0.35,0.6` → `shots/vfx/sheet_<name>.png`.

## Known gaps
Soft-particle depth path implemented but needs `ctx.render.depthTexture` (call `particles.setSoftDepth`); heat shimmer is a faint warm haze (no refraction); tracer-cam framing in lab is wide; no per-tagger tuning pass vs CS2 yet.

## Round 2
Tracers rebuilt: >=5px quad (~2-3px hot core), HDR x3.2, saturated tagger colour with white core, longer streaks (len 5-20 m), foreshortened (incoming) tracers widen to a blob, min lifetime 0.11 s. Impacts: tagger-coloured streak spray, bigger flash/ring, dark bullet-hole decal (24 s, fades last 30%). Tag-hit: coloured light-mist + streaks (`bodySpark`). Shatter handler (`character:shatter(ed)`) is flash+light+sparkles only; floor rings capped 1.5 m. Shaders pre-warmed on boot:done. vfx.update CPU: idle 0.005 ms, stress max 2.5 ms (lab 'fight' x2 + shards).
Inspect: `node tools/vfx_sheet.mjs tracer-volley impact-tile --times 0.017,0.05,0.1`.
