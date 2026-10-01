// Mock world for the HUD: a self-contained fake ctx (actors, match, combat, map) + a director that drives every
// element with deterministic fake data. Used by ctx.hud.debug.mock(true), ?scene=hud-gallery and tools/hud_sheet.mjs.
import { TEAMS } from '../../core/config.js';

const NAMES_A = ['You', 'Kestrel', 'Marlo', 'Juno', 'Dax'];
const NAMES_B = ['Vega', 'Rook', 'Sable', 'Nyx', 'Orin'];
const CATALOG = [
  { id: 'vest', name: 'Vest', cost: 1000, slot: 5, category: 'equipment', teams: ['ember', 'tide'], killReward: 0, desc: 'Armor + crown guard. Absorbs 50% of drain.' },
  { id: 'kit', name: 'Kit', cost: 400, slot: 5, category: 'equipment', teams: ['tide'], killReward: 0, desc: 'Disarm the Beacon in half the time.' },
  { id: 'pip', name: 'Pip', cost: 200, slot: 2, category: 'pistol', teams: ['ember', 'tide'], killReward: 300, desc: 'Default sidearm. Accurate, forgiving.' },
  { id: 'twin', name: 'Twin', cost: 300, slot: 2, category: 'pistol', teams: ['ember', 'tide'], killReward: 300, desc: 'Fast burst pistol.' },
  { id: 'judge', name: 'Judge', cost: 700, slot: 2, category: 'pistol', teams: ['ember', 'tide'], killReward: 300, desc: 'Heavy revolver-style. One-crown potential.' },
  { id: 'zip', name: 'Zip', cost: 1050, slot: 1, category: 'smg', teams: ['ember', 'tide'], killReward: 600, desc: 'High rate, low damage. Mobile.' },
  { id: 'hum', name: 'Hum', cost: 1250, slot: 1, category: 'smg', teams: ['ember', 'tide'], killReward: 600, desc: 'Balanced mid-range SMG.' },
  { id: 'arc', name: 'Arc', cost: 2700, slot: 1, category: 'rifle', teams: ['ember'], killReward: 300, desc: 'Ember rifle. High damage, harsh recoil.' },
  { id: 'rail', name: 'Rail', cost: 3100, slot: 1, category: 'rifle', teams: ['tide'], killReward: 300, desc: 'Tide rifle. Accurate and controllable.' },
  { id: 'halo', name: 'Halo', cost: 3300, slot: 1, category: 'rifle', teams: ['ember', 'tide'], killReward: 300, desc: 'Scoped burst rifle. Precise.' },
  { id: 'lance', name: 'Lance', cost: 4750, slot: 1, category: 'heavy', teams: ['ember', 'tide'], killReward: 100, desc: 'One-tag bolt-action. Strong movement penalty.' },
  { id: 'scatter', name: 'Scatter', cost: 1100, slot: 1, category: 'heavy', teams: ['ember', 'tide'], killReward: 900, desc: 'Pellet spread. Close range.' },
  { id: 'storm', name: 'Storm', cost: 5200, slot: 1, category: 'heavy', teams: ['ember', 'tide'], killReward: 300, desc: 'Big-magazine LMG.' },
  { id: 'haze', name: 'Haze', cost: 300, slot: 4, category: 'utility', teams: ['ember', 'tide'], killReward: 0, desc: 'Smoke sphere that blocks vision.' },
  { id: 'strobe', name: 'Strobe', cost: 200, slot: 4, category: 'utility', teams: ['ember', 'tide'], killReward: 0, desc: 'Blinding burst.' },
  { id: 'pulse', name: 'Pulse', cost: 300, slot: 4, category: 'utility', teams: ['ember', 'tide'], killReward: 0, desc: 'Area pulse. Partial Charge drain.' },
];
const DEFS = {
  arc: { id: 'arc', name: 'Arc', magSize: 30, reloadTime: 2.5 }, rail: { id: 'rail', name: 'Rail', magSize: 30, reloadTime: 2.4 }, pip: { id: 'pip', name: 'Pip', magSize: 13, reloadTime: 2.2 },
  lance: { id: 'lance', name: 'Lance', magSize: 10, reloadTime: 3.2 }, halo: { id: 'halo', name: 'Halo', magSize: 30, reloadTime: 3.0 }, tap: { id: 'tap', name: 'Tap' },
  haze: { id: 'haze', name: 'Haze' }, strobe: { id: 'strobe', name: 'Strobe' }, pulse: { id: 'pulse', name: 'Pulse' }, beacon: { id: 'beacon', name: 'Beacon' },
  zip: { id: 'zip', name: 'Zip', magSize: 32, reloadTime: 2.0 }, hum: { id: 'hum', name: 'Hum', magSize: 30, reloadTime: 2.3 }, twin: { id: 'twin', name: 'Twin', magSize: 20, reloadTime: 2.1 },
  judge: { id: 'judge', name: 'Judge', magSize: 8, reloadTime: 2.9 }, scatter: { id: 'scatter', name: 'Scatter', magSize: 8, reloadTime: 3.4 }, storm: { id: 'storm', name: 'Storm', magSize: 100, reloadTime: 4.8 }, kit: { id: 'kit', name: 'Kit' }, vest: { id: 'vest', name: 'Vest' },
};

