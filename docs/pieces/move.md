# Piece `move` — movement & camera feel (round 1)

**Files:** `src/player/{index,simulate,geom,course}.js`, `tools/move_test.mjs`, `tools/move_plot.py`.

## API
* `ctx.player.simulate(actor, cmd, dt)` — pure fixed-step movement, same code for human + bots. `cmd = {forward,right (-1..1), jump, crouch, walk, yaw, pitch}` (jump/crouch held booleans; edges detected inside). State lives in `actor.move`.
* `actor.move` outputs for combat/bots: `speed` (horizontal m/s), `speed3`, `accurate` (grounded, not sliding, speed ≤ crouch-walk speed), `inaccuracy` 0..1 (continuous), `onGround`, `sliding`, `crouching`, `airTime`, `landRecover`, `speedScale` (WRITE this to slow for heavy taggers/scope), `gait`.
* `ctx.player`: `actor`, `frozen` (get/set; auto-true in match phase `freeze` unless set), `respawn({pos,yaw})`, `spectate(actor|null)` (null = free cam), `nextSpectate(±1)`, `mode` (`play|death|spectate|free`), `punch(pitch,yaw,roll,kind='recoil'|'flinch')` (radians; +pitch = up, +yaw = left), `aimPunch {x,y,z}` (recoil spring, add to shot direction), `setZoom(mult)`, `sensScale`, `view` (speed/onGround/crouch/walking/sliding/aimPunch/lookDelta/roll for the viewmodel).
* Events: `jump {actor,speed}`, `land {actor,speed,surface}`, `footstep {actor,pos,surface,speed,crouch,walk,foot}`, `slide {actor,speed}`, `mantle {actor,height}`, `spectate {actor}`.
* Settings used: `sensitivity` (CS numbers, 0.022°/count), `invertY`, `fov` (HORIZONTAL degrees), `autoBhop`, optional `headBob`, `crouchToggle`.

## Inspect
* Course: `http://localhost:5173/?test=1&seed=1&scene=movement-course&station=stairs18` (stations: start lane flat stairs18/30/44/50/Fine ramp8…60 crest slideSlope ledge0.3…2.0 jumpchain pillars squeeze0.8 slalom corridor0.75 zigzag diag45 hairpin tunnel1.5 door0.9 thinwall vcrease block gaps …). `__game.ctx.player.debug.goto('ledge1.3')`, `.exitCourse()` restores the map collider.
* `__game.hold({forward:true})`, `__game.advance(1)`, `__game.ctx.player.debug.telemetry()` / `.history()` / `.tune({runSpeed:7})`.
* Numbers: `node tools/move_test.mjs [--only accel,stop,bhop,slide,jump,stairs,ramps,ledges,tight,walls,fuzz]` then `python3 tools/move_plot.py` → `shots/move/charts.png`.

## Round 2 changes
Speed/footsteps now come from post-collision displacement (wedged in a V = 0 m/s, no steps); 2-plane crease clip; stair-lip snag fixed (no more speed loss at stairs44); bhop takeoff no longer loses speed (smooth soft cap 7.8→11 m/s, hard 12.2); run 7.2 m/s; slide ×1.38 boost to ≤10 m/s, ~1.2 s / 9 m, 3.4° roll, deeper eye drop; speed FOV kick removed (`fovKick` setting, default 0; world FOV fixed); crouch-jump +0.17 m; mantle up to 1.5 m; livelier bob (2.3 cm, 0.7° roll) + footstep bounce; consumes `ctx.combat.aimPunch/scopeFov/sensScale/speedMult` and `ctx.match.frozen`.

## Measured (round 1 numbers; run is now 7.2)
run 6.6 m/s (CS2 4.76; ×1.39), 90% speed in 0.15 s, walk 0.52×, crouch 0.34×, counter-strafe to accurate speed 0.05 s / full stop 0.08 s (hold 120 ms), release stop 0.42 s, jump 1.05 m / 0.60 s hang, run-jump 3.9 m, perfect bhop plateaus ≈ 8.9 takeoff / 10 peak (soft cap), slide boost ×1.2 to ≤ 8.8 m/s, ~0.9 s / 4.5 m, step 0.45 m, ramps ≤ 45°, mantle ≤ 0.6 m lip (≤ 1.45 m above last ground), tunnelling 0/102, determinism identical, ~5 µs/tick.

## Known gaps
No real-map hard-case pass yet beyond random fuzz; no surf-specific tuning; head-bob/landing/roll amplitudes judged only numerically + stills (need critic eyes on video); no player-vs-player standing-on-head; slide has no sound event beyond `slide`.
