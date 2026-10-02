# flow — match flow & economy (`src/match/`)
Files: `index.js` (module + debug API + scenes), `flow.js` (state machine, teams, spawns, economy, MVP, halves/OT, spectate), `beacon.js`, `buy.js`, `economy.js`, `catalog.js`, `beaconView.js` (world prop), `lab.js`, `sim.js` (sandbox, scripted director, invariant checker). Test: `node tools/match_test.mjs [--seeds 12]` (115 checks + CS2 conformance table, no browser).

## Inspect
* `?test=1&scene=match-lab` (add `&autoplay=0`, `&speed=2`, `&team=tide`, `&phase=live`): dummy actors + scripted director playing real rounds; overlay shows state machine, timers, score, loss levels, beacon, per-player credits/loadout, last round econ, history. Top-down camera (key O toggles), Y/U skip round to Ember/Tide, P autoplay, ,/. time scale. `window.__game.advance(60)` steps it.
* `?test=1&match=1[&team=tide&difficulty=elite&dummies=1]` starts a real match with whatever bots/combat exist. Without `test`/menu the match auto-starts when menu is a stub.
* Console: `ctx.match.debug.forcePhase('buy|freeze|live|armed|roundEnd|halftime|matchEnd|warmup')`, `.skipRound('ember'|'tide')`, `.next()` (skip banner), `.setCredits(actor,n)`, `.autoplay(true,{scenario:'plant_disarm',speed:2})`, `.simulate(30,{seed})` (headless sandbox, returns violations/scores), `.snapshot()`, `.text()`.

## Decisions (see test table)
* Team = side colour. Ember always attacks (carries Beacon, spawns `map.spawns.ember`). Halftime swaps `actor.team` for all 10, swaps `scores`/`lossStreak`; `playerTeam` updates; `team:change` fired. `sideOf` is therefore constant; `history[].winnerSquad` ('A'/'B') is stable identity.
* Regulation 14 rounds, halftime after 7, first to 8 wins. 7-7 -> OT (card `halftime{kind:'ot'}`, no swap); OT = MR3: first to base+4, swap every 3 OT rounds (`otHalf`), 3-3 starts next OT (target +4 again). Economy+loadouts reset at start (800), halftime (800), OT start/half (5000).
* Phases: buy 12 s -> freeze 6 s -> live 105 s -> armed (35 s fuse replaces timer) -> roundEnd 6 s -> (halftime 8 s) -> buy. `frozen` true in buy+freeze (actors pinned to spawn as fallback). Buying: warmup, buy, freeze, and 10 s into live inside the buy zone (spawn radius 16 m or `map.inBuyZone`). `buyTimeLeft` for the HUD.
* Economy: win 3250; loss 1400+500*level (level 0..4, +1 per loss, -1 per win — CS2 decrement rule; `ECON.winStreakRule='reset'` to switch); plant +300 each Ember on armed; disarm +300 disarmer; tag reward from `combat.taggers[id].killReward` else class table (smg 600, rifle/pistol/LMG 300, sniper 100, shotgun 900, tap 1500); teammate tag -300; cap 9000. Survivors keep weapons/armor/utility; tagged-out keep credits only + Tap/Pip.
* Beacon: random Ember carrier; arm = hold E 3.2 s inside site, grounded, speed<=1.5 (release/move/leave cancels and resets); fuse 35 s; disarm 5 s (2.5 s with Kit) within 2 m, one disarmer, resets on release. Carrier tagged out -> drops, any living Ember walks over to pick up. Arming in progress at time expiry may finish; otherwise Tide wins `time`. Ember wiped after arming: round continues. Tide wiped after arming: Ember wins at once. Simultaneous wipe: Tide (Ember wins only if already armed, via fuse).
* MVP: tags*10 + assists*3 + dmg/100 + objective; decisive plant/disarm +100. Spectate: `ctx.player.spectate(nextAliveTeammate)` + `spectate` event; `match.cycleSpectate(dir)`.

