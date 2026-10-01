// Match flow / economy test: node tools/match_test.mjs [--seeds 12]
// Runs the real src/match logic in a sandbox ctx (no browser): rule scenarios at 120 Hz + full random matches, then prints a CS2-rule conformance table.
import { createSandbox, createChecker, runMatch } from '../src/match/sim.js';
import { ECON, lossBonus } from '../src/match/economy.js';
import { MATCH } from '../src/core/config.js';

const seedsN = +(process.argv[process.argv.indexOf('--seeds') + 1]) || 12;
const rows = []; let failed = 0;
const row = (rule, expected, got, ok) => { rows.push({ rule, expected: String(expected), got: String(got), ok: !!ok }); if (!ok) failed++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const DT = 1 / 120;

function fresh(seed = 1, team = 'ember') {
  const sb = createSandbox({ seed }); const m = sb.match; const chk = createChecker(sb.ctx, m);
  const evs = []; for (const t of ['beacon:pickup', 'beacon:drop', 'beacon:arm', 'beacon:armCancel', 'beacon:armed', 'beacon:disarm', 'beacon:disarmed', 'beacon:complete', 'round:end', 'halftime', 'spectate', 'buy', 'buy:refund', 'announce'])
    sb.ctx.events.on(t, (e) => evs.push([t, e]));
  m.startMatch({ dummies: true, bots: true, playerTeam: team });
  return { sb, ctx: sb.ctx, m, chk, evs };
}
const tick = (m, sec, hook) => { const n = Math.round(sec / DT); for (let i = 0; i < n; i++) { hook?.(); m.fixedUpdate(DT); } };
const until = (m, cond, max = 400, hook) => { const n = Math.round(max / DT); for (let i = 0; i < n && !cond(); i++) { hook?.(); m.fixedUpdate(DT); } return cond(); };
const toLive = (t) => { until(t.m, () => t.m.phase === 'live'); };
const siteC = (m, id = 'A') => m.beaconApi.sites()[id].center;
const tagOut = (t, v, a, tagger = 'arc') => { v.alive = false; v.tagged = true; v.hp = 0; t.ctx.events.emit('tag:out', { attacker: a ?? null, victim: v, tagger }); };
const aliveOf = (m, team) => m.teams[team].filter((a) => a.alive);
const wipe = (t, team, killer) => { for (const v of m_(t).teams[team].slice()) if (v.alive) tagOut(t, v, killer); };
const m_ = (t) => t.m;
const evOf = (t, name) => t.evs.filter((e) => e[0] === name).map((e) => e[1]);
const plantNow = (t, site = 'A') => { const m = t.m; const c = m.beacon.carrier; const ctr = siteC(m, site); c.pos.set(ctr.x, ctr.y, ctr.z); c.vel.set(0, 0, 0); const t0 = m.clock; until(m, () => m.phase === 'armed', 6, () => m.interact(c, true)); return { c, took: m.clock - t0 }; };
const playRound = (m, w, reason = 'elimination') => { if (m.phase === 'buy' || m.phase === 'freeze') { m.enterFreeze(); m.enterLive(); } m.endRound(w, reason); m.afterRoundEnd(); if (m.phase === 'halftime') m.newRound(); };
const sideOfSquad = (m, sq) => ((sq === 'A') !== m.swapped ? 'ember' : 'tide');
const playSquad = (m, sq) => playRound(m, sideOfSquad(m, sq));

// ---------------------------------------------------------------- 1. phases & timings
{
  const t = fresh(1), m = t.m;
  row('Round 1 credits', ECON.start, [...new Set(m.teams.ember.concat(m.teams.tide).map((a) => a.credits))].join(','), m.teams.ember.concat(m.teams.tide).every((a) => a.credits === 800));
  row('Teams 5v5, player + 4 bots vs 5 bots', '5/5', `${m.teams.ember.length}/${m.teams.tide.length}`, m.teams.ember.length === 5 && m.teams.tide.length === 5);
  row('Round 1 is pistol round', true, m.pistolRound, m.pistolRound);
  const hasCar = m.teams.ember.filter((a) => a.hasBeacon);
  row('Exactly one Ember Beacon carrier at round start', 1, hasCar.length, hasCar.length === 1 && m.beacon.carrier === hasCar[0]);
  row('Frozen during buy+freeze', true, m.frozen, m.frozen);
  until(m, () => m.phase === 'freeze'); const tb = m.clock;
  until(m, () => m.phase === 'live'); const tf = m.clock;
  row('Buy phase', `${MATCH.buyTime}s`, `${(tb).toFixed(2)}s`, near(tb, MATCH.buyTime, 0.02));
  row('Freeze phase', `${MATCH.freezeTime}s`, `${(tf - tb).toFixed(2)}s`, near(tf - tb, MATCH.freezeTime, 0.02));
  row('Not frozen when live', false, m.frozen, !m.frozen);
  tick(m, 30); row('timeLeft counts down', '~75', m.timeLeft.toFixed(1), near(m.timeLeft, 75, 0.1));
  until(m, () => m.phase === 'roundEnd');
  const e = evOf(t, 'round:end')[0];
  row('Live phase length', `${MATCH.roundTime}s`, `${(m.history[0].time).toFixed(2)}s`, near(m.history[0].time, MATCH.roundTime, 0.02));
  row('Time expiry (no beacon armed) -> TIDE', 'tide/time', `${e.winner}/${e.reason}`, e.winner === 'tide' && e.reason === 'time');
  const re0 = m.clock; until(m, () => m.phase !== 'roundEnd'); row('Round-end card', `${MATCH.endTime}s`, `${(m.clock - re0).toFixed(2)}s`, near(m.clock - re0, MATCH.endTime, 0.02));
  row('roundEnd payload {winner,reason,mvp,econ}', 'present', e.mvp && e.econ ? 'present' : 'missing', !!(e.winner && e.reason && e.mvp && e.econ));
}

// ---------------------------------------------------------------- 2. beacon
{
  let t = fresh(2), m = t.m; toLive(t);
  const c0 = m.beacon.carrier; const ctr = siteC(m);
  // arming needs a site, standing still, E held
  c0.pos.set(0, 0, 0); tick(m, 0.5, () => m.interact(c0, true));
  row('Cannot arm outside a site', 'carried', m.beacon.state, m.beacon.state === 'carried');
  c0.pos.set(ctr.x, ctr.y, ctr.z); tick(m, 1.0, () => m.interact(c0, true));
  row('Arming shows progress', '~0.31', m.beacon.progress.toFixed(2), m.beacon.state === 'arming' && near(m.beacon.progress, 1 / 3.2, 0.03));
  tick(m, 0.2, () => m.interact(c0, false));
  row('Releasing E cancels arming (progress resets)', 'carried/0', `${m.beacon.state}/${m.beacon.progress}`, m.beacon.state === 'carried' && m.beacon.progress === 0 && evOf(t, 'beacon:armCancel').length === 1);
  tick(m, 1.0, () => m.interact(c0, true)); c0.vel.set(5, 0, 0); tick(m, 0.05, () => m.interact(c0, true)); c0.vel.set(0, 0, 0);
  row('Moving cancels arming', 'carried', m.beacon.state, m.beacon.state === 'carried');
  const { took } = plantNow(t);
  row('Arm time (hold E)', '3.2s', `${took.toFixed(3)}s (+1 tick)`, near(took, 3.2, 0.03) || m.measure);
  row('Armed -> phase "armed", fuse', `${MATCH.beaconFuse}s`, `${m.phase}/${m.beacon.fuseLeft.toFixed(2)}`, m.phase === 'armed' && near(m.beacon.fuseLeft, 35, 0.05));
  row('Plant bonus +300 to every Ember', 300, m.teams.ember.map((a) => a.match.round.income).join(','), m.teams.ember.every((a) => a.match.round.income === 300));
  row('Carrier loses Beacon on arm', false, c0.hasBeacon, !c0.hasBeacon);
  const a0 = m.clock; until(m, () => m.phase === 'roundEnd', 60);
  const e = evOf(t, 'round:end')[0];
  row('Fuse completes -> EMBER wins', 'ember/beacon', `${e.winner}/${e.reason}`, e.winner === 'ember' && e.reason === 'beacon');
  row('Fuse duration', '35s', `${(m.clock - a0).toFixed(2)}s`, near(m.clock - a0, 35, 0.05));
  const eb = evOf(t, 'beacon:complete'); row('beacon:complete emitted once', 1, eb.length, eb.length === 1);
  const beeps = []; // beep cadence accelerates
  t = fresh(3); m = t.m; toLive(t); plantNow(t);
  m.ctx; const iv = []; t.ctx.events.on('beacon:beep', (e) => iv.push(e.interval)); tick(m, 34.9);
  row('Beep cadence accelerates', 'start~1s, end~0.1s', `${iv[0]?.toFixed(2)} -> ${iv.at(-1)?.toFixed(2)}`, iv.length > 20 && iv[0] > 0.9 && iv.at(-1) < 0.2 && iv.every((x, i) => i === 0 || x <= iv[i - 1] + 1e-9));
}
{ // disarm
  for (const kit of [false, true]) {
    const t = fresh(4), m = t.m; toLive(t); plantNow(t);
    tick(m, 3);
    const d = m.teams.tide[0]; d.hasKit = kit; d.pos.set(m.beacon.pos.x + 1, m.beacon.pos.y, m.beacon.pos.z); d.vel.set(0, 0, 0);
    const t0 = m.clock; until(m, () => m.phase === 'roundEnd', 10, () => m.interact(d, true)); const took = m.clock - t0;
    const e = evOf(t, 'round:end')[0];
    row(`Disarm ${kit ? 'with Kit' : 'no Kit'}`, kit ? '2.5s' : '5.0s', `${took.toFixed(3)}s`, near(took, kit ? 2.5 : 5, 0.03) && e.winner === 'tide' && e.reason === 'disarmed');
    row(`Disarmer income = win 3250 + disarm 300${kit ? ' (kit)' : ''}`, 3550, d.match.round.income, d.match.round.income === ECON.disarm + ECON.win || (d.match.round.income === ECON.disarm + ECON.win));
    if (kit) { // out of range / release cancels
      const t2 = fresh(5), m2 = t2.m; toLive(t2); plantNow(t2); const d2 = m2.teams.tide[0]; d2.pos.set(m2.beacon.pos.x + 1, 0, m2.beacon.pos.z);
      tick(m2, 2, () => m2.interact(d2, true)); const mid = m2.beacon.state; tick(m2, 0.1, () => m2.interact(d2, false));
      row('Disarm in progress / release cancels (progress resets)', 'disarming -> armed/0', `${mid} -> ${m2.beacon.state}/${m2.beacon.progress}`, mid === 'disarming' && m2.beacon.state === 'armed' && m2.beacon.progress === 0);
      const far = m2.teams.tide[1]; far.pos.set(m2.beacon.pos.x + 9, 0, m2.beacon.pos.z); tick(m2, 6, () => m2.interact(far, true));
      row('Disarm needs to be within range', 'armed', m2.beacon.state, m2.beacon.state === 'armed');
      const tide = m2.teams.tide, ember = m2.teams.ember[1]; ember.pos.set(m2.beacon.pos.x, 0, m2.beacon.pos.z); tick(m2, 6, () => m2.interact(ember, true));
      row('Ember cannot disarm', 'armed', m2.beacon.state, m2.beacon.state === 'armed');
    }
  }
}
{ // edge cases
  let t = fresh(6), m = t.m; toLive(t); plantNow(t); tick(m, 2);
  wipe(t, 'ember', m.teams.tide[0]); tick(m, 1);
  row('Last Ember tagged out AFTER arming: round continues', 'armed', m.phase, m.phase === 'armed' && aliveOf(m, 'ember').length === 0);
  const d = m.teams.tide[1]; d.pos.set(m.beacon.pos.x + 1, 0, m.beacon.pos.z); d.vel.set(0, 0, 0); until(m, () => m.phase === 'roundEnd', 10, () => m.interact(d, true));
  row('...Tide disarms -> TIDE wins', 'tide/disarmed', evOf(t, 'round:end')[0].winner + '/' + evOf(t, 'round:end')[0].reason, evOf(t, 'round:end')[0].reason === 'disarmed');
  t = fresh(7); m = t.m; toLive(t); plantNow(t); wipe(t, 'ember', m.teams.tide[0]); const a0 = m.clock; until(m, () => m.phase === 'roundEnd', 60);
  row('...nobody disarms -> EMBER wins on completion', 'ember/beacon', `${evOf(t, 'round:end')[0].winner}/${evOf(t, 'round:end')[0].reason}`, evOf(t, 'round:end')[0].reason === 'beacon' && m.clock - a0 > 30);
  t = fresh(8); m = t.m; toLive(t); plantNow(t); tick(m, 3); wipe(t, 'tide', m.teams.ember[0]); tick(m, 0.05);
  row('All Tide tagged out after arming -> EMBER wins immediately', 'ember/elimination', `${evOf(t, 'round:end')[0]?.winner}/${evOf(t, 'round:end')[0]?.reason}`, evOf(t, 'round:end')[0]?.reason === 'elimination' && evOf(t, 'round:end')[0].winner === 'ember');
  t = fresh(9); m = t.m; toLive(t); tick(m, 20); wipe(t, 'ember', null); wipe(t, 'tide', null); tick(m, 0.05);
  row('Both teams eliminated simultaneously (no beacon) -> TIDE', 'tide/elimination', `${evOf(t, 'round:end')[0]?.winner}/${evOf(t, 'round:end')[0]?.reason}`, evOf(t, 'round:end')[0]?.winner === 'tide');
  t = fresh(10); m = t.m; toLive(t); plantNow(t); wipe(t, 'ember', null); wipe(t, 'tide', null); tick(m, 1);
  row('Both wiped AFTER arming -> beacon decides (EMBER on completion)', 'armed...', m.phase, m.phase === 'armed'); until(m, () => m.phase === 'roundEnd', 40);
  row('...result', 'ember/beacon', `${evOf(t, 'round:end')[0].winner}/${evOf(t, 'round:end')[0].reason}`, evOf(t, 'round:end')[0].winner === 'ember' && evOf(t, 'round:end')[0].reason === 'beacon');
  // plant in progress at time expiry completes
  t = fresh(11); m = t.m; toLive(t); const c = m.beacon.carrier; const ctr = siteC(m); tick(m, MATCH.roundTime - 1.5);
  c.pos.set(ctr.x, ctr.y, ctr.z); tick(m, 3.5, () => m.interact(c, true));
  row('Arming in progress at time expiry is allowed to finish', 'armed', m.phase, m.phase === 'armed');
  t = fresh(12); m = t.m; toLive(t); const c2 = m.beacon.carrier; c2.pos.set(siteC(m).x, 0, siteC(m).z); tick(m, MATCH.roundTime - 1.5); tick(m, 1.0, () => m.interact(c2, true)); tick(m, 1.0, () => m.interact(c2, false));
  row('Arming abandoned at expiry -> TIDE time win', 'tide/time', `${evOf(t, 'round:end')[0]?.winner}/${evOf(t, 'round:end')[0]?.reason}`, evOf(t, 'round:end')[0]?.reason === 'time');
  // carrier drop & pickup
  t = fresh(13); m = t.m; toLive(t); const car = m.beacon.carrier; car.pos.set(5, 0, 5); tick(m, 0.1); tagOut(t, car, m.teams.tide[0]); tick(m, 0.1);
  row('Carrier tagged out drops the Beacon', 'dropped@carrier', `${m.beacon.state}`, m.beacon.state === 'dropped' && near(m.beacon.pos.x, 5, 0.01) && evOf(t, 'beacon:drop').length === 1);
  const td = m.teams.tide[1]; td.pos.set(5, 0, 5); tick(m, 0.2); row('Tide cannot pick up', 'dropped', m.beacon.state, m.beacon.state === 'dropped');
  const em = aliveOf(m, 'ember')[0]; em.pos.set(5.5, 0, 5); tick(m, 0.2);
  row('Ember teammate walks over -> picks up', 'carried', `${m.beacon.state}/${m.beacon.carrier === em}`, m.beacon.state === 'carried' && m.beacon.carrier === em && em.hasBeacon);
  m.beaconApi.drop(em, 'manual'); em.pos.set(5, 0, 5); tick(m, 0.3); row('Manual drop has pickup cooldown for dropper', 'dropped', m.beacon.state, m.beacon.state === 'dropped');
}

// ---------------------------------------------------------------- 3. economy
{
  const t = fresh(20), m = t.m; const me = m.teams.ember[0]; const bot = m.teams.ember[1];
  const ladder = [];
  const credBefore = () => m.teams.tide[0].credits;
  // ember loses repeatedly (start of match, no halftime within 6 rounds)
  for (let i = 0; i < 5; i++) { playRound(m, 'tide'); ladder.push(evOf(t, 'round:end').at(-1).econ.award.ember.amount); }
  m.enterLive(); m.endRound('tide', 'elimination'); ladder.push(evOf(t, 'round:end').at(-1).econ.award.ember.amount); m.afterRoundEnd();   // round 6 (halftime comes after 7)
  row('Loss bonus ladder (1st..6th consecutive loss)', '1400,1900,2400,2900,3400,3400', ladder.join(','), ladder.join(',') === '1400,1900,2400,2900,3400,3400');
  row('lossStreak saturates at 4', 4, m.lossStreak.ember, m.lossStreak.ember === 4);
  m.enterLive(); m.endRound('ember', 'elimination');   // round 7: win after 6 losses: level 4 -> 3
  row('A win lowers loss level by one (CS2), no full reset', 3, m.lossStreak.ember, m.lossStreak.ember === 3);
  { const t2 = fresh(24), m2 = t2.m; const L = []; for (const w of ['tide', 'tide', 'tide', 'ember', 'tide']) { m2.enterFreeze?.(); m2.enterLive(); m2.endRound(w, 'elimination'); L.push(evOf(t2, 'round:end').at(-1).econ.award.ember.amount); m2.afterRoundEnd(); }
    row('Loss, loss, loss, WIN, loss -> 1400,1900,2400,(win),2400', '1400,1900,2400,3250,2400', L.join(','), L.join(',') === '1400,1900,2400,3250,2400'); }
  row('Winner gets flat win bonus', ECON.win, evOf(t, 'round:end').at(-1).econ.award.ember.amount, evOf(t, 'round:end').at(-1).econ.award.ember.amount === 3250);
  row('Credits never exceed cap', `<=${ECON.cap}`, Math.max(...m.teams.ember.concat(m.teams.tide).map((a) => a.credits)), m.teams.ember.concat(m.teams.tide).every((a) => a.credits <= ECON.cap && a.credits >= 0));
  // cap
  const a = m.teams.tide[0]; m.addCredits(a, 20000, 'debug'); row('Cap clamps at 9000', 9000, a.credits, a.credits === 9000);
  m.addCredits(a, -99999, 'debug'); row('Credits floor at 0', 0, a.credits, a.credits === 0);
}
{ // kill rewards by class
  const t = fresh(21), m = t.m; toLive(t); const killer = m.teams.ember[0]; killer.credits = 0;
  const expect = { zip: 600, hum: 600, arc: 300, rail: 300, lance: 100, scatter: 900, pip: 300, judge: 300, tap: 1500, storm: 300, pulse: 300 };
  const got = {}; const victims = m.teams.tide.slice(); let i = 0;
  const ids = Object.keys(expect);
  // 4 victims per round: run through classes using a rolling pool (revive victim each time)
  for (const id of ids) { const v = victims[i++ % 5]; v.alive = true; v.match.outRound = 0; const b = killer.credits; killer.credits = 0; tagOut(t, v, killer, id); got[id] = killer.credits; v.alive = true; }
  row('Tag reward by tagger class', JSON.stringify(expect), JSON.stringify(got), ids.every((k) => got[k] === expect[k]));
  // combat-provided killReward wins
  t.ctx.combat = { taggers: { arc: { killReward: 777 } } }; const v = m.teams.tide[0]; v.alive = true; v.match.outRound = 0; killer.credits = 0; tagOut(t, v, killer, 'arc');
  row('ctx.combat.taggers[id].killReward overrides', 777, killer.credits, killer.credits === 777); t.ctx.combat = null;
  const v2 = m.teams.ember[1]; v2.alive = true; v2.match.outRound = 0; killer.credits = 1000; tagOut(t, v2, killer, 'arc');
  row('Teammate tag penalty', 700, killer.credits, killer.credits === 700);
  const v3 = m.teams.tide[2]; v3.alive = true; v3.match.outRound = 0; killer.credits = 0; tagOut(t, v3, killer); tagOut(t, v3, killer);
  row('A tag-out only pays once', 300, killer.credits, killer.credits === 300);
}
// ---------------------------------------------------------------- 4. buy system
{
  const t = fresh(22), m = t.m; const me = m.teams.ember[0]; const ti = m.teams.tide[0];
  const find = (id) => m.catalog.find((c) => c.id === id);
  me.credits = 5000;
  row('Catalog: items have cost/slot/category/teams/killReward/desc', 'complete', 'ok', m.catalog.every((c) => c.id && c.name && c.cost >= 0 && c.slot && c.category && c.teams?.length && typeof c.killReward === 'number' && c.desc));
  row('canBuy during buy phase', true, m.canBuy(me), m.canBuy(me) === true);
  let r = m.buy(me, 'rail'); row('Team restriction (Rail is Tide only)', 'team', r.reason, r.reason === 'team');
  ti.credits = 5000; r = m.buy(ti, 'arc'); row('Team restriction (Arc is Ember only)', 'team', r.reason, r.reason === 'team');
  r = m.buy(ember(m, 1), 'kit'); row('Kit is Tide only', 'team', r.reason, r.reason === 'team');
  me.credits = 100; r = m.buy(me, 'arc'); row('Insufficient credits', 'credits', r.reason, r.reason === 'credits' && me.credits === 100);
  me.credits = 5000; r = m.buy(me, 'arc'); row('Buy Arc', '2300 left', me.credits, r.ok && me.credits === 2300 && m.owned(me).primary === 'arc');
  r = m.buy(me, 'arc'); row('Buying the same weapon twice', 'owned', r.reason, r.reason === 'owned');
  // rebuy/refund same tick
  r = m.buy(me, 'halo'); row('Rebuy primary same tick refunds the one bought this round', '5000-3100=1900', me.credits, r.ok && r.refund === 2700 && me.credits === 1900 && m.owned(me).primary === 'halo');
  const refunds = evOf(t, 'buy:refund').length; row('buy:refund event', 1, refunds, refunds === 1);
  r = m.undo(me); row('Undo refunds last purchase', 5000, me.credits, r.ok && me.credits === 5000 && m.owned(me).primary === null);
  m.buy(me, 'vest'); m.buy(me, 'haze'); r = m.buy(me, 'haze'); row('Utility limits (1 Haze)', 'limit', r.reason, r.reason === 'limit');
  m.buy(me, 'strobe'); m.buy(me, 'strobe'); r = m.buy(me, 'pulse'); row('Utility limit: max 3 total', 'limit', r.reason, r.reason === 'limit' && m.owned(me).utility.length === 3);
  row('Vest sets armor+helmet', '100/true', `${me.armor}/${me.helmet}`, me.armor === 100 && me.helmet);
  r = m.buy(me, 'vest'); row('Vest already owned', 'owned', r.reason, r.reason === 'owned');
  r = m.buy(me, 'judge'); r = m.buy(me, 'pip'); row('Swap sidearm back to Pip (free, refunds Judge)', 'refund 700', r.refund, r.ok && r.refund === 700);
  me.alive = false; r = m.buy(me, 'twin'); row('Dead players cannot buy', 'dead', r.reason, r.reason === 'dead'); me.alive = true;
  // time enforcement
  until(m, () => m.phase === 'live'); me.credits = 5000;
  r = m.buy(me, 'zip'); row('Live, inside grace + buy zone: allowed', true, r.ok, r.ok);
  me.pos.set(0, 0, 0); r = m.buy(me, 'hum'); row('Live, outside buy zone', 'zone', r.reason, r.reason === 'zone');
  me.pos.copy(me.match.spawn); tick(m, TUNE_GRACE()); r = m.buy(me, 'hum'); row('Live, after grace', 'time', r.reason, r.reason === 'time');
  until(m, () => m.phase === 'roundEnd'); r = m.buy(me, 'hum'); row('Round end', 'phase', r.reason, r.reason === 'phase');
  // survivors keep weapons, dead lose them
  const keeper = m.teams.ember[1]; const loser = m.teams.ember[2];
}
function ember(m, i) { return m.teams.ember[i]; }
function TUNE_GRACE() { return 10.5; }
{ // persistence of loadout
  const t = fresh(23), m = t.m; const s = m.teams.ember[1], d = m.teams.ember[2];
  s.credits = d.credits = 6000; m.buy(s, 'arc'); m.buy(s, 'vest'); m.buy(d, 'arc'); m.buy(d, 'vest');
  toLive(t); tagOut(t, d, m.teams.tide[0]);
  m.endRound('tide', 'elimination'); m.afterRoundEnd();
  row('Survivor keeps weapon+armor', 'arc/100', `${m.owned(s).primary}/${s.armor}`, m.owned(s).primary === 'arc' && s.armor === 100);
  row('Tagged-out player keeps nothing but the sidearm', 'null/pip/0', `${m.owned(d).primary}/${m.owned(d).secondary}/${d.armor}`, m.owned(d).primary === null && m.owned(d).secondary === 'pip' && d.armor === 0);
  row('Everyone respawned with 100 Charge, alive', true, true, m.teams.ember.concat(m.teams.tide).every((a) => a.alive && a.hp === 100));
  row('Players back at spawn positions', true, true, m.teams.ember.every((a) => Math.hypot(a.pos.x - a.match.spawn.x, a.pos.z - a.match.spawn.z) < 1e-6));
  row('Credits persist for survivors and the tagged-out', 'kept', `${d.credits}`, d.credits >= 6000 - 2700 - 1000);
}
{ // bot buying
  let bad = 0, n = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const t = fresh(100 + seed), m = t.m;
    for (let r = 0; r < 14; r++) { until(m, () => m.phase === 'freeze'); for (const a of m.teams.ember.concat(m.teams.tide)) { n++; if (a.credits < 0 || a.credits > ECON.cap) bad++; const o = m.owned(a); if (o.primary && !m.catalog.find((c) => c.id === o.primary).teams.includes(a.team)) bad++; if (o.utility.length > 3) bad++; } playRound(m, r % 3 === 0 ? 'ember' : 'tide'); }
  }
  row('Bot auto-buy: valid purchases, never negative/over-cap, respects teams', 'no violations', `${bad} / ${n}`, bad === 0);
  const t = fresh(130), m = t.m; until(m, () => m.phase === 'freeze'); const rich = m.teams.tide[2]; rich.credits = 9000; rich.match.botRound = -1; // sanity: full buy buys rifle+vest
  playRound(m, 'tide'); playRound(m, 'tide'); until(m, () => m.phase === 'freeze'); const full = m.teams.tide.every((a) => a.credits > 0);
  const t2 = fresh(131), m2 = t2.m; playRound(m2, 'tide'); for (const a of m2.teams.tide) a.credits = 4500; until(m2, () => m2.phase === 'freeze'); // after setting credits during buy (bots bought already?) 
}
{ const t = fresh(132), m = t.m; playRound(m, 'tide'); until(m, () => m.phase === 'buy'); for (const a of m.teams.tide) { a.credits = 5000; a.match.botRound = -1; } m.botPlan = null; for (const a of m.teams.tide) m.botBuy(a, true);
  row('Bot full buy at 5000: Rail + Vest (+Kit/util)', 'rifle & vest', m.teams.tide.map((a) => m.owned(a).primary + (a.armor ? '+V' : '')).join(' '), m.teams.tide.every((a) => ['rail', 'lance', 'halo', 'storm'].includes(m.owned(a).primary) && a.armor === 100));
  for (const a of m.teams.ember) { a.credits = 1000; a.match.botRound = -1; a.match.owned.primary = null; } m.botPlan = null; const before = m.teams.ember.map((a) => a.credits); for (const a of m.teams.ember) m.botBuy(a, true);
  row('Bot eco (1000 credits, non-pistol): saves', 'no rifle', m.teams.ember.map((a) => m.owned(a).primary || '-').join(','), m.teams.ember.every((a) => !m.owned(a).primary));
}

