// Writes the JSON body for the live artifact's db doc `progress/state` from public/progress.json.
// Then push it with the ArtifactData tool: action=set collection=progress doc_id=state file_path=<out>
import fs from 'node:fs';
const out = process.argv[2] || '/tmp/board_state.json';
const p = JSON.parse(fs.readFileSync('public/progress.json', 'utf8'));
const urls = fs.existsSync('docs/snap_urls.json') ? JSON.parse(fs.readFileSync('docs/snap_urls.json', 'utf8')) : {};
const body = { wave: p.wave, phase: p.phase, updated: p.updated,
  pieces: p.pieces.map((x) => ({ id: x.id, name: x.name, status: x.status, round: x.round, score: x.score, gap: (x.gap || '').slice(0, 300), note: x.note || '', history: (x.history || []).slice(-14).map((h) => ({ winner: h.winner, score: h.score, round: h.round })) })),
  log: p.log.slice(0, 50), snaps: p.snaps.filter((s) => urls[s.src]).slice(0, 10).map((s) => ({ url: urls[s.src], caption: s.caption, t: s.t })) };
fs.writeFileSync(out, JSON.stringify(body)); console.log(out, JSON.stringify(body).length, 'bytes');
