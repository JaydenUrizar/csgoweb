// FLUX TAG playthrough: boots the REAL game (menu -> Play Match), plays rounds with an input-injecting autopilot
// (nav pathing, aiming via mouse deltas, firing, planting/disarming the Beacon, buying), forces the rest of the match
// (halftime / match end), then returns to the menu, and prints a health report. Exit code 1 if anything is unhealthy.
//
//   node tools/playthrough.mjs                 # ~3-6 min: UI tour + 2 live rounds + forced halftime + match end + menu
//   node tools/playthrough.mjs --quick         # test=1&match=1&phase=live shortcut, 1 round (about 1 min)
//   node tools/playthrough.mjs --rounds 4      # number of rounds the autopilot really plays before forcing the rest
//   node tools/playthrough.mjs --full          # play the whole match with the autopilot (slow: 10+ min)
//   node tools/playthrough.mjs --team ember|tide --size 960x540 --shots shots/playthrough --seed 3 --noshots
// Output: shots/playthrough/*.png (key frames, LOOK at them), JSON summary on the last line, "HEALTH: OK|FAIL".
import { open } from './lib.mjs';
import fs from 'node:fs';

const A = process.argv.slice(2);
const flag = (n) => A.includes('--' + n);
const opt = (n, d) => { const i = A.indexOf('--' + n); return i >= 0 && A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : d; };
const QUICK = flag('quick'), FULL = flag('full'), NOSHOTS = flag('noshots');
const ROUNDS = +opt('rounds', QUICK ? 1 : 2), SEED = opt('seed', '1'), TEAM = opt('team', 'ember');
const [W, H] = opt('size', '960x540').split('x').map(Number);
const OUT = opt('shots', 'shots/playthrough'); fs.mkdirSync(OUT, { recursive: true });
const t00 = Date.now(); const T = () => ((Date.now() - t00) / 1000).toFixed(0).padStart(4) + 's';
const say = (...a) => console.log(T(), ...a);
const issues = []; const flagIssue = (s) => { if (!issues.includes(s)) { issues.push(s); say('ISSUE:', s); } };

const g = await open(QUICK
  ? { params: `test=1&seed=${SEED}&match=1&phase=live&team=${TEAM}`, size: [W, H], wait: 180000 }
  : { params: `seed=${SEED}`, size: [W, H], wait: 180000 });
const shot = async (name) => { if (NOSHOTS) return; await g.advance(0.02); await ev(() => window.__game.render()); await g.page.screenshot({ path: `${OUT}/${name}.png` }); };
const adv = (s) => g.advance(s, { render: false });   // software-GL render is ~0.8 s/frame: only render for screenshots
const ev = (fn, a) => g.eval(fn, a);
const key = async (k, hold = 0.06) => { await g.page.keyboard.down(k); await adv(hold); await g.page.keyboard.up(k); await adv(0.1); };
const phases = []; const report = { perf: {}, checks: [] };
const check = (name, ok, info = '') => { report.checks.push({ name, ok: !!ok, info }); if (!ok) flagIssue(`check failed: ${name} ${info}`); };

