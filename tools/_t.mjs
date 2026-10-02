import { open } from './lib.mjs';
const g = await open({ params: 'test=1&seed=1&scene=locker', size: [1280, 720] });
const call = (code, arg) => g.page.evaluate(([c, ar]) => { const L = window.__game.ctx.cosmetics.debug.locker; return (new Function('L', 'a', c))(L, ar); }, [code, arg]);
await g.page.keyboard.press('t'); await call('L.settle(1)');
await call('L.setLoadout({team:"tide",suit:"suit-tide-ii",pattern:"pat-tide",visor:"vis-cyclops",helmet:"helm-hex",back:"back-tail",charm:"charm-tide",nameplate:"plate-neon",skin:"skin-neon",emote:"sway"})');
const shots = {};
for (const c of ['suit','visor','charm','nameplate','skin','emote']) { await call('L.setCat(a);L.settle(2.2)', c); await g.page.waitForTimeout(350); await g.page.screenshot({ path: `shots/cosmetics/r3_${c}.png` }); }
console.log(await call('L.setCat("emote");L.setCat("emote");return [document.querySelectorAll("#fx-locker .card").length, document.querySelector(".lk-sidetog .on").dataset.s]'));
console.log(JSON.stringify(await g.errors()).slice(0,600)); await g.close();