## Events emitted
`round:phase`, `round:start {n,pistol,ot}`, `round:reset {n}`, `round:end {winner,reason,n,mvp,econ,scores,next,ot}` (reason elimination|time|disarmed|beacon), `halftime {kind:'half'|'ot'|'otHalf',swapped,scores}`, `match:start`, `match:end {winner,winnerSquad,scores,mvp,playerWon}`, `match:pause|resume`, `team:change`, `actor:respawn`, `credits {actor,delta,want,reason,total}` (reasons win|loss|tag|teamtag|plant|disarm|buy:id|refund:id), `buy {actor,item,cost,refund,replaced}`, `buy:refund`, `buy:drop`, `spectate`, `announce {id}` (round_start, round_pistol, freeze, round_live, time_30, time_10, beacon_armed, beacon_10, beacon_5, beacon_disarmed, round_win_ember|tide, halftime, overtime, match_won|lost), `beacon:pickup|drop|arm (start)|armCancel|armed (done)|disarm (start)|disarmCancel|disarmed (done)|complete (explosion)|beep {interval,fuseLeft}`.

## API additions
`ctx.match`: `frozen, buyTimeLeft, interact(actor,held), refund/undo/rebuy/quickBuy/dropItem, owned(actor), scoreboard(), pause()/resume(), quit(), cycleSpectate(), killReward(id), matchMvp, lastRound, otIndex/otTarget, beaconApi.*`.

## Tuning / known gaps
Constants in `flow.js TUNE` and `economy.js ECON`. Gaps: no 3D announcer/UI (hud/audio own them); world beacon prop is a simple procedural device; dropped-weapon world items rely on combat; combat/player/ai/avatars hooks are untested against real pieces (requests written in docs/requests/*-from-flow-1.md).

## Round 2 changes
* Exit frags (tags during roundEnd) now pay the reward, count stats, set victim `survived=false`; ledger re-syncs from `actor.inventory` (slots 1/2, utility) each round reset.
* 0:00 ends the round even mid-arm (Tide `time` win; arm cancelled). Halftime clears the Beacon carrier and resets credits/streaks on the halftime card immediately.
* Economy: each half starts at loss level 1 (pistol loser +1900); surviving Ember on a time-out get no loss bonus; lost-after-plant gives each Ember +800 (`credits` reason `plantloss`). Buy grace in live is 20 s.
* New announce ids: `match_point {teams}`, `last_round_of_half`, `last_round`, `clutch {team,actor,vs}`, `beacon_dropped`/`beacon_picked_up` (`teams:['ember']`); `round:start` carries `matchPoint, lastRoundOfHalf, lastRound`. First `beacon:beep` fires at the moment of arming.
* Test mode: spawn pin is off in `?test=1` (`?freeze=1` or `debug.pin(true)` restores); `?match=1&phase=live` starts live and sticks.

## Round 3 changes
* `match:end` payload is complete and documented (also `ctx.match.matchResult`): `{winner, winnerSquad, scores, playerTeam, playerWon, mvp, teams:{ember[],tide[]} (actors with actor.stats.{tags,outs,assists,damage,score} mirrored from flow), history:[{n,winner,reason,scores,mvp,credits,plant,time,ot,econ}], econLog:[{n,ember,tide}], scoreboard, rounds, ot, otIndex, winTarget}`. Verified with the real menu: end screen builds, no errors. Menu must call `ctx.match.quit()` / `startMatch()` to leave matchEnd.
* OT state for HUD: getters `winTarget, roundTotal, half, halfLabel, roundLabel, otRoundOf`, `scoringOpen`.
* Beacon drops to the floor with an unbounded ray (fallback: carrier's last grounded spot); pickup |dy|<=2.2.
* Clutch voice only for the local player on 1v2/1v3; `spectate` event once per switch.
* Balance (src/match/timing.js, 6 seeds x 8 real bot rounds): live 105->100 s, fuse 35->40 s. Ember wins 65% -> ~42-50%, time-outs 0 -> ~5%. Requests for bots in docs/requests/bots-from-flow-2.md.