function radarCanvas() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const W = (v) => (v + 64) / 128 * S;  // world -> px
  const floor = 'rgba(126,148,176,.88)', wall = 'rgba(28,36,52,.95)', edge = 'rgba(214,228,246,.5)';
  const rr = (x0, z0, x1, z1, fill) => { g.fillStyle = fill; g.beginPath(); g.roundRect(W(x0), W(z0), W(x1) - W(x0), W(z1) - W(z0), 4); g.fill(); g.strokeStyle = edge; g.lineWidth = 1.5; g.stroke(); };
  for (const r of [[-58, -9, 58, 9], [-46, -58, -32, 20], [32, -20, 46, 58], [-14, -40, 12, 40], [26, -58, 58, -30], [-58, 30, -30, 58], [-6, 8, 6, 26], [-30, -60, -8, -44], [10, 44, 34, 60]]) rr(r[0], r[1], r[2], r[3], floor);
  for (const r of [[36, -54, 42, -46], [46, -40, 54, -34], [-54, 34, -46, 42], [-42, 48, -36, 54], [-4, -4, 4, 3], [-24, 12, -18, 18], [20, -16, 26, -10], [-10, -34, -6, -28]]) { g.fillStyle = wall; g.fillRect(W(r[0]), W(r[1]), W(r[2]) - W(r[0]), W(r[3]) - W(r[1])); g.strokeStyle = 'rgba(190,206,230,.6)'; g.lineWidth = 1.5; g.strokeRect(W(r[0]), W(r[1]), W(r[2]) - W(r[0]), W(r[3]) - W(r[1])); }
  return c;
}

