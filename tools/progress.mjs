// Live-progress CLI. Writes public/progress.json (polled by /progress.html).
//   node tools/progress.mjs init                      (creates pieces from docs/pieces.json)
//   node tools/progress.mjs piece <id> [--status queued|building|judging|passed] [--round N] [--score 0-10] [--gap "text"] [--note "text"] [--winner ours|ref|tie]
//   node tools/progress.mjs log "message" [--kind wave|build|critic|integrate]
//   node tools/progress.mjs wave <n> "<title>"
//   node tools/progress.mjs snap <png> "<caption>"    (copies a screenshot into public/progress/)
import fs from 'node:fs'; import path from 'node:path';
const F = 'public/progress.json'; const read = () => JSON.parse(fs.readFileSync(F, 'utf8'));
const [cmd, ...rest] = process.argv.slice(2);
const flag = (k) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : undefined; };
const p = read();
const now = () => new Date().toISOString();
if (cmd === 'init') { p.pieces = JSON.parse(fs.readFileSync('docs/pieces.json', 'utf8')).map((x) => ({ ...x, status: 'queued', round: 0, score: 0, gap: '', history: [] })); }
if (cmd === 'piece') {
  const id = rest[0]; const pc = p.pieces.find((x) => x.id === id); if (!pc) { console.error('no piece', id); process.exit(1); }
  for (const k of ['status', 'gap', 'note']) if (flag(k) !== undefined) pc[k] = flag(k);
  if (flag('round') !== undefined) pc.round = +flag('round'); if (flag('score') !== undefined) pc.score = +flag('score');
  if (flag('winner') || flag('gap') || flag('score')) pc.history.push({ t: now(), round: pc.round, winner: flag('winner') || '', score: pc.score, gap: pc.gap });
  pc.updated = now();
}
if (cmd === 'log') p.log.unshift({ t: now(), text: rest[0], kind: flag('kind') || 'build' });
if (cmd === 'wave') { p.wave = +rest[0]; p.phase = rest[1]; p.log.unshift({ t: now(), text: `WAVE ${rest[0]} — ${rest[1]}`, kind: 'wave' }); }
if (cmd === 'snap') { fs.mkdirSync('public/progress', { recursive: true }); const dst = `public/progress/${Date.now()}_${path.basename(rest[0])}`; fs.copyFileSync(rest[0], dst); p.snaps.unshift({ t: now(), src: dst.replace('public/', ''), caption: rest[1] || '' }); p.snaps = p.snaps.slice(0, 60); }
p.log = p.log.slice(0, 200); p.updated = now();
fs.writeFileSync(F, JSON.stringify(p, null, 1)); console.log('ok');
