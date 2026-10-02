// node tools/audio_dump.mjs [--only regex] [--out shots/audio] [--dry] [--tp] [--no-analyze] [--seconds n]
// Renders every catalogue sound offline (OfflineAudioContext, same graph as the game) -> WAV, then runs tools/audio_analyze.py
// for spectrograms + metrics (peak / RMS / attack / centroid / decay / LUFS-ish).
import { chromium } from 'playwright-core';
import { GAME_URL } from './lib.mjs';
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes('--' + k);
const out = opt('out', 'shots/audio'); const only = opt('only') ? new RegExp(opt('only')) : null;
fs.mkdirSync(out, { recursive: true });
// Lightweight page on the dev-server origin (no game boot needed): sounds are pure modules.
let browser, page; const logs = [];
async function launch() {
  try { await browser?.close(); } catch {}
  browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--disable-gpu'] });
  page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); }); page.on('pageerror', (e) => logs.push(String(e)));
  await page.route('**/__audio_dump.html', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>audio dump</title>' }));
  await page.goto(GAME_URL + '__audio_dump.html');
}
await launch();
// every evaluate has a timeout; a hung/crashed renderer is relaunched and the render retried once
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + ms + 'ms')), ms))]);
const g = { eval: (fn, arg) => withTimeout(page.evaluate(fn, arg), 45000), errors: async () => logs, close: () => browser.close() };
const names = await g.eval(async () => { const m = await import('/src/audio/catalog.js'); m.ensureRegistered(); return [...Object.keys(m.SOUNDS), ...m.musicNames()]; });
function wav(file, sr, chans) {
  const n = chans[0].length, nc = chans.length, buf = Buffer.alloc(44 + n * nc * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * nc * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(nc, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * nc * 2, 28); buf.writeUInt16LE(nc * 2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * nc * 2, 40);
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); buf.writeInt16LE(Math.round(v * 32767), o); o += 2; }
  fs.writeFileSync(file, buf);
}
async function render(name, o) { try { return await render1(name, o); } catch (e) { console.log('retry', name, String(e).slice(0, 80)); await launch(); return await render1(name, o); } }
async function render1(name, o) {
  const r = await g.eval(async ([name, o]) => {
    const m = await import('/src/audio/offline.js'); const r = await m.renderOfflineFull(name, o);
    const enc = (a) => { const i16 = new Int16Array(a.length); for (let i = 0; i < a.length; i++) i16[i] = Math.max(-1, Math.min(1, a[i])) * 32767; const u = new Uint8Array(i16.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    return { sr: r.sampleRate, ch: r.channels.map(enc) };
  }, [name, o]);
  return { sr: r.sr, ch: r.ch.map((b) => { const u = Buffer.from(b, 'base64'); const i16 = new Int16Array(u.buffer, u.byteOffset, u.length / 2); return Float32Array.from(i16, (v) => v / 32767); }) };
}
let n = 0;
for (const name of names) {
  if (only && !only.test(name)) continue;
  const o = { seconds: opt('seconds') ? +opt('seconds') : undefined, fp: true };
  try {
    let r = await render(name, o); wav(path.join(out, name + '.wav'), r.sr, r.ch);
    if (flag('dry') && !name.startsWith('music.')) { r = await render(name, { ...o, dry: true }); wav(path.join(out, name + '.dry.wav'), r.sr, [r.ch[0]]); }
    const sp = (await g.eval(async (nm) => { const m = await import('/src/audio/catalog.js'); return m.SOUNDS[nm]?.spatial; }, name));
    if (flag('tp') && sp) { r = await render(name, { ...o, fp: false, dist: 25, az: 30 }); wav(path.join(out, name + '.tp.wav'), r.sr, r.ch); }
    n++;
  } catch (e) { console.log('FAIL', name, String(e).slice(0, 200)); }
}
console.log('rendered', n, 'sounds ->', out);
const errs = await g.errors(); if (errs.length) console.log('page errors:', errs.filter((x) => !/BVH/.test(x)).join('\n'));
await g.close();
if (!flag('no-analyze')) { const r = spawnSync('python3', ['tools/audio_analyze.py', out, ...(only ? ['--only', opt('only')] : [])], { stdio: 'inherit' }); process.exit(r.status || 0); }
