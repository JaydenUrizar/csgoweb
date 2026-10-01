// Cosmetics catalog: data only. Every item is { id, cat, name, rarity, set, n, team, flavor, ...props }.
// `n` is the STABLE index inside its category (used by loadout share codes) — only ever APPEND to a category.
// Vocabulary (fixed by docs/ARCHITECTURE.md): patterns solid|stripes|hex|chevron|camo|circuit|gradient|checker; materials matte|satin|metallic|holo;
// helmet shapes round|visorcap|hex|crest|antenna|horns|halo|none; visor shapes wide|slit|round|shades|cyclops|x; back none|pack|wings|tail|jet|banner;
// trails none|sparks|ribbon|pixels|comet|petals; tag-out shatter|confetti|pixelate|fireworks|petals|stars; charms none|orb|cube|star|cat|bolt; nameplate plain|glow|hex.

export const RARITY = {
  common:    { id: 'common',    name: 'Common',    color: 0xb0c3d9, css: '#b0c3d9', weight: 46, rank: 0 },
  rare:      { id: 'rare',      name: 'Rare',      color: 0x4b7bff, css: '#4b7bff', weight: 32, rank: 1 },
  epic:      { id: 'epic',      name: 'Epic',      color: 0xc63cf2, css: '#c63cf2', weight: 17, rank: 2 },
  legendary: { id: 'legendary', name: 'Legendary', color: 0xf5b73a, css: '#f5b73a', weight: 5,  rank: 3 },
};
export const RARITY_LIST = ['common', 'rare', 'epic', 'legendary'];

export const CATEGORIES = [
  { id: 'suit',      key: 'suits',      name: 'Suits',       slot: 'SUIT' },
  { id: 'helmet',    key: 'helmets',    name: 'Helmets',     slot: 'HELMET' },
  { id: 'visor',     key: 'visors',     name: 'Visors',      slot: 'VISOR' },
  { id: 'pattern',   key: 'patterns',   name: 'Patterns',    slot: 'PATTERN' },
  { id: 'back',      key: 'backs',      name: 'Back Items',  slot: 'BACK' },
  { id: 'trail',     key: 'trails',     name: 'Trails',      slot: 'TRAIL' },
  { id: 'tagOut',    key: 'tagOuts',    name: 'Tag-Out FX',  slot: 'TAG-OUT' },
  { id: 'skin',      key: 'skins',      name: 'Tagger Skins', slot: 'TAGGER SKIN' },
  { id: 'charm',     key: 'charms',     name: 'Charms',      slot: 'CHARM' },
  { id: 'nameplate', key: 'nameplates', name: 'Nameplates',  slot: 'NAMEPLATE' },
  { id: 'emote',     key: 'emotes',     name: 'Emotes',      slot: 'EMOTE' },
];

export const SETS = [
  { id: 'issue',    name: 'Standard Issue',  color: 0x9aa6b8, team: 'any',   blurb: 'Reliable club kit. Never goes out of style.' },
  { id: 'solar',    name: 'Solar Flare',     color: 0xffb627, team: 'ember', blurb: 'Forged in a noon sun. Crimson plate, molten-gold trim, fireworks on the way out.' },
  { id: 'tide',     name: 'Deep Tide',       color: 0x2fd0ff, team: 'tide',  blurb: 'Trench-dark hulls and bioluminescent glow. Cold, quiet, fast.' },
  { id: 'neon',     name: 'Neon Drift',      color: 0xff2bd6, team: 'any',   blurb: 'Midnight highway, magenta rain. Pixel-perfect and always in motion.' },
  { id: 'lantern',  name: 'Paper Lantern',   color: 0xc8102e, team: 'ember', blurb: 'Festival night. Red silk, cream paper, drifting blossoms.' },
  { id: 'verdant',  name: 'Verdant Circuit', color: 0x3ddc84, team: 'tide',  blurb: 'Overgrown motherboard. Living hex-armour that hums in the dark.' },
  { id: 'midnight', name: 'Midnight Static', color: 0x7c4dff, team: 'tide',  blurb: 'Signal lost. Deep navy, violet interference, one cold eye.' },
  { id: 'gilded',   name: 'Gilded Court',    color: 0xd4a72c, team: 'ember', blurb: 'Ivory and gold for the champion. Wings optional. Applause guaranteed.' },
  { id: 'frost',    name: 'Glacier Pop',     color: 0xff7ac8, team: 'tide',  blurb: 'Ice-cream cold. Candy stripes, a very smug cat, confetti finish.' },
];

