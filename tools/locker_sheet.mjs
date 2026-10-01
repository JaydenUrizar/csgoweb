// node tools/locker_sheet.mjs [--out shots/cosmetics/sheet] [--size 1600x900] [--randoms 6]
// Captures every locker tab, both sides, hover/emote/tag-out states and a spread of random loadouts (preview-only scene).
import { open } from './lib.mjs';
import fs from 'node:fs';
const a = process.argv.slice(2); const opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const out = opt('out', 'shots/cosmetics/sheet'); const [w, h] = opt('size', '1600x900').split('x').map(Number); const nRand = +opt('randoms', 6);
fs.mkdirSync(out, { recursive: true });
const g = await open({ params: 'test=1&seed=1&scene=locker', size: [w, h] });
const call = (code, arg) => g.page.evaluate(([c, ar]) => { const L = window.__game.ctx.cosmetics.debug.locker; return (new Function('L', 'a', c))(L, ar); }, [code, arg]);
const cats = ['suit', 'helmet', 'visor', 'pattern', 'back', 'trail', 'tagOut', 'skin', 'charm', 'nameplate', 'emote', 'sets'];
for (const side of ['ember', 'tide']) {
  await call('L.setSide(a)', side);
  for (const c of cats) {
    await call('L.setCat(a)', c); await call('L.settle(1.4)');
    if (c === 'trail') await call('L.settle(1.8)');
    await g.page.waitForTimeout(650); await g.page.screenshot({ path: `${out}/${side}_${c}.png` });
  }
}
// special states
await call('L.setSide("ember");L.setCat("tagOut");L.stage.playTagOut("fireworks",0xffb627);L.settle(0.9)'); await g.page.waitForTimeout(650); await g.page.screenshot({ path: `${out}/state_tagout_fireworks.png` });
await call('L.setCat("emote");L.stage.playEmote("flex");L.settle(1.2)'); await g.page.waitForTimeout(650); await g.page.screenshot({ path: `${out}/state_emote_flex.png` });
await call('L.setCat("suit");L.hover("suit-neon");L.settle(0.8)'); await g.page.waitForTimeout(650); await g.page.screenshot({ path: `${out}/state_hover_neon.png` });
// random spread on the preview-only scene canvas: use locker preview with random loadouts
for (let i = 0; i < nRand; i++) {
  const side = i % 2 ? 'tide' : 'ember';
  await call(`L.setSide(a[0]);L.setCat("suit");L.randomize();L.view("wide");L.settle(1.6)`, [side]);
  await g.page.waitForTimeout(650); await g.page.screenshot({ path: `${out}/random_${i}_${side}.png` });
}
const errs = await g.errors(); if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
console.log('saved to', out); await g.close();