// ---------------------------------------------------------------------------------------------------------------
// in-page instrumentation + autopilot
await ev(() => {
  const c = window.__game.ctx; if (c.__pt) return;
  const R = c.__pt = { counts: {}, log: [], phases: [], tagsByMe: 0, tagsOnMe: 0, plants: 0, disarms: 0, completes: 0, roundEnds: [], buys: 0, util: 0, hud: [], mTags: 0, mOuts: 0, maxCalls: 0, maxTris: 0, advMs: [], settleErr: [] };
  const orig = c.events.emit;
  c.events.emit = function (t, d) {
    R.counts[t] = (R.counts[t] || 0) + 1;
    if (t === 'round:phase') R.phases.push([+c.engine.time.toFixed(1), d.phase, c.match.round]);
    if (t === 'match:start') { R.mTags = 0; R.mOuts = 0; }
    if (t === 'tag:out') { R.mOuts++; if (d.attacker && d.attacker !== d.victim && d.attacker.team !== d.victim.team) R.mTags++; }
    if (t === 'tag:out') { if (d.attacker === c.localActor) R.tagsByMe++; if (d.victim === c.localActor) R.tagsOnMe++; }
    if (t === 'beacon:armed') R.plants++; if (t === 'beacon:disarmed') R.disarms++; if (t === 'beacon:complete') R.completes++;
    if (t === 'round:end') R.roundEnds.push({ n: d.n, winner: d.winner, reason: d.reason, scores: { ...d.scores } });
    if (t === 'buy') R.buys++; if (t === 'util:throw') R.util++;
    return orig.call(this, t, d);
  };
  R.audio = {}; try { const op = c.audio.play; c.audio.play = function (n, o) { R.audio[n] = (R.audio[n] || 0) + 1; return op.call(this, n, o); }; const oa = c.audio.announce; c.audio.announce = function (id, o) { R.audio['ANN:' + id] = (R.audio['ANN:' + id] || 0) + 1; return oa.call(this, id, o); }; } catch (e) { R.audioErr = String(e); }
  const P = { on: true, goalKind: '', path: null, pathT: -9, pi: 0, stuckT: 0, lastPos: null, yawErrMax: 0, lookDx: 0, shots: 0, throwT: 0, reloadT: 0, strafeT: 0, strafeDir: 1, plantTries: 0 };
  R.pilot = P;
  const sys = {
    fixedUpdate(dt) {
      const m = c.match, a = c.localActor, inp = c.input; if (!P.on || !a || !m || c.engine.paused) return;
      const act = {}; let mdx = 0, mdy = 0;
      const set = (k, v) => { act[k] = v; };
      for (const k of ['forward', 'back', 'left', 'right', 'jump', 'crouch', 'fire', 'use', 'reload', 'aim']) act[k] = false;
      const live = m.phase === 'live' || m.phase === 'armed';
      if (!a.alive || !live) { inp.inject(act); return; }
      const T = c.engine.time;
      const e = c.combat.equipped(a);
      // --- pick target
      let tgt = null, best = 1e9; const eye = a.eyePos ? a.eyePos() : a.pos;
      for (const o of c.actors) { if (o === a || o.team === a.team || !o.alive) continue; const d = o.pos.distanceTo(a.pos); if (d < best && d < 70 && (c.nav?.visible?.(a, o) ?? true)) { best = d; tgt = o; } }
      const yawTo = (x, z) => Math.atan2(-(x - a.pos.x), -(z - a.pos.z));
      const wrap = (x) => { while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; };
      const k = 0.022 * Math.PI / 180 * (c.settings.get('sensitivity') ?? 1) * (c.combat?.sensScale?.(a) ?? 1);
      const turn = (dyaw, dp) => { mdx = -dyaw / k; mdy = -dp / k; };
      let moveFwd = true;
      if (tgt) {
        const tp = tgt.pos, aim = { x: tp.x, y: tp.y + 1.35, z: tp.z };
        const ey = a.pos.y + a.eyeHeight; const dx = aim.x - a.pos.x, dz = aim.z - a.pos.z, dh = Math.hypot(dx, dz);
        const wantYaw = yawTo(aim.x, aim.z), wantPitch = Math.atan2(aim.y - ey, dh);
        const ey2 = wrap(wantYaw - a.yaw), ep = wantPitch - a.pitch; P.yawErrMax = Math.max(P.yawErrMax, Math.abs(ey2));
        const f = 0.6; turn(ey2 * f, ep * f);
        const aligned = Math.abs(ey2) < 0.05 && Math.abs(ep) < 0.06;
        if (aligned) { set('fire', true); P.shots++; }
        if (e && e.def && (e.def.id === 'lance' || e.def.id === 'halo') && dh > 25) set('aim', true);
        // counter-strafe / strafe while shooting
        P.strafeT -= dt; if (P.strafeT <= 0) { P.strafeT = 0.35 + Math.random() * 0.4; P.strafeDir = Math.random() < 0.5 ? -1 : 1; }
        set(P.strafeDir > 0 ? 'right' : 'left', best > 8); moveFwd = best > 18;
        P.goalKind = 'fight';
      }
      if (e && e.mag === 0 && e.state !== 'reload') { if (!tgt || e.mag === 0) set('reload', T - P.reloadT > 0.5); P.reloadT = T; }
      // --- objective
      if (!tgt || best > 10) {
        const sites = c.map.sites; const B = m.beacon;
        let goal = null; P.goalKind = 'roam';
        const siteA = sites.A.center, siteB = sites.B.center;
        if (a.team === 'ember') {
          if (a.hasBeacon || B.carrier === a) { const s = P.site === 'B' ? siteB : siteA; goal = s; P.goalKind = 'plant'; }
          else if (B.state === 'dropped') { goal = B.pos; P.goalKind = 'pickup'; }
          else { goal = (B.state === 'armed' ? B.pos : (B.carrier?.pos || siteA)); P.goalKind = 'escort'; }
        } else {
          if (B.state === 'armed' || B.state === 'disarming') { goal = B.pos; P.goalKind = 'disarm'; }
          else { goal = (Math.floor(T / 25) % 2 ? siteB : siteA); P.goalKind = 'guard'; }
        }
        if (goal) {
          const dxz = Math.hypot(goal.x - a.pos.x, goal.z - a.pos.z);
          const close = P.goalKind === 'plant' ? 1.2 : P.goalKind === 'disarm' ? 0.9 : 3;
          if (dxz < close && (P.goalKind === 'plant' || P.goalKind === 'disarm')) { set('use', true); moveFwd = false; if (P.goalKind === 'plant') P.plantTries++; }
          else if (dxz < close) moveFwd = false;
          else {
            if (T - P.pathT > 0.5 || !P.path) { P.path = c.nav.path(a.pos, goal) || [goal]; P.pathT = T; P.pi = 0; }
            while (P.pi < P.path.length - 1 && Math.hypot(P.path[P.pi].x - a.pos.x, P.path[P.pi].z - a.pos.z) < 0.9) P.pi++;
            const wp = P.path[P.pi]; const wy = yawTo(wp.x, wp.z); const er = wrap(wy - a.yaw);
            if (!tgt) turn(er * 0.5, -a.pitch * 0.3);
            moveFwd = Math.abs(er) < 1.2;
            if (!tgt && a.pos.y + 0.3 < wp.y && a.onGround) set('jump', true);
          }
        } else moveFwd = false;
        // no target: look down a bit for natural pitch
      }
      set('forward', moveFwd);
      // stuck detection
      const sp = Math.hypot(a.vel.x, a.vel.z);
      if (moveFwd && sp < 1) P.stuckT += dt; else P.stuckT = 0;
      if (P.stuckT > 0.4) { set('jump', true); if (P.stuckT > 1.2) { P.path = null; if (P.stuckT > 2) { set('left', true); } } }
      inp.inject(act, { dx: mdx, dy: mdy });
      // utility: throw one at 12 s into the round if we own some
      if (!tgt && m.phase === 'live' && c.combat.utility?.count) {
        for (const u of ['haze', 'strobe', 'pulse']) if (c.combat.utility.count(a, u) > 0 && T - P.throwT > 20 && m.timeLeft < 90) { P.throwT = T; R.wantThrow = u; break; }
      }
    },
  };
  c.engine.add(sys, 7.5);
  // HUD <-> state consistency sampler (call from the harness)
  R.hudSample = () => {
    const q = (s) => document.querySelector(s)?.textContent?.trim();
    const a = c.localActor, m = c.match, e = c.combat.equipped(a);
    return { money: q('.money .amt'), cr: a.credits, hp: q('.blk.hp .num'), hpA: Math.ceil(a.hp), armor: q('.blk.ar .num'), arA: Math.round(a.armor || 0), mag: q('.ammo .mag'), magA: e?.mag, res: q('.ammo .res'), resA: e?.reserve, scL: q('.top .sc b:first-child'), scR: q('.top .sc b:last-child'), sc: { ...m.scores }, alive: a.alive, spectating: !!c.match.spectating, team: a.team, time: q('.top .time span'), tl: m.timeLeft, phase: m.phase, weapon: e?.def?.id, wn: q('.ammo .wn'), util: !!document.querySelector('.ammo.util') };
  };
}).catch((e) => flagIssue('instrument failed ' + e));