export const WEARS = [
  { id: 'fn', name: 'Factory Fresh', short: 'FF', value: 0.03 },
  { id: 'mw', name: 'Minimal Wear',  short: 'MW', value: 0.11 },
  { id: 'ft', name: 'Field-Tested',  short: 'FT', value: 0.26 },
  { id: 'ww', name: 'Well-Worn',     short: 'WW', value: 0.41 },
  { id: 'bs', name: 'Scuffed',       short: 'SC', value: 0.70 },
];

export const EMOTE_IDS = ['wave', 'salute', 'flex', 'shuffle', 'shrug', 'spin', 'cheer', 'point', 'clap', 'robot', 'bow', 'sway'];

// ---- authoring helpers -------------------------------------------------------------------------------
const items = [];
const counters = {};
function add(cat, id, name, rarity, set, props, flavor = '') {
  const n = counters[cat] = (counters[cat] ?? -1) + 1;
  items.push({ id, cat, name, rarity, set, n, flavor, ...props });
}
const suit = (id, name, r, s, base, accent, pattern, material, flavor) => add('suit', id, name, r, s, { base, accent, pattern, material }, flavor);
const helmet = (id, name, r, s, shape, color, accent, flavor) => add('helmet', id, name, r, s, { shape, color, accent }, flavor);
const visor = (id, name, r, s, shape, color, glow, flavor) => add('visor', id, name, r, s, { shape, color, glow }, flavor);
const pattern = (id, name, r, s, pat, color, flavor) => add('pattern', id, name, r, s, { pattern: pat, color }, flavor);   // color null => use suit accent
const back = (id, name, r, s, model, color, flavor) => add('back', id, name, r, s, { model, color }, flavor);
const trail = (id, name, r, s, type, color, color2, flavor) => add('trail', id, name, r, s, { type, color, color2 }, flavor);
const tagOut = (id, name, r, s, effect, color, flavor) => add('tagOut', id, name, r, s, { effect, color }, flavor);
const skin = (id, name, r, s, pat, primary, accent, glow, flavor) => add('skin', id, name, r, s, { pattern: pat, primary, accent, glow }, flavor);
const charm = (id, name, r, s, model, color, flavor) => add('charm', id, name, r, s, { model, color }, flavor);
const plate = (id, name, r, s, style, color, flavor) => add('nameplate', id, name, r, s, { style, color }, flavor);
const emote = (id, name, r, s, anim, flavor) => add('emote', id, name, r, s, { anim }, flavor);