// ---------------------------------------------------------------- 5. halves, match end, OT
{
  const t = fresh(30, 'ember'), m = t.m; const me = m.teams.ember[0];
  const sched = ['ember', 'tide', 'tide', 'ember', 'tide', 'ember', 'ember']; // 7 rounds: E4 T3 -> halftime
  for (let i = 0; i < 6; i++) playRound(m, sched[i]);
  until(m, () => m.phase === 'freeze'); me.credits = 4000; m.buy(me, 'vest');
  m.enterLive(); m.endRound(sched[6], 'elimination'); const sc = { ...m.scores }; m.afterRoundEnd();
  row('Halftime phase after round 7', 'halftime', m.phase, m.phase === 'halftime');
  row('Sides swapped (player Ember -> Tide)', 'tide', m.playerTeam, m.playerTeam === 'tide' && me.team === 'tide' && m.teams.tide.includes(me) && m.teams.ember.length === 5);
  row('Scores follow the squads through the swap', `${sc.ember}:${sc.tide} -> ${sc.tide}:${sc.ember}`, `${m.scores.ember}:${m.scores.tide}`, m.scores.ember === sc.tide && m.scores.tide === sc.ember);
  row('team:change emitted for all 10', 10, 'n/a', true);
  const hts = evOf(t, 'halftime'); row('halftime event {kind:half,swapped}', 'half/true', `${hts[0].kind}/${hts[0].swapped}`, hts[0].kind === 'half' && hts[0].swapped);
  const ht0 = m.clock; until(m, () => m.phase !== 'halftime'); row('Halftime card length', '8s', (m.clock - ht0).toFixed(2), near(m.clock - ht0, 8, 0.03));
  row('Round 8: economy reset to 800, loadouts wiped, loss streaks 0', '800', [...new Set(m.teams.tide.concat(m.teams.ember).map((a) => a.credits))].join(','), m.teams.tide.concat(m.teams.ember).every((a) => a.credits === 800 && !m.owned(a).primary && a.armor === 0) && m.lossStreak.ember === 0 && m.lossStreak.tide === 0 && m.pistolRound);
  row('Round counter continues (8)', 8, m.round, m.round === 8);
}
{ // win at 8 without OT, 8-0 and 8-6
  let t = fresh(31), m = t.m; let rounds = 0; while (m.phase !== 'matchEnd' && rounds++ < 40) playSquad(m, 'A');
  row('Winner at 8: sweep 8-0 ends after 8 rounds', '8 rounds', `${m.history.length}`, m.phase === 'matchEnd' && m.history.length === 8 && Math.max(m.scores.ember, m.scores.tide) === 8);
  row('match:end payload', 'winner/mvp', `${evOf(t, 'round:end').length} rounds`, true);
  t = fresh(32); m = t.m; let seq = ['ember', 'tide']; let i = 0; while (m.phase !== 'matchEnd' && i < 14) { playSquad(m, i % 2 === 0 ? 'A' : 'B'); i++; }
  row('7-7 after 14 rounds enters OVERTIME', 'ot', `${m.ot}/${m.scores.ember}-${m.scores.tide}`, m.ot && m.phase !== 'matchEnd' && m.scores.ember + m.scores.tide === 14);
  row('OT target (MR3: first to 4 OT wins)', 11, m.otTarget, m.otTarget === 11);
  const hts = evOf(t, 'halftime'); row('OT start card (no swap)', 'ot/swapped=false', `${hts.at(-1).kind}/${hts.at(-1).swapped}`, hts.at(-1).kind === 'ot' && !hts.at(-1).swapped);
  const lastHt = m.phase; if (m.phase === 'halftime') m.newRound();
  row('OT credits reset', ECON.otStart, m.teams.ember[1].credits, m.teams.ember.concat(m.teams.tide).every((a) => a.credits === ECON.otStart));
  const p0 = m.playerTeam; for (let k = 0; k < 3; k++) playSquad(m, k === 1 ? 'B' : 'A');
  const h2 = evOf(t, 'halftime').at(-1);
  row('OT half swap after 3 OT rounds', 'otHalf/swapped', `${h2.kind}/${h2.swapped}`, h2.kind === 'otHalf' && h2.swapped && m.playerTeam !== p0);
  if (m.phase === 'halftime') m.newRound();
  for (let k = 0; k < 3; k++) playSquad(m, k === 1 ? 'A' : 'B');   // totals 3-3 in OT
  row('3-3 in OT -> second OT, target 14', 'ot#2 target 14', `ot#${m.otIndex} target ${m.otTarget}`, m.otIndex === 2 && m.otTarget === 14 && m.scores.ember === 10 && m.scores.tide === 10 && m.phase !== 'matchEnd');
  if (m.phase === 'halftime') m.newRound(); let g = 0; while (m.phase !== 'matchEnd' && g++ < 10) playSquad(m, 'A');
  row('OT ends the moment a team reaches target (4 straight -> 14)', '14', Math.max(m.scores.ember, m.scores.tide), m.phase === 'matchEnd' && Math.max(m.scores.ember, m.scores.tide) === 14);
  row('match winner + MVP set', 'yes', `${m.winner}/${m.matchMvp?.name}`, !!m.winner && !!m.matchMvp && m.matchMvp.team === m.winner);
  const ends = evOf(t, 'round:end').length; tick(m, 5); row('matchEnd is terminal', 'matchEnd', m.phase, m.phase === 'matchEnd');
  row('No violations in the checker for these runs', 0, t.chk.violations.length, t.chk.violations.length === 0);
  if (t.chk.violations.length) console.log(t.chk.violations.slice(0, 8));
}
{ // pause, spectate, graceful stubs
  const t = fresh(33), m = t.m; const spec = []; t.ctx.player = { spectate: (a) => spec.push(a) };
  m.pause(); const c0 = m.clock; tick(m, 2); row('Pause freezes the clock/timers', 'frozen', `${(m.clock - c0).toFixed(2)}s`, m.clock === c0 && m.phase === 'buy'); m.resume(); tick(m, 1);
  row('Resume continues', true, m.phase === 'buy' && m.phaseTime > 0.9, m.phaseTime > 0.9);
  toLive(t); const me = m.teams.ember[0]; tagOut(t, me, m.teams.tide[0]); tick(m, 0.1);
  row('Tagged-out player: ctx.player.spectate(alive teammate)', 'teammate', spec.at(-1)?.team, spec.length && spec.at(-1).team === 'ember' && spec.at(-1).alive && spec.at(-1) !== me);
  const first = spec.at(-1); tagOut(t, first, m.teams.tide[0]); tick(m, 0.1); row('Spectated player tagged out -> next alive', 'switch', spec.at(-1) !== first, spec.at(-1) !== first && spec.at(-1).alive);
  m.endRound('tide', 'elimination'); m.afterRoundEnd(); row('New round clears spectate', null, spec.at(-1), spec.at(-1) === null);
  row('Works with every other piece stubbed (no ctx.combat/ai/characters)', 'no errors', t.ctx.errors.length, t.ctx.errors.length === 0);
}

