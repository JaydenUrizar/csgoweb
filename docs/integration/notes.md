# Integration notes (integrator pass 1)

Play-tested the whole game through the real boot path (menu -> match -> halftime -> match end -> menu, Locker, Settings, Practice Range, pause) with `tools/playthrough.mjs`. Everything below was verified by running the game and LOOKING at frames; shots land in `shots/playthrough/`.

## How to run the playthrough
```
node tools/playthrough.mjs                # ~5 min: UI tour, practice range + pause + leave, 2 autopilot-played rounds with real buy-menu keys,
                                          # utility throws, plant/disarm scenarios, forced halftime, forced match end, recap, back to menu, 2nd match
node tools/playthrough.mjs --quick        # test=1&match=1&phase=live shortcut (~2.5 min, no menu/pause/recap)
node tools/playthrough.mjs --full         # whole match played by the autopilot (~7-10 min)
flags: --team ember|tide  --rounds N  --seed N  --size 960x540  --shots DIR  --noshots
```
Run it in the background (`nohup ... > log &`) - it takes longer than a tool timeout. Exit 1 + `HEALTH: FAIL` list on any issue. It checks: console errors, phases reached, events/audio families that must fire, HUD text vs state (hp/ammo/money/score), scoreboard totals vs `tag:out` events, draw calls/tris budget, pause/resume, menu navigation, second-match reset.
Software GL renders ~0.8 s/frame, so the tool steps the sim with `advance(s,{render:false})` and renders only for screenshots. Wall-clock (non-test) play in headless is ~10x slower than real time; never judge feel there.
Menu note: the tool sets `ctx.manualStepping=true` right after the menu appears (real boot path otherwise).

## Fixed in this pass (all minimal, local)
1. **Local body stuck in the camera after respawn** (`characters/index.js`): `spectate` event with `actor:null` set `viewActor=null`, so after being tagged out once, every later round showed the player's own model as a giant coloured card in front of the camera. Now null -> default (local if alive).
2. **Viewmodel kept the wrong side's colours** (`combat/viewmodel/index.js`): hands/skin were styled once; picking Tide or halftime swap left orange trim on Tide. Now restyles on `cosmetics:change`.
3. **Round/halftime banners used a stale team** (`ui/hud/index.js`, `prompts.js`): Tide saw "ATTACK - arm the Beacon" in round 1; halftime said "you are now attacking" to a player who just became a defender. HUD now refreshes `playerTeam` from `localActor` before forwarding sim events.
4. **Bots parked 2.4 m from a dropped Beacon forever** (`ai/bots/brain.js`): pickup orders went through crowd offset + 1.5 m arrival slack, beacon pickup range is 1.6 m -> round timed out with live Ember bots standing next to the Beacon. Pickup orders now go straight to the Beacon (r<=0.5).
5. **Practice Range leaked into later matches** (`combat/range.js`, `match/flow.js`): range hid the map and swapped its collider, and its debug telemetry panel covered the HUD; neither was torn down on Play/Leave. Range now disposes on `match:start` and new `match:quit` (emitted by `quit()`), and the telemetry panel only shows with `?test` or `?overlay=1`.
6. **No prompt for weapon swap** (`ui/hud/prompts.js`): combat swaps a dropped tagger on E but nothing told the player. Added "Swap for X" prompt.

## Remaining, ranked (go back to piece builders)
1. **bots/nav - pacing & objective pressure.** Ember rounds that run to time with 5v5 alive still occur (bots take 60-100 s detours, carrier waits at spawn, Tide bots never rotate or peek). Use `node tools/bot_test.mjs --seeds 1,2,3,4,5 --rounds 10`: look at plant rate, rounds ending on `time` with >=4 alive, time-to-first-contact. Needs a "commit to execute by T+55 s" rule and a Tide rotate-on-callout rule.
2. **menu/hud - small viewports.** At 960x540 the Settings Controls tab overlaps (Mouse DPI row over the CS2-sens/eDPI readouts) and the menu tip bar overlaps the match-setup footer; at 480x270 the main menu buttons are outside the viewport; at 1:1 windows the top bar overlaps the radar. 1280x720+ is clean.
3. **flow/hud/menu - Practice Range is not a first-class mode.** HUD shows `WARMUP 0:00 / ROUND 0/15`, one team pip, and the pause screen says "Round 1 - Ember 0 : 0 Tide". Needs `match.mode==='practice'` and HUD/pause variants (hide round UI, show tagger-switch hint). Also tutorial card pops in practice.
4. **hud/characters/render - colourblind mode is HUD only.** `settings.colorblind` recolours HUD team colours (orange->yellow, teal->blue) but the world (suits' team emissive, Beacon, spawn walls, radar dots on the map) keeps orange/teal, so the two disagree. Needs a shared `ctx.render.teamColors` consumed by characters/beaconView/vfx.
5. **hud - spectator information.** When dead the vitals/ammo/money/slot list all show the spectated bot (fine) but the credit-delta log and utility slot icons still show a mix of own/spectated entries, and an all-dead team can spectate enemies. Define one `view` actor for every vitals widget and restrict to teammates (CS2).
6. **render/perf - GPU unverified.** Only software GL available here: main pass 68-142 draw calls and 80-215k tris (within budget) but total frame cost with bloom/shadows/post is unmeasured on a real GPU. Dynamic resolution exists (not active in ?test). Someone with a GPU should profile `ctx.render.info()` + `performance.now()` per frame in a live 5v5 and confirm 60 fps on integrated graphics.
7. **audio - announcer duplicates are suppressed by wall-clock (2.5 s) only.** Flow emits `announce` ids that audio also plays from its own handlers (`round:end`, beacon state). Works in real time; under fast-forward/`advance()` both play. Prefer one source of truth (flow's `announce` events) and delete audio's duplicates.
8. **menu - first-run tutorial card** stays docked over the left-middle HUD for the whole first match (covers radar callout at <=960 px). Auto-collapse after step 1 completes or when the player is in a fight.
9. **hud - spectate round-end:** when the whole team is dead the spectate target is an enemy (see 5) and the banner is gated by 1.4 s; consider holding a kill-cam style replay target on the killer instead.

## Seam checks that passed (no action)
Event bus: no console errors across 3 full playthroughs (real boot, test boot, production build `vite build` smoke). Tag feed / scoreboard / economy totals agree (`tag:out` count == scoreboard tags == stats). Money/ammo/hp/score HUD text equals sim state after tweening. Pause freezes engine+match clock and resumes cleanly; Esc closes buy menu without opening pause; Tab scoreboard; freeze/buy pins movement but allows look; jump/crouch/slide; halftime swaps team + spawn + viewmodel + banner; round-end banner/MVP; match recap -> Main menu -> second match starts at round 1, 0-0, $800; resize 640x360..1920x1080 re-lays out HUD and cameras; no per-round growth in geometries/textures/objects over 9 rounds (heap steady ~110-140 MB).