// ======================================================= SUITS
suit('suit-graphite',  'Graphite Kit',     'common', 'issue', 0x3a3f4a, 0x9aa6b8, 'solid',    'matte',    'Plain, honest, hard to see coming.');
suit('suit-chalk',     'Chalk Runner',     'common', 'issue', 0xe8edf2, 0x5b6b80, 'stripes',  'matte',    'Fresh-laundered and immediately regretted.');
suit('suit-clay',      'Clay Court',       'common', 'issue', 0xc7683a, 0xf1d9b5, 'solid',    'matte',    'Sun-baked terracotta.');
suit('suit-harbor',    'Harbor Blue',      'common', 'issue', 0x2b5d8a, 0xbfe3ff, 'chevron',  'matte',    'Dockside navy with sea-glass trim.');
suit('suit-moss',      'Moss Ops',         'common', 'issue', 0x4a5d3a, 0xc9d19a, 'camo',     'matte',    'Forest-patch camo. Very hard to hide in an arena.');
suit('suit-signal',    'Signal Yellow',    'rare',   'issue', 0xe8c531, 0x222222, 'checker',  'satin',    'Caution-tape chic.');
suit('suit-chrome',    'Chrome Runner',    'rare',   'issue', 0x9aa4b2, 0xffffff, 'gradient', 'metallic', 'Mirror finish, zero regrets.');
suit('suit-void',      'Void Black',       'rare',   'issue', 0x14151b, 0x5f6bff, 'hex',      'satin',    'Absorbs light. Reflects style.');
suit('suit-solar',     'Solar Flare Plate','epic',   'solar', 0xd7263d, 0xffb627, 'gradient', 'satin',    'Crimson plate, sunrise trim.');
suit('suit-solar-ii',  'Corona Prime',     'legendary','solar',0x7a1220, 0xffd166, 'chevron', 'metallic', 'A star wore this first.');
suit('suit-tide',      'Deep Tide Hull',   'epic',   'tide',  0x0b3954, 0x2fd0ff, 'hex',      'satin',    'Pressure-rated. Glows where it is thin.');
suit('suit-tide-ii',   'Abyssal Skin',     'legendary','tide',0x041a2b, 0x7dfbe0, 'gradient', 'holo',     'Shimmers like something watching you.');
suit('suit-neon',      'Neon Drift Skin',  'legendary','neon',0x1a0b3d, 0xff2bd6, 'circuit',  'holo',     'The highway is a circuit and you are the current.');
suit('suit-lantern',   'Lantern Silk',     'epic',   'lantern',0xc8102e, 0xf3e5c8, 'chevron',  'satin',    'Red silk over cream paper.');
suit('suit-verdant',   'Verdant Weave',    'epic',   'verdant',0x123524, 0x3ddc84, 'hex',      'metallic', 'Living circuitry in a forest coat.');
suit('suit-midnight',  'Static Coat',      'rare',   'midnight',0x1b1c3f, 0x7c4dff, 'checker', 'satin',    'Interference pattern from a dead channel.');
suit('suit-gilded',    'Gilded Livery',    'legendary','gilded',0xf4efe6, 0xd4a72c, 'stripes', 'metallic', 'Ivory, gold leaf and a hint of royalty.');
suit('suit-frost',     'Glacier Pop Kit',  'rare',   'frost', 0xbfe8ff, 0xff7ac8, 'stripes',  'matte',    'Vanilla ice with a raspberry ripple.');
suit('suit-ember-ops', 'Ember Ops',        'rare',   'issue', 0x8a2b12, 0xff9a3c, 'camo',     'matte',    'Rust-belt camo. Warm and mean.');
suit('suit-tide-ops',  'Tide Ops',         'rare',   'issue', 0x0d4a52, 0x5fe6d8, 'camo',     'matte',    'Reef camo. Cool and calm.');

// ======================================================= HELMETS
helmet('helm-none',    'Bare Head',       'common', 'issue', 'none',     0x000000, 0x000000, 'Wind in your hair. No protection whatsoever.');
helmet('helm-sport',   'Sport Shell',     'common', 'issue', 'round',    0x3a3f4a, 0x9aa6b8, 'The regulation dome.');
helmet('helm-cap',     'Runner Cap',      'common', 'issue', 'visorcap', 0x2b5d8a, 0xbfe3ff, 'Brim forward, speed backward.');
helmet('helm-hex',     'Hex Guard',       'rare',   'issue', 'hex',      0x2a2f3a, 0x59e0ff, 'Faceted for deflection. Mostly for looks.');
helmet('helm-crest',   'Rally Crest',     'rare',   'issue', 'crest',    0xc7683a, 0xf1d9b5, 'A mohawk of pure intent.');
helmet('helm-ping',    'Ping Antenna',    'rare',   'issue', 'antenna',  0x9aa4b2, 0xff5a3c, 'Always transmitting. Nobody knows what.');
helmet('helm-corona',  'Corona Crest',    'epic',   'solar', 'crest',    0xd7263d, 0xffb627, 'A flame that never went out.');
helmet('helm-tide',    'Tidepool Dome',   'rare',   'tide',  'round',    0x0b3954, 0x2fd0ff, 'Air-bubble aesthetics.');
helmet('helm-neon',    'Drift Antenna',   'epic',   'neon',  'antenna',  0x1a0b3d, 0xff2bd6, 'Picks up radio, rain and rivals.');
helmet('helm-horns',   'Lantern Horns',   'epic',   'lantern','horns',   0xf3e5c8, 0xc8102e, 'Paper horns, oiled and gilded.');
helmet('helm-verdant', 'Canopy Hex',      'epic',   'verdant','hex',     0x123524, 0x3ddc84, 'Leaf-vein plating.');
helmet('helm-midnight','Static Cap',      'rare',   'midnight','visorcap',0x1b1c3f,0x7c4dff, 'Brim full of static.');
helmet('helm-halo',    'Champion Halo',   'legendary','gilded','halo',   0xf4efe6, 0xd4a72c, 'It floats. Do not ask how.');
helmet('helm-frost',   'Snowcap Shell',   'rare',   'frost', 'round',    0xbfe8ff, 0xff7ac8, 'Pom-pom optional.');
helmet('helm-abyss',   'Anglerfish Crest','legendary','tide','antenna',  0x041a2b, 0x7dfbe0, 'A single light in the dark.');

