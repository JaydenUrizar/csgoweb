# hud — in-game HUD (`src/ui/hud/`)
Files: `index.js` (module, scale/palette, scenes, API) · `fx.js` (crosshair/hit markers/damage arcs/scope, device-pixel canvas) · `radar.js` · `topbar.js` · `vitals.js` (charge/armor/credits/ammo/slots) · `feed.js` · `prompts.js` (prompts, ring, banners, notices, toasts, flash-blind) · `buymenu.js` · `scoreboard.js` · `spectator.js` · `icons.js` (SVG sprite, 18 taggers/gear + glyphs) · `mock.js` · `fonts/` (Barlow Condensed woff2, bundled, offline).
Layout is authored at 720p and scaled by `innerHeight/720 * settings.hudScale`; colourblind via `settings.colorblind` (deut|prot|trit|off). All animation is JS-timed on sim `dt` (deterministic under `advance()`); DOM written only on change; ~0.35 ms/frame.
## Inspect
* `?test=1&scene=hud-gallery[&hudstate=<s>][&bg=sun|dusk|dark|bright|3d][&anim=1]` — every element on a backdrop. States: `ctx.hud.debug.states()` (live lowhp buy scoreboard spectator scope halo armed arming disarming banner-* blind reload lowammo hit crown tagout dmg cb-* ...). `ctx.hud.debug.state(name)` then `.step(seconds)`.
* `?scene=hud-icons`, `?scene=hud-crosshairs`; `?hudmock=1` overlays mock data in any scene; `ctx.hud.debug.mock(true|false)`.
* `node tools/hud_sheet.mjs [--size 1920x1080] [--states a,b]` -> `shots/hud/sheet/<size>/*.png` + tiled `shots/hud/sheet_<size>_N.png` (slow, run in background).
* Real game: `?test=1&match=1` (B opens buy menu, hold Tab scoreboard). Keys: buy menu digits = column then item, F4 re-buy, F3 auto-buy, Esc/B close.
## Contracts used
`match.{phase,round,scores,timeLeft,buyTimeLeft,beacon,teams,catalog,canBuy,buy,mvp,history,scoreboard(),spectating,cycleSpectate}`, `combat.{equipped,inventory,crosshairSpread,utility.count}`, `map.{radar(canvasFor,bounds),sites,calloutAt|callouts,raycast}`, events tag:hit/out, credits, buy, util:blind, beacon:*, round:*, halftime, match:end. Radar falls back to a baked collider height-map if `map.radar` is missing.
## Known gaps
Scope overlay also drawn by HUD (skipped if `combat.viewmodel.drawsScopeOverlay`); radar spotted-enemy = LOS from allies (no ai perception hook); damage arc style plain; no kit state read for disarm hint; buy menu is not mouse-unlocked in-game (hotkeys only, clicks work when cursor free); pip emblems are hash-generated; weapon silhouettes first-pass.

## Round 2
Radar now restyles `map.radar` (labels erased, dark silhouette + wall edges, 30 m range, big A/B badges clamped inside the ring, outlined dots + view cone); team-coloured pip tiles; topbar + buy menu share `match.buyTimeLeft` and the same tweened money; menus are near-opaque and fade banners/notices/toasts/prompts; compact 1.4 s round banner; thicker damage arcs with arrowhead; bigger hit markers; redrawn weapon icons.