const state = () => ev(() => { const c = window.__game.ctx, m = c.match, a = c.localActor; const e = c.combat?.equipped?.(a); return { phase: m.phase, round: m.round, tl: +(m.timeLeft ?? 0).toFixed(1), scores: { ...m.scores }, team: a.team, alive: a.alive, hp: Math.round(a.hp), cr: a.credits, wp: e?.def?.id, mag: e?.mag, beacon: m.beacon?.state, mode: c.player?.mode, menu: c.menu?.state, actors: c.actors.length, aliveE: c.actors.filter((o) => o.alive && o.team === 'ember').length, aliveT: c.actors.filter((o) => o.alive && o.team === 'tide').length }; });
const perfNow = () => ev(() => { window.__game.render(); const i = window.__game.ctx.render.info(); return { calls: i.calls, tris: i.triangles, geoms: i.geometries, tex: i.textures }; });
const notePerf = async () => { const p = await perfNow(); report.perf.maxCalls = Math.max(report.perf.maxCalls || 0, p.calls); report.perf.maxTris = Math.max(report.perf.maxTris || 0, p.tris); report.perf.last = p; };
let hudMismatch = 0;
const hudDiff = (s) => {
  const bad = [];
  if (!s.alive || s.spectating) return bad;   // HUD shows the spectated player's numbers while dead
  if (+s.hp !== s.hpA) bad.push(`hp ${s.hp}/${s.hpA}`);
  if (s.mag !== undefined && s.magA !== undefined && !s.util && +s.mag !== s.magA) bad.push(`mag ${s.mag}/${s.magA}`);
  if (!s.util && s.resA !== undefined && s.res !== undefined && +s.res !== s.resA && s.res !== '') bad.push(`res ${s.res}/${s.resA}`);
  if (s.money && +s.money.replace(/[^\d]/g, '') !== s.cr && s.phase !== 'warmup') bad.push(`money ${s.money}/${s.cr}`);
  const hudL = +s.scL, hudR = +s.scR; const mine = s.sc[s.team], theirs = s.sc[s.team === 'ember' ? 'tide' : 'ember'];
  if (!Number.isNaN(hudL) && (hudL !== mine || hudR !== theirs)) bad.push(`score hud ${s.scL}:${s.scR} vs ${mine}:${theirs}`);
  return bad;
};
const hudCheck = async (tag) => {
  let s = await ev(() => window.__game.ctx.__pt.hudSample()); let bad = hudDiff(s);
  if (bad.length) { await adv(2); s = await ev(() => window.__game.ctx.__pt.hudSample()); bad = hudDiff(s); }   // numbers tween: only persistent mismatches count
  if (bad.length) { hudMismatch++; flagIssue(`HUD/state mismatch (${tag}): ${bad.join('; ')}`); }
  return s;
};