// ======================================================= VISORS
visor('vis-wide',    'Clear Wide',      'common', 'issue', 'wide',    0x66d9ff, 0x66d9ff, 'The classic panoramic pane.');
visor('vis-slit',    'Amber Slit',      'common', 'issue', 'slit',    0xffb347, 0xffb347, 'Squint like you mean it.');
visor('vis-round',   'Goggle Lens',     'common', 'issue', 'round',   0x9fffb0, 0x9fffb0, 'Twin-lens optics.');
visor('vis-shades',  'Court Shades',    'rare',   'issue', 'shades',  0x1a1a22, 0xff9a3c, 'Sunglasses. Indoors. Obviously.');
visor('vis-cyclops', 'Cyclops Eye',     'rare',   'issue', 'cyclops', 0xff3b3b, 0xff3b3b, 'One eye, many opinions.');
visor('vis-x',       'X-Ray Cross',     'rare',   'issue', 'x',       0xf2f2ff, 0xf2f2ff, 'Marks the spot on your own face.');
visor('vis-solar',   'Solar Slit',      'epic',   'solar', 'slit',    0xffd166, 0xffb627, 'Molten gold, no filter.');
visor('vis-tide',    'Biolume Wide',    'epic',   'tide',  'wide',    0x2fd0ff, 0x2fd0ff, 'Glows in the dark, stays glowing.');
visor('vis-neon',    'Drift Shades',    'epic',   'neon',  'shades',  0x1a0b3d, 0xff2bd6, 'Neon reflection built in.');
visor('vis-lantern', 'Lantern Lens',    'rare',   'lantern','round',  0xffd9a0, 0xff9a3c, 'A warm paper glow.');
visor('vis-verdant', 'Sprout X',        'rare',   'verdant','x',      0x3ddc84, 0x3ddc84, 'Cross-hair reticle grown wild.');
visor('vis-midnight','Static Cyclops',  'epic',   'midnight','cyclops',0xb69bff,0x7c4dff, 'Staring through the noise.');
visor('vis-gilded',  'Royal Wide',      'legendary','gilded','wide',  0xffe9a8, 0xd4a72c, 'Gold-tinted, silk-lined.');
visor('vis-frost',   'Ice Goggle',      'rare',   'frost', 'round',   0xff7ac8, 0xff7ac8, 'Strawberry-tinted ski lens.');