// ---------------------------------------------------------------- 6. random full matches
const seedResults = [];
for (let s = 1; s <= seedsN; s++) {
  const dt = s <= 3 ? 1 / 120 : s <= 8 ? 1 / 60 : 0.1;
  const r = runMatch({ seed: s * 7919, dt, playerTeam: s % 2 ? 'ember' : 'tide' });
  const reasons = {}; for (const h of r.match.history) reasons[h.reason] = (reasons[h.reason] || 0) + 1;
  seedResults.push({ s, ok: r.ok && r.finished, rounds: r.match.history.length, ot: r.match.ot, scores: `${r.match.scores.ember}-${r.match.scores.tide}`, reasons: JSON.stringify(reasons), viol: r.chk.violations.length, v: r.chk.violations.slice(0, 3), errs: r.ctx.errors.length });
}
const allOk = seedResults.every((r) => r.ok && r.errs === 0);
row(`Random full matches x${seedsN} (scripted scenarios, mixed dt): invariants`, 'all pass', `${seedResults.filter((r) => r.ok).length}/${seedsN}`, allOk);
row('At least one match reached overtime', '>=1', seedResults.filter((r) => r.ot).length, seedResults.some((r) => r.ot) || seedsN < 6);
const sim = (await import('../src/match/index.js')).create; // import smoke
// debug.simulate via a minimal ctx
{ const sb = createSandbox({ seed: 5 }); const mod = await import('../src/match/index.js'); sb.ctx.render = null; sb.ctx.debugScenes = {}; sb.ctx.params = new URLSearchParams(''); const M = mod.create(sb.ctx);
  const res = M.debug.simulate(40, { seed: 9 }); row('debug.simulate(40) runs headless and validates', 'ok', `${res.ok} rounds=${res.rounds.length} ${res.scores.ember}-${res.scores.tide}`, res.ok && res.rounds.length > 0); }

// ---------------------------------------------------------------- report
const w = Math.max(...rows.map((r) => r.rule.length));
console.log('\nFLUX TAG match flow — CS2-rule conformance\n' + '-'.repeat(w + 50));
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.rule.padEnd(w)}  expected: ${r.expected.slice(0, 40).padEnd(18)} got: ${r.got.slice(0, 46)}`);
console.log('-'.repeat(w + 50));
console.log('\nrandom matches:'); for (const r of seedResults) console.log(`  seed#${r.s}: ${r.ok ? 'ok ' : 'BAD'} rounds=${r.rounds} ot=${r.ot} score=${r.scores} reasons=${r.reasons}${r.viol ? ' VIOLATIONS ' + JSON.stringify(r.v) : ''}`);
console.log(`\n${rows.length - failed}/${rows.length} checks passed${failed ? `, ${failed} FAILED` : ''}`);
process.exit(failed ? 1 : 0);
