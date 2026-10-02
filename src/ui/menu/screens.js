// Screen builders: boot, main menu, help/cheat-sheet, credits, pause, match-end recap.
import { h, ICON, keyLabel, makeControls } from './ui.js';
import { logoSVG, emblemSVG } from './logo.js';

export const TIPS = [
  ['MOVEMENT', 'Counter-strafe: tap the opposite direction key to stop dead before you tag. Accuracy returns instantly.'],
  ['MOVEMENT', 'Hold Shift to walk silently. Footsteps carry a long way in Crux Station.'],
  ['ECONOMY', 'Losing streaks pay more each round. A well-timed eco round can win you the half.'],
  ['UTILITY', 'Haze blocks vision, Strobe blinds everyone facing it, Pulse drains Charge in an area — combine them.'],
  ['BEACON', 'Arming takes 3.2 s. Get a teammate to cover you, or Haze the site first.'],
  ['AIM', 'Crown shots deal 4× Charge. Keep your crosshair at head height as you round corners.'],
  ['TEAMWORK', 'Press V to ping. Your bots react to callouts — use them.'],
  ['TAGGERS', 'Arc hits hard but kicks; Rail is easier to control. Learn the spray pattern in Practice Range.'],
];

const DIFFS = [['rookie', 'Rookie', 'Forgiving aim, slow reactions', 1], ['pro', 'Pro', 'Solid aim, uses utility', 2], ['elite', 'Elite', 'Fast, precise, coordinated', 3]];
const SIDES = [['ember', 'Ember', 'Attack · carry the Beacon', '255,122,47'], ['tide', 'Tide', 'Defend · hold the sites', '47,208,255'], ['random', 'Random', 'Coin flip', '255,255,255']];