// ======================================================= PATTERNS (color null => suit accent)
pattern('pat-auto',     'Suit Default',    'common', 'issue', 'auto',     null, 'Use the suit\'s own weave.');
pattern('pat-solid',    'Plain Weave',     'common', 'issue', 'solid',    null, 'No pattern. Confident.');
pattern('pat-stripes',  'Racing Stripes',  'common', 'issue', 'stripes',  0xffffff, 'Go-faster lines.');
pattern('pat-chevron',  'Chevron Rush',    'common', 'issue', 'chevron',  0xffd166, 'Arrows that point at trouble.');
pattern('pat-camo',     'Digital Camo',    'rare',   'issue', 'camo',     0x88a070, 'Pixelated foliage.');
pattern('pat-checker',  'Checker Flag',    'rare',   'issue', 'checker',  0xf5f5f5, 'Finish-line energy.');
pattern('pat-hex',      'Honeycomb',       'rare',   'issue', 'hex',      0xffc93c, 'Hive-mind style.');
pattern('pat-circuit',  'Circuit Trace',   'rare',   'issue', 'circuit',  0x43ffb0, 'Copper-and-neon board traces.');
pattern('pat-gradient', 'Sunset Fade',     'rare',   'issue', 'gradient', 0xff8a4c, 'Top to bottom, warm to hot.');
pattern('pat-solar',    'Flare Bands',     'epic',   'solar', 'chevron',  0xffb627, 'Rolling solar flares.');
pattern('pat-tide',     'Wave Scales',     'epic',   'tide',  'hex',      0x7dfbe0, 'Scales in a rip current.');
pattern('pat-neon',     'Drift Grid',      'legendary','neon','circuit',  0x22f5ff, 'Wireframe horizon.');
pattern('pat-lantern',  'Paper Cranes',    'epic',   'lantern','chevron', 0xf3e5c8, 'Folded, flapping and fiercely fast.');
pattern('pat-verdant',  'Moss Board',      'rare',   'verdant','circuit', 0xc6ff3d, 'Traces under lichen.');
pattern('pat-midnight', 'Dead Channel',    'rare',   'midnight','checker',0x7c4dff, 'Snow on the screen.');
pattern('pat-gilded',   'Gold Leaf',       'legendary','gilded','stripes',0xd4a72c, 'Beaten gold on ivory.');
pattern('pat-frost',    'Candy Stripe',    'epic',   'frost', 'stripes',  0xff7ac8, 'Peppermint-fast.');

// ======================================================= BACK ITEMS
back('back-none',    'No Back Item',    'common', 'issue', 'none',   0x000000, 'Travelling light.');
back('back-pack',    'Field Pack',      'common', 'issue', 'pack',   0x5b6473, 'Water, snacks and spare batteries.');
back('back-pack2',   'Courier Bag',     'rare',   'issue', 'pack',   0xff7a2f, 'Express deliveries, express damage.');
back('back-banner',  'Team Banner',     'rare',   'issue', 'banner', 0x2fd0ff, 'Carry the colours, literally.');
back('back-jet',     'Solar Thruster',  'epic',   'solar', 'jet',    0xffb627, 'Purely cosmetic. Purely loud.');
back('back-tail',    'Reef Fin',        'rare',   'tide',  'tail',   0x2fd0ff, 'A dorsal fin, gently glowing.');
back('back-wings-n', 'Drift Wings',     'legendary','neon','wings',  0xff2bd6, 'Holographic pinions, pixel-perfect.');
back('back-lantern', 'Festival Banner', 'epic',   'lantern','banner', 0xc8102e, 'Silk streamer with tassels.');
back('back-verdant', 'Sprout Pack',     'rare',   'verdant','pack',  0x3ddc84, 'Grows something in the top pocket.');
back('back-midnight','Static Jet',      'epic',   'midnight','jet',  0x7c4dff, 'Violet exhaust, no smell.');
back('back-gilded',  'Champion Wings',  'legendary','gilded','wings',0xd4a72c, 'Gold-tipped. Applause on landing.');
back('back-frost',   'Fluffy Tail',     'epic',   'frost', 'tail',   0xff7ac8, 'Extremely fluffy. Extremely fast.');

