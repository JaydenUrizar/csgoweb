// Headless bot matches. node tools/bot_test.mjs [--seeds 1,2,3] [--rounds 6] [--difficulty pro|rookie|elite] [--max 900] [--quiet] [--json out.json]
// Runs full 5v5 all-bot matches (human actor adopted by the AI, free camera) via __game.advance and prints:
// round-length distribution, first contact, tags/round, kills per weapon & distance, plant rate, win split, stuck incidents, exceptions, CPU/tick.
import { open } from './lib.mjs';
import fs from 'node:fs';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const seeds = opt('seeds', '1,2,3').split(',').map(Number);
const rich = args.includes('--rich');
const emberDiff = opt('ember', ''), tideDiff = opt('tide', '');
const nRounds = +opt('rounds', 6), difficulty = opt('difficulty', 'pro'), maxSim = +opt('max', 1200), quiet = args.includes('--quiet');
const out = { difficulty, seeds: [], rounds: [] };
let failed = 0;
const fail = (m) => { failed++; console.log('FAIL ' + m); };

for (const seed of seeds) {
  const g = await open({ params: `test=1&seed=${seed}&scene=bot-lab&ui=0&draw=0&view=none&difficulty=${difficulty}`, size: [640, 360] });
  const t0 = Date.now();
  let simT = 0, lastLog = 0;
  await g.eval(([e, t]) => { const d = window.__game.ctx.ai.debug; d.resetTelemetry(); window.__game.ctx.match.debug.pin(false); if (e) d.setDifficulty(e, 'ember'); if (t) d.setDifficulty(t, 'tide'); }, [emberDiff, tideDiff]);
  if (rich) await g.eval(() => { const c = window.__game.ctx; const fill = () => { for (const a of c.actors) if (a.team === 'ember' || a.team === 'tide') c.match.debug.setCredits(a, 9000); }; c.events.on('round:phase', (e) => { if (e.phase === 'buy') fill(); }); fill(); });
  while (simT < maxSim) {
    await g.advance(5, { render: false }); simT += 5;
    const st = await g.eval(() => { const m = window.__game.ctx.match; return { n: m.history.length, phase: m.phase, ended: m.phase === 'matchEnd', round: m.round }; });
    if (st.n >= nRounds || st.ended) break;
    if (!quiet && simT - lastLog >= 60) { lastLog = simT; console.log(`  seed ${seed}: sim ${simT}s rounds ${st.n} phase ${st.phase}`); }
  }
  const res = await g.eval(() => ({ tel: window.__game.ctx.ai.debug.telemetry(), rounds: window.__game.ctx.ai.debug.rounds(), snap: window.__game.ctx.match.snapshot() }));
  const errs = await g.errors();
  const T = res.tel;
  console.log(`seed ${seed}: ${T.rounds} rounds in ${simT}s sim (${((Date.now() - t0) / 1000).toFixed(0)}s wall) wins E${T.wins.ember}/T${T.wins.tide} reasons ${JSON.stringify(T.reasons)} plant ${T.plantRate}`);
  console.log(`  len mean ${T.len.mean} p10 ${T.len.p10} p50 ${T.len.p50} p90 ${T.len.p90} (min ${T.len.min} max ${T.len.max}) | first contact ${T.firstContact.mean}s [${T.firstContact.min}..${T.firstContact.max}] | tags/round ${T.tagsPerRound}`);
  console.log(`  kills ${JSON.stringify(T.kills.byWeapon)} dist ${JSON.stringify(T.kills.byDist)} head ${T.kills.head}/${T.kills.total} | throws ${JSON.stringify(T.throwsBy)} | shots ${T.shots} hits ${T.hits}`);
  console.log(`  stuck ${T.stuck.seconds}s / ${T.stuck.incidents} incidents / ${T.stuck.teleports} teleports | clean rounds ${(T.stuck.cleanRounds * 100).toFixed(0)}% | cpu ${T.cpuMsPerTick}ms/tick (max ${T.cpuMaxMs}) = ${(T.cpuMsPerTick * 2).toFixed(2)}ms/frame@60 | exceptions ${T.exceptions}`);
  console.log(`  sight-to-first-shot ms ${JSON.stringify(T.reactionMs)}`);
  if (args.includes('--log')) for (const l of T.log) console.log('    ' + JSON.stringify(l));
  if (!quiet) for (const r of res.rounds) console.log(`    r${r.n}: ${r.winner} by ${r.reason} len ${r.len}s contact ${r.contactT}s firstTag ${r.firstTagT}s tags ${r.tags} planted ${r.planted}${r.planted ? '@' + r.plantT + 's' : ''} stuck ${r.stuck}`);
  if (errs.length) { console.log('  ERRORS:\n   ' + errs.slice(0, 6).join('\n   ')); fail(`seed ${seed}: console/page errors`); }
  if (T.exceptions) fail(`seed ${seed}: bot exceptions ${T.exceptions}`);
  if (T.stuck.cleanRounds < 0.95) fail(`seed ${seed}: only ${(T.stuck.cleanRounds * 100).toFixed(0)}% rounds without stuck bots`);
  if (T.cpuMsPerTick * 2 > 1.5) fail(`seed ${seed}: cpu ${(T.cpuMsPerTick * 2).toFixed(2)} ms/frame > 1.5`);
  out.seeds.push({ seed, summary: T }); out.rounds.push(...res.rounds.map((r) => ({ seed, ...r })));
  await g.close();
}
// aggregate
const R = out.rounds;
if (R.length) {
  const lens = R.map((r) => r.len).sort((a, b) => a - b), q = (p) => lens[Math.min(lens.length - 1, Math.floor(p * lens.length))];
  const avg = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const contacts = R.map((r) => r.contactT).filter((v) => v >= 0);
  console.log(`\nALL ${R.length} rounds: len p10 ${q(0.1)} p50 ${q(0.5)} p90 ${q(0.9)} | contact mean ${avg(contacts).toFixed(1)}s | tags/round ${avg(R.map((r) => r.tags)).toFixed(1)} | plant rate ${(R.filter((r) => r.planted).length / R.length * 100).toFixed(0)}% | ember wins ${R.filter((r) => r.winner === 'ember').length} tide wins ${R.filter((r) => r.winner === 'tide').length}`);
  const hist = {}; for (const r of R) { const b = Math.floor(r.len / 15) * 15; hist[b] = (hist[b] || 0) + 1; }
  console.log('length histogram (15 s bins): ' + Object.keys(hist).sort((a, b) => a - b).map((k) => `${k}:${hist[k]}`).join(' '));
}
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(out, null, 1));
console.log(failed ? `\n${failed} FAILED` : '\nPASS');
process.exit(failed ? 1 : 0);
