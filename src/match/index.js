// FLUX TAG — match flow & economy (piece `flow`). See docs/pieces/flow.md.
// ctx.match = { phase, round, scores, timeLeft, beacon, teams, catalog, canBuy, buy, startMatch, debug, ... }
import { createMatch, TUNE } from './flow.js';
import { createBeaconView } from './beaconView.js';
import { createLab } from './lab.js';
import { createDriver, runMatch, SCENARIOS } from './sim.js';
import { ECON } from './economy.js';
import { rng } from '../core/rng.js';

export function create(ctx) {
  const M = createMatch(ctx);
  const view = (() => { try { return ctx.render?.scene ? createBeaconView(ctx, M) : null; } catch (e) { console.error('[match] beacon view', e); (ctx.errors ||= []).push('match.beaconView: ' + e); return null; } })();
  const driver = createDriver(ctx, M, { rand: () => rng.next(), moveSpeed: 9 });
  const lab = createLab(ctx, M, driver);

  // The lab/autoplay director must tick just before the state machine so scripted holds are visible to it.
  const baseFixed = M.fixedUpdate;
  M.fixedUpdate = (dt) => { driver.step(dt); baseFixed(dt); };
  M.update = (dt) => { view?.update(dt); lab.update(dt); };
  M.dispose = () => { view?.dispose(); lab.dispose(); };

  const setCredits = (a, n) => { const before = a.credits; a.credits = Math.max(0, Math.min(ECON.cap, Math.round(n))); M.env.emit('credits', { actor: a, delta: a.credits - before, want: n - before, reason: 'debug', total: a.credits }); return a.credits; };
  const ensure = () => { if (!M.active) M.startMatch({ bots: true }); };

  M.debug = {
    driver, lab, scenarios: SCENARIOS.map((s) => s[0]),
    startMatch: (o) => M.startMatch(o),
    /** Jump the state machine. p in warmup|buy|freeze|live|armed|roundEnd|halftime|matchEnd */
    forcePhase(p) {
      if (p === 'warmup') { M.quit(); return M.phase; }
      ensure();
      const idle = () => ['roundEnd', 'halftime', 'matchEnd', 'warmup'].includes(M.phase);
      switch (p) {
        case 'buy': M.newRound(); break;
        case 'freeze': if (idle()) M.newRound(); M.enterFreeze(); break;
        case 'live': if (idle()) M.newRound(); if (M.phase !== 'live' && M.phase !== 'armed') M.enterLive(); break;
        case 'armed': if (idle()) M.newRound(); if (M.phase !== 'live' && M.phase !== 'armed') M.enterLive(); if (M.phase === 'live') M.beaconApi.forceArm('A'); break;
        case 'roundEnd': if (idle()) M.newRound(); if (M.phase !== 'live' && M.phase !== 'armed') M.enterLive(); M.endRound('tide', 'forced'); break;
        case 'halftime': M.enterHalftime('half'); break;
        case 'matchEnd': if (!M.winner) M.winner = M.scores.ember >= M.scores.tide ? 'ember' : 'tide'; M.enterMatchEnd(); break;
        default: throw new Error('unknown phase ' + p);
      }
      return M.phase;
    },
    /** End the current round for `winner` (default random) and jump through the round-end / halftime cards. */
    skipRound(winner, reason = 'forced') {
      ensure();
      if (!winner) winner = rng.next() < 0.5 ? 'ember' : 'tide';
      if (M.phase === 'buy' || M.phase === 'freeze' || M.phase === 'warmup') { if (M.phase === 'warmup') M.startMatch({ bots: true }); M.enterLive(); }
      if (M.phase === 'live' || M.phase === 'armed') M.endRound(winner, reason);
      return M.phase;
    },
    /** Skip the current banner phase (roundEnd / halftime) immediately. */
    next() { if (M.phase === 'roundEnd') M.afterRoundEnd(); else if (M.phase === 'halftime') M.newRound(); return M.phase; },
    setCredits,
    autoplay(on = true, o = {}) { driver.enabled = !!on; if (o.speed) driver.speed = o.speed; if (o.scenario !== undefined) driver.forced = o.scenario; if (on && (M.phase === 'live' || M.phase === 'armed')) driver.plan(); return driver.enabled; },
    /** Fast headless match (sandbox ctx, random scripted outcomes) validating economy / halves / overtime. Does not touch the live match. */
    simulate(nRounds = 30, o = {}) {
      const r = runMatch({ seed: o.seed ?? 1, dt: o.dt ?? 0.1, playerTeam: o.playerTeam || 'ember', forced: o.scenario || null, onStep: (m) => m.history.length >= nRounds });
      const m = r.match;
      return {
        ok: r.ok, violations: r.chk.violations, rounds: r.chk.rounds, scores: { ...m.scores }, ot: m.ot, otIndex: m.otIndex, finished: r.finished, winner: m.winner, halftimes: r.chk.halftimes.map((h) => ({ kind: h.kind, at: h.at })),
        credits: Object.fromEntries(r.ctx.actors.map((a) => [a.name, a.credits])), lossStreak: { ...m.lossStreak }, measure: Object.fromEntries(Object.entries(r.chk.measure).map(([k, v]) => [k, +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(3)])),
      };
    },
    /** Let place()/debug moves stick during buy/freeze (the spawn pin is off by default in ?test=1). */
    pin: (on) => { TUNE.hardFreeze = !!on; return TUNE.hardFreeze; },
    snapshot: () => M.snapshot(),
    text: () => lab.text(),
    beacon: { forceArm: (site) => M.beaconApi.forceArm(site) },
  };

  ctx.debugScenes['match-lab'] = async () => {
    M.startMatch({ difficulty: 'pro', playerTeam: ctx.params.get('team') || 'ember', dummies: true, bots: true });
    driver.enabled = ctx.params.get('autoplay') !== '0'; driver.speed = +ctx.params.get('speed') || 1;
    lab.start(); lab.forceRefresh();
    if (ctx.params.get('phase')) M.debug.forcePhase(ctx.params.get('phase'));
  };

  ctx.events.on('boot:done', () => {
    const p = ctx.params;
    if (p.get('scene')) return;
    if (p.get('match')) { M.startMatch({ difficulty: p.get('difficulty') || 'pro', playerTeam: p.get('team') || 'ember', dummies: p.get('dummies') === '1' }); if (p.get('phase')) M.debug.forcePhase(p.get('phase')); }
    else if (!p.get('test') && ctx.menu?.__stub) M.startMatch({ difficulty: 'pro', playerTeam: 'ember' });
  });
  return M;
}