// ======================================================= TRAILS
trail('trail-none',    'No Trail',        'common', 'issue', 'none',   0x000000, 0x000000, 'Clean footprints.');
trail('trail-sparks',  'Spark Kick',      'common', 'issue', 'sparks', 0xffe08a, 0xff8a3c, 'Sparks on the sprint.');
trail('trail-ribbon',  'Ribbon Run',      'rare',   'issue', 'ribbon', 0x2fd0ff, 0x8affea, 'A silk streamer at your heels.');
trail('trail-pixels',  'Pixel Dust',      'rare',   'issue', 'pixels', 0xffffff, 0x9aa6b8, 'Dropped frames.');
trail('trail-comet',   'Comet Tail',      'rare',   'issue', 'comet',  0x9bd1ff, 0xffffff, 'Streaking through.');
trail('trail-petals',  'Petal Drift',     'rare',   'issue', 'petals', 0xffb7d5, 0xffffff, 'Spring, at 8 metres per second.');
trail('trail-solar',   'Solar Embers',    'epic',   'solar', 'sparks', 0xffb627, 0xd7263d, 'Molten trails on the floor.');
trail('trail-tide',    'Bioluminescence', 'epic',   'tide',  'ribbon', 0x2fd0ff, 0x7dfbe0, 'Light follows where you swim.');
trail('trail-neon',    'Pixel Rain',      'legendary','neon','pixels', 0xff2bd6, 0x22f5ff, 'Bitrate at maximum.');
trail('trail-lantern', 'Blossom Storm',   'epic',   'lantern','petals',0xffb7d5, 0xc8102e, 'Cherry blossoms in your wake.');
trail('trail-verdant', 'Spore Trail',     'rare',   'verdant','sparks',0xc6ff3d, 0x3ddc84, 'Glow-spores, gently floating.');
trail('trail-midnight','Shooting Star',   'epic',   'midnight','comet',0xb69bff, 0x7c4dff, 'Wish upon a sprint.');
trail('trail-gilded',  'Gold Dust',       'legendary','gilded','sparks',0xffe9a8, 0xd4a72c, 'You leave shine.');
trail('trail-frost',   'Sprinkle Ribbon', 'epic',   'frost', 'ribbon', 0xff7ac8, 0xbfe8ff, 'Strawberry and vanilla, swirled.');

// ======================================================= TAG-OUT EFFECTS
tagOut('out-shatter',  'Glass Shatter',     'common', 'issue', 'shatter',   0x9be7ff, 'The classic crystal break.');
tagOut('out-confetti', 'Confetti Pop',      'rare',   'frost', 'confetti',  0xff7ac8, 'Party rules apply.');
tagOut('out-pixel',    'Pixel Burst',       'epic',   'neon',  'pixelate',  0xff2bd6, 'Downscaled into oblivion.');
tagOut('out-fire',     'Firework Finale',   'epic',   'solar', 'fireworks', 0xffb627, 'A bow, a bang and a sparkler.');
tagOut('out-petals',   'Petal Storm',       'epic',   'lantern','petals',   0xffb7d5, 'Dissolves into blossoms.');
tagOut('out-stars',    'Star Shower',       'legendary','gilded','stars',   0xffe9a8, 'Twinkle out of frame.');

// ======================================================= TAGGER SKINS
skin('skin-factory',  'Factory Grey',    'common', 'issue', 'solid',    0x5b6473, 0x9aa6b8, 0x66d9ff, 'Straight from the crate.');
skin('skin-hazard',   'Hazard Line',     'common', 'issue', 'stripes',  0xe8c531, 0x222222, 0xffdd55, 'Caution: fun.');
skin('skin-arctic',   'Arctic Camo',     'common', 'issue', 'camo',     0xdfe8f0, 0x8fa3b8, 0x9be7ff, 'Snow-blend pixels.');
skin('skin-crimson',  'Crimson Chevron', 'rare',   'issue', 'chevron',  0xb3202c, 0xf5f5f5, 0xff6a6a, 'Arrowheads for arrowheads.');
skin('skin-cobalt',   'Cobalt Weave',    'rare',   'issue', 'hex',      0x1d4fbf, 0x8ab6ff, 0x4b9dff, 'Woven carbon, blue in the light.');
skin('skin-slate',    'Slate Fade',      'rare',   'issue', 'gradient', 0x2b3242, 0x6c7a99, 0x9bb4ff, 'Storm cloud, gunmetal, lightning.');
skin('skin-checker',  'Checker Rush',    'rare',   'issue', 'checker',  0x222831, 0xf5f5f5, 0xffffff, 'Flag drop!');
skin('skin-solar',    'Solar Flare',     'epic',   'solar', 'gradient', 0xd7263d, 0xffb627, 0xffb627, 'Sunrise through the barrel.');
skin('skin-corona',   'Corona',          'legendary','solar','chevron', 0x7a1220, 0xffd166, 0xffd166, 'The core of a small star.');
skin('skin-tide',     'Deep Tide',       'epic',   'tide',  'hex',      0x0b3954, 0x2fd0ff, 0x2fd0ff, 'Scales and current.');
skin('skin-abyss',    'Abyss Bloom',     'legendary','tide','gradient', 0x041a2b, 0x7dfbe0, 0x7dfbe0, 'A slow, glowing pulse.');
skin('skin-neon',     'Neon Drift',      'legendary','neon','circuit',  0x1a0b3d, 0xff2bd6, 0x22f5ff, 'Rides the grid.');
skin('skin-lantern',  'Paper Lantern',   'epic',   'lantern','chevron', 0xc8102e, 0xf3e5c8, 0xffb36a, 'Glows from the inside.');
skin('skin-verdant',  'Verdant Circuit', 'epic',   'verdant','circuit', 0x123524, 0x3ddc84, 0xc6ff3d, 'Overgrown traces.');
skin('skin-midnight', 'Dead Channel',    'rare',   'midnight','checker',0x1b1c3f, 0x7c4dff, 0xb69bff, 'Snow-static shimmer.');
skin('skin-gilded',   'Gilded Court',    'legendary','gilded','stripes',0xf4efe6, 0xd4a72c, 0xffe9a8, 'Gold leaf over ivory.');
skin('skin-frost',    'Glacier Pop',     'epic',   'frost', 'stripes',  0xbfe8ff, 0xff7ac8, 0xff7ac8, 'Raspberry ripple.');
skin('skin-ember-ops','Ember Camo',      'rare',   'issue', 'camo',     0x8a2b12, 0xff9a3c, 0xffb36a, 'Rust-belt camo.');
skin('skin-tide-ops', 'Reef Camo',       'rare',   'issue', 'camo',     0x0d4a52, 0x5fe6d8, 0x5fe6d8, 'Coral-blend pixels.');
skin('skin-void',     'Void Core',       'epic',   'issue', 'circuit',  0x0a0b10, 0x5f6bff, 0x7f8cff, 'A black hole with a trigger.');

