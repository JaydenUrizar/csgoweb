// FLUX TAG bots (piece `bots`). See docs/pieces/bots.md.
// ctx.ai = { createBot(team,name,difficulty), removeBot(actor), debug, bots, tel, ... }
// Layout: bots/config.js (difficulty knobs) · senses.js (vision/hearing/memory) · brain.js (aim, fire, movement, orders) ·
//         team.js (Ember executes / Tide holds, retakes) · throws.js (utility lineups) · debug.js (overlay, telemetry, ?scene=bot-lab).
import * as THREE from 'three';
import { createActor } from '../core/actor.js';
import { diffOf, DIFF, K } from './bots/config.js';
import { mulberry32, dist2 } from './bots/util.js';
import { createSenses } from './bots/senses.js';
import { createBrain } from './bots/brain.js';
import { createTeam } from './bots/team.js';
import { createThrows } from './bots/throws.js';
import { createDebug } from './bots/debug.js';

const NAMES = ['Nova', 'Kite', 'Rex', 'Juno', 'Orbit', 'Pixel', 'Vex', 'Mako', 'Zed', 'Lumen', 'Echo', 'Sol', 'Ping', 'Dash', 'Fizz', 'Quill', 'Rune', 'Blip', 'Cinder', 'Wisp'];

export function create(ctx) {
  const seed = +(ctx.params?.get('seed') || 1) | 0;
  const B = {
    ctx, bots: [], pathBudget: 2, now: 0, seed, rngMain: mulberry32(seed * 7919 + 17), serial: 0,
    intel: { ember: new Map(), tide: new Map() }, pending: [], enabled: true,
    tel: null,
  };
  B.lastPing = -9; B.rng = B.rngMain; B.diffTable = DIFF; B.simBudget = 1;
  const events = ctx.events;
  const offs = [];
  const on = (t, f) => offs.push(events.on(t, f));

  // ------------------------------------------------------------------------------------------------ telemetry
  B.tel = {
    rounds: [], cur: null, kills: { byWeapon: {}, byDist: { '0-8': 0, '8-20': 0, '20-40': 0, '40+': 0 }, head: 0, total: 0, wallbang: 0 }, stuckTime: 0, teleports: 0, stuckIncidents: 0, log: [], reactions: [], paths: 0, exceptions: 0, cpu: { ms: 0, ticks: 0, max: 0 },
    shots: 0, hits: 0, plants: 0, disarms: 0, wins: { ember: 0, tide: 0 }, reasons: {}, contacts: [],
    onFirstShot(ai, now) { const c = this.cur; if (c && c.firstShotT < 0) c.firstShotT = now - c.t0; },
    onStuck(ai, now) { this.stuckIncidents++; const c = this.cur; if (c) c.stuck.add(ai.actor.id); const a = ai.actor; this.log.push({ k: 'stuck', t: +(now - (c?.t0 ?? 0)).toFixed(1), n: c?.n, who: a.name, pos: a.pos.toArray().map((v) => +v.toFixed(1)), goal: ai.mv.goal.toArray().map((v) => +v.toFixed(1)), order: ai.order ? ai.order.kind + ':' + (ai.order.role || '') : '-', stage: ai.mv.stage, path: ai.mv.path ? ai.mv.pi + '/' + ai.mv.path.length : '-', area: ctx.nav?.areaAt?.(a.pos) }); },
    onContact(now, bot, m) { const c = this.cur; if (c && c.contactT < 0) { c.contactT = now - c.t0; if (bot) { const a = bot.actor, e = m.actor; this.log.push({ k: 'contact', n: c.n, t: +c.contactT.toFixed(1), who: a.name + '(' + a.team + ')', area: ctx.nav?.areaAt?.(a.pos), enemy: e.name, earea: ctx.nav?.areaAt?.(e.pos), d: +Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z).toFixed(1), order: bot.ai.order ? bot.ai.order.kind + ':' + (bot.ai.order.role || '') : '-', src: m.src }); } } },
    startRound(n, now) { this.cur = { n, t0: now, len: 0, contactT: -1, firstShotT: -1, firstTagT: -1, tags: 0, planted: false, plantT: -1, stuck: new Set(), winner: null, reason: '' }; },
    endRound(e, now) { const c = this.cur; if (!c) return; c.len = now - c.t0; c.winner = e.winner; c.reason = e.reason; this.rounds.push({ n: c.n, len: +c.len.toFixed(1), contactT: +c.contactT.toFixed(1), firstTagT: +c.firstTagT.toFixed(1), tags: c.tags, planted: c.planted, plantT: +c.plantT.toFixed(1), stuck: c.stuck.size, winner: e.winner, reason: e.reason }); this.wins[e.winner] = (this.wins[e.winner] || 0) + 1; this.reasons[e.reason] = (this.reasons[e.reason] || 0) + 1; this.cur = null; },
    reset() { this.rounds.length = 0; this.log.length = 0; this.reactions.length = 0; this.cur = null; this.kills = { byWeapon: {}, byDist: { '0-8': 0, '8-20': 0, '20-40': 0, '40+': 0 }, head: 0, total: 0, wallbang: 0 }; this.stuckTime = 0; this.teleports = 0; this.stuckIncidents = 0; this.paths = 0; this.exceptions = 0; this.cpu = { ms: 0, ticks: 0, max: 0 }; this.shots = 0; this.hits = 0; this.plants = 0; this.disarms = 0; this.wins = { ember: 0, tide: 0 }; this.reasons = {}; },
  };

  // ------------------------------------------------------------------------------------------------ team intel / callouts
  B.teamIntel = (team) => B.intel[team];
  const enemyTeam = (t) => (t === 'ember' ? 'tide' : 'ember');
  const _enemies = { ember: [], tide: [] };
  B.enemiesOf = (team) => _enemies[team];   // refreshed each tick (actors of the opposite team, any alive state)
  function refreshTeams() {
    const e = _enemies.ember, t = _enemies.tide; e.length = 0; t.length = 0;
    for (const a of ctx.actors) { if (a.team === 'ember') e.push(a); else if (a.team === 'tide') t.push(a); }
    // enemiesOf('ember') must return TIDE actors
  }
  B.enemiesOf = (team) => (team === 'ember' ? _enemies.tide : _enemies.ember);

  B.callout = (bot, kind, pos, text) => {
    const a = bot?.actor; if (!a) return;
    const area = pos ? ctx.nav?.areaAt?.(pos) : null;
    const payload = { actor: a, team: a.team, kind, text: text || kind, pos: pos ? pos.clone() : null, area, t: B.now };
    events.emit('bot:callout', payload);
    // teammates of the human see a ping marker for enemy callouts (rate limited; the enemy team's callouts stay private)
    if (pos && kind === 'enemy' && a.team === ctx.localActor?.team && !ctx.localActor?.ai && B.now - B.lastPing > 2.2) { B.lastPing = B.now; events.emit('ping', { actor: a, pos: pos.clone(), kind: 'enemy', text: area ? `${area}` : '', team: a.team }); }
  };
  B.onSpotted = (bot, m, now) => {
    const ai = bot.ai;
    if (m.called || now - ai.lastCall < 0.4) return; m.called = true; ai.lastCall = now;
    const delay = 0.3 + (1 - ai.diff.tactics) * 0.6 + B.rng() * 0.5;
    B.pending.push({ at: now + delay, team: bot.team, id: m.id, pos: m.pos.clone(), by: bot, conf: 0.85, src: 'vis', kind: 'enemy' });
  };
  B.onHeard = (bot, m, kind, now) => { /* gunfire heard: no callout, teammates hear it themselves */ };
  B.onTargetChange = (bot, from, to, now) => { if (to && !from) { B.tel.onContact(now, bot, to); bot.ai.fp.phase = 'stop'; bot.ai.fp.until = now + 0.15; bot.ai.fp.styleT = 0; } };
  function flushPending(now) {
    const p = B.pending; let w = 0;
    for (let i = 0; i < p.length; i++) {
      const it = p[i];
      if (it.at > now) { p[w++] = it; continue; }
      if (!it.by.actor.alive && now - it.at > 0) { /* dead men tell no tales, but the death callout covers it */ }
      const mp = B.intel[it.team], cur = mp.get(it.id);
      if (!cur || cur.t < it.at - 0.2) { const rec = cur || { pos: new THREE.Vector3() }; rec.pos.copy(it.pos); rec.t = it.at; rec.src = it.src; rec.by = it.by; rec.conf = it.conf; mp.set(it.id, rec); }
      B.callout(it.by, 'enemy', it.pos, 'enemy');
    }
    p.length = w;
  }
  B.enemyKnownNear = (team, pos, r, maxAge, now) => {
    for (const it of B.intel[team].values()) { if (now - it.t > maxAge) continue; if (Math.hypot(it.pos.x - pos.x, it.pos.z - pos.z) < r) return true; }
    for (const b of B.bots) { if (b.team !== team || !b.actor.alive) continue; for (const m of b.ai.mem.values()) if (m.vis && now - m.seenT < maxAge && Math.hypot(m.pos.x - pos.x, m.pos.z - pos.z) < r) return true; }
    return false;
  };
  B.visibleEnemies = (bot) => { let n = 0; for (const m of bot.ai.mem.values()) if (m.vis) n++; return n; };
  B.expectEnemy = (ai, now) => { for (const m of ai.mem.values()) if (m.actor.alive && now - m.t < 9 && m.conf > 0.4 && Math.hypot(m.pos.x - ai.actor.pos.x, m.pos.z - ai.actor.pos.z) < 40) return true; return false; };

  // cover search: cheap node-based first, nav.coverPoints as a budgeted fallback
  B.coverBudget = 0;
  B.hasCoverFor = (ai, m) => !!B.coverFor(ai, m, B.now, true);
  B.coverFor = (ai, m, now, peek) => {
    if (ai.cover && ai.cover.until > now && ai.cover.m === m.id) return ai.cover.pos;
    if (peek && ai.cover && ai.cover.m === m.id && ai.cover.until > now - 4) return ai.cover.pos;
    const a = ai.actor, list = ctx.map?.nodes?.list; let best = null, bd = 1e9;
    if (list) for (let i = 0; i < list.length; i++) {
      const n = list[i]; if (n.type !== 'cover' && n.type !== 'angle' && n.type !== 'hold' && n.type !== 'choke') continue;
      const d = Math.hypot(n.pos.x - a.pos.x, n.pos.z - a.pos.z); if (d > 16 || d >= bd || Math.abs(n.pos.y - a.pos.y) > 2) continue;
      if (Math.hypot(n.pos.x - m.pos.x, n.pos.z - m.pos.z) < d - 1 && d > 3) continue;
      if (ctx.nav.visible(m.pos, n.pos, { ignoreSmoke: true })) continue;
      bd = d; best = n.pos;
    }
    if (!best && B.coverBudget > 0) { B.coverBudget--; const cp = ctx.nav.coverPoints(a.pos, m.pos, 9, { max: 2 }); if (cp?.length) best = cp[0].pos; }
    if (best) { ai.cover = { pos: best.clone ? best.clone() : best, until: now + 2.5, m: m.id }; return ai.cover.pos; }
    return null;
  };

  // ------------------------------------------------------------------------------------------------ bot creation
  B.S = createSenses(B);
  B.brain = createBrain(B);
  B.team = createTeam(B);
  B.throws = createThrows(B);

  function newAi(actor, diff) {
    const df = diffOf(diff);
    const rng = mulberry32(seed * 1013 + actor.id * 7001 + 3);
    const ai = {
      isBot: true, actor, diff: df, rng, bot: null,
      cmd: { fire: false, aim: false, reload: false, drop: false, use: false, last: false, inspect: false, slot: 0, dir: null },
      mv: { cmd: { forward: 0, right: 0, jump: false, crouch: false, walk: false, yaw: 0, pitch: 0 }, goal: new THREE.Vector3(), has: false, r: 1, mode: 'run', path: null, pi: 0, needPath: false, nextPathAt: 0, fails: 0, arrived: false, unreachable: false,
        sx: 0, sz: 0, st: 0, stuckAcc: 0, stage: 0, unstuckUntil: 0, noSmooth: 0, unx: 0, unz: 0, unjump: false, pathT: 0 },
      steer: { x: 0, z: 0, mag: 0, jump: false },
      aim: { yaw: actor.yaw, pitch: 0, yv: 0, pv: 0, nx: 0, ny: 0, lookOmega: 8 + df.omega * 0.12, it: { kind: 0, m: null, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fast: false }, acqT: -9, acqSet: true, exactYaw: 0, exactPitch: 0, dist: 20, hy: 1.5, errM: 0 },
      fp: { style: 'strafe', styleT: 0, phase: 'stop', until: 0, dir: 1, burstLeft: 0, burstN: 0, shots0: 0, burstStart: 0, nextBurstAt: 0, wantStop: false, scopeAt: 0, crouch: false, flipT: 0, shootStart: 0 },
      wi: { def: null, klass: 'none', mag: 0, reserve: 0, max: 1, scoped: false, reloading: false, ready: false, id: '' },
      mem: new Map(), target: null, lastTarget: null, order: null, role: '', blind: 0, heard: null,
      lookAhead: new THREE.Vector3(), hasLookAhead: false, lookAt: null, coverPos: null, cover: null,
      thinkAt: -1, nextThink: (actor.id % 8) / 8 / K.thinkHz, thinkDt: 1 / K.thinkHz, visAt: 0, slotCool: 0, lastThreatT: -9, lastCall: -9, lastHeardCall: -9, holdT: 0, holdCrouch: false, jigT: 0, jig: null, crouchWant: false, syncT: 0,
      stuckTotal: 0, stuckNow: false, stuckFlag: false, teleports: 0, planting: false, defusing: false, pistolSwap: 0, shotSeen: false, util: null, kills: 0, deaths: 0,
      aimHead: undefined, aimHeadT: -9, pickup: null, pickupT: 0, utilReactAt: 0, slot: B.serial % 7,
    };
    return ai;
  }

  function createBot(team, name, difficulty = 'pro') {
    const nm = name || NAMES[B.serial % NAMES.length];
    const actor = createActor({ name: nm, team, isPlayer: false });
    const ai = newAi(actor, difficulty);
    actor.ai = ai;
    const bot = { actor, ai, id: actor.id, get team() { return actor.team; } };
    ai.bot = bot; ai.util = B.throws.newState();
    B.serial++;
    B.bots.push(bot);
    ctx.player?.simulate && ctx.player.simulate(actor, null, 0);   // allocate actor.move
    return actor;
  }
  function removeBot(actor) {
    const i = B.bots.findIndex((b) => b.actor === actor); if (i >= 0) B.bots.splice(i, 1);
    actor.ai = null;
  }
  function resetBot(b) {
    const ai = b.ai, a = b.actor;
    ai.mem.clear(); ai.target = null; ai.lastTarget = null; ai.order = null; ai.role = ''; ai.heard = null; ai.mv.has = false; ai.mv.path = null; ai.mv.arrived = false; ai.mv.stage = 0; ai.mv.unstuckUntil = 0; ai.mv.stuckAcc = 0;
    ai.lookAt = null; ai.cover = null; ai.jig = null; ai.fp.burstLeft = 0; ai.fp.nextBurstAt = 0; ai.fp.style = 'strafe'; ai.fp.styleT = 0; ai.aim.yaw = a.yaw; ai.aim.pitch = 0; ai.aim.yv = ai.aim.pv = 0; ai.aim.it.kind = 0;
    ai.stuckFlag = false; ai.stuckNow = false; ai.pickup = null; ai.pistolSwap = 0; ai.shotSeen = false; ai.planting = false; ai.blind = 0; ai.nextThink = B.now + ai.thinkDt * ((a.id % 8) / 8); ai.lastThreatT = -9; ai.visAt = B.now + ai.rng() * 0.1; ai.seq = null;
    B.throws.reset(ai); a.blind = null;
    ai.mv.sx = a.pos.x; ai.mv.sz = a.pos.z;
  }

  // ------------------------------------------------------------------------------------------------ hearing
  const nvis = (a, p) => ctx.nav?.visible?.(a, p, { eyeA: 1.2, eyeB: 1.2, ignoreSmoke: true });
  function broadcast(src, pos, range, kind) {
    const now = B.now;
    for (let i = 0; i < B.bots.length; i++) {
      const b = B.bots[i], a = b.actor; if (!a.alive || a.team === src.team || a === src) continue;
      const r = range * b.ai.diff.hear, dx = pos.x - a.pos.x, dz = pos.z - a.pos.z, dy = pos.y - a.pos.y;
      const d = Math.hypot(dx, dz) + Math.abs(dy) * 1.5; if (d > r) continue;
      if (d > 5 && !nvis(a.pos, pos) && d > r * 0.5) continue;
      B.S.hear(b, pos, src, kind, now);
    }
  }
  on('footstep', (e) => { const a = e.actor; if (!a || !a.alive || e.walk || e.crouch) return; if ((e.speed || 0) < 3) return; broadcast(a, e.pos, K.hearRun * Math.min(1.3, e.speed / 7), 'step'); });
  on('land', (e) => { const a = e.actor; if (a && (e.speed || 0) > 6) broadcast(a, a.pos, K.hearLand, 'step'); });
  on('weapon:fire', (e) => {
    const a = e.actor; if (!a) return; B.tel.shots++;
    const id = e.tagger; const range = id === 'lance' ? K.hearSnipe : id === 'tap' ? 8 : K.hearShot;
    broadcast(a, e.origin || a.pos, range, 'shot');
  });
  on('weapon:reload', (e) => { if (e.stage === 'start' && e.actor) broadcast(e.actor, e.actor.pos, K.hearReload, 'step'); });
  on('beacon:arm', (e) => { if (e.actor) broadcast(e.actor, e.actor.pos, K.hearPlant, 'shot'); });
  on('beacon:disarm', (e) => { if (e.actor) broadcast(e.actor, e.actor.pos, K.hearPlant, 'shot'); });
  on('tag:hit', (e) => {
    const v = e.victim, at = e.attacker; B.tel.hits++;
    if (!v || !at) return;
    const c = B.tel.cur; if (c && c.firstTagT < 0) { c.firstTagT = B.now - c.t0; B.tel.log.push({ k: 'firstHit', n: c.n, t: +c.firstTagT.toFixed(1), at: at.name + '(' + at.team + ')@' + ctx.nav?.areaAt?.(at.pos), v: v.name + '@' + ctx.nav?.areaAt?.(v.pos), d: +Math.hypot(at.pos.x - v.pos.x, at.pos.z - v.pos.z).toFixed(1), w: e.tagger, hg: e.hitgroup, ord: at.ai?.order ? at.ai.order.kind + ':' + (at.ai.order.role || '') : '-' }); }
    if (v.ai && v.alive !== false) {
      const b = v.ai.bot, m = B.S.memOf(b, at); m.hitT = B.now;
      if (!m.vis) { m.pos.copy(at.pos); m.t = m.heardT = B.now; m.conf = 0.9; m.src = 'hit'; v.ai.heard = { t: B.now, x: at.pos.x, y: at.pos.y, z: at.pos.z, kind: 'hit', id: at.id }; }
      v.ai.hurtT = B.now;
    }
    // teammates of the victim hear the shots, noted via weapon:fire
  });
  on('tag:out', (e) => {
    const v = e.victim, at = e.attacker; if (!v) return;
    const c = B.tel.cur, K_ = B.tel.kills;
    if (c) c.tags++;
    K_.total++; K_.byWeapon[e.tagger] = (K_.byWeapon[e.tagger] || 0) + 1; if (e.headshot || e.hitgroup === 'head' || e.hitgroup === 'crown') K_.head++; if (e.wallbang) K_.wallbang++;
    if (at && at.pos) { const d = Math.hypot(at.pos.x - v.pos.x, at.pos.z - v.pos.z); K_.byDist[d < 8 ? '0-8' : d < 20 ? '8-20' : d < 40 ? '20-40' : '40+']++; }
    if (v.ai) v.ai.deaths++; if (at?.ai) at.ai.kills++;
    // the victim's team learns where the killer was
    if (at && v.team !== at.team && at.alive) B.pending.push({ at: B.now + 0.5, team: v.team, id: at.id, pos: at.pos.clone(), by: v.ai?.bot || B.bots.find((b) => b.team === v.team) || { actor: v, ai: { diff: { tactics: 0.5 } } }, conf: 0.7, src: 'death', kind: 'enemy' });
    ctx.nav?.danger?.add?.(v.pos, 2.5, 6, v.team);
  });
  on('round:phase', (e) => { if (e.phase === 'live') { B.tel.startRound(ctx.match?.round ?? 0, B.now); } });
  on('round:reset', () => { B.intel.ember.clear(); B.intel.tide.clear(); B.pending.length = 0; B.team.onRound(); for (const b of B.bots) resetBot(b); });
  on('round:end', (e) => {
    if (e.reason === 'time' || e.reason === 'disarmed') B.tel.log.push({ k: 'end-' + e.reason, n: B.tel.cur?.n, t: +(B.now - (B.tel.cur?.t0 ?? 0)).toFixed(0), goAt: B.T?.ember ? +(B.T.ember.goAt - B.T.ember.liveStart).toFixed(0) : 0, go: B.T?.ember?.go, entryGo: B.T?.ember?.entryGo, style: B.T?.ember?.style, site: B.T?.ember?.site, bots: B.bots.map((b) => `${b.actor.name}/${b.team[0]}${b.actor.alive ? '' : ' xx'} ${ctx.nav?.areaAt?.(b.actor.pos) || ''} ${b.ai.order ? b.ai.order.kind + ':' + (b.ai.order.role || '') + (b.ai.order.waiting ? '(w)' : '') : '-'} u${b.ai.util?.orders?.length || 0}`) });
    B.tel.endRound(e, B.now);
  });
  on('actor:respawn', (e) => { const b = B.bots.find((x) => x.actor === e.actor); if (b) resetBot(b); });
  on('team:change', () => { B.intel.ember.clear(); B.intel.tide.clear(); });
  on('beacon:armed', () => { const c = B.tel.cur; if (c) { c.planted = true; c.plantT = B.now - c.t0; } B.tel.plants++; });
  on('beacon:disarmed', () => { B.tel.disarms++; });

  // ------------------------------------------------------------------------------------------------ loop
  const cpuT = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let acc = 0;
  function fixedUpdate(dt) {
    if (!B.enabled) return;
    const t0 = cpuT();
    B.now = ctx.engine?.time ?? (B.now + dt);
    B.pathBudget = 2; B.coverBudget = 1; B.simBudget = 1;
    refreshTeams();
    const m = ctx.match;
    const phase = m?.phase;
    const play = !m || phase === 'live' || phase === 'armed' || phase === 'warmup';
    try {
      flushPending(B.now);
      if (((B.tickN = (B.tickN || 0) + 1) & 15) === 0) B.team.update(B.now);
      for (let i = 0; i < B.bots.length; i++) {
        const b = B.bots[i], a = b.actor;
        if (!a.alive || a.tagged) { b.ai.cmd.fire = b.ai.cmd.aim = false; continue; }
        if (!play && phase !== 'buy' && phase !== 'freeze') { /* round end: stand still */ stand(b, dt); continue; }
        try { B.brain.act(b.ai, B.now, dt); } catch (e) { B.tel.exceptions++; if (B.tel.exceptions < 6) { console.error('[bots]', e); (ctx.errors ||= []).push('bots: ' + (e?.stack || e)); } try { B.throws.reset(b.ai); b.ai.util.cooldown = B.now + 2; } catch { /* ignore */ } }
      }
    } catch (e) {
      B.tel.exceptions++; if (B.tel.exceptions < 6) { console.error('[bots]', e); (ctx.errors ||= []).push('bots: ' + (e?.stack || e)); }
    }
    const el = cpuT() - t0; const c = B.tel.cpu; c.ms += el; c.ticks++; if (el > c.max) c.max = el;
    B.dbg?.fixed?.(dt);
  }
  function stand(b, dt) {
    const a = b.actor, mvc = b.ai.mv.cmd; b.ai.cmd.fire = false; b.ai.cmd.aim = false;
    mvc.forward = mvc.right = 0; mvc.jump = false; mvc.crouch = false; mvc.walk = false; mvc.yaw = b.ai.aim.yaw; mvc.pitch = b.ai.aim.pitch;
    ctx.player.simulate(a, mvc, dt);
  }

  const api = {
    createBot, removeBot, bots: B.bots, B, tel: B.tel, get enabled() { return B.enabled; }, set enabled(v) { B.enabled = !!v; },
    fixedUpdate, update(dt) { B.dbg?.update?.(dt); },
    dispose() { for (const f of offs) f?.(); B.dbg?.dispose?.(); },
    diffs: ['rookie', 'pro', 'elite'],
    /** resets every bot's perception/orders (e.g. after teleporting actors in a test) */
    reset() { for (const b of B.bots) resetBot(b); B.intel.ember.clear(); B.intel.tide.clear(); },
  };
  B.dbg = createDebug(B, api);
  api.debug = B.dbg.api;
  return api;
}
