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
