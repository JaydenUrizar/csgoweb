// Match flow core: state machine, teams, spawns, round reset, scoring, economy, MVP, halftime/overtime, spectating.
// Pure logic + defensive calls into other pieces (ctx.combat / ctx.ai / ctx.characters / ctx.player ...) so it runs stand-alone
// (with every other piece stubbed) and inside tools/match_test.mjs with a sandbox ctx.
import * as THREE from 'three';
import { createActor } from '../core/actor.js';
import { MATCH, TEAMS } from '../core/config.js';
import { rng as coreRng } from '../core/rng.js';
import { ECON, lossBonus, nextLossLevel, clampCredits, KILL_REWARD } from './economy.js';
import { installBuy } from './buy.js';
import { installBeacon } from './beacon.js';

export const TUNE = {
  halftime: 8,            // s, side swap / overtime card
  buyGrace: 20,           // s after go during which the buy zone stays open (CS2 mp_buytime 20)
  warmupRespawn: 2,       // s
  hardFreeze: true,       // pin actors at spawn during buy/freeze even if the movement piece ignores match.frozen
  buyZoneRadius: 16,      // m from a friendly spawn (used when the map has no explicit buy zone)
  otHalfRounds: 3,        // MR3 overtime: swap every 3 rounds
  otWins: 4,              // wins needed inside an overtime segment
  disarmRange: 2.0,       // m (horizontal) to the armed beacon
  pickupRange: 1.6,       // m to a dropped beacon
  kitDisarmTime: 2.5,
  plantSpeedMax: 1.5,     // m/s horizontal: arming/disarming needs you to stand still
  spectate: true,
};

const NAMES = ['Kestrel', 'Nova', 'Vex', 'Ryo', 'Juno', 'Cobalt', 'Mika', 'Onyx', 'Sable', 'Tempo', 'Zed', 'Ivy', 'Rook', 'Blitz', 'Halo9', 'Quill', 'Fjord', 'Lumen', 'Pixel', 'Marlo', 'Echo', 'Dax', 'Wren', 'Orbit', 'Sprig', 'Tango', 'Vesper', 'Kilo'];
const other = (t) => (t === 'ember' ? 'tide' : 'ember');
export { other };

export function freshRound() { return { tags: 0, outs: 0, assists: 0, damage: 0, income: 0, objective: 0 }; }
export function newMs() {
  return {
    owned: { primary: null, secondary: 'pip', utility: [], vest: false, kit: false },
    bought: [], useUntil: -1, round: freshRound(),
    total: { tags: 0, outs: 0, assists: 0, damage: 0, mvps: 0, plants: 0, disarms: 0, score: 0 },
    survived: true, outRound: 0, deadAt: -1, botRound: -1,
    spawn: new THREE.Vector3(), spawnYaw: 0,
  };
}

