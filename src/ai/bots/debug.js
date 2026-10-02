// Debug: in-world overlay (paths / aim / vision / targets), per-bot state dump, telemetry summary, `?scene=bot-lab`.
import * as THREE from 'three';
import { K } from './config.js';

const COL = { ember: [1, 0.55, 0.2], tide: [0.2, 0.85, 1] };

export function createDebug(B, api) {
  const { ctx } = B;
  const D = { on: false, text: false, line: null, geo: null, pos: null, col: null, cap: 6000, n: 0, el: null, followIdx: -1, view: null, camSys: null, adopted: [] };

  function ensureLines() {
    if (D.line || !ctx.render?.scene) return;
    D.pos = new Float32Array(D.cap * 3); D.col = new Float32Array(D.cap * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(D.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(D.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const m = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.95, toneMapped: false });
    D.line = new THREE.LineSegments(g, m); D.line.frustumCulled = false; D.line.renderOrder = 999; D.line.name = 'bot-debug';
    ctx.render.scene.add(D.line); D.geo = g;
    const pg = new THREE.BufferGeometry(); D.ppos = new Float32Array(16 * 3); D.pcol = new Float32Array(16 * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(D.ppos, 3).setUsage(THREE.DynamicDrawUsage)); pg.setAttribute('color', new THREE.BufferAttribute(D.pcol, 3).setUsage(THREE.DynamicDrawUsage)); pg.setDrawRange(0, 0);
    D.pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 11, sizeAttenuation: false, vertexColors: true, depthTest: false, transparent: true, toneMapped: false })); D.pts.frustumCulled = false; D.pts.renderOrder = 1000; ctx.render.scene.add(D.pts);
  }
  const seg = (x0, y0, z0, x1, y1, z1, c) => {
    if (D.n + 2 > D.cap) return; const i = D.n * 3;
    D.pos[i] = x0; D.pos[i + 1] = y0; D.pos[i + 2] = z0; D.pos[i + 3] = x1; D.pos[i + 4] = y1; D.pos[i + 5] = z1;
    D.col[i] = D.col[i + 3] = c[0]; D.col[i + 1] = D.col[i + 4] = c[1]; D.col[i + 2] = D.col[i + 5] = c[2]; D.n += 2;
  };
  const WHITE = [1, 1, 1], RED = [1, 0.2, 0.2], YEL = [1, 0.9, 0.2], GRN = [0.3, 1, 0.4], PUR = [0.8, 0.4, 1], GRY = [0.5, 0.5, 0.5];

  function draw() {
    if (!D.on) { if (D.line) D.line.visible = D.pts.visible = false; return; }
    ensureLines(); if (!D.line) return; D.line.visible = D.pts.visible = true; D.n = 0; let np = 0;
    for (const b of B.bots) {
      const a = b.actor, ai = b.ai; if (!a.alive) continue;
      const c = COL[a.team] || WHITE, x = a.pos.x, y = a.pos.y + 0.1, z = a.pos.z, ey = a.pos.y + (a.eyeHeight || 1.6);
      if (np < 16) { D.ppos[np * 3] = x; D.ppos[np * 3 + 1] = a.pos.y + 2.3; D.ppos[np * 3 + 2] = z; D.pcol[np * 3] = c[0]; D.pcol[np * 3 + 1] = c[1]; D.pcol[np * 3 + 2] = c[2]; np++; }
      // marker cross
      seg(x - 1, y, z, x + 1, y, z, c); seg(x, y, z - 1, x, y, z + 1, c); seg(x - 0.7, y, z - 0.7, x + 0.7, y, z + 0.7, c); seg(x - 0.7, y, z + 0.7, x + 0.7, y, z - 0.7, c); seg(x, y, z, x, y + 2, z, c);
      // aim ray
      const cp = Math.cos(ai.aim.pitch); const L = 6;
      seg(x, ey, z, x - Math.sin(ai.aim.yaw) * cp * L, ey + Math.sin(ai.aim.pitch) * L, z - Math.cos(ai.aim.yaw) * cp * L, ai.target ? RED : YEL);
      // vision cone edges
      const h = ai.diff.fov * Math.PI / 360;
      for (const s of [-1, 1]) { const yy = ai.aim.yaw + s * h; seg(x, ey, z, x - Math.sin(yy) * 7, ey, z - Math.cos(yy) * 7, GRY); }
      // path
      const mv = ai.mv;
      if (mv.has && mv.path) { let px = x, py = y + 0.2, pz = z; for (let i = mv.pi; i < mv.path.length; i++) { const q = mv.path[i]; seg(px, py, pz, q.x, q.y + 0.2, q.z, GRN); px = q.x; py = q.y + 0.2; pz = q.z; } }
      else if (mv.has) seg(x, y, z, mv.goal.x, mv.goal.y + 0.2, mv.goal.z, GRY);
      // target / memory
      if (ai.target) seg(x, ey, z, ai.target.actor.pos.x, ai.target.actor.pos.y + 1.4, ai.target.actor.pos.z, RED);
      for (const m of ai.mem.values()) { if (m.vis || B.now - m.t > 4 || !m.actor.alive) continue; seg(x, y + 0.5, z, m.pos.x, m.pos.y + 0.5, m.pos.z, PUR); seg(m.pos.x - 0.3, m.pos.y + 0.5, m.pos.z, m.pos.x + 0.3, m.pos.y + 0.5, m.pos.z, PUR); }
      if (ai.util?.cur) { const t = ai.util.cur.target; seg(x, ey, z, t.x, t.y, t.z, [0.3, 0.6, 1]); }
      if (ai.stuckNow) { seg(x - 0.6, y + 2.2, z, x + 0.6, y + 2.2, z, RED); }
    }
    D.geo.setDrawRange(0, D.n); D.geo.attributes.position.needsUpdate = true; D.geo.attributes.color.needsUpdate = true;
    D.pts.geometry.setDrawRange(0, np); D.pts.geometry.attributes.position.needsUpdate = true; D.pts.geometry.attributes.color.needsUpdate = true;
  }

  function stateOf(b) {
    const a = b.actor, ai = b.ai, o = ai.order, wi = ai.wi, mv = ai.mv;
    return {
      name: a.name, team: a.team, diff: ai.diff.id, alive: a.alive, hp: a.hp, pos: [+a.pos.x.toFixed(1), +a.pos.y.toFixed(1), +a.pos.z.toFixed(1)], speed: +(a.move?.speed || 0).toFixed(1),
      area: ctx.nav?.areaAt?.(a.pos) || '', role: ai.role, order: o ? `${o.kind}${o.role ? ':' + o.role : ''}${o.nodeId ? '@' + o.nodeId : ''}${o.waiting ? ' (wait)' : ''}` : '-',
      arrived: mv.arrived, path: mv.path ? `${mv.pi}/${mv.path.length}` : '-', stuck: +ai.stuckTotal.toFixed(1), tele: ai.teleports,
      target: ai.target ? ai.target.actor.name : '-', style: ai.fp.style + '/' + ai.fp.phase, wpn: `${wi.id}${wi.reloading ? '(R)' : ''} ${wi.mag}/${wi.reserve}`, util: ai.util?.state + (ai.util?.orders?.length ? '+' + ai.util.orders.length : ''),
      known: [...ai.mem.values()].filter((m) => m.actor.alive && B.now - m.t < K.memoryTime).map((m) => `${m.actor.name}:${m.src}:${(B.now - m.t).toFixed(1)}s`).join(' '),
      kd: `${ai.kills}/${ai.deaths}`, aimErrM: +(ai.aim.errM || 0).toFixed(2),
    };
  }
  const dump = (who) => { const b = typeof who === 'string' ? B.bots.find((x) => x.actor.name === who) : who?.ai ? B.bots.find((x) => x.actor === who) : B.bots[who ?? 0]; return b ? stateOf(b) : null; };

  function text() {
    const m = ctx.match, l = [];
    l.push(`BOT LAB  t=${B.now.toFixed(1)}s phase=${m?.phase} round=${m?.round} score E${m?.scores?.ember}:${m?.scores?.tide}T beacon=${m?.beacon?.state}${m?.beacon?.site ? '@' + m.beacon.site : ''} fuse=${(m?.beacon?.fuseLeft || 0).toFixed(1)}`);
    const t = B.tel; l.push(`telemetry: rounds=${t.rounds.length} tags=${t.kills.total} stuck=${t.stuckTime.toFixed(1)}s/${t.stuckIncidents}inc teleports=${t.teleports} throws=${t.throws || 0} cpu=${(t.cpu.ticks ? t.cpu.ms / t.cpu.ticks : 0).toFixed(3)}ms/tick max ${t.cpu.max.toFixed(2)}`);
    l.push('name     tm  hp  area              order                    tgt     style         wpn          util    kd');
    for (const b of B.bots) { const s = stateOf(b); l.push(`${s.name.padEnd(8)} ${s.team.slice(0, 2)} ${String(Math.round(s.hp)).padStart(3)} ${(s.area || '').slice(0, 16).padEnd(17)} ${s.order.slice(0, 24).padEnd(24)} ${s.target.padEnd(7)} ${s.style.padEnd(13)} ${s.wpn.padEnd(12)} ${String(s.util).padEnd(7)} ${s.kd}${s.alive ? '' : ' x'}${s.stuck > 1 ? ' STUCK' + s.stuck : ''}`); }
    return l.join('\n');
  }
  function showText(on) {
    D.text = on;
    if (on && !D.el) { const el = document.createElement('pre'); el.id = 'bot-lab-overlay'; el.style.cssText = 'position:fixed;left:8px;top:8px;margin:0;padding:6px 8px;z-index:9999;pointer-events:none;font:10.5px/1.25 ui-monospace,Menlo,Consolas,monospace;color:#e6eefc;background:rgba(8,10,16,.8);border:1px solid rgba(255,255,255,.12);border-radius:4px;white-space:pre;max-width:98vw;overflow:hidden'; document.body.appendChild(el); D.el = el; }
    if (D.el) D.el.style.display = on ? 'block' : 'none';
  }
  let tAcc = 0;
  function update(dt) {
    if (D.on) draw();
    if (D.text && D.el) { tAcc += dt; if (tAcc > 0.25) { tAcc = 0; D.el.textContent = text(); } }
  }

  // --------------------------------------------------------------------------------------------- summary
  function summary() {
    const t = B.tel, r = t.rounds, n = r.length || 1;
    const lens = r.map((x) => x.len).sort((a, b) => a - b), q = (p) => (lens.length ? lens[Math.min(lens.length - 1, Math.floor(p * lens.length))] : 0);
    const contacts = r.map((x) => x.contactT).filter((v) => v >= 0), tags = r.map((x) => x.tags);
    const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    const reactBy = {}; for (const [d, ms] of t.reactions) (reactBy[d] ||= []).push(ms);
    const reactionMs = Object.fromEntries(Object.entries(reactBy).map(([d, a]) => { a.sort((x, y) => x - y); return [d, { n: a.length, p25: a[Math.floor(a.length * 0.25)], p50: a[Math.floor(a.length * 0.5)], p75: a[Math.floor(a.length * 0.75)] }]; }));
    return {
      reactionMs, rounds: r.length, wins: { ...t.wins }, reasons: { ...t.reasons }, plantRate: +(r.filter((x) => x.planted).length / n).toFixed(2),
      len: { mean: +avg(lens).toFixed(1), p10: q(0.1), p50: q(0.5), p90: q(0.9), min: lens[0] || 0, max: lens[lens.length - 1] || 0 },
      firstContact: { mean: +avg(contacts).toFixed(1), min: contacts.length ? Math.min(...contacts) : 0, max: contacts.length ? Math.max(...contacts) : 0 },
      tagsPerRound: +avg(tags).toFixed(2), kills: t.kills, stuck: { seconds: +t.stuckTime.toFixed(1), incidents: t.stuckIncidents, teleports: t.teleports, roundsWithStuck: r.filter((x) => x.stuck > 0).length, cleanRounds: +(r.filter((x) => x.stuck === 0).length / n).toFixed(3) },
      log: t.log.slice(-60), throws: t.throws || 0, throwsBy: t.throwsBy || {}, shots: t.shots, hits: t.hits, paths: t.paths, exceptions: t.exceptions,
      cpuMsPerTick: +(t.cpu.ticks ? t.cpu.ms / t.cpu.ticks : 0).toFixed(4), cpuMaxMs: +t.cpu.max.toFixed(2),
    };
  }

  // --------------------------------------------------------------------------------------------- full-bot match (human actor adopted)
  function adoptLocal(difficulty = 'pro') {
    const me = ctx.localActor; if (!me || me.ai) return me;
    ctx.player?.spectate?.(null);                           // free camera, the player module stops simulating the actor
    const df = difficulty;
    const tmp = api.createBot(me.team, me.name, df);        // build an ai on a throw-away actor, then move it to the human actor
    const b = B.bots.find((x) => x.actor === tmp);
    B.bots.splice(B.bots.indexOf(b), 1);
    b.ai.actor = me; b.actor = me; me.ai = b.ai; b.id = me.id; Object.defineProperty(b, 'team', { get: () => me.team, configurable: true });
    B.bots.push(b); D.adopted.push(me);
    return me;
  }
  function releaseLocal() { const me = ctx.localActor; if (!me?.ai) return; const i = B.bots.findIndex((x) => x.actor === me); if (i >= 0) B.bots.splice(i, 1); me.ai = null; }

  function topView(on = true, name = 'top') {
    if (!on) { ctx.map?.debug?.clear?.(); return; }
    ctx.combat?.viewmodel?.setVisible?.(false); ctx.hud?.setVisible?.(false);
    ctx.map?.debug?.setView?.(name);
  }

  /** all-bot match for observation / headless runs */
  function startAllBots(o = {}) {
    const m = ctx.match; if (!m) return false;
    m.startMatch({ difficulty: o.difficulty || 'pro', playerTeam: o.team || 'ember', bots: true, dummies: false });
    adoptLocal(o.difficulty || 'pro');
    if (o.difficulty) for (const b of B.bots) b.ai.diff = diffFor(o.difficulty);
    return true;
  }
  const diffFor = (d) => B.diffTable[d] || B.diffTable.pro;

  ctx.debugScenes = ctx.debugScenes || {};
  ctx.debugScenes['bot-lab'] = async () => {
    const p = ctx.params, df = p.get('difficulty') || 'pro';
    D.on = p.get('draw') !== '0'; showText(p.get('ui') !== '0');
    startAllBots({ difficulty: df, team: p.get('team') || 'ember' });
    if (p.get('phase')) ctx.match.debug?.forcePhase?.(p.get('phase'));
    const view = p.get('view') || 'top';
    if (ctx.map?.debug?.VIEWS?.[view]) topView(true, view);
    else if (view === 'follow') { const bt = B.bots.filter((x) => x.actor !== ctx.localActor); const i = +p.get('bot') || 0; D.followIdx = i; ctx.player?.spectate?.(bt[i]?.actor || null); }
  };

  D.api = {
    get on() { return D.on; }, draw(on = true) { D.on = !!on; if (!D.on && D.line) D.line.visible = D.pts.visible = false; return D.on; }, text: () => text(), showText, dump, state: stateOf,
    all: () => B.bots.map(stateOf), telemetry: summary, rounds: () => B.tel.rounds.slice(), resetTelemetry: () => B.tel.reset(), top: topView, startAllBots, adoptLocal, releaseLocal,
    tune: (id, kv) => { const df = B.diffTable[id]; if (df) Object.assign(df, kv); return df; },
    setDifficulty: (d, team) => { for (const b of B.bots) if (!team || b.team === team) { b.ai.diff = B.diffTable[d] || b.ai.diff; b.ai.aim.lookOmega = 8 + b.ai.diff.omega * 0.12; } },
    follow: (i) => { const bt = B.bots.filter((x) => x.actor.alive); const b = bt[(i + bt.length) % Math.max(1, bt.length)]; if (b) ctx.player?.spectate?.(b.actor); return b?.actor.name; },
    intel: (team) => [...B.teamIntel(team).values()].map((v) => ({ pos: v.pos.toArray().map((x) => +x.toFixed(1)), age: +(B.now - v.t).toFixed(1), src: v.src })),
    team: (t) => B.T?.[t],
    config: K,
  };
  return { api: D.api, fixed() {}, update, dispose() { showText(false); if (D.line) { D.line.parent?.remove(D.line); D.pts?.parent?.remove(D.pts); } topView(false); } };
}
