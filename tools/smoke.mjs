// Fast health check: game boots, no errors, stepping works. Exit 1 on failure. Builders run this before finishing an edit.
import { open } from './lib.mjs';
const g = await open({ params: 'test=1&seed=1', size: [960, 540] });
await g.advance(1.0);
const info = await g.eval(() => ({ stubs: Object.entries(window.__game.ctx.modules).filter(([, m]) => m.__stub).map(([k]) => k), failed: Object.entries(window.__game.ctx.modules).filter(([, m]) => m.failed).map(([k]) => k), actors: window.__game.ctx.actors.length, calls: window.__game.ctx.render.info?.()?.calls }));
const errs = await g.errors();
console.log(JSON.stringify(info)); if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await g.close(); process.exit(errs.length || info.failed.length ? 1 : 0);
