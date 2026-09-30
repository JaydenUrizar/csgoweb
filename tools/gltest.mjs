import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'] });
const p = await b.newPage();
await p.setContent('<canvas id=c></canvas>');
console.log(await p.evaluate(()=>{const g=document.getElementById('c').getContext('webgl2');return g? g.getParameter(g.VERSION)+' | '+g.getParameter(g.MAX_TEXTURE_SIZE):'none'}));
await b.close();
