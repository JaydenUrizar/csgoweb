// First-run interactive tutorial: movement -> aim -> buy -> beacon. Non-blocking cards; each step completes from real game signals
// (position delta, yaw delta, weapon:fire, buy, beacon:*). N skips a step. Progress is defensive: with stubs the player can still press N.
import { h, keyLabel } from './ui.js';

export function createTutorial(ctx, A) {
  const S = { i: -1, prog: 0, done: false, wait: 0, active: false, dist: 0, yaw: 0, fired: false, jumped: false, bought: false, buyOpened: false, beacon: false, lastX: 0, lastZ: 0, lastYaw: 0, finishT: 0 };
  const K = (a) => (A.binds()[a] || []).filter(Boolean).map(keyLabel);
  const team = () => ctx.match?.playerTeam || ctx.localActor?.team || 'ember';
  const steps = [
    { id: 'move', name: 'Movement', title: 'Get moving', text: 'Run, strafe and jump. Tap the opposite key to counter-strafe and stop instantly — bunny-hop by jumping while you strafe.', keys: () => [[K('forward')[0], K('left')[0], K('back')[0], K('right')[0]].filter(Boolean), K('jump'), K('crouch')], hint: 'Move ~10 m and jump' },
    { id: 'aim', name: 'Aim', title: 'Look & tag', text: 'Sweep the mouse to look around and click to fire. Small taps and counter-strafing keep shots accurate. Crown hits deal 4× Charge.', keys: () => [['Mouse'], ['Mouse 1']], hint: 'Look around and fire once' },
    { id: 'buy', name: 'Buy', title: 'Buy a tagger', text: 'During the buy phase open the shop and grab a primary tagger and a Vest. Credits carry over if you survive.', keys: () => [K('buy')], hint: 'Open the buy menu and purchase something' },
    { id: 'beacon', name: 'Beacon', get title() { return team() === 'ember' ? 'Arm the Beacon' : 'Stop the Beacon'; }, get text() { return team() === 'ember' ? 'Carry the Beacon to site A or B and hold E for 3.2 s to arm it. Then protect it until it completes its 35 s charge.' : 'Guard the sites. If Ember arms the Beacon, hold E on it for 5 s to disarm it — or tag out every Ember.'; }, keys: () => [K('use')], hint: 'Hold E on a site' },
  ];
  const stepDots = h('div', { class: 'st' }, steps.map(() => h('i')));
  const title = h('h4'), text = h('p'), keys = h('div', { class: 'keys' }), fill = h('i'), hint = h('span'), stepName = h('span');
  const skip = h('button', { onClick: () => A.tutorialSkip() }, 'Skip tutorial');
  const next = h('button', { onClick: () => advance() }, 'Next step');
  const el = h('div', { class: 'fx-card fx-tut', hidden: true, 'aria-live': 'polite' },
    h('div', { class: 'hd' }, h('span', null, 'Training'), stepName, stepDots),
    title, text, keys, h('div', { class: 'bar' }, fill), h('div', { class: 'ft' }, hint, h('span', { style: { display: 'flex', gap: 'calc(1*var(--u))' } }, next, skip)));
  const off = [];
  const mine = (d) => !d?.actor || d.actor === ctx.localActor;
  function bind() {
    off.push(ctx.events.on('jump', (d) => { if (mine(d)) S.jumped = true; }));
    off.push(ctx.events.on('weapon:fire', (d) => { if (d?.actor === ctx.localActor) S.fired = true; }));
    off.push(ctx.events.on('buy', (d) => { if (mine(d)) S.bought = true; }));
    off.push(ctx.events.on('beacon:arm', (d) => { if (mine(d)) S.beacon = true; }));
    off.push(ctx.events.on('beacon:armed', (d) => { if (mine(d)) S.beacon = true; }));
    off.push(ctx.events.on('beacon:disarm', (d) => { if (mine(d)) S.beacon = true; }));
    off.push(ctx.events.on('match:end', () => api.stop()));
    off.push(ctx.events.on('round:end', () => { if (S.active && S.i < steps.length) { A.setTutorialDone(); api.stop(); } }));
  }
  function render() {
    const s = steps[S.i]; if (!s) return;
    el.classList.remove('done', 'ok'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    stepName.textContent = `· ${S.i + 1}/${steps.length} ${s.name}`; stepName.style.marginLeft = 'calc(.3*var(--u))'; stepName.style.color = 'var(--mute)';
    title.textContent = s.title; text.textContent = s.text; hint.textContent = s.hint; fill.style.width = '0%';
    keys.replaceChildren(...s.keys().flatMap((grp, i) => [...(i ? [h('span', { style: { margin: '0 calc(.3*var(--u))' } }, '·')] : []), ...grp.map((k) => h('span', { class: 'fx-key' }, k))]));
    [...stepDots.children].forEach((d, i) => { d.className = i < S.i ? 'd' : i === S.i ? 'c' : ''; });
    next.textContent = S.i === steps.length - 1 ? 'Finish' : 'Next step (N)';
  }
  function begin(i) {
    S.i = i; S.prog = 0; S.wait = 0; S.dist = 0; S.yaw = 0; S.fired = false; S.jumped = false; S.bought = false; S.buyOpened = false; S.beacon = false;
    const a = ctx.localActor; if (a) { S.lastX = a.pos.x; S.lastZ = a.pos.z; S.lastYaw = a.yaw; }
    render();
  }
  function advance() {
    ctx.events.emit('ui:click');
    if (S.i >= steps.length - 1) { finish(); return; }
    begin(S.i + 1);
  }
  function finish() {
    A.setTutorialDone(); title.textContent = 'You are ready'; text.textContent = 'Win rounds, bank credits, and learn the sites. Press F1 any time for the controls sheet. Good luck.'; keys.replaceChildren(); hint.textContent = 'Training complete'; fill.style.width = '100%'; el.classList.add('ok', 'done');
    stepDots.querySelectorAll('i').forEach((d) => { d.className = 'd'; }); S.finishT = 3.4; S.i = steps.length; next.hidden = skip.hidden = true;
  }
  const onKey = (e) => { if (!S.active || !A.inGame()) return; if (e.code === 'KeyN' && !e.repeat && S.i < steps.length) advance(); };
  const api = {
    el, get active() { return S.active; },
    start(from = 0) { if (S.active) return; S.active = true; S.age = 0; bind(); addEventListener('keydown', onKey); next.hidden = skip.hidden = false; el.hidden = false; begin(from); },
    stop() { if (!S.active) return; S.active = false; off.splice(0).forEach((f) => f()); removeEventListener('keydown', onKey); el.hidden = true; },
    show(v) { el.hidden = !v || !S.active; },
    stepTo(i) { if (!S.active) this.start(i); else begin(i); },
    debugFinish() { finish(); },
    update(dt) {
      if (!S.active) return;
      S.age = (S.age || 0) + dt; if (S.age > 170 && S.i < steps.length) { A.setTutorialDone(); api.stop(); return; }
      const ph = ctx.match?.phase; el.style.visibility = (ph === 'roundEnd' || ph === 'matchEnd' || ph === 'halftime') ? 'hidden' : '';
      if (S.i >= steps.length) { S.finishT -= dt; if (S.finishT <= 0) api.stop(); return; }
      const a = ctx.localActor; const s = steps[S.i]; if (!a) return;
      const dx = a.pos.x - S.lastX, dz = a.pos.z - S.lastZ, d = Math.hypot(dx, dz); if (d < 2) S.dist += d; S.lastX = a.pos.x; S.lastZ = a.pos.z;
      let dy = a.yaw - S.lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); S.yaw += Math.abs(dy); S.lastYaw = a.yaw;
      if (ctx.input?.pressed?.('jump')) S.jumped = true; if (ctx.input?.pressed?.('buy')) S.buyOpened = true;
      let p = 0;
      if (s.id === 'move') p = Math.min(1, S.dist / 10) * .8 + (S.jumped ? .2 : 0);
      else if (s.id === 'aim') p = Math.min(1, S.yaw / 2.2) * .5 + (S.fired ? .5 : 0);
      else if (s.id === 'buy') p = S.bought ? 1 : S.buyOpened ? .45 : 0;
      else if (s.id === 'beacon') { const bc = ctx.match?.beacon; p = S.beacon ? 1 : (bc && (bc.state === 'arming' || bc.state === 'disarming') && bc.carrier === a || bc?.state === 'disarming' ? Math.max(.2, bc.progress || 0) : 0); if (bc?.state === 'armed' && team() === 'ember') p = 1; }
      S.prog += (p - S.prog) * Math.min(1, dt * 10); fill.style.width = (S.prog * 100).toFixed(1) + '%';
      if (p >= 1 && !S.wait) { S.wait = .9; el.classList.add('ok'); ctx.events.emit('ui:click'); }
      if (S.wait) { S.wait -= dt; if (S.wait <= 0) advance(); }
    },
  };
  return api;
}
