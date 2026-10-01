// Navigation validation: samples random point pairs, walks each path with capsule sweeps against the collision BVH and prints stats.
//   node tools/nav_validate.mjs                  # built-in stress-test map (Node only, no browser)
//   node tools/nav_validate.mjs --map=game       # the real game map, in the running dev server via headless Chromium
//   options: --pairs=2000 --seed=1 --size=100 --cell=0.5 --json
// Exit code 1 if any path clips, floats, or fails.
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.replace(/^--/, '').split('='); return [m[0], m[1] ?? true]; }));
const pairs = +(args.pairs || 2000), seed = +(args.seed || 1), mapKind = args.map || 'test';
const opts = {}; if (args.cell) opts.cell = +args.cell;

function print(r) {
  if (args.json) { console.log(JSON.stringify(r, null, 1)); return; }
  const { build, bench, val } = r;
  console.log('== NAV VALIDATE (' + r.map + ') ==');
  console.log(`graph      nodes ${build.nodes} (raw ${build.rawNodes}, pruned ${build.rawNodes - build.nodes}) walkEdges ${build.walkEdges} jump ${build.jumpLinks} drop ${build.dropLinks} components ${build.components} grid ${build.grid}@${build.cell}m areas ${build.areas}`);
  console.log(`build      ${build.buildMs.toFixed(0)} ms  (rays ${build.rays}, regions ${build.regionMs.toFixed(1)} ms)   spawns/sites in main component: ${build.hintsInMain}/${build.hintPoints}`);
  console.log(`bench      ${bench.pairs} pairs: avg ${bench.avgUs.toFixed(0)} us  p50 ${bench.p50Us.toFixed(0)}  p95 ${bench.p95Us.toFixed(0)}  max ${bench.maxUs.toFixed(0)} us, fail ${(bench.failRate * 100).toFixed(2)}%  avg len ${bench.avgLen.toFixed(1)} m, ${bench.avgPts.toFixed(1)} waypoints`);
  console.log(`validate   ${val.pairs} pairs: ok ${val.ok} fail ${val.fail} | bad paths ${val.badPaths} (clip ${val.clipped}, floating ${val.floating}, wall-ray ${val.wallRay}, hop ${val.hopBad}) | samples ${val.samples} | hops ${val.hops} (jump ${val.jumps}, drop ${val.drops}) | detour x${val.detour.toFixed(3)} worst x${val.ratioMax.toFixed(2)} | ${val.ms.toFixed(0)} ms | hash ${val.hash}`);
  for (const w of val.worst) console.log('  violation', JSON.stringify(w));
  if (val.nullPaths.length) console.log('  unreachable samples', JSON.stringify(val.nullPaths));
  console.log(val.clean ? 'RESULT: PASS (no clipping, no failures)' : 'RESULT: FAIL');
}

if (mapKind === 'game') {
  const { open } = await import('./lib.mjs');
  const g = await open({ params: 'test=1&seed=' + seed });
  await g.advance(0.2);
  const r = await g.eval(([pairs, seed, opts]) => {
    const nav = window.__game.ctx.nav; if (!nav?.debug?.validate) return { error: 'ctx.nav.debug.validate missing (nav module not loaded?)' };
    if (!nav.ready) nav.rebuild(opts); else if (Object.keys(opts).length) nav.rebuild(opts);
    return { map: window.__game.ctx.map.name || 'game', build: nav.debug.stats().build, bench: nav.debug.benchmark(300), val: nav.debug.validate(pairs, seed) };
  }, [pairs, seed, opts]);
  const errs = await g.errors(); await g.close();
  if (r.error) { console.error(r.error); process.exit(2); }
  print(r); if (errs.length) console.log('page errors:', errs.join('\n'));
  process.exit(r.val.clean ? 0 : 1);
} else {
  const { buildTestMap } = await import('../src/ai/nav/testmap.js');
  const { NavSystem } = await import('../src/ai/nav/system.js');
  const { validatePaths } = await import('../src/ai/nav/validate.js');
  const m = buildTestMap({ size: +(args.size || 100) });
  const sys = new NavSystem(m, { options: opts, seed });
  const build = sys.build();
  const bench = sys.benchmark(300);
  const val = validatePaths(sys, { pairs, seed });
  const again = validatePaths(sys, { pairs: 300, seed });
  const r = { map: m.name, build, bench, val };
  print(r);
  const det = validatePaths(sys, { pairs: 300, seed }).hash === again.hash; console.log('deterministic re-run:', det ? 'yes' : 'NO');
  const rt = sys.sitesToSpawnRouteTimes(); console.log('route times:', JSON.stringify(rt, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v)));
  process.exit(val.clean && det ? 0 : 1);
}
