import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('console', (m) => console.log('[c]', m.type(), m.text().slice(0, 300))); p.on('pageerror', (e) => console.log('[pe]', e.message));
await p.goto('http://127.0.0.1:5180/?test=1&seed=1&scene=utility-lab&labui=0');
for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 3000)); const r = await p.evaluate(() => ({ ready: window.__game?.ready, errs: window.__game?.errors?.() })); console.log(i, JSON.stringify(r).slice(0, 600)); if (r.ready) break; }
await b.close();