const settle = async (n = 5) => { for (let i = 0; i < n; i++) { await g.page.waitForTimeout(350); await adv(0.5); } };
const clickBtn = (re) => ev((src) => { const b = [...document.querySelectorAll('button,[role=button]')].find((x) => x.offsetParent && new RegExp(src, 'i').test(x.innerText)); if (b) { b.click(); return true; } return false; }, re);
const clickText = (t) => clickBtn(t);
const shotRaw = async (name) => { if (NOSHOTS) return; await g.page.screenshot({ path: `${OUT}/${name}.png` }); };

// ---------------------------------------------------------------------------------------------------------------
// real menu path
if (!QUICK) {
  say('waiting for menu');
  await g.page.waitForFunction(() => window.__game.ctx.menu?.state === 'main' && document.querySelector('.fx-boot')?.className.includes('out'), null, { timeout: 240000 });
  await ev(() => { const c = window.__game.ctx; c.manualStepping = true; c.input.fakeLock = true; });   // wall clock is far too slow in software GL
  await adv(1); await g.page.waitForTimeout(400); await adv(0.5); await shot('01-menu');
  check('menu reached after boot', (await state()).menu === 'main');
  // UI tour: settings tabs, locker, help, credits, practice range (and back)
  const tour = async (label, re, name) => {
    if (!(await clickBtn(re))) { flagIssue(`menu: cannot open ${label}`); return; }
    await settle(5); await shotRaw(name);
    await g.page.keyboard.press('Escape'); await settle(5);
    const st2 = await ev(() => ({ menu: window.__game.ctx.menu.state, main: !!document.querySelector('.fx-main.on') }));
    if (st2.menu !== 'main' || !st2.main) { flagIssue(`menu: after closing ${label} state=${JSON.stringify(st2)}`); await ev(() => window.__game.ctx.menu.debug?.show?.('main')); await settle(3); }
  };
  await tour('settings', 'SETTINGS', '02-settings');
  await tour('locker', 'LOCKER', '03-locker');
  await tour('how to play', 'HOW TO PLAY', '04-help');
  await tour('credits', 'CREDITS', '04-credits');
  // practice range
  if (await clickText('^\\s*0?2?\\s*PRACTICE RANGE\\s*$')) {
    for (let i = 0; i < 8; i++) { await g.page.waitForTimeout(400); await adv(0.5); }
    const st = await state(); say('practice range:', JSON.stringify({ menu: st.menu, phase: st.phase }));
    await shot('05-practice'); await adv(2); await ev(() => window.__game.hold({ forward: true, fire: true })); await adv(1.5); await ev(() => window.__game.hold({ forward: false, fire: false }));
    await shot('05-practice-b');
    await key('Escape', 0.3); await settle(3);
    const p1 = await state(); say('paused in practice:', p1.menu); await shot('05-practice-pause');
    // leave -> menu
    if (await clickBtn('Leave match')) { await settle(2); if (!(await clickBtn('^\\s*Leave\\s*$'))) flagIssue('pause: leave confirmation has no Leave button'); } else { flagIssue('pause menu has no Leave match button'); await ev(() => window.__game.ctx.match.quit?.()); }
    for (let i = 0; i < 6; i++) { await g.page.waitForTimeout(400); await adv(0.5); }
    const p2 = await state(); say('after leaving practice:', p2.menu);
    if (p2.menu !== 'main') { flagIssue(`could not return to menu from practice (state ${p2.menu})`); await ev(() => window.__game.ctx.menu.debug?.show?.('main')); }
  } else flagIssue('menu: cannot open practice range');
  // play match
  await ev(() => { try { window.__game.ctx.settings.set?.('tutorialDone', true); } catch {} });
  try { await g.page.click(`[data-v="${TEAM}"]`, { timeout: 2000 }); await adv(0.3); await g.page.click('button:has-text("ENTER")', { timeout: 2000 }); } catch (e) { flagIssue('menu: setup panel (side radio / PLAY button) not clickable: ' + String(e).slice(0, 80)); await clickText('PLAY MATCH'); }
  for (let i = 0; i < 10; i++) { await g.page.waitForTimeout(450); await adv(0.5); if ((await state()).menu === 'game') break; }
  try { await g.page.click('text=Skip tutorial', { timeout: 800 }); } catch {}
  const s0 = await state(); check('match started from menu (phase buy, 10 actors)', s0.menu === 'game' && s0.phase === 'buy' && s0.actors === 10, JSON.stringify(s0));
  check('player team as chosen', s0.team === TEAM, s0.team);
} else { await adv(0.5); }
await notePerf(); await shot('10-start');