// ======================================================= CHARMS
charm('charm-none',    'No Charm',       'common', 'issue', 'none',  0x000000, 'Empty hook.');
charm('charm-orb',     'Glow Orb',       'common', 'issue', 'orb',   0x66d9ff, 'Tiny lantern.');
charm('charm-cube',    'Lucky Cube',     'common', 'issue', 'cube',  0xff7a2f, 'Six sides, all lucky.');
charm('charm-star',    'Star Tag',       'rare',   'issue', 'star',  0xffd166, 'Gold star. You earned it.');
charm('charm-cat',     'Neko Charm',     'rare',   'issue', 'cat',   0xf5f5f5, 'Purr-fect.');
charm('charm-bolt',    'Volt Bolt',      'rare',   'issue', 'bolt',  0xffe14a, 'Kinda charged.');
charm('charm-solar',   'Mini Sun',       'epic',   'solar', 'orb',   0xffb627, 'Warm to the touch.');
charm('charm-tide',    'Pearl Drop',     'epic',   'tide',  'orb',   0x7dfbe0, 'From the deep.');
charm('charm-neon',    'Glitch Cube',    'epic',   'neon',  'cube',  0xff2bd6, 'Never the same colour twice.');
charm('charm-lantern', 'Paper Star',     'epic',   'lantern','star', 0xc8102e, 'Folded, twice.');
charm('charm-verdant', 'Sprout Bolt',    'rare',   'verdant','bolt', 0x3ddc84, 'Charged by sunlight.');
charm('charm-gilded',  'Gold Star',      'legendary','gilded','star',0xd4a72c, 'A tiny trophy.');
charm('charm-frost',   'Smug Cat',       'legendary','frost','cat',  0xff7ac8, 'Judges you silently.');
charm('charm-midnight','Static Orb',     'rare',   'midnight','orb', 0x7c4dff, 'Hums at 50 Hz.');