export function createMock(H) {
  const settings = H.ctx.settings;
  const mk = (name, team, id, isPlayer = false) => ({
    id, name, team, isPlayer, isBot: !isPlayer, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: true, crouching: false,
    hp: 100, armor: 0, helmet: false, alive: true, tagged: false, credits: 3200, hasBeacon: false, hasKit: false, inventory: { slots: {}, current: null, utility: [] },
    stats: { tags: 0, outs: 0, assists: 0, score: 0, damage: 0, crowns: 0 }, spotted: false, ph: id * 1.7,
  });
  const A = NAMES_A.map((n, i) => mk(n, 'ember', i + 1, i === 0)), B = NAMES_B.map((n, i) => mk(n, 'tide', i + 11));
  const you = A[0];
  const map = {
    bounds: { min: { x: -64, y: 0, z: -64 }, max: { x: 64, y: 12, z: 64 } }, radar: { canvas: radarCanvas(), rect: { minX: -64, maxX: 64, minZ: -64, maxZ: 64 } },
    sites: { A: { center: { x: 42, y: 0, z: -42 }, radius: 9 }, B: { center: { x: -42, y: 0, z: 42 }, radius: 9 } },
    callouts: [
      { name: 'Long', pos: { x: 0, z: 0 }, radius: 16 }, { name: 'Mid Doors', pos: { x: 0, z: -22 }, radius: 14 }, { name: 'A Site', pos: { x: 42, z: -42 }, radius: 12 },
      { name: 'B Site', pos: { x: -42, z: 42 }, radius: 12 }, { name: 'Catwalk', pos: { x: -39, z: -20 }, radius: 14 }, { name: 'Tunnels', pos: { x: 39, z: 30 }, radius: 14 }, { name: 'Plaza', pos: { x: 22, z: 52 }, radius: 14 },
    ],
  };
  const match = {
    phase: 'live', round: 9, scores: { ember: 5, tide: 3 }, timeLeft: 74.6, phaseTime: 30, playerTeam: 'ember', overtime: false, mvp: null, history: [], lossStreak: { ember: 0, tide: 1 },
    sideOf: (t) => (t === 'ember' ? 'attack' : 'defend'), beacon: { state: 'carried', site: null, pos: { x: 0, y: 0, z: 0 }, carrier: A[2], progress: 0, fuseLeft: 35 },
    teams: { ember: A, tide: B }, catalog: CATALOG,
    canBuy: () => match.phase === 'buy' || match.phase === 'freeze' || match.phase === 'warmup',
    buy(actor, id) {
      const it = CATALOG.find((c) => c.id === id); if (!it) return { ok: false, reason: 'unknown' };
      if (!match.canBuy(actor)) return { ok: false, reason: 'phase' };
      if (it.teams && !it.teams.includes(actor.team)) return { ok: false, reason: 'team' };
      if (actor.credits < it.cost) return { ok: false, reason: 'credits' };
      const inv = actor.inventory; const slots = inv.slots;
      if (id === 'vest') { if (actor.armor >= 100) return { ok: false, reason: 'owned' }; actor.armor = 100; actor.helmet = true; }
      else if (id === 'kit') { if (actor.hasKit) return { ok: false, reason: 'owned' }; actor.hasKit = true; inv.kit = true; }
      else if (it.slot === 4) { const n = inv.utility.filter((u) => u === id).length; if (inv.utility.length >= 3 || n >= 2) return { ok: false, reason: 'full' }; inv.utility.push(id); }
      else { if (Object.values(slots).includes(id)) return { ok: false, reason: 'owned' }; slots[it.slot === 2 ? 'secondary' : 'primary'] = id; inv.current = id; }
      actor.credits -= it.cost; H.bus.emit('buy', { actor, item: id, name: it.name, cost: it.cost }); H.bus.emit('credits', { actor, delta: -it.cost, reason: 'Purchase' });
      return { ok: true };
    },
  };
  const eq = { def: DEFS.arc, mag: 24, reserve: 90, state: 'idle', t: 0, scoped: false, burst: 0 };
  const M = {
    on: false, auto: false, demoT: 0, running: false, spread: 0.06, fire: 0, ctx: null, eq, A, B, you, match, map,
  };
  const inv = (a) => a.inventory;
  const combat = {
    taggers: DEFS, equipped: (a) => (a === you ? eq : { def: DEFS[a.inventory.current] || DEFS.arc, mag: 20, reserve: 60, state: 'idle', t: 0 }),
    crosshairSpread: (a) => (a === you ? M.spread : 0.1), inventory: (a) => inv(a), utility: { count: (a, t) => a.inventory.utility.filter((u) => u === t).length },
    viewmodel: {},
  };
  M.ctx = { settings, input: H.ctx.input, events: H.ctx.events, actors: [...A, ...B], localActor: you, match, combat, map, render: null, cosmetics: H.ctx.cosmetics, audio: null, nav: null, hud: null };

  const defaults = () => {
    A.forEach((a, i) => { a.alive = true; a.tagged = false; a.hp = [84, 100, 62, 100, 40][i]; a.armor = [62, 100, 0, 100, 40][i]; a.helmet = i !== 2; a.hasBeacon = false; a.credits = [4200, 3800, 2900, 5100, 1750][i]; a.stats = { tags: [12, 9, 6, 8, 4][i], outs: [7, 5, 8, 6, 9][i], assists: [3, 2, 1, 4, 0][i], score: [30, 24, 15, 22, 9][i], damage: 0, crowns: 0 }; });
    B.forEach((a, i) => { a.alive = true; a.tagged = false; a.hp = 100; a.armor = 50; a.stats = { tags: [10, 8, 5, 7, 6][i], outs: [6, 8, 9, 7, 5][i], assists: [2, 1, 3, 0, 2][i], score: [26, 20, 14, 17, 15][i], damage: 0, crowns: 0 }; a.spotted = false; });
    B[1].alive = false; B[1].tagged = true; A[4].alive = true;
    B[0].spotted = true; B[3].spotted = true;
    you.inventory = { slots: { primary: 'arc', secondary: 'pip', grip: 'tap' }, current: 'arc', utility: ['haze', 'strobe', 'strobe'] };
    for (const a of [...A.slice(1), ...B]) a.inventory = { slots: { primary: a.team === 'ember' ? 'arc' : 'rail', secondary: 'pip' }, current: a.team === 'ember' ? 'arc' : 'rail', utility: ['haze'] };
    A[2].hasBeacon = true; match.beacon = { state: 'carried', site: null, pos: A[2].pos, carrier: A[2], progress: 0, fuseLeft: 35 };
    Object.assign(match, { phase: 'live', round: 9, scores: { ember: 5, tide: 3 }, timeLeft: 74.6, playerTeam: 'ember', overtime: false, mvp: A[1], history: ['ember', 'tide', 'ember', 'ember', 'tide', 'ember', 'tide', 'ember'].map((w, i) => ({ n: i + 1, winner: w, reason: 'elimination' })) });
    match.sideOf = (t) => (t === match.playerTeam ? 'attack' : 'defend');
    you.team = 'ember'; you.alive = true; you.name = 'You';
    Object.assign(eq, { def: DEFS.arc, mag: 24, reserve: 90, state: 'idle', t: 0, scoped: false });
    M.spread = 0.06; M.fire = 0; M.reloadT0 = -99;
    H.flags.forceScore = false; H.cbOverride = null; H.scaleOverride = null; H.xhairOverride = null; H.specForce = null;
  };
  defaults();
  const place = (T) => {
    // local stands in the middle corridor; everyone else drifts on slow orbits (deterministic in T)
    if (!M.fixed) { you.pos.x = -6; you.pos.z = 5; } you.yaw = 0.7;
    const orb = (a, cx, cz, r, sp, off) => { const t = T * sp + off; a.pos.x = cx + Math.cos(t) * r; a.pos.z = cz + Math.sin(t) * r; a.pos.y = 0; a.yaw = -t + Math.PI / 2; };
    orb(A[1], -8, 3, 9, 0.12, 0.4); orb(A[2], 8, 12, 12, 0.10, 2.0); orb(A[3], 20, -6, 14, 0.09, 4.0); orb(A[4], -30, -12, 8, 0.16, 5.5);
    orb(B[0], 10, -24, 8, 0.14, 1.0); orb(B[1], 6, -8, 3, 0.1, 3.0); orb(B[2], 40, -30, 8, 0.11, 2.4); orb(B[3], -12, 22, 12, 0.13, 0.2); orb(B[4], -50, 46, 6, 0.12, 4.4);
    B[3].pos.y = 4.2; B[0].pos.y = -0.5; A[3].pos.y = 3.6;
    you.vel.x = M.moving ? 4.2 : 0; you.vel.z = 0;
    if (match.beacon.state === 'armed' || match.beacon.state === 'arming' || match.beacon.state === 'disarming') match.beacon.pos = { x: 42, y: 0, z: -42 };
    else if (match.beacon.state === 'carried') match.beacon.pos = A[2].pos;
  };
  place(0);

  const reset = () => { H.bus.emit('reset'); defaults(); M.auto = false; M.moving = false; M.demoT = 0; };
  const st = {
    live() {
      H.bus.emit('reset'); H.flags.forceScore = false;
      const feed = [
        { attacker: A[1], victim: B[1], tagger: 'arc', hitgroup: 'head' }, { attacker: B[2], victim: A[4], tagger: 'rail', wallbang: true },
        { attacker: you, victim: B[3], tagger: 'arc', hitgroup: 'chest', through: 'smoke' }, { attacker: A[3], victim: B[4], tagger: 'lance', hitgroup: 'head', blind: true, noscope: true }, { attacker: B[0], victim: you, tagger: 'pulse' },
      ];
      for (const f of feed) H.bus.emit('tag:out', f);
      H.bus.emit('credits', { actor: you, delta: 300, reason: 'Tag' });
      H.bus.emit('tag:hit', { attacker: you, victim: B[0], damage: 27, hitgroup: 'chest', tagger: 'arc' });
      H.bus.emit('tag:hit', { attacker: B[0], victim: you, damage: 18, hitgroup: 'chest', tagger: 'rail' });
      H.toast?.('<b>+$300</b> Tag reward', ''); H.toast?.('Kestrel: <b>Haze out!</b>', '');
    },
    lowhp() { you.hp = 17; you.armor = 0; you.helmet = false; },
    buy() { match.phase = 'buy'; match.timeLeft = 9.4; you.credits = 3450; you.armor = 0; you.helmet = false; you.inventory = { slots: { secondary: 'pip', grip: 'tap' }, current: 'pip', utility: ['strobe'] }; Object.assign(eq, { def: DEFS.pip, mag: 13, reserve: 39 }); H.buy.open(); },
    'buy-poor': () => { st.buy(); you.credits = 900; },
    'buy-tide': () => { st.buy(); you.team = 'tide'; match.playerTeam = 'tide'; you.credits = 5200; },
    scoreboard() { H.flags.forceScore = true; },
    spectator() { you.alive = false; you.hp = 0; you.tagged = true; H.specForce = A[2]; match.phase = 'live'; },
    scope() { you.inventory.slots.primary = 'lance'; you.inventory.current = 'lance'; Object.assign(eq, { def: DEFS.lance, mag: 5, reserve: 30, scoped: true }); M.spread = 0; },
    halo() { you.inventory.slots.primary = 'halo'; you.inventory.current = 'halo'; Object.assign(eq, { def: DEFS.halo, mag: 30, reserve: 90, scoped: true }); M.spread = 0; },
    armed() { match.phase = 'armed'; match.beacon = { state: 'armed', site: 'A', pos: { x: 42, y: 0, z: -42 }, carrier: null, progress: 1, fuseLeft: 21.6 }; A[2].hasBeacon = false; match.timeLeft = 0; },
    'armed-late': () => { st.armed(); match.beacon.fuseLeft = 5.3; },
    arming() { you.hasBeacon = true; A[2].hasBeacon = false; you.pos.x = 42; you.pos.z = -42; M.fixed = true; match.beacon = { state: 'arming', site: 'A', pos: you.pos, carrier: you, progress: 0.62, fuseLeft: 35 }; },
    'arm-prompt': () => { you.hasBeacon = true; A[2].hasBeacon = false; M.fixed = true; you.pos.x = 42; you.pos.z = -42; match.beacon = { state: 'carried', site: null, pos: you.pos, carrier: you, progress: 0, fuseLeft: 35 }; },
    disarming() { you.team = 'tide'; match.playerTeam = 'tide'; you.hasKit = true; match.phase = 'armed'; M.fixed = true; you.pos.x = 41; you.pos.z = -41; match.beacon = { state: 'disarming', site: 'A', pos: { x: 42, y: 0, z: -42 }, carrier: null, progress: 0.4, fuseLeft: 17 }; match.timeLeft = 0; },
    'banner-round': () => { match.phase = 'freeze'; match.timeLeft = 5.2; H.prompts.roundIntro(match.round + 100 * Math.random() | 0 || 9); },
    'banner-win': () => H.bus.emit('round:end', { winner: 'ember', reason: 'beacon', n: 9 }),
    'banner-lose': () => H.bus.emit('round:end', { winner: 'tide', reason: 'disarmed', n: 9 }),
    'banner-mp': () => { match.scores = { ember: 7, tide: 5 }; match.round = 13; match.phase = 'freeze'; match.timeLeft = 4.1; H.prompts.roundIntro(13); },
    'banner-half': () => H.bus.emit('halftime', {}),
    'banner-end': () => H.bus.emit('match:end', { winner: 'ember' }),
    blind() { H.bus.emit('util:blind', { actor: you, amount: 1 }); },
    reload() { eq.state = 'reload'; eq.mag = 0; M.reloadT0 = H.T - 1.2; M.reloadFreeze = 1.2; },
    lowammo() { eq.mag = 5; },
    empty() { eq.mag = 0; eq.reserve = 60; },
    hit() { H.bus.emit('tag:hit', { attacker: you, victim: B[0], damage: 27, hitgroup: 'chest' }); },
    crown() { H.bus.emit('tag:hit', { attacker: you, victim: B[0], damage: 100, hitgroup: 'head' }); },
    tagout() { H.bus.emit('tag:hit', { attacker: you, victim: B[0], damage: 60, hitgroup: 'chest' }); H.bus.emit('tag:out', { attacker: you, victim: B[0], tagger: 'arc', hitgroup: 'chest' }); },
    dmg() { for (const [a, p] of [[B[0], { x: -6, z: -25 }], [B[2], { x: 14, z: 8 }], [B[3], { x: -20, z: 12 }]]) { a.pos.x = p.x; a.pos.z = p.z; H.bus.emit('tag:hit', { attacker: a, victim: you, damage: 30, hitgroup: 'chest' }); } },
    feed() { st.live(); },
    firing() { M.spread = 0.85; M.holdSpread = 0.85; },
    'cb-deut': () => { H.cbOverride = 'deut'; }, 'cb-prot': () => { H.cbOverride = 'prot'; }, 'cb-trit': () => { H.cbOverride = 'trit'; },
    'scale-big': () => { H.scaleOverride = 1.3; }, 'scale-small': () => { H.scaleOverride = 0.8; },
    pistol() { match.round = 1; match.scores = { ember: 0, tide: 0 }; match.history = []; you.credits = 800; you.armor = 0; you.helmet = false; you.inventory = { slots: { secondary: 'pip', grip: 'tap' }, current: 'pip', utility: [] }; Object.assign(eq, { def: DEFS.pip, mag: 13, reserve: 39 }); },
    tide() { you.team = 'tide'; match.playerTeam = 'tide'; you.inventory.slots.primary = 'rail'; you.inventory.current = 'rail'; Object.assign(eq, { def: DEFS.rail }); },
    util() { you.inventory.current = 'strobe'; Object.assign(eq, { def: DEFS.strobe, mag: 1, reserve: 0 }); },
    grip() { you.inventory.current = 'tap'; Object.assign(eq, { def: DEFS.tap, mag: null, reserve: null }); },
    matchend() { match.phase = 'matchEnd'; match.scores = { ember: 8, tide: 5 }; H.bus.emit('match:end', { winner: 'ember' }); },
  };

  // -------------------------------------------------- scripted demo loop (auto)
  const SCRIPT = [
    [0.6, () => H.bus.emit('tag:hit', { attacker: you, victim: B[0], damage: 27, hitgroup: 'chest' })],
    [0.9, () => H.bus.emit('tag:hit', { attacker: you, victim: B[0], damage: 27, hitgroup: 'stomach' })],
    [1.4, () => H.bus.emit('tag:hit', { attacker: you, victim: B[0], damage: 100, hitgroup: 'head' })],
    [1.5, () => { H.bus.emit('tag:out', { attacker: you, victim: B[0], tagger: 'arc', hitgroup: 'head' }); you.stats.tags++; B[0].alive = false; B[0].tagged = true; H.bus.emit('credits', { actor: you, delta: 300, reason: 'Tag' }); you.credits += 300; }],
    [2.6, () => { B[2].pos.x = -18; B[2].pos.z = 6; H.bus.emit('tag:hit', { attacker: B[2], victim: you, damage: 22, hitgroup: 'chest' }); you.hp -= 22; }],
    [3.3, () => { H.bus.emit('tag:hit', { attacker: B[3], victim: you, damage: 34, hitgroup: 'chest' }); you.hp -= 34; }],
    [4.2, () => H.bus.emit('tag:out', { attacker: A[1], victim: B[3], tagger: 'arc', hitgroup: 'chest', wallbang: true }) || (B[3].alive = false)],
    [5.0, () => { eq.state = 'reload'; M.reloadT0 = H.T; }],
    [7.5, () => { eq.state = 'idle'; eq.mag = 30; eq.reserve -= 6; }],
    [8.2, () => { M.holdSpread = 0.9; }], [10.0, () => { M.holdSpread = 0; }],
    [10.5, () => H.bus.emit('util:blind', { actor: you, amount: 0.8 })],
    [12.5, () => H.bus.emit('tag:out', { attacker: B[2], victim: A[4], tagger: 'rail', hitgroup: 'head', through: 'smoke' }) || (A[4].alive = false)],
    [14.0, () => { you.credits -= 0; H.bus.emit('credits', { actor: you, delta: 250, reason: 'Beacon armed' }); you.credits += 250; }],
  ];
  const LOOP = 16;
  let si = 0;
  M.update = function (dt) {
    if (!M.on) return;
    M.time = (M.time || 0) + dt;
    place(M.time);
    // spread: decay to base
    const base = M.holdSpread ?? 0; M.spread += (base + (M.moving ? 0.25 : 0.05) - M.spread) * Math.min(1, dt * 6) * (M.holdSpread == null ? 0 : 1);
    if (eq.state === 'reload') {
      eq.t = Math.max(0, H.T - M.reloadT0);
      if (M.reloadFreeze) { M.reloadT0 = H.T - M.reloadFreeze; eq.t = M.reloadFreeze; }
      else if (eq.t >= (eq.def.reloadTime || 2.5) && M.auto) { eq.state = 'idle'; eq.mag = eq.def.magSize; }
    }
    if (M.auto) {
      M.demoT += dt;
      while (si < SCRIPT.length && M.demoT >= SCRIPT[si][0]) SCRIPT[si++][1]();
      if (M.demoT >= LOOP) { M.demoT = 0; si = 0; for (const a of [...A, ...B]) { a.alive = true; a.tagged = false; a.hp = 100; } B[1].alive = false; B[1].tagged = true; you.hp = 96; you.armor = 62; H.bus.emit('reset'); eq.state = 'idle'; eq.mag = 30; }
      match.timeLeft = Math.max(0, match.timeLeft - dt);
      you.hp = Math.min(100, you.hp + 0);
    }
  };
  M.apply = (name) => {
    reset(); M.holdSpread = null;
    const f = st[name]; if (!f) { H.bus.emit('reset'); return false; }
    M.fixed = false; f(); place(M.time || 0); H.refreshActors?.();
    if (name === 'firing') { M.spread = 0.85; }
    return true;
  };
  M.states = Object.keys(st);
  M.startAuto = () => { reset(); M.auto = true; M.moving = true; M.demoT = 0; si = 0; M.holdSpread = 0; H.bus.emit('reset'); H.banner?.({ title: 'ROUND <em>9</em>', sub: 'Attack — arm the Beacon at A or B', color: H.pal.ember, hold: 2 }); };
  return M;
}