// ---------------------------------------------------------------------------------------------------------------
// match loop
const stepUntil = async (pred, maxSec, dt = 1, label = '') => { let t = 0; let s; while (t < maxSec) { s = await state(); if (pred(s)) return s; await adv(dt); t += dt; } s = await state(); if (!pred(s)) flagIssue(`timeout waiting for ${label || pred}: ${JSON.stringify(s)}`); return s; };
const roundSummaries = [];
async function playRound(idx) {
  let s = await state(); say(`ROUND ${s.round} start phase=${s.phase} team=${s.team} cr=${s.cr}`);
  // buy phase through real keyboard on round 1 (buy menu flow), API afterwards
  if (s.phase === 'buy') {
    await adv(0.5); await hudCheck('buy');
    await key('KeyB', 0.3); await shot(`${String(idx).padStart(2, '0')}-buy-open`);
    const before = (await state()).cr;
    if (s.cr >= 2900) { await key('Digit4'); await key('Digit1', 0.3); }        // rifle column, first item (Rail/Arc)
    else if (s.cr >= 1250) { await key('Digit3'); await key('Digit2', 0.3); }   // SMG column: Hum
    else { await key('Digit2'); await key('Digit3', 0.3); }                                          // pistol column: Judge (700)
    await adv(0.3); const after = await state(); await shot(`${String(idx).padStart(2, '0')}-buy-after`);
    if (before === after.cr) flagIssue(`buy menu keyboard flow bought nothing (cr ${before}, wp ${after.wp})`);
    await key('Escape', 0.2);
    // fill with armor/util through API like a normal human would with F3/B
    await ev(() => { const c = window.__game.ctx, a = c.localActor; for (const id of ['vest', 'haze', 'strobe']) { if (c.match.canBuy?.(a)) { const r = c.match.buy(a, id); if (r?.ok) window.__game.ctx.__pt.buys += 0; } } });
    await hudCheck('after buy');
  }
  s = await stepUntil((x) => x.phase === 'live' || x.phase === 'armed', 40, 1, 'live');
  await shot(`${String(idx).padStart(2, '0')}-live-start`);
  if (idx === 1) { await ev(() => window.__game.hold({ scoreboard: true })); await adv(0.6); await shot('01-scoreboard-tab'); const sbv = await ev(() => !!document.querySelector('.sb,.scoreboard,[class*=scoreboard]')?.offsetParent); await ev(() => window.__game.hold({ scoreboard: false })); await adv(0.4); say('scoreboard visible while holding Tab:', sbv); }
  // live: run until round end, sampling
  let t = 0, shots = 0, lastShot = -99, thrown = false, specShot = false, plantShot = false, armedShot = false;
  while (t < 170) {
    await adv(1); t += 1; s = await state();
    if (t % 5 === 0) { await hudCheck(`live t=${t}`); await notePerf(); }
    // pending utility throw request from the autopilot
    const wt = await ev(() => { const R = window.__game.ctx.__pt; const u = R.wantThrow; R.wantThrow = null; return u; });
    if (wt && s.alive) {
      await ev(() => { window.__game.ctx.__pt.pilot.on = false; window.__game.ctx.input.clearInjected(); });
      await key('Digit4', 0.3);
      const eq = await ev(() => window.__game.ctx.combat.equipped(window.__game.ctx.localActor)?.def?.id);
      await ev(() => window.__game.hold({ fire: true })); await adv(0.15); await ev(() => window.__game.hold({ fire: false })); await adv(1.2); await shot(`${String(idx).padStart(2, '0')}-util-${wt}`);
      say('threw utility, equipped was', eq);
      await ev(() => { window.__game.ctx.__pt.pilot.on = true; }); await key('Digit1', 0.2); thrown = true;
    }
    if (s.tl < 100 && shots < 3 && t - lastShot >= 12 && s.alive) { await shot(`${String(idx).padStart(2, '0')}-live-${s.tl | 0}`); shots++; lastShot = t; }
    if (s.beacon === 'armed' && !armedShot) { armedShot = true; await shot(`${String(idx).padStart(2, '0')}-armed`); }
    if (!s.alive && !specShot && s.phase !== 'roundEnd') { specShot = true; await adv(1.5); await shot(`${String(idx).padStart(2, '0')}-spectate`); const sp = await ev(() => { const c = window.__game.ctx; return { mode: c.player.mode, spec: !!c.match.spectating, specName: c.match.spectating?.name, hudSpec: !!document.querySelector('.spec,.spectator,[class*=spec]')?.offsetParent }; }); say('spectate:', JSON.stringify(sp)); if (sp.mode !== 'spectate') flagIssue('after tag-out the player is not in spectate mode: ' + JSON.stringify(sp)); }
    if (s.phase === 'roundEnd') break;
    if (s.phase === 'halftime' || s.phase === 'matchEnd') break;
  }
  s = await state(); if (s.phase !== 'roundEnd' && s.phase !== 'halftime' && s.phase !== 'matchEnd') flagIssue(`round ${s.round} did not end in 170 s of sim (phase ${s.phase}, tl ${s.tl}, beacon ${s.beacon})`);
  await adv(1.2); await shot(`${String(idx).padStart(2, '0')}-roundend`);
  const hud = await ev(() => ({ banner: document.querySelector('.ban')?.innerText?.trim()?.slice(0, 80) })); say('round end banner:', JSON.stringify(hud));
  const last = await ev(() => { const m = window.__game.ctx.match; return { winner: m.history.at(-1)?.winner, reason: m.history.at(-1)?.reason, scores: { ...m.scores } }; });
  say('round result', JSON.stringify(last), 'alive E/T', s.aliveE, s.aliveT);
  roundSummaries.push(last);
  await hudCheck('roundEnd');
}