// ======================================================= NAMEPLATES
plate('plate-plain',    'Plain White',    'common', 'issue', 'plain', 0xffffff, 'No frills.');
plate('plate-glow',     'Team Glow',      'common', 'issue', 'glow',  0x66d9ff, 'A soft halo behind your name.');
plate('plate-hex',      'Hex Badge',      'rare',   'issue', 'hex',   0xf5f5f5, 'A faceted badge for the discerning.');
plate('plate-solar',    'Flare Glow',     'epic',   'solar', 'glow',  0xffb627, 'Sun-warm.');
plate('plate-tide',     'Deep Glow',      'rare',   'tide',  'glow',  0x2fd0ff, 'Bioluminescent lettering.');
plate('plate-neon',     'Drift Hex',      'epic',   'neon',  'hex',   0xff2bd6, 'Neon badge.');
plate('plate-lantern',  'Lantern Plate',  'rare',   'lantern','glow', 0xff9a3c, 'Softly lit.');
plate('plate-verdant',  'Circuit Hex',    'rare',   'verdant','hex',  0x3ddc84, 'Hex with a pulse.');
plate('plate-gilded',   'Gilded Hex',     'legendary','gilded','hex', 0xd4a72c, 'Gold-plated. Naturally.');
plate('plate-frost',    'Candy Glow',     'rare',   'frost', 'glow',  0xff7ac8, 'Sweet.');

// ======================================================= EMOTES
emote('wave',    'Friendly Wave',    'common', 'issue',   'wave',    'Hello. Hello. Hello.');
emote('salute',  'Salute',           'common', 'issue',   'salute',  'Sir, yes sir.');
emote('flex',    'Solar Flex',       'rare',   'solar',   'flex',    'Show them the sun.');
emote('shuffle', 'Drift Shuffle',    'epic',   'neon',    'shuffle', 'Footwork at the neon crossing.');
emote('shrug',   'Big Shrug',        'common', 'issue',   'shrug',   'Whatever.');
emote('spin',    'Victory Spin',     'rare',   'issue',   'spin',    'A full revolution of success.');
emote('cheer',   'Cheer Jump',       'rare',   'frost',   'cheer',   'Two hands, high hops.');
emote('point',   'Point Away',       'common', 'issue',   'point',   'Over there. No, there.');
emote('clap',    'Slow Clap',        'rare',   'issue',   'clap',    'Very slow. Very sarcastic.');
emote('robot',   'Robotic',          'epic',   'midnight','robot',   'Dead channel, live moves.');
emote('bow',     'Lantern Bow',      'epic',   'lantern', 'bow',     'A deep, formal bow.');
emote('sway',    'Deep Sway',        'legendary','tide',  'sway',    'Rocking with the tide.');

// ---- derived data --------------------------------------------------------------------------------------
function hue(c) {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 0.08) return -1;                   // grey
  let h; if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360; return h;
}
const primaryColor = (it) => it.base ?? it.color ?? it.primary ?? 0x888888;
const setById = Object.fromEntries(SETS.map((s) => [s.id, s]));
for (const it of items) {
  const s = setById[it.set];
  it.rarityInfo = RARITY[it.rarity];
  // team affinity used by randomLoadout: from the set, else from the colour (warm => ember, cool => tide)
  if (s && s.team !== 'any') it.team = s.team;
  else {
    const h = hue(primaryColor(it));
    it.team = h < 0 ? 'any' : (h < 60 || h > 330) ? 'ember' : (h > 160 && h < 260) ? 'tide' : 'any';
  }
  if (it.cat === 'tagOut' || it.cat === 'emote') it.team = (s && s.team !== 'any') ? s.team : 'any';
  it.searchText = `${it.name} ${it.flavor} ${s?.name ?? ''} ${it.rarity}`.toLowerCase();
}

export const ITEMS = items;
export const BY_ID = Object.fromEntries(items.map((i) => [i.id, i]));
export const BY_CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, items.filter((i) => i.cat === c.id)]));
for (const s of SETS) s.items = items.filter((i) => i.set === s.id).map((i) => i.id);
export const SET_BY_ID = setById;
export { hue };

/** Public `catalog` object handed out as ctx.cosmetics.catalog. */
export function buildCatalog() {
  const cat = {
    categories: CATEGORIES, rarities: RARITY, rarityList: RARITY_LIST, sets: SETS, wears: WEARS, emoteIds: EMOTE_IDS,
    all: ITEMS, byId: BY_ID, byCategory: BY_CAT, setById: SET_BY_ID,
    get: (id) => BY_ID[id] ?? null,
    forCategory: (c) => BY_CAT[c] ?? [],
  };
  for (const c of CATEGORIES) cat[c.key] = BY_CAT[c.id];
  return cat;
}
