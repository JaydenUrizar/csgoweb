// Shared harness helpers. Usage from a scenario/script:
//   import { open } from './lib.mjs'; const g = await open({ params:'test=1&seed=1', size:[1280,720] });
//   await g.advance(2); await g.shot('shots/x.png'); await g.close();
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path';
export const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export async function open({ params = 'test=1', size = [1280, 720], url = GAME_URL, wait = 60000, headed = false } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: !headed, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
  const logs = []; page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${t}`); }); page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  await page.goto(url + (url.includes('?') ? '&' : '?') + params.replace(/^\?/, ''), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: wait });
  const g = {
    page, browser, logs,
    eval: (fn, arg) => page.evaluate(fn, arg),
    game: (fn, arg) => page.evaluate(([f, a]) => (new Function('game', 'a', `return (${f})(game, a)`))(window.__game, a), [fn.toString(), arg]),
    advance: (s, o) => page.evaluate(([s, o]) => window.__game.advance(s, o), [s, o]),
    async shot(file, { clip } = {}) { fs.mkdirSync(path.dirname(file), { recursive: true }); await page.evaluate(() => window.__game.render()); await page.screenshot({ path: file, clip }); return file; },
    async errors() { return [...logs, ...(await page.evaluate(() => window.__game.errors()))]; },
    close: () => browser.close(),
  };
  return g;
}
