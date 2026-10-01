// Capture every menu screen at 1280x720 and 1920x1080 -> shots/menu/<screen>_<w>.png and contact sheets.
//   node tools/menu_sheet.mjs [--only main,pause] [--sizes 1280x720,1920x1080] [--q] 
import { open } from './lib.mjs';
import { execFileSync } from 'node:child_process'; import fs from 'node:fs';
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const sizes = opt('sizes', '1280x720,1920x1080').split(',').map((s) => s.split('x').map(Number));
const only = opt('only', '')?.split(',').filter(Boolean);
fs.mkdirSync('shots/menu', { recursive: true });
for (const [w, h] of sizes) {
  const g = await open({ params: 'test=1&seed=1&menu=1&scene=menu-gallery&screen=main', size: [w, h] });
  const ids = await g.eval(() => window.__game.ctx.menu.debug.screens);
  const files = [];
  for (const id of ids) {
    if (only.length && !only.includes(id) && !only.includes(id.split(':')[0])) continue;
    await g.eval((id) => window.__game.ctx.menu.debug.show(id), id);
    await g.advance(0.6); await new Promise((r) => setTimeout(r, 350)); await g.advance(0.2);
    const f = `shots/menu/${id.replace(':', '-')}_${w}.png`; await g.shot(f); files.push(f); console.log('shot', f);
  }
  const errs = await g.errors(); if (errs.length) console.log('ERRORS\n' + errs.join('\n'));
  await g.close();
  if (files.length > 1) { try { execFileSync('python3', ['tools/sheet.py', 'grid', `shots/menu/sheet_${w}.png`, ...files]); } catch (e) { console.log('sheet failed', e.message); } }
}
