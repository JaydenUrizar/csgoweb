# Piece: cosmetics (src/cosmetics/**)
CS2-inventory-style Locker + cosmetics data. 154 items / 11 categories / 8 themed sets / 4 rarities (common #b0c3d9, rare blue, epic magenta, legendary gold).
## API (ctx.cosmetics)
`catalog` (suits, helmets, visors, patterns, backs, trails, tagOuts, skins, charms, nameplates, emotes, sets, all, byId) · `resolve(loadout)` -> CosmeticSpec (memoised; extra non-enumerable `_meta`; skin `wear` = 0..1 float; suit.base is team-guarded so enemy-hue bodies are muted) · `getLoadout(actor)` (player: saved slot for the actor's team; bots: auto random, de-duplicated suits) · `setLoadout(actor|team, l)` · `apply(actor)` (calls `ctx.characters.refreshCosmetics`, emits `cosmetics:change`) · `randomLoadout(rng, team)` (rng fn | {next()} | core rng) · `encode/decode` share codes (`FLUX-E0B0-…`) · `openLocker({side,cat})/closeLocker()/toggleLocker()` · `renderPreview(canvas, loadout, {focus,live,dpr})` -> handle {update,resize,dispose,stage} · `specFor(actor)`. Stars progression (round/tag/match events) is optional; everything is unlocked.
Storage: localStorage `fluxtag.cosmetics.v1` (4 loadout slots x both sides, stars). Preview uses its own renderer + stand-in rig built from the spec (characters has no createPreview; if it adds `createPreview()` returning {root,setSpec,update} it is used instead).
## Inspect
* `?test=1&seed=1&scene=locker[&lockertab=skin&side=tide]` full Locker. `scene=locker-preview[&random=1&seed=3&side=tide]` bare 3D preview.
* `__game.ctx.cosmetics.debug.locker`: setCat, hover(id), equip(id), setSide, randomize, setLoadout(l), view('head|back|tagger|wide'), settle(s), stage.playTagOut(effect,color), stage.playEmote(id).
* `node tools/locker_sheet.mjs --out shots/cosmetics/sheet --randoms 6` screenshots every tab on both sides, tag-out/emote/hover states and random loadouts.
Keys: Q/E tab, R random, T side, 1-4 slot, A/D rotate, Ctrl+S save, Esc close; drag/wheel on preview.
## Known gaps
Stand-in preview is not the in-game body (visual parity depends on characters); card icons are 2D illustrations; trail/charm not rendered in-game by characters yet (attach points only); no audio hooks beyond ui:* events.

## Round 2
* Locker preview now uses the REAL in-game athlete (`src/cosmetics/preview/real.js`): a private preview actor is spawned via `ctx.characters.spawn`, its model re-parented into the locker's own scene (characters.group is moved there while open and restored on close), animated by `characters.update`, tag-out uses `characters.tagOut(actor,dir,{style})`, emotes are layered as post-animation bone offsets (`bone_emotes.js`). Falls back to the stand-in rig only if characters is a stub. Skins tab shows a big inspect tagger built from the skin (combat's world model ignores skins).
* `resolve(loadout)` is team-aware: suit base is mapped into the team hue band (lightness/saturation keep each suit's tone), accent/helmet/back clamped like the in-game material, so spec == what is drawn. Suit/helmet/back cards are tinted to the active side.
* Charms and trails now render in game (`ingame.js`): charm hangs from attach point `hip`; trails are pooled particles at `trailEmitter` (2 draws total).
* Layout rebuilt for density (grid 2+ rows at 720p, 3 at 1080p), short tab names, compact footer, share code lossless (wear 0..1000).

## Round 3
Neutral studio lighting (Neutral tone mapping, low exposure/bloom, dim rims) so Tide no longer blows out; per-slot cameras (charm side close-up, nameplate sprite above head, skin inspect gun, compact toolbar at 720p); suit pattern colours auto-contrast against the team-banded body; visor glow pre-compensated for characters' 50% team lerp (still washes opposite-hue visors: see docs/requests/avatars-from-cosmetics-2.md); suits renamed team-neutral; tagger skins now have per-skin tagger kind (pistol/smg/rifle/sniper), decal (flames, waves, scales, grid, ...) and finish (matte/gloss/metal/holo/carbon) in icons and inspect; bots pick the least-similar of 16 candidate loadouts (headgear, visor, back, pattern, finish, charm); trails bigger/denser and anchored to the actor's feet height; fixed side-toggle highlight, wear label gap.
