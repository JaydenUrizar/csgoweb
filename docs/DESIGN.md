# FLUX TAG — design bible

**Pitch.** A fast, competitive 5v5 tactical arena shooter-that-isn't: a *tag sport*. Two teams of five, round-based, with the readability, economy, utility play and gunfeel of Counter-Strike 2 — but nobody gets hurt. You wield **taggers** that fire pulses of light; a hit drains a target's **Charge**; at 0 they are **TAGGED OUT** — they freeze into a glass-like crystal and shatter into confetti light shards and sit out until next round. No blood, no gore, no death animations. Bright, crisp, stylised low-poly art with premium lighting, bloom and colour grading.

**Feel targets (the bar is CS2 itself):** crisp 128-tick-feeling responsiveness, deterministic recoil patterns and counter-strafe accuracy, pin-sharp audio cues (footsteps you can locate, distinct weapon report per tagger), loud & clear feedback on every hit, killfeed/scoreboard/economy literacy, and a cohesive art style you can read at a glance (team colours, silhouettes, callable map locations). Movement is *faster and more fluid* than CS: air-strafing, bunny-hopping with soft speed cap, slide-crouch, ledge assist, tiny coyote time.

## Teams & mode
* **EMBER** (orange, attackers) and **TIDE** (teal/cyan, defenders). Halves swap sides. First to **8 rounds** wins (best of 15). Overtime: MR3 sudden.
* Player plays on a team with 4 bot teammates vs 5 bots. Difficulty selectable (Rookie / Pro / Elite).
* **Objective — the Beacon.** Ember carries one Beacon; hold **E** at site A or B for 3.2 s to *arm* it. Once armed, it charges for 35 s. Tide can *disarm* (5 s, faster with a kit) — or tag out every Ember. Ember wins by (a) tagging everyone out, or (b) beacon completing its charge. Tide wins by (a) tagging out everyone, (b) disarming, or (c) time expiring with no beacon armed. Beacon arming/disarming gets progress ring, beeping cadence that accelerates, loud announcer lines.
* Round flow: freeze/buy phase (12 s buy + 6 s freeze) → live (105 s) → armed timer → round end (6 s: MVP, winner banner, economy summary) → next. Halftime after 7 rounds, match end screen with MVP and scoreboard.
* **Economy** (credits, starts 800, cap 9000): win 3250, loss 1400 +500/loss streak (max 3400), tag reward by tagger class, beacon plant +300 team, disarm +300. Persist between rounds for survivors; tagged-out players keep nothing except default sidearm.
* **Taggers** (slots): 1 primary, 2 sidearm, 3 grip (bat-shaped *Tap* stick, melee tag), 4 utility (up to 3: Haze, Strobe, Pulse), 5 Beacon/Kit. Buy menu (B) with categories exactly like CS2's radial+grid legibility.
  * Sidearms: **Pip** (default pistol), **Twin** (fast burst pistol), **Judge** (heavy revolver-style).
  * SMG: **Zip** (high rate, low dmg), **Hum** (mid).
  * Rifles: **Arc** (Ember rifle, AK-like: high damage, harsh recoil), **Rail** (Tide rifle, M4-like: accurate, softer), **Halo** (scoped burst, accurate).
  * Sniper: **Lance** (one-tag bolt-action, scope, strong movement penalty).
  * Shotgun-ish: **Scatter** (pellets, close range).
  * Heavy: **Storm** (LMG, big magazine).
  * Utility: **Haze** (smoke — volumetric-looking sphere that blocks vision), **Strobe** (flash — blinding white burst + ear ring), **Pulse** (area pulse dealing partial Charge drain in radius, non-lethal knockback shimmer). **Kit** (fast disarm), **Vest** (armor+helmet), 
* Damage model: hit groups (crown/head ×4, chest ×1, stomach ×1.25, limbs ×0.75), armor absorbs 50%, wallbang penetration through thin props ("cover glass"), falloff.
* Player **health = Charge (100)**. Bots do the same.

## Art direction
* Stylised **low-poly, flat-shaded with baked-looking gradients**, tone-mapped HDR, bloom on emissives, soft dynamic shadows, coloured bounce, atmospheric fog and light shafts. Reference: CS2 material readability (Inferno/Dust2 warm sun light, Overpass wet cool), crossed with Overwatch-clean silhouettes / Splatoon-ish saturation.
* Map: **"Crux Station"** — sun-drenched arena complex: two bomb-site-like Beacon nodes (A upper courtyard, B lower plaza), long central mid with a suspended catwalk, ramps, doors, tunnels, jump-up boxes, stairs. Callout names on floor signage. Two-tone team colours on spawn walls. Day lighting with warm key + cool fill.
* Characters: chunky, readable low-poly athletes with team-coloured suits, glowing visor, hard helmet, tag-vest; layered cosmetics.
* HUD: CS2 layout language (bottom-left health/armor, bottom-right ammo/weapon, top-center score + timer + team alive pips, top-left radar, right-side tag feed, left-bottom money delta), crisp typography (condensed sans), subtle gradients.
* Audio: fully procedural (WebAudio synthesis). Every tagger has its own distinct multi-layer report (transient, body, tail, mechanism), spatialised with distance filtering, occlusion, footstep surface variance, UI clicks, announcer VOs via speech-synth-styled robotic tones or tone stings, adaptive music (menu, round, armed-tension, win/lose stings).