// Deterministic objective + pause scenarios (the autopilot rarely survives to plant): human plants (Ember) or disarms (Tide), pause/resume mid-round.
async function objectiveScenario(tag) {
  const team = (await state()).team; say(`objective scenario (${tag}) as ${team}`);
  await ev(() => { const m = window.__game.ctx.match; window.__game.ctx.__pt.pilot.on = false; window.__game.ctx.input.clearInjected(); m.debug.forcePhase('live'); window.__game.ctx.__pt.aiSave = window.__game.ctx.ai.fixedUpdate; window.__game.ctx.ai.fixedUpdate = () => {}; });
  await adv(0.5);
  const ok = await ev(() => {
    const c = window.__game.ctx, m = c.match, a = c.localActor, api = m.beaconApi; const A = c.map.sites.A.center;
    if (a.team === 'ember') { const car = m.beacon.carrier; if (car && car !== a) api.drop(car); if (m.beacon.state === 'dropped') api.pickup(a); a.pos.set(A.x + 1.2, A.y, A.z); a.vel.set(0, 0, 0); a.yaw = 1.57; return { has: a.hasBeacon, st: m.beacon.state }; }
    api.forceArm('A'); const b = m.beacon.pos; a.pos.set(b.x + 0.4, b.y, b.z); a.vel.set(0, 0, 0); a.yaw = 0; a.hp = 100; return { st: m.beacon.state };
  });
  await adv(0.4); await shot(`${tag}-prompt`);
  const prompt = await ev(() => document.querySelector('.prm')?.innerText?.replace(/\n/g, ' ').slice(0, 60));
  say('prompt text:', JSON.stringify(prompt), JSON.stringify(ok));
  if (team === 'ember' && !ok.has) flagIssue('objective scenario: could not hand the Beacon to the player');
  await ev(() => window.__game.hold({ use: true }));
  let shotMid = false, result = null;
  for (let i = 0; i < 14; i++) {
    await adv(0.5); const b = await ev(() => { const m = window.__game.ctx.match; return { st: m.beacon.state, p: +(m.beacon.progress || 0).toFixed(2), ph: m.phase, hint: document.querySelector('[class*=ring],[class*=prog]')?.innerText?.slice(0, 40) }; });
    if (!shotMid && b.p > 0.4) { shotMid = true; await shot(`${tag}-progress`); }
    if ((team === 'ember' && b.st === 'armed') || (team === 'tide' && (b.st === 'disarmed' || b.ph === 'roundEnd'))) { result = b; break; }
  }
  await ev(() => window.__game.hold({ use: false }));
  await adv(0.6); await shot(`${tag}-done`);
  if (!result) flagIssue(`objective scenario: player could not ${team === 'ember' ? 'arm' : 'disarm'} the Beacon (hold E 7 s)`);
  else say('objective result', JSON.stringify(result));
  await ev(() => { window.__game.ctx.ai.fixedUpdate = window.__game.ctx.__pt.aiSave; window.__game.ctx.__pt.pilot.on = true; });
}
async function pauseScenario() {
  await ev(() => { window.__game.ctx.match.debug.forcePhase('live'); });
  await adv(2); const before = await ev(() => { const c = window.__game.ctx; return { tl: c.match.timeLeft, p: c.actors.filter((a) => a !== c.localActor).map((a) => a.pos.x + a.pos.z) }; });
  await key('Escape', 0.3); await settle(4); const st = await ev(() => ({ menu: window.__game.ctx.menu.state, paused: !!window.__game.ctx.match.paused, ep: window.__game.ctx.engine.paused }));
  await shot('pause-in-match');
  await adv(3); const after = await ev(() => { const c = window.__game.ctx; return { tl: c.match.timeLeft, p: c.actors.filter((a) => a !== c.localActor).map((a) => a.pos.x + a.pos.z) }; });
  check('Esc in a live round opens pause', st.menu === 'pause', JSON.stringify(st));
  // manual stepping ignores engine.paused (the real rAF loop skips every system while it is set), so assert the flags + that the match clock itself is stopped
  check('pause stops the engine and the match clock', st.menu !== 'pause' || (st.ep === true && st.paused === true && Math.abs(after.tl - before.tl) < 0.6), `engine.paused=${st.ep} match.paused=${st.paused} timer ${before.tl.toFixed(1)}->${after.tl.toFixed(1)}`);
  if (!(await clickBtn('^\\s*Resume'))) await key('Escape', 0.3);
  await settle(4); const st2 = await ev(() => ({ menu: window.__game.ctx.menu.state, paused: !!window.__game.ctx.match.paused })); check('resume returns to the game', st2.menu === 'game' && !st2.paused, JSON.stringify(st2));
}

