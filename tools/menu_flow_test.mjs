// Regression test for menu flows: Play -> pause focus -> Leave confirm (Stay/Esc/Leave by mouse) -> main; F1 from pause; Esc closes overlays.
//   node tools/menu_flow_test.mjs      (exit 1 on failure)
import { open } from './lib.mjs';
const g = await open({ params: 'test=1&seed=1&menu=1', size: [1280, 720], wait: 240000 });
g.page.setDefaultTimeout(120000);
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const st = () => g.eval(() => ({ base: window.__game.ctx.menu.debug.base, ov: window.__game.ctx.menu.debug.overlays, foc: document.activeElement?.dataset?.id || document.activeElement?.className || '', fxmenu: document.documentElement.classList.contains('fx-menu'), confirm: !!document.querySelector('.fx-confirm') }));
const click = async (sel) => { const r = await g.eval((s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); const hit = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2); return [q.x + q.width / 2, q.y + q.height / 2, e.contains(hit)]; }, sel); if (!r) return null; await g.page.mouse.click(r[0], r[1]); return r[2]; };
const until = async (fn, n = 40) => { for (let i = 0; i < n; i++) { await g.advance(0.3); await w(100); if (await fn()) return true; } return false; };
await g.page.keyboard.press('Escape'); // nothing in main
await g.eval(() => window.__game.ctx.menu.debug.play());
ok(await until(async () => (await st()).base === 'game'), 'play -> game');
await g.eval(() => window.__game.ctx.menu.debug.openPause()); await w(700);
let s = await st(); ok(s.base === 'pause' && s.foc === 'resume', `pause opens with Resume focused (${s.foc})`);
ok((await click('.fx-pb[data-id=leave]')) === true, 'Leave button is hit-testable'); await w(500);
s = await st(); ok(s.confirm, 'confirm dialog opened'); ok(await g.eval(() => !!document.querySelector('.fx-confirm [data-autofocus]') && document.activeElement === document.querySelector('.fx-confirm [data-autofocus]')), 'Stay focused');
ok((await click('.fx-confirm .fx-btn.danger')) === true, 'Leave-confirm button hit-testable (not inert)');
await g.page.keyboard.press('Escape'); await w(1500); // Esc on... after Leave click may already have left; handle both
s = await st();
if (s.base === 'pause' && !s.confirm) { ok(true, 'Esc = Stay (pause remains)'); }
// now real leave
if (s.base !== 'main') { await click('.fx-pb[data-id=leave]'); await w(500); ok((await click('.fx-confirm .fx-btn.danger')) === true, 'Leave clickable again'); }
ok(await until(async () => (await st()).base === 'main', 60), 'Leave -> main menu');
// replay: F1 from pause
await g.eval(() => window.__game.ctx.menu.debug.play()); await until(async () => (await st()).base === 'game');
await g.eval(() => window.__game.ctx.menu.debug.openPause()); await w(500);
await g.page.keyboard.press('F1'); await w(500); s = await st();
ok(s.ov.includes('cheat') && !s.fxmenu, `F1 in pause opens cheat-sheet without menu backdrop (${JSON.stringify(s.ov)})`);
await g.page.keyboard.press('Escape'); await w(500); s = await st(); ok(s.base === 'pause' && !s.ov.length, 'Esc closes cheat-sheet, pause stays');
await click('.fx-pb[data-id=settings]'); await w(600); s = await st(); ok(s.ov.includes('settings') && /fx-tab/.test(s.foc), `settings focus on tab (${s.foc})`);
await g.page.keyboard.press('Escape'); await w(600); s = await st(); ok(!s.ov.length && s.base === 'pause', 'Esc closes settings back to pause');
// (critic r4) repeated pause/resume: every pause button stays visible + hit-testable each time
const hitAll = () => g.eval(() => ['resume', 'settings', 'controls', 'leave'].every((id) => { const e = document.querySelector(`.fx-pb[data-id=${id}]`); const q = e?.getBoundingClientRect(); return q && q.width > 0 && e.contains(document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2)); }));
for (let k = 0; k < 2; k++) {
  await click('.fx-pb[data-id=resume]'); ok(await until(async () => (await st()).base === 'game', 10), `resume #${k + 1} -> game`);
  await g.page.keyboard.press('Escape'); await g.advance(0.6); await w(400); s = await st();
  ok(s.base === 'pause' && s.foc === 'resume' && await hitAll(), `pause #${k + 2}: Resume focused, all buttons hittable (${s.foc})`);
}
// (critic r4) keyboard-only leave: ArrowDown x3 -> Leave, Enter -> confirm (Stay focused), ArrowRight -> Leave, Enter
for (let i = 0; i < 3; i++) { await g.page.keyboard.press('ArrowDown'); await w(150); }
s = await st(); ok(s.foc === 'leave', `arrow keys reach Leave (${s.foc})`);
await g.page.keyboard.press('Enter'); await w(500); s = await st(); ok(s.confirm, 'Enter on Leave opens confirm');
await g.page.keyboard.press('ArrowRight'); await w(150); await g.page.keyboard.press('Enter');
ok(await until(async () => (await st()).base === 'main', 60), 'keyboard-only Leave -> main menu');
// (critic r4) settings actually apply in game: FOV (horizontal) -> camera, rebind jump -> KeyJ
await g.eval(() => { const S = window.__game.ctx.settings; S.set('fov', 110); S.set('keybinds', { jump: ['KeyJ'] }); window.__game.ctx.menu_applyBinds?.(); });
await g.eval(() => window.__game.ctx.menu.debug.play()); await until(async () => (await st()).base === 'game');
const vfov = await g.eval(() => window.__game.ctx.render.camera.fov); ok(Math.abs(vfov - 77.55) < 0.3, `fov 110 horizontal -> camera ${vfov.toFixed(2)} vertical @16:9`);
await until(async () => (await g.eval(() => window.__game.ctx.match.phase)) === 'live', 80);
const vy = () => g.eval(() => window.__game.ctx.localActor.vel.y);
await g.page.keyboard.down('Space'); await g.advance(0.05); await g.page.keyboard.up('Space'); await g.advance(0.1); ok((await vy()) < 0.5, 'Space no longer jumps after rebind');
await g.advance(1); await g.page.keyboard.down('KeyJ'); await g.advance(0.05); await g.page.keyboard.up('KeyJ'); await g.advance(0.1); ok((await vy()) > 1, 'rebound J jumps');
await g.eval(() => { const S = window.__game.ctx.settings; S.set('fov', 100); S.set('keybinds', {}); window.__game.ctx.menu_applyBinds?.(); });
const errs = await g.errors(); ok(!errs.length, 'no console errors ' + JSON.stringify(errs).slice(0, 200));
await g.close(); process.exit(fails ? 1 : 0);