export function createMatch(ctx, o = {}) {
  // test mode: place()/debug must not be fought by the spawn pin (movement piece still sees match.frozen). ?freeze=1 forces it back on.
  TUNE.hardFreeze = !(ctx.params?.get?.('test') && ctx.params.get('freeze') !== '1');
  const R = o.random || (() => coreRng.next());
  const rint = (a, b) => Math.floor(a + R() * (b - a + 1));
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const emit = (t, d) => ctx.events.emit(t, d);
  const report = (where, e) => { const m = `match.${where}: ${e?.stack || e}`; console.error(m); (ctx.errors || (ctx.errors = [])).push(m); };
  const safe = (where, fn) => { try { return fn(); } catch (e) { report(where, e); return undefined; } };
  /** live combat piece or null when stubbed */
  const C = () => (ctx.combat && !ctx.combat.__stub ? ctx.combat : null);
  const ms = (a) => a.match || (a.match = newMs());

  const M = {
    // ---- contract (docs/ARCHITECTURE.md) ----
    phase: 'warmup', state: 'warmup', prev: null, round: 0, scores: { ember: 0, tide: 0 }, timeLeft: 0, phaseTime: 0, phaseDuration: 0,
    playerTeam: 'ember', teams: { ember: [], tide: [] }, lossStreak: { ember: 0, tide: 0 }, mvp: null, history: [],
    beacon: null, catalog: [],
    // ---- extras ----
    active: false, paused: false, frozen: false, clock: 0, lastDt: 1 / 120, difficulty: 'pro', winner: null, matchMvp: null, playerWon: null,
    ot: false, otIndex: 0, otBase: 0, otTarget: 0, otRound: 0, swapped: false, halfKind: null, pistolRound: false, needReset: true, resetCredits: ECON.start,
    next: null, buyTimeLeft: 0, lastRound: null, roundEcon: null, armedThisRound: false, roundStartClock: 0, spectating: null, bots: [],
    roundsToWin: MATCH.roundsToWin, regulationRounds: (MATCH.roundsToWin - 1) * 2,
    tune: TUNE, econ: ECON,
  };
  const env = { ctx, M, R, rint, shuffle, emit, report, safe, C, ms, TUNE };
  M.env = env;
  M.sideOf = (team) => (team === 'ember' ? 'attack' : 'defend');
  M.squadOf = (team) => (M.swapped ? (team === 'ember' ? 'B' : 'A') : (team === 'ember' ? 'A' : 'B'));
  M.other = other;

  // ------------------------------------------------------------------ credits
  function addCredits(a, want, reason) {
    if (!want) return 0;
    const before = a.credits; a.credits = clampCredits(before + want);
    const delta = a.credits - before;
    if (reason !== 'buy' && !String(reason).startsWith('buy') && !String(reason).startsWith('refund')) ms(a).round.income += delta;
    emit('credits', { actor: a, delta, want, reason, total: a.credits });
    return delta;
  }
  env.addCredits = addCredits;
  M.addCredits = addCredits;

  // ------------------------------------------------------------------ teams / actors
  function syncTeams() {
    M.teams.ember.length = 0; M.teams.tide.length = 0;
    for (const a of ctx.actors) if (TEAMS[a.team]) M.teams[a.team].push(a);
    // stable order: human first, then by id
    for (const t of ['ember', 'tide']) M.teams[t].sort((x, y) => (y.isPlayer - x.isPlayer) || (x.id - y.id));
  }
  env.syncTeams = syncTeams;
  const aliveOf = (team) => { let n = 0; for (const a of M.teams[team]) if (a.alive) n++; return n; };
  env.aliveOf = aliveOf;
  M.aliveCount = aliveOf;
  const local = () => ctx.localActor || null;

  function removeActor(a) {
    safe('ai.removeBot', () => ctx.ai?.removeBot?.(a));
    safe('characters.despawn', () => (ctx.characters?.despawn ? ctx.characters.despawn(a) : ctx.characters?.remove?.(a)));
    const i = ctx.actors.indexOf(a); if (i >= 0) ctx.actors.splice(i, 1);
  }

  function makeBot(team, name, difficulty, dummy) {
    let a = null;
    if (!dummy && ctx.ai && !ctx.ai.__stub && typeof ctx.ai.createBot === 'function') a = safe('ai.createBot', () => ctx.ai.createBot(team, name, difficulty));
    if (!a) a = createActor({ name, team, isPlayer: false });
    a.team = team; if (!a.name) a.name = name;
    if (!ctx.actors.includes(a)) ctx.actors.push(a);
    if (!a.model) safe('characters.spawn', () => ctx.characters?.spawn?.(a));
    a.match = newMs(); a.credits = ECON.start; a.hasKit = false;
    M.bots.push(a);
    return a;
  }

  // ------------------------------------------------------------------ spawns
  const FALLBACK = { ember: { z: 30, yaw: 0 }, tide: { z: -30, yaw: Math.PI } };
  function spawnList(team) {
    const src = ctx.map?.spawns?.[team]; const out = [];
    if (Array.isArray(src)) for (const s of src) {
      if (s?.pos?.isVector3) out.push({ pos: s.pos, yaw: s.yaw || 0 });
      else if (s?.isVector3) out.push({ pos: s, yaw: 0 });
      else if (s && typeof s.x === 'number') out.push({ pos: new THREE.Vector3(s.x, s.y || 0, s.z), yaw: s.yaw || 0 });
    }
    if (!out.length) {
      const f = FALLBACK[team];
      for (let i = 0; i < 5; i++) out.push({ pos: new THREE.Vector3((i - 2) * 2.2, 0, f.z), yaw: f.yaw });
    }
    return out;
  }
  function placeTeam(team) {
    const list = spawnList(team), members = M.teams[team];
    const idx = shuffle(list.map((_, i) => i));
    members.forEach((a, k) => {
      const sp = list[idx[k % list.length]], s = ms(a);
      s.spawn.copy(sp.pos); s.spawnYaw = sp.yaw;
      if (k >= list.length) { const ring = Math.floor(k / list.length); s.spawn.x += Math.cos(k * 2.4) * 1.4 * ring; s.spawn.z += Math.sin(k * 2.4) * 1.4 * ring; }
    });
  }
  const inBuyZone = (a) => {
    const z = ctx.map?.inBuyZone;
    if (typeof z === 'function') { const r = z.call(ctx.map, a.pos, a.team); if (r !== undefined) return !!r; }
    for (const s of spawnList(a.team)) { const dx = s.pos.x - a.pos.x, dz = s.pos.z - a.pos.z; if (dx * dx + dz * dz <= TUNE.buyZoneRadius * TUNE.buyZoneRadius) return true; }
    return false;
  };
  env.inBuyZone = inBuyZone; M.inBuyZone = inBuyZone;

  // ------------------------------------------------------------------ loadouts
  function wipeLoadout(a) {
    const s = ms(a);
    s.owned = { primary: null, secondary: 'pip', utility: [], vest: false, kit: false };
    a.armor = 0; a.helmet = false; a.hasKit = false; a.hasBeacon = false;
    const c = C();
    if (c) safe('combat.reset', () => {
      if (c.resetLoadout) c.resetLoadout(a, { keepWeapons: false });
      else { c.give?.(a, 'tap'); c.give?.(a, 'pip'); }
    });
  }
  env.wipeLoadout = wipeLoadout;

  /** Make our ledger match the real combat inventory (weapons can be dropped / picked up / lost outside the buy menu). */
  function syncOwned(a) {
    const c = C(); const inv = a.inventory; if (!c || !inv?.slots) return;
    const o = ms(a).owned, sl = inv.slots;
    const idOf = (w) => (typeof w === 'string' ? w : w?.id || w?.def?.id || null);
    o.primary = idOf(sl[1] ?? sl.primary);
    o.secondary = idOf(sl[2] ?? sl.secondary) || 'pip';
    if (Array.isArray(inv.utility)) o.utility = inv.utility.map(idOf).filter(Boolean);
    o.vest = a.armor > 0; o.kit = !!a.hasKit;
  }
  env.syncOwned = syncOwned;

  function resetActor(a, wipe) {
    const s = ms(a), wasAlive = a.alive;
    if (wasAlive) syncOwned(a);
    const keep = !wipe && s.survived && wasAlive;
    a.alive = true; a.tagged = false; a.hp = 100; a.vel.set(0, 0, 0); a.pitch = 0; a.onGround = true; a.crouching = false; a.lastDamagedBy = null; a.hasBeacon = false;
    if (!keep) wipeLoadout(a);
    else { const c = C(); if (c?.resetLoadout) safe('combat.reset', () => c.resetLoadout(a, { keepWeapons: true })); }
    s.lastBuy = s.bought.map((b) => b.id); s.round = freshRound(); s.bought.length = 0; s.useUntil = -1; s.outRound = 0; s.deadAt = -1; s.survived = true;
    a.pos.copy(s.spawn); a.yaw = s.spawnYaw;
    safe('characters.revive', () => { if (ctx.characters?.revive) ctx.characters.revive(a); else ctx.characters?.setVisible?.(a, true); });
    emit('actor:respawn', { actor: a });
  }

  function resetEconomy(credits) {
    for (const a of ctx.actors) if (TEAMS[a.team]) a.credits = credits;
    M.lossStreak.ember = M.lossStreak.tide = ECON.startLevel;
  }

  // ------------------------------------------------------------------ phases
  function refreshFlags() { M.state = M.phase; M.frozen = M.phase === 'buy' || M.phase === 'freeze'; }
  function setPhase(p, dur = 0) {
    const prev = M.phase; M.prev = prev; M.phase = p; M.phaseTime = 0; M.phaseDuration = dur; M.timeLeft = dur;
    refreshFlags(); emit('round:phase', { phase: p, prev });
  }
  env.setPhase = setPhase;
  const announce = (id, extra) => emit('announce', { id, ...extra });
  env.announce = announce;

  function clearWorld() {
    safe('clearWorld', () => { ctx.combat?.clearWorld?.(); ctx.combat?.utility?.clear?.(); ctx.vfx?.clear?.(); });
  }

  function newRound() {
    const n = M.history.length + 1; M.round = n;
    syncTeams();
    let wipeAll = false;
    if (M.needReset) { resetEconomy(M.resetCredits); M.pistolRound = M.resetCredits === ECON.start; wipeAll = true; M.needReset = false; }
    else M.pistolRound = false;
    clearWorld();
    placeTeam('ember'); placeTeam('tide');
    for (const a of ctx.actors) if (TEAMS[a.team]) resetActor(a, wipeAll);
    M.roundEcon = { ember: { kills: 0, plant: 0, disarm: 0, teamTag: 0 }, tide: { kills: 0, plant: 0, disarm: 0, teamTag: 0 } };
    M.mvp = null; M.armedThisRound = false; M.next = null;
    M.beaconApi.reset();
    M.beaconApi.assignCarrier();
    M.specTarget = null; setSpectate(null);
    M.botPlan = null; M.clutchDone = { ember: false, tide: false };
    M.buyApi.scheduleBots();
    emit('round:reset', { n });
    setPhase('buy', MATCH.buyTime);
    emit('round:start', { n, pistol: M.pistolRound, ot: M.ot, matchPoint: ['ember', 'tide'].filter((t) => M.scores[t] === (M.ot ? M.otTarget : M.roundsToWin) - 1), lastRoundOfHalf: !M.ot ? n === M.regulationRounds / 2 : (M.otRound + 1) % TUNE.otHalfRounds === 0, lastRound: !M.ot && n === M.regulationRounds });
    announce(M.pistolRound ? 'round_pistol' : 'round_start', { n });
    const target = M.ot ? M.otTarget : M.roundsToWin;
    const mp = ['ember', 'tide'].filter((t) => M.scores[t] === target - 1);
    const lastHalf = !M.ot ? n === M.regulationRounds / 2 : (M.otRound + 1) % TUNE.otHalfRounds === 0;
    const lastRound = !M.ot && n === M.regulationRounds;
    if (mp.length) announce('match_point', { teams: mp, both: mp.length === 2 });
    if (lastRound) announce('last_round', { n }); else if (lastHalf) announce('last_round_of_half', { n });
    M.roundInfo = { matchPoint: mp, lastRoundOfHalf: lastHalf, lastRound };
  }

  function enterFreeze() { M.buyApi.flushBots(); setPhase('freeze', MATCH.freezeTime); announce('freeze'); }
  function enterLive() { M.buyApi.flushBots(); setPhase('live', MATCH.roundTime); M.roundStartClock = M.clock; announce('round_live'); }

  // ------------------------------------------------------------------ round end
  function pickMvp(winner, reason) {
    const B = M.beacon; const cands = M.teams[winner];
    let best = null, bestScore = -1;
    for (const a of cands) {
      const r = ms(a).round;
      let sc = r.tags * 10 + r.assists * 3 + r.damage / 100 + (a.alive ? 1 : 0) + r.objective * 4;
      if (reason === 'disarmed' && B.disarmer === a) sc += 100;
      if (reason === 'beacon' && B.planter === a) sc += 100;
      sc += a.isPlayer ? 0.0001 : 0;
      if (sc > bestScore) { bestScore = sc; best = a; }
    }
    return { mvp: best, score: bestScore };
  }

  function endRound(winner, reason) {
    if (M.phase !== 'live' && M.phase !== 'armed') return false;
    const loser = other(winner);
    const n = M.round;
    // ---- economy
    const level = M.lossStreak[loser];
    const bonus = lossBonus(level);
    const rows = { ember: [], tide: [] };
    const before = new Map(ctx.actors.map((a) => [a, a.credits]));
    for (const a of M.teams[winner]) addCredits(a, ECON.win, 'win');
    let noBonus = 0;
    for (const a of M.teams[loser]) {
      if (reason === 'time' && loser === 'ember' && a.alive) { noBonus++; continue; }       // CS2: attackers who survive a time-out get nothing (saving costs money)
      addCredits(a, bonus, 'loss');
    }
    const plantLoss = loser === 'ember' && M.armedThisRound ? ECON.plantLoss : 0;
    if (plantLoss) for (const a of M.teams.ember) addCredits(a, plantLoss, 'plantloss');
    const streakBefore = { ember: M.lossStreak.ember, tide: M.lossStreak.tide };
    M.lossStreak[winner] = nextLossLevel(M.lossStreak[winner], true);
    M.lossStreak[loser] = nextLossLevel(level, false);
    // ---- MVP
    const { mvp } = pickMvp(winner, reason);
    if (mvp) { const s = ms(mvp); s.total.mvps++; }
    for (const a of ctx.actors) if (TEAMS[a.team]) { const r = ms(a).round; const s = ms(a); s.total.score += r.tags * 10 + r.assists * 3 + r.damage / 100 + r.objective * 4 + (a === mvp ? 10 : 0); s.survived = a.alive; }
    for (const t of ['ember', 'tide']) for (const a of M.teams[t]) rows[t].push({ actor: a, id: a.id, name: a.name, alive: a.alive, tags: ms(a).round.tags, income: ms(a).round.income, credits: a.credits, before: before.get(a) });
    const econ = {
      winner, loser, reason,
      award: { [winner]: { kind: 'win', amount: ECON.win }, [loser]: { kind: 'loss', amount: bonus, level } },
      lossStreak: { before: streakBefore, after: { ...M.lossStreak } },
      nextLoss: { ember: lossBonus(M.lossStreak.ember), tide: lossBonus(M.lossStreak.tide) },
      kills: { ember: M.roundEcon.ember.kills, tide: M.roundEcon.tide.kills },
      plant: { ember: M.roundEcon.ember.plant, tide: M.roundEcon.tide.plant },
      disarm: M.roundEcon.tide.disarm, teamTags: { ember: M.roundEcon.ember.teamTag, tide: M.roundEcon.tide.teamTag },
      survivorsNoBonus: noBonus, plantLoss, players: rows, resetNext: false,
    };
    // ---- score
    M.scores[winner]++;
    M.mvp = mvp;
    const entry = { n, winner, winnerSquad: M.squadOf(winner), reason, plant: M.armedThisRound, scores: { ...M.scores }, mvp: mvp?.name || null, mvpId: mvp?.id ?? null, ot: M.ot, aliveAtEnd: { ember: aliveOf('ember'), tide: aliveOf('tide') }, time: M.clock - M.roundStartClock };
    M.history.push(entry);
    // ---- what comes next
    const done = M.history.length;
    let next = 'buy', matchWinner = null;
    if (!M.ot) {
      if (M.scores[winner] >= M.roundsToWin) matchWinner = winner;
      else if (done === M.regulationRounds) { M.ot = true; M.otIndex = 1; M.otBase = M.scores.ember; M.otTarget = M.otBase + TUNE.otWins; M.otRound = 0; next = 'otStart'; }
      else if (done === M.regulationRounds / 2) next = 'half';
    } else {
      M.otRound++;
      if (M.scores[winner] >= M.otTarget) matchWinner = winner;
      else if (M.otRound % TUNE.otHalfRounds === 0) {
        next = 'otHalf';
        if (M.otRound % (TUNE.otHalfRounds * 2) === 0) { M.otIndex++; M.otBase = M.scores.ember; M.otTarget = M.otBase + TUNE.otWins; }
      }
    }
    if (matchWinner) { next = 'matchEnd'; M.winner = matchWinner; }
    M.next = next; econ.resetNext = next === 'half' || next === 'otStart' || next === 'otHalf';
    entry.econ = { award: econ.award, lossStreak: econ.lossStreak, next };
    M.lastRound = { n, winner, reason, mvp, econ, scores: { ...M.scores }, next };
    setPhase('roundEnd', MATCH.endTime);
    emit('round:end', { winner, reason, n, mvp, econ, scores: { ...M.scores }, next, ot: M.ot });
    announce(winner === 'ember' ? 'round_win_ember' : 'round_win_tide', { reason, winner });
    if (reason === 'time') announce('time_expired');
    return true;
  }
  M.endRound = endRound;

  function afterRoundEnd() {
    const nx = M.next;
    if (nx === 'matchEnd') enterMatchEnd();
    else if (nx === 'half' || nx === 'otStart' || nx === 'otHalf') enterHalftime(nx === 'half' ? 'half' : nx === 'otStart' ? 'ot' : 'otHalf');
    else newRound();
  }

  function swapSides() {
    for (const a of ctx.actors) {
      if (!TEAMS[a.team]) continue;
      const from = a.team, to = other(from); a.team = to;
      safe('characters.setTeam', () => ctx.characters?.setTeam?.(a, to));
      emit('team:change', { actor: a, from, to });
    }
    [M.scores.ember, M.scores.tide] = [M.scores.tide, M.scores.ember];
    [M.lossStreak.ember, M.lossStreak.tide] = [M.lossStreak.tide, M.lossStreak.ember];
    M.swapped = !M.swapped;
    syncTeams();
    if (local()) M.playerTeam = local().team;
  }

  function enterHalftime(kind) {
    M.halfKind = kind;
    setPhase('halftime', TUNE.halftime);
    const swap = kind !== 'ot';
    if (swap) swapSides();
    M.needReset = true; M.resetCredits = kind === 'half' ? ECON.start : ECON.otStart;
    M.beaconApi.reset(); for (const a of ctx.actors) a.hasBeacon = false;      // no stale carrier on the other side
    resetEconomy(M.resetCredits);                                               // scoreboard on the halftime card shows the fresh credits
    emit('halftime', { kind, swapped: swap, scores: { ...M.scores }, n: M.history.length, ot: M.ot, otIndex: M.otIndex, playerTeam: M.playerTeam });
    announce(kind === 'half' ? 'halftime' : 'overtime', { kind });
  }

  function enterMatchEnd() {
    setPhase('matchEnd', 0);
    const w = M.winner; let best = null, bs = -1;
    for (const a of M.teams[w] || []) { const t = ms(a).total; const sc = t.score + t.mvps * 5 + a.isPlayer * 0.001; if (sc > bs) { bs = sc; best = a; } }
    M.matchMvp = best; M.playerWon = local() ? local().team === w : null;
    emit('match:end', { winner: w, winnerSquad: M.squadOf(w), scores: { ...M.scores }, mvp: best, playerWon: M.playerWon, history: M.history, playerTeam: M.playerTeam, ot: M.ot });
    announce(M.playerWon === false ? 'match_lost' : 'match_won', { winner: w });
  }

  // ------------------------------------------------------------------ tags -> stats / rewards
  const taggerId = (t) => (typeof t === 'string' ? t : t?.id || t?.def?.id || null);
  function killReward(id) {
    const d = id && ctx.combat?.taggers?.[id];
    if (d && typeof d.killReward === 'number') return d.killReward;
    return (id && KILL_REWARD[id]) ?? KILL_REWARD.default;
  }
  M.killReward = killReward;

  function onTagOut(e) {
    const v = e?.victim; if (!v || !TEAMS[v.team]) return;
    v.alive = false; v.tagged = true; if (v.hp > 0) v.hp = 0;
    const exit = M.phase === 'roundEnd';             // "exit frag": tagged after the round was decided -> pays + stats, victim loses gear
    const playing = M.phase === 'live' || M.phase === 'armed' || exit;
    const s = ms(v);
    if (!playing) { s.deadAt = M.clock; return; }
    if (exit) { s.survived = false; syncOwned(v); }
    if (s.outRound === M.round) return;           // idempotent per round
    s.outRound = M.round; s.deadAt = M.clock; s.round.outs++; s.total.outs++;
    if (!exit) clutchCheck();
    const a = e.attacker;
    if (a && a !== v && TEAMS[a.team]) {
      const as = ms(a);
      if (a.team !== v.team) {
        as.round.tags++; as.total.tags++;
        const amt = killReward(taggerId(e.tagger));
        addCredits(a, amt, 'tag');
        M.roundEcon[a.team].kills += amt;
      } else {
        addCredits(a, ECON.teamTag, 'teamtag'); M.roundEcon[a.team].teamTag += ECON.teamTag;
      }
    }
    const as = e.assist; if (as && typeof as === 'object' && as.team && as.team !== v.team) { ms(as).round.assists++; ms(as).total.assists++; }
  }
  function onTagHit(e) {
    const a = e?.attacker, v = e?.victim; if (!a || !v || a === v || a.team === v.team || !TEAMS[a.team]) return;
    if (M.phase !== 'live' && M.phase !== 'armed' && M.phase !== 'roundEnd') return;
    const d = Math.max(0, +e.damage || 0); ms(a).round.damage += d; ms(a).total.damage += d;
  }
  ctx.events.on('tag:out', onTagOut);
  ctx.events.on('tag:hit', onTagHit);

  /** 1vX announce, once per team per round, while the round is being played. */
  function clutchCheck() {
    if (M.phase !== 'live' && M.phase !== 'armed') return;
    for (const t of ['ember', 'tide']) {
      if (M.clutchDone[t]) continue;
      const mine = M.teams[t].filter((a) => a.alive), foes = aliveOf(other(t));
      if (mine.length === 1 && foes >= 2) { M.clutchDone[t] = true; announce('clutch', { team: t, actor: mine[0], vs: foes }); }
    }
  }
  env.clutchCheck = clutchCheck;

  // ------------------------------------------------------------------ spectating
  function setSpectate(a) {
    if (M.spectating === a) return;
    M.spectating = a;
    if (TUNE.spectate) safe('player.spectate', () => ctx.player?.spectate?.(a));
    emit('spectate', { actor: a });
  }
  function nextAlive(from, dir = 1) {
    const me = local(); if (!me) return null;
    const pool = M.teams[me.team].filter((a) => a.alive && a !== me);
    if (!pool.length) return null;
    if (!from || !pool.includes(from)) return pool[0];
    return pool[(pool.indexOf(from) + (dir < 0 ? pool.length - 1 : 1)) % pool.length];
  }
  M.nextAlive = nextAlive;
  M.cycleSpectate = (dir = 1) => { const me = local(); if (me && !me.alive) setSpectate(nextAlive(M.spectating, dir)); };
  function spectateTick() {
    const me = local(); if (!me || !M.active) return;
    if (me.alive) { if (M.spectating) setSpectate(null); return; }
    if (M.phase !== 'live' && M.phase !== 'armed' && M.phase !== 'roundEnd') return;
    if (!M.spectating || !M.spectating.alive) setSpectate(nextAlive(M.spectating, 1));
  }

  // ------------------------------------------------------------------ tick
  const usePressed = (a) => { if (a === ctx.localActor && a.isPlayer && ctx.input?.down?.('use')) return true; return ms(a).useUntil > M.clock; };
  env.useHeld = usePressed;
  M.interact = (a, held = true) => { ms(a).useUntil = held ? M.clock + Math.max(0.08, M.lastDt * 2) : -1; };

  function pinFrozen() {
    if (!TUNE.hardFreeze) return;
    for (const a of ctx.actors) {
      if (!TEAMS[a.team] || !a.match) continue;
      a.vel.set(0, 0, 0); a.pos.copy(a.match.spawn);
    }
  }

  function pollDeaths() {
    for (const a of ctx.actors) {
      if (!TEAMS[a.team]) continue;
      if (!a.alive && a.match && a.match.outRound !== M.round) onTagOut({ victim: a, attacker: null });
    }
  }

  function tickWarmup(dt) {
    for (const a of ctx.actors) {
      if (!TEAMS[a.team]) continue;
      const s = ms(a);
      if (!a.alive) {
        if (s.deadAt < 0) s.deadAt = M.clock;
        if (M.clock - s.deadAt >= TUNE.warmupRespawn) {
          const l = spawnList(a.team); const sp = l[rint(0, l.length - 1)];
          a.alive = true; a.tagged = false; a.hp = 100; a.pos.copy(sp.pos); a.yaw = sp.yaw; a.vel.set(0, 0, 0); s.deadAt = -1;
          safe('characters.revive', () => ctx.characters?.revive?.(a)); emit('actor:respawn', { actor: a });
        }
      }
    }
    if (M.paused) return;
  }

  function fixedUpdate(dt) {
    if (M.paused) return;
    M.clock += dt; M.lastDt = dt;
    if (!M.active) { if (M.phase === 'warmup') tickWarmup(dt); return; }
    switch (M.phase) {
      case 'buy':
        M.phaseTime += dt; pinFrozen(); M.buyApi.tickBots();
        if (M.phaseTime >= M.phaseDuration - 1e-9) enterFreeze();
        break;
      case 'freeze':
        M.phaseTime += dt; pinFrozen(); M.buyApi.tickBots();
        if (M.phaseTime >= M.phaseDuration - 1e-9) enterLive();
        break;
      case 'live': case 'armed':
        M.phaseTime += dt; pollDeaths(); M.beaconApi.tick(dt); break;
      case 'roundEnd':
        M.phaseTime += dt; if (M.phaseTime >= M.phaseDuration - 1e-9) afterRoundEnd(); break;
      case 'halftime':
        M.phaseTime += dt; if (M.phaseTime >= M.phaseDuration - 1e-9) newRound(); break;
      default: break;
    }
    if (M.phase === 'armed') M.timeLeft = Math.max(0, M.beacon.fuseLeft); else M.timeLeft = Math.max(0, M.phaseDuration - M.phaseTime);
    M.buyTimeLeft = M.buyApi.buyTimeLeft();
    spectateTick();
  }

  // ------------------------------------------------------------------ match lifecycle
  function teardown() {
    for (const a of M.bots) removeActor(a);
    M.bots.length = 0;
  }

  function startMatch(opts = {}) {
    teardown();
    M.difficulty = opts.difficulty || 'pro';
    let team = opts.playerTeam; if (team === 'random') team = R() < 0.5 ? 'ember' : 'tide'; if (!TEAMS[team]) team = 'ember';
    let me = local();
    if (!me) {
      me = createActor({ name: 'You', team, isPlayer: true }); ctx.actors.push(me); ctx.localActor = me; M._dummyLocal = me; M._dummyLocalRef = me;
    }
    me.team = team; me.stats = { tags: 0, outs: 0, assists: 0, score: 0, damage: 0, crowns: 0 };
    if (!me.model) safe('characters.spawn', () => ctx.characters?.spawn?.(me));
    if (opts.bots !== false) {
      const names = shuffle(NAMES.slice());
      const dummy = !!opts.dummies;
      for (let i = 0; i < 4; i++) makeBot(team, names.pop(), M.difficulty, dummy);
      for (let i = 0; i < 5; i++) makeBot(other(team), names.pop(), M.difficulty, dummy);
    }
    for (const a of ctx.actors) if (TEAMS[a.team]) { a.credits = ECON.start; a.hasKit = false; a.stats = { tags: 0, outs: 0, assists: 0, score: 0, damage: 0, crowns: 0 }; a.match = newMs(); }
    M.scores.ember = M.scores.tide = 0; M.lossStreak.ember = M.lossStreak.tide = ECON.startLevel;
    M.history.length = 0; M.round = 0; M.winner = null; M.matchMvp = null; M.playerWon = null; M.mvp = null; M.lastRound = null;
    M.ot = false; M.otIndex = 0; M.otBase = 0; M.otTarget = 0; M.otRound = 0; M.swapped = false; M.halfKind = null;
    M.needReset = true; M.resetCredits = ECON.start; M.active = true; M.paused = false; M.playerTeam = team;
    syncTeams();
    emit('match:start', { difficulty: M.difficulty, playerTeam: team });
    newRound();
    return M;
  }

  function quit() {
    teardown(); M.active = false; M.winner = null; M.round = 0; M.history.length = 0; M.scores.ember = M.scores.tide = 0;
    M.lossStreak.ember = M.lossStreak.tide = ECON.startLevel; M.ot = false; M.swapped = false; M.beaconApi?.reset?.(); setSpectate(null);
    for (const a of ctx.actors) if (TEAMS[a.team]) { a.alive = true; a.hp = 100; a.credits = ECON.cap; }
    setPhase('warmup', 0); syncTeams();
  }

  M.startMatch = startMatch; M.quit = quit;
  M.pause = () => { M.paused = true; emit('match:pause', {}); };
  M.resume = () => { M.paused = false; emit('match:resume', {}); };
  M.fixedUpdate = fixedUpdate;
  M.newRound = newRound; M.enterLive = enterLive; M.enterFreeze = enterFreeze; M.enterHalftime = enterHalftime; M.enterMatchEnd = enterMatchEnd; M.afterRoundEnd = afterRoundEnd;
  M.setPhase = setPhase; M.syncTeams = syncTeams; M.removeActor = removeActor; M.spawnList = spawnList; M.pollDeaths = pollDeaths;
  env.endRound = endRound; env.enterLive = enterLive;

  // ------------------------------------------------------------------ scoreboard
  M.scoreboard = () => {
    const mk = (a) => { const s = ms(a); return { actor: a, id: a.id, name: a.name, team: a.team, isPlayer: a.isPlayer, alive: a.alive, tags: s.total.tags, outs: s.total.outs, assists: s.total.assists, damage: Math.round(s.total.damage), credits: a.credits, mvps: s.total.mvps, score: Math.round(s.total.score), hasBeacon: !!a.hasBeacon, roundTags: s.round.tags }; };
    const out = { ember: { team: 'ember', score: M.scores.ember, side: 'attack', rows: [] }, tide: { team: 'tide', score: M.scores.tide, side: 'defend', rows: [] }, round: M.round, phase: M.phase, ot: M.ot };
    for (const t of ['ember', 'tide']) { out[t].rows = M.teams[t].map(mk).sort((x, y) => y.score - x.score || y.tags - x.tags); out[t].alive = aliveOf(t); out[t].lossStreak = M.lossStreak[t]; }
    return out;
  };

  M.beaconApi = installBeacon(env);
  M.beacon = M.beaconApi.state;
  M.buyApi = installBuy(env);
  M.catalog = M.buyApi.catalog;
  M.canBuy = M.buyApi.canBuy; M.rebuy = M.buyApi.rebuy; M.quickBuy = (a) => M.buyApi.botBuy(a, true); M.buy = M.buyApi.buy; M.refund = M.buyApi.refund; M.undo = M.buyApi.undo; M.botBuy = M.buyApi.botBuy; M.dropItem = M.buyApi.drop;
  M.owned = (a) => ms(a).owned;
  refreshFlags();

  M.snapshot = () => ({
    phase: M.phase, round: M.round, timeLeft: +M.timeLeft.toFixed(2), scores: { ...M.scores }, lossStreak: { ...M.lossStreak }, playerTeam: M.playerTeam, ot: M.ot, otIndex: M.otIndex, otTarget: M.otTarget, swapped: M.swapped,
    beacon: { state: M.beacon.state, site: M.beacon.site, progress: +M.beacon.progress.toFixed(3), fuseLeft: +M.beacon.fuseLeft.toFixed(2), carrier: M.beacon.carrier?.name || null },
    alive: { ember: aliveOf('ember'), tide: aliveOf('tide') }, credits: Object.fromEntries(ctx.actors.filter((a) => TEAMS[a.team]).map((a) => [a.name, a.credits])), history: M.history.map((h) => `${h.n}:${h.winner[0]}:${h.reason}`),
  });
  return M;
}