if (FULL) {
  for (let i = 1; i < 40; i++) { const s = await state(); if (s.phase === 'matchEnd' || s.menu === 'end') break; await playRound(i); await stepUntil((x) => x.phase !== 'roundEnd', 12, 1, 'after roundEnd'); }
} else {
  for (let i = 1; i <= ROUNDS; i++) { await playRound(i); if (i < ROUNDS) await stepUntil((x) => x.phase === 'buy' || x.phase === 'halftime', 15, 1, 'next buy'); }
  if (!QUICK || true) {
    // force through to halftime + match end, sampling the cards
    await objectiveScenario('40-obj-a'); if (!QUICK) await pauseScenario();
    say('forcing rounds to reach halftime');
    for (let k = 0; k < 20; k++) {
      const s = await state(); if (s.phase === 'halftime' || s.phase === 'matchEnd' || s.menu === 'end') break;
      await ev((k) => { const m = window.__game.ctx.match; if (m.phase === 'roundEnd') m.debug.next(); else m.debug.skipRound(k % 2 ? 'ember' : 'tide', k % 3 ? 'elimination' : 'time'); if (m.phase === 'roundEnd') m.debug.next(); }, k);
      await adv(0.3);
    }
    await adv(0.5); let s = await state(); say('halftime state', s.phase, s.scores, 'team', s.team); await shot('20-halftime');
    const sideBefore = TEAM; check('halftime reached', s.phase === 'halftime', s.phase);
    if (s.phase === 'halftime') { check('halftime swaps player team', s.team !== sideBefore, s.team); await ev(() => window.__game.ctx.match.debug.next()); await adv(1); await shot('21-after-halftime'); const s2 = await state(); check('after halftime a new buy phase starts', s2.phase === 'buy', s2.phase); const tc = await ev(() => { const c = window.__game.ctx; return { vmTeam: c.localActor.team, bots: c.actors.filter((a) => a !== c.localActor).map((a) => `${a.team}:${a.model?.userData?.team || ''}`).slice(0, 3) }; }); say('post-halftime', JSON.stringify(tc)); await hudCheck('after halftime');
      // one more live round after the swap, played by the autopilot
      await playRound(30); await objectiveScenario('41-obj-b');
    }
    say('forcing match end');
    for (let k = 0; k < 30; k++) { const s = await state(); if (s.phase === 'matchEnd' || s.menu === 'end') break; await ev((k) => { const m = window.__game.ctx.match; if (m.phase === 'roundEnd') m.debug.next(); else if (m.phase === 'halftime') m.debug.next(); else m.debug.skipRound('ember', 'elimination'); if (m.phase === 'roundEnd') m.debug.next(); }, k); await adv(0.3); }
  }
}
await adv(1); let sEnd = await state(); say('match end state', JSON.stringify(sEnd));
{
  const sb = await ev(() => { const c = window.__game.ctx, R = c.__pt; const board = c.match.scoreboard(); const rows = [...board.ember.rows, ...board.tide.rows]; const sum = (k) => rows.reduce((n, r) => n + (r[k] || 0), 0); return { evTags: R.mTags, evOuts: R.mOuts, sbTags: sum('tags'), sbOuts: sum('outs'), statTags: c.actors.reduce((n, a) => n + (a.stats?.tags || 0), 0), rows: rows.length, credits: c.actors.map((a) => a.credits), hist: c.match.history.length, scores: { ...c.match.scores } }; });
  say('scoreboard vs events', JSON.stringify(sb));
  check('scoreboard tag/out totals match tag:out events', sb.rows === 10 && sb.evOuts === sb.sbOuts && sb.evTags === sb.sbTags && sb.statTags === sb.sbTags, JSON.stringify(sb));
  check('credits within 0..9000', sb.credits.every((x) => x >= 0 && x <= 9000), JSON.stringify(sb.credits));
  check('round history length == total rounds won', sb.hist === sb.scores.ember + sb.scores.tide, `${sb.hist} vs ${sb.scores.ember + sb.scores.tide}`);
}
if (!QUICK) {
  for (let i = 0; i < 8; i++) { await g.page.waitForTimeout(500); await adv(0.7); if ((await state()).menu === 'end') break; }
  await shot('30-match-end'); sEnd = await state(); check('end-of-match recap shown', sEnd.menu === 'end', sEnd.menu);
  if (!(await g.page.click('text=Main menu', { timeout: 1500 }).then(() => true).catch(() => false))) await ev(() => window.__game.ctx.menu.debug?.show?.('main'));
  for (let i = 0; i < 8; i++) { await g.page.waitForTimeout(400); await adv(0.6); }
  sEnd = await state(); await shot('31-back-to-menu'); check('back at main menu after match', sEnd.menu === 'main', sEnd.menu);
  // second match must start cleanly (state reset)
  if (await g.page.click('text=PLAY MATCH', { timeout: 1500 }).then(() => true).catch(() => false)) { await key('Enter', 0.1); for (let i = 0; i < 10; i++) { await g.page.waitForTimeout(450); await adv(0.5); if ((await state()).menu === 'game') break; }
    const s3 = await state(); check('second match starts clean (round 1, 0-0, 800 cr)', s3.round === 1 && s3.scores.ember === 0 && s3.scores.tide === 0 && s3.phase === 'buy' && s3.actors === 10, JSON.stringify(s3)); await shot('32-second-match'); }
}