const mapThumb = () => `<svg viewBox="0 0 120 68" preserveAspectRatio="xMidYMid slice"><rect width="120" height="68" fill="#0d1622"/>
<g stroke="rgba(120,180,220,.14)" stroke-width=".5">${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 10} 0V68"/>`).join('')}${Array.from({ length: 7 }, (_, i) => `<path d="M0 ${i * 10}H120"/>`).join('')}</g>
<g fill="#233246" stroke="#3f5a78" stroke-width=".8"><rect x="8" y="8" width="34" height="20"/><rect x="60" y="6" width="50" height="16"/><rect x="8" y="42" width="30" height="18"/><rect x="52" y="40" width="58" height="20"/><rect x="44" y="28" width="22" height="10" fill="#2c3d55"/></g>
<path d="M4 34H116" stroke="#4f7ba3" stroke-width="2" stroke-dasharray="4 3" opacity=".8"/>
<circle cx="26" cy="18" r="6" fill="rgba(255,122,47,.25)" stroke="#ff7a2f" stroke-width="1"/><text x="26" y="20.5" font-family="Barlow Condensed,Arial" font-weight="800" font-size="8" text-anchor="middle" fill="#ff7a2f">A</text>
<circle cx="92" cy="52" r="6" fill="rgba(47,208,255,.22)" stroke="#2fd0ff" stroke-width="1"/><text x="92" y="54.5" font-family="Barlow Condensed,Arial" font-weight="800" font-size="8" text-anchor="middle" fill="#2fd0ff">B</text>
<rect x="100" y="24" width="12" height="9" fill="#ff7a2f" opacity=".85"/><rect x="6" y="36" width="12" height="9" fill="#2fd0ff" opacity=".85"/></svg>`;

export function buildBoot() {
  const fill = h('div', { class: 'fill' }), label = h('span', null, 'Initialising'), pct = h('b', null, '0%');
  const press = h('div', { class: 'press' }, 'Press any key');
  const el = h('div', { class: 'fx-screen fx-boot on' },
    h('div', { class: 'glow' }),
    h('div', { class: 'stage' }, h('div', { class: 'lg', html: logoSVG({ animate: true }) })),
    h('div', { class: 'pb' }, h('div', { class: 'trk' }, fill), h('div', { class: 'inf' }, label, pct)),
    press);
  return { el, set(p, text) { fill.style.width = Math.round(p * 100) + '%'; pct.textContent = Math.round(p * 100) + '%'; if (text) label.textContent = text; } };
}

export function buildMain(ctx, A) {
  const rows = [
    { id: 'play', label: 'Play Match', sub: '5v5 · vs bots', pri: true, act: () => A.play() },
    { id: 'range', label: 'Practice Range', sub: 'Aim & movement', act: () => A.play({ practice: true }) },
    { id: 'locker', label: 'Locker', sub: 'Cosmetics & loadout', act: () => A.openLocker() },
    { id: 'settings', label: 'Settings', sub: 'Controls · video · audio', act: () => A.open('settings') },
    { id: 'help', label: 'How to Play', sub: 'Rules & keys', act: () => A.open('help') },
    { id: 'credits', label: 'Credits', sub: '', act: () => A.open('credits') },
  ];
  const menu = h('ul', { class: 'fx-menu', role: 'menu' }, rows.map((r, i) => h('li', { role: 'none' }, h('button', {
    class: 'fx-mi fx-in' + (r.pri ? ' pri' : ''), role: 'menuitem', style: { '--i': i + 3 }, 'data-id': r.id, 'data-autofocus': r.pri ? '' : null, onClick: r.act,
  }, r.pri ? h('span', { class: 'shine' }) : null, h('span', { class: 'n' }, String(i + 1).padStart(2, '0')), h('span', null, r.label), h('span', { class: 'sub' }, r.sub)))));
  const P = A.pref;
  const diff = h('div', { class: 'fx-seg', role: 'radiogroup', 'aria-label': 'Difficulty' }, DIFFS.map(([id, name, d, n]) => h('button', { role: 'radio', 'data-v': id, title: d, onClick: () => { P.set('difficulty', id); paint(); } }, name, h('span', { class: 'dots' }, [1, 2, 3].map((i) => h('i', { class: i <= n ? 'f' : '' }))))));
  const side = h('div', { class: 'fx-seg side', role: 'radiogroup', 'aria-label': 'Side' }, SIDES.map(([id, name, d, c]) => h('button', { role: 'radio', 'data-v': id, style: { '--c': c }, title: d, onClick: () => { P.set('side', id); paint(); } }, h('span', { class: 'sw' + (id === 'random' ? ' rnd' : '') }), name)));
  const diffEm = h('em'), sideEm = h('em');
  const paint = () => {
    for (const b of diff.children) b.classList.toggle('on', b.dataset.v === P.get('difficulty'));
    for (const b of side.children) b.classList.toggle('on', b.dataset.v === P.get('side'));
    diffEm.textContent = DIFFS.find((d) => d[0] === P.get('difficulty'))?.[2] || ''; sideEm.textContent = SIDES.find((d) => d[0] === P.get('side'))?.[2] || '';
  };
  paint();
  const go = h('button', { class: 'fx-go fx-inR', 'data-id': 'go', onClick: () => A.play() }, h('span', { class: 'shine' }), h('span', null, 'Play'), h('span', { class: 'fx-key' }, 'Enter'));
  const card = h('div', { class: 'fx-card fx-setup fx-inR' },
    h('div', { class: 'fx-h' }, h('b', null, 'Match'), 'setup'),
    h('div', { class: 'fx-lab', style: { marginTop: 0 } }, 'Bot difficulty', diffEm), diff,
    h('div', { class: 'fx-lab' }, 'Your side', sideEm), side,
    h('div', { class: 'fx-lab' }, 'Map', h('em', null, '1 of 1')),
    h('div', { class: 'fx-map' }, h('div', { class: 'th', html: mapThumb() }), h('div', null, h('div', { class: 'nm' }, 'Crux Station'), h('div', { class: 'ds' }, 'Two Beacon sites · long mid · catwalk')), h('div', { class: 'ok', html: ICON.check })),
    go,
    h('button', { class: 'fx-go2', onClick: () => A.play({ practice: true }) }, h('span', null, 'Practice range'), h('small', null, 'No bots, no timer')),
    h('div', { class: 'fx-rules' }, h('span', null, h('b', null, 'First to 8'), ' rounds'), h('span', null, h('b', null, '5v5'), ' · you + 4 bots'), h('span', null, h('b', null, 'Halves'), ' swap sides')));
  const tip = h('span', { class: 'tip' });
  let ti = Math.floor(Math.random() * TIPS.length), tt = 0;
  const showTip = () => { const t = TIPS[ti % TIPS.length]; tip.replaceChildren(h('b', null, t[0]), t[1]); };
  showTip();
  const nameChip = h('button', { class: 'fx-chip', onClick: () => A.open('settings', 'controls'), title: 'Change callsign' }, h('span', { class: 'fx-avatar' }), h('b', null, A.name()));
  const el = h('div', { class: 'fx-screen fx-main' },
    h('div', { class: 'fx-top' }, h('div', { class: 'fx-brand', html: emblemSVG() + '<span>Flux Tag</span>' }), h('span', { class: 'fx-spacer' }), nameChip,
      h('button', { class: 'fx-ico', 'aria-label': 'Fullscreen', title: 'Fullscreen', html: ICON.full, onClick: () => A.fullscreen() }), h('button', { class: 'fx-ico', 'aria-label': 'Settings', title: 'Settings', html: ICON.gear, onClick: () => A.open('settings') })),
    h('div', { class: 'col-l' }, h('div', { class: 'fx-logo fx-in', style: { '--i': 0 }, html: logoSVG() }), h('div', { class: 'fx-tag fx-in', style: { '--i': 1 } }, h('i'), 'Competitive tag sport'), menu, h('div', { class: 'fx-ver' }, 'Build ', A.version)),
    card,
    h('div', { class: 'fx-foot' }, tip, h('span', { class: 'fx-spacer' }),
      h('span', { class: 'fx-hint' }, h('span', { class: 'fx-key' }, '↑'), h('span', { class: 'fx-key' }, '↓'), 'Navigate'), h('span', { class: 'fx-hint' }, h('span', { class: 'fx-key' }, 'Enter'), 'Select'), h('span', { class: 'fx-hint' }, h('span', { class: 'fx-key' }, 'F1'), 'Controls')));
  return {
    el, paint, refreshName() { nameChip.lastChild.textContent = A.name(); },
    tick(dt) { tt += dt; if (tt > 8) { tt = 0; ti++; tip.style.opacity = 0; setTimeout(() => { showTip(); tip.style.opacity = 1; }, 380); } },
  };
}

// ---- help / cheat sheet ----
export function buildHelp(ctx, A, { compact = false } = {}) {
  const grp = (t, list) => h('div', { class: 'g' }, h('h4', null, t), ...list.map(([label, keys]) => h('div', { class: 'r' }, h('span', null, label), h('span', { style: { display: 'flex', gap: '.35rem' } }, keys.filter(Boolean).map((k) => h('span', { class: 'fx-key' }, k))))));
  const body = h('div');
  const build = () => {
    const b = A.binds(); const K = (a) => (b[a] || []).filter(Boolean).map(keyLabel);
    const move = grp('Move', [['Forward / back', [K('forward')[0], K('back')[0]]], ['Strafe', [K('left')[0], K('right')[0]]], ['Jump', K('jump')], ['Crouch / slide', K('crouch')], ['Walk quietly', K('walk')], ['Bunny-hop', ['Jump', '+', 'Strafe']]]);
    const fight = grp('Tag', [['Fire', ['Mouse 1']], ['Scope / aim', ['Mouse 2']], ['Reload', K('reload')], ['Inspect', K('inspect')], ['Drop tagger', K('drop')], ['Last tagger', K('lastWeapon')]]);
    const team = grp('Team', [['Buy menu', K('buy')], ['Scoreboard', K('scoreboard')], ['Use / arm Beacon', K('use')], ['Ping', K('ping')], ['Slots 1–5', ['1', '–', '5']], ['Cycle utility', K('utilitySwap')]]);
    body.replaceChildren(h('div', { class: 'fx-help' }, move, fight, team,
      h('div', { class: 'fx-rules-box' },
        h('div', { class: 'fx-rb' }, h('div', { class: 'no' }, '01 · GOAL'), h('b', null, 'Tag them out'), h('p', null, 'Your Charge is your health. Drain a rival to zero and they freeze, shatter into light, and sit out the round.')),
        h('div', { class: 'fx-rb' }, h('div', { class: 'no' }, '02 · BEACON'), h('b', null, 'Arm or disarm'), h('p', null, 'Ember carries one Beacon: hold E at site A or B for 3.2 s. It charges for 35 s. Tide disarms it in 5 s (faster with a Kit).')),
        h('div', { class: 'fx-rb' }, h('div', { class: 'no' }, '03 · ECONOMY'), h('b', null, 'Buy smart'), h('p', null, 'You start with 800 credits. Wins pay 3250, losses 1400 plus streak bonus. Survivors keep their gear.')),
        h('div', { class: 'fx-rb' }, h('div', { class: 'no' }, '04 · FIRST TO 8'), h('b', null, 'Win the match'), h('p', null, 'Halves swap sides after 7 rounds. Utility — Haze, Strobe, Pulse — wins rounds. Learn it in the Practice Range.')))));
  };
  build();
  const els = compact ? h('div', { class: 'fx-screen fx-cheat' }, h('div', { class: 'fx-layer fx-dim' }), h('div', { class: 'fx-card', style: { position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%', width: 'min(84rem,94vw)', padding: '1.6rem 2rem' } }, h('div', { class: 'fx-h' }, h('b', null, 'Controls'), 'cheat-sheet', h('span', { class: 'fx-hint', style: { marginLeft: 'auto' } }, h('span', { class: 'fx-key' }, 'F1'), 'Close')), body))
    : h('div', { class: 'fx-screen fx-helpscr' }, h('div', { class: 'fx-layer fx-dim' }), h('div', { class: 'fx-card fx-sheet' },
      h('div', { class: 'fx-sh-head' }, h('h2', null, 'How to ', h('i', null, 'Play')), h('span', { class: 'fx-spacer' }), h('button', { class: 'fx-btn sm', onClick: () => A.replayTutorial() }, 'Replay tutorial'), h('button', { class: 'fx-x', 'aria-label': 'Close', onClick: () => A.back(), html: ICON.x })),
      h('div', { class: 'fx-pane', style: { padding: '1.6rem 2.4rem' } }, body),
      h('div', { class: 'fx-sh-foot' }, h('span', { class: 'fx-hint' }, h('span', { class: 'fx-key' }, 'Esc'), 'Back'), h('span', { class: 'fx-spacer' }), h('span', null, 'Bindings shown are your current keys'))));
  return { el: els, refresh: build };
}

export function buildCredits(ctx, A) {
  return h('div', { class: 'fx-screen fx-creditscr' }, h('div', { class: 'fx-layer fx-dim' }), h('div', { class: 'fx-card fx-sheet', style: { width: 'min(56rem,94vw)' } },
    h('div', { class: 'fx-sh-head' }, h('h2', null, 'Cred', h('i', null, 'its')), h('span', { class: 'fx-spacer' }), h('button', { class: 'fx-x', 'aria-label': 'Close', onClick: () => A.back(), html: ICON.x })),
    h('div', { class: 'fx-pane', style: { padding: '1rem 2rem 2rem' } }, h('div', { class: 'fx-cred' },
      h('div', { html: logoSVG(), style: { width: '17rem', margin: '0 auto' } }),
      h('h3', null, 'Concept & direction'), h('p', null, 'Jayden Urizar'),
      h('h3', null, 'Built with'), h('p', null, 'Claude Code'), h('small', null, 'Every model, texture, animation and sound is generated procedurally in code — no external assets.'),
      h('h3', null, 'Tech'), h('p', null, 'three.js · three-mesh-bvh · WebAudio'), h('small', null, 'Typography: Barlow & Barlow Condensed (SIL OFL).'),
      h('h3', null, 'Inspiration'), h('p', null, 'The polish of Counter-Strike 2'), h('small', null, 'FLUX TAG is an original, non-violent tag sport. It is not affiliated with or endorsed by Valve Corporation.'))),
    h('div', { class: 'fx-sh-foot' }, h('span', { class: 'fx-hint' }, h('span', { class: 'fx-key' }, 'Esc'), 'Back'))));
}

export function buildPause(ctx, A) {
  const K = makeControls(ctx), S = ctx.settings;
  const sens = K.slider({ min: .1, max: 8, step: .01, def: 1, get: () => S.get('sensitivity') ?? 1, set: (v) => S.set('sensitivity', v), fmt: (v) => v.toFixed(2), label: 'Sensitivity' });
  const vol = K.slider({ min: 0, max: 1, step: .01, def: .8, get: () => S.get('volume') ?? .8, set: (v) => S.set('volume', v), fmt: (v) => Math.round(v * 100), unit: '%', label: 'Master volume' });
  const qrow = (l, c) => h('div', { class: 'qr' }, h('span', null, l), c.el);
  const sub = h('div', { class: 'sub' }, 'Match in progress');
  const mk = (cls, label, key, fn, id) => h('button', { class: 'fx-pb ' + cls, 'data-id': id, 'data-autofocus': id === 'resume' ? '' : null, onClick: fn }, h('span', null, label), key ? h('span', { class: 'fx-key' }, key) : null);
  const box = h('div', { class: 'fx-card fx-pbox fx-inU' }, h('div', { class: 'ttl' }, 'Paused'), sub,
    h('div', { class: 'list' }, mk('pri', 'Resume', 'Esc', () => A.resume(), 'resume'), mk('', 'Settings', '', () => A.open('settings'), 'settings'), mk('', 'Controls', 'F1', () => A.open('cheat'), 'controls'), mk('danger', 'Leave match', '', () => A.confirmLeave(), 'leave')),
    h('div', { class: 'fx-quick' }, qrow('Sensitivity', sens), qrow('Master volume', vol)),
    h('div', { class: 'foot' }, 'Click Resume to recapture the mouse'));
  const el = h('div', { class: 'fx-screen fx-pause' }, h('div', { class: 'fx-layer fx-dim' }), box);
  return {
    el, refresh() {
      const m = ctx.match; let t = 'Match in progress';
      if (m && !m.__stub && m.scores) t = `Round ${m.round || 1} · Ember ${m.scores.ember ?? 0} – ${m.scores.tide ?? 0} Tide`;
      sub.textContent = t; sens.refresh(); vol.refresh();
    },
  };
}

export function fakeEndData(ctx, winner = 'ember') {
  const names = { ember: ['You', 'Kestrel', 'Nova', 'Bolt', 'Ripley'], tide: ['Marlin', 'Sable', 'Quill', 'Onyx', 'Vega'] };
  const mk = (team) => names[team].map((n, i) => ({ name: n, team, isPlayer: n === 'You', stats: { tags: 14 - i * 2 + (team === winner ? 3 : 0), outs: 6 + i, assists: i % 3, damage: 1800 - i * 210, score: 34 - i * 5 + (team === winner ? 9 : 0) } }));
  const teams = { ember: mk('ember'), tide: mk('tide') };
  const all = [...teams.ember, ...teams.tide]; const mvp = all.filter((a) => a.team === winner).sort((a, b) => b.stats.score - a.stats.score)[0];
  return { winner, teams, mvp, scores: winner === 'ember' ? { ember: 8, tide: 5 } : { ember: 5, tide: 8 }, playerTeam: 'ember', history: Array.from({ length: 13 }, (_, i) => ({ n: i + 1, winner: [0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0].map((x) => (x ? 'tide' : 'ember'))[i], reason: 'tagged' })), fake: true };
}

export function buildEnd(ctx, A, data) {
  const m = ctx.match || {};
  const d = data || {};
  const teams = d.teams || m.teams || { ember: [], tide: [] };
  const scores = d.scores || m.scores || { ember: 0, tide: 0 };
  const winner = d.winner || (scores.ember > scores.tide ? 'ember' : 'tide');
  const my = d.playerTeam || m.playerTeam || ctx.localActor?.team || 'ember';
  const won = d.playerWon ?? (winner === my);
  const all = [...(teams.ember || []), ...(teams.tide || [])];
  const mvp = d.mvp || m.mvp || [...all].sort((a, b) => (b.stats?.score || 0) - (a.stats?.score || 0))[0];
  const col = (t) => (t === 'ember' ? '255,122,47' : '47,208,255');
  const table = (team) => {
    const list = [...(teams[team] || [])].sort((a, b) => (b.stats?.score || 0) - (a.stats?.score || 0));
    return h('div', { class: 'fx-card fx-tb fx-inU', style: { '--i': team === 'ember' ? 2 : 3 } },
      h('div', { class: 'th', style: { '--c': col(team) } }, h('s'), team === 'ember' ? 'Ember' : 'Tide', team === my ? h('span', { style: { color: 'var(--dim)', fontSize: '.7em', letterSpacing: '.2em' } }, 'your team') : null, h('i', null, scores[team] ?? 0)),
      h('table', null, h('thead', null, h('tr', null, ['Player', 'Tags', 'Outs', 'Ast', 'Dmg', 'Score'].map((c) => h('th', { class: 'c' }, c)))),
        h('tbody', null, list.map((a) => { const s = a.stats || {}; return h('tr', { class: (a.isPlayer ? 'me ' : '') + (a === mvp ? 'mvp' : '') }, h('td', null, a === mvp ? h('span', { class: 'star', html: '★' }) : null, a.name), h('td', null, s.tags ?? 0), h('td', null, s.outs ?? 0), h('td', null, s.assists ?? 0), h('td', null, Math.round(s.damage ?? 0)), h('td', null, s.score ?? 0)); }))));
  };
  const hist = (d.history || m.history || []).slice(0, 30);
  const reasonMap = { tagged: 'T', armed: 'B', beacon: 'B', disarmed: 'D', time: 'C' };
  const el = h('div', { class: 'fx-screen fx-end', style: { '--acc-rgb': won ? col(my) : '255,93,108' } },
    h('div', { class: 'fx-layer fx-dim fx-enddim' }),
    h('div', { class: 'fx-etop' }, h('div', { class: 'res fx-inU' }, won ? 'Victory' : 'Defeat'),
      h('div', { class: 'sc fx-inU', style: { '--i': 1 } }, h('span', { class: 'e' }, scores.ember ?? 0), h('i', null, 'EMBER · TIDE'), h('span', { class: 't' }, scores.tide ?? 0)),
      h('div', { class: 'reason fx-inU', style: { '--i': 1 } }, (winner === 'ember' ? 'Ember' : 'Tide') + ' wins the match')),
    h('div', { class: 'fx-ebody' }, table('ember'), table('tide'),
      mvp ? h('div', { class: 'fx-card fx-mvp fx-inU', style: { '--i': 4 } }, h('div', { class: 'st', html: ICON.star }), h('div', { class: 'who' }, h('small', null, 'Match MVP'), h('b', null, mvp.name), h('em', null, `${mvp.stats?.tags ?? 0} tags · ${Math.round(mvp.stats?.damage ?? 0)} Charge drained`)),
        hist.length ? h('div', { class: 'fx-hist', title: 'Round history' }, hist.map((r) => h('i', { style: { '--c': col(r.winner) } }, reasonMap[r.reason] || ''))) : null) : null),
    h('div', { class: 'fx-eact fx-inU', style: { '--i': 5 } }, h('button', { class: 'fx-go', 'data-autofocus': '', onClick: () => A.playAgain() }, h('span', { class: 'shine' }), h('span', null, 'Play again')), h('button', { class: 'fx-btn', onClick: () => A.toMenu() }, 'Main menu')));
  return { el };
}