// ---------------------------------------------------------------------------------------------------------------
const R = await ev(() => { const r = window.__game.ctx.__pt; return { counts: r.counts, phases: r.phases, tagsByMe: r.tagsByMe, tagsOnMe: r.tagsOnMe, plants: r.plants, disarms: r.disarms, completes: r.completes, roundEnds: r.roundEnds, buys: r.buys, util: r.util, audio: r.audio, shots: r.pilot.shots, plantTries: r.pilot.plantTries }; });
const errs = await g.errors();
const phaseSet = [...new Set(R.phases.map((p) => p[1]))];
const c = R.counts; const tagOuts = c['tag:out'] || 0, tagHits = c['tag:hit'] || 0;
const au = R.audio || {}; const auFam = (re) => Object.entries(au).filter(([k]) => re.test(k)).reduce((n, [, v]) => n + v, 0);
const audioNeeded = { 'tagger fire': /^tagger\..*\.fire$/, 'footsteps': /^step\./, 'impacts': /^impact\./, 'UI/round stings': /^ui\.round\./, 'announcer': /^ANN:/, 'beacon': /^beacon\./, 'tag-out': /^tag\.out\./, 'reload/draw': /^tagger\..*\.(reload|draw)/ };
for (const [k, re] of Object.entries(audioNeeded)) if (!auFam(re)) flagIssue(`audio never played: ${k}`);
if (R.tagsByMe > 0 && !auFam(/^hit\./)) flagIssue('player tagged opponents but no hit.* confirm sound played');
if (R.tagsOnMe > 0 && !auFam(/^dmg\.taken|^tag\.out\.self/)) flagIssue('player was hit but no damage sound played');
const eventsNeeded = ['weapon:fire', 'tag:hit', 'tag:out', 'impact', 'credits', 'buy', 'round:end', 'announce', 'footstep', 'character:shattered'];
for (const e of eventsNeeded) if (!c[e]) flagIssue(`event never fired: ${e}`);
if (!QUICK) for (const p of ['buy', 'freeze', 'live', 'roundEnd', 'halftime']) if (!phaseSet.includes(p)) flagIssue(`phase never reached: ${p}`);
if (errs.length) flagIssue(`${errs.length} console/page errors`);
const summary = { seconds: +((Date.now() - t00) / 1000).toFixed(0), team: TEAM, phases: phaseSet, rounds: R.roundEnds, tags: { out: tagOuts, hits: tagHits, byMe: R.tagsByMe, onMe: R.tagsOnMe }, beacon: { armed: R.plants, disarmed: R.disarms, complete: R.completes, plantHoldTicks: R.plantTries }, util: R.util, buys: R.buys, shots: R.shots, perf: report.perf, hudMismatches: hudMismatch, announces: c['announce'] || 0, errors: errs.slice(0, 10), checksFailed: report.checks.filter((x) => !x.ok).map((x) => x.name) };
console.log(JSON.stringify(summary, null, 1));
console.log('audio:', JSON.stringify(Object.fromEntries(Object.entries(au).sort((a, b) => b[1] - a[1]).slice(0, 40))));
console.log('events:', JSON.stringify(Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 40))));
if (report.perf.maxCalls > 350) flagIssue(`draw calls ${report.perf.maxCalls} > 350`);
if (report.perf.maxTris > 400000) flagIssue(`triangles ${report.perf.maxTris} > 400k`);
await g.close();
console.log(issues.length ? `HEALTH: FAIL (${issues.length} issues)\n - ` + issues.join('\n - ') : 'HEALTH: OK');
process.exit(issues.length ? 1 : 0);
