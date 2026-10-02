// ?scene=match-lab — dummy actors + scripted director; on-screen debug text of the state machine and economy table.
import * as THREE from 'three';
import { TEAMS } from '../core/config.js';
import { TIMING as MATCH } from './timing.js';
import { ECON, lossBonus } from './economy.js';

const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const rpad = (s, n) => String(s).padStart(n);
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;

export function createLab(ctx, M, driver) {
  const L = { active: false, view: 'top', hidden: false, root: null, markers: new Map(), sites: [], last: 0, el: null, keyFn: null };

  function text() {
    const B = M.beacon, me = ctx.localActor;
    const l = [];
    l.push(`FLUX TAG / MATCH LAB      autoplay:${driver.enabled ? 'ON ' : 'off'} scenario:${driver.scenario || '-'}  clock ${M.clock.toFixed(1)}s${M.paused ? '  [PAUSED]' : ''}`);
    l.push(`PHASE  ${pad(M.phase.toUpperCase(), 9)} round ${M.round}  ${M.ot ? `OVERTIME #${M.otIndex} (target ${M.otTarget})` : `regulation (first to ${M.roundsToWin})`}  next:${M.next || '-'}`);
    l.push(`TIME   ${mmss(M.timeLeft)} of ${M.phaseDuration ? M.phaseDuration.toFixed(0) : '-'}s   frozen:${M.frozen ? 'yes' : 'no'}  buyTimeLeft:${M.buyTimeLeft.toFixed(1)}`);
    l.push(`SCORE  EMBER ${M.scores.ember} : ${M.scores.tide} TIDE     you=${M.playerTeam.toUpperCase()}  swapped:${M.swapped ? 'yes' : 'no'}  half:${M.halfKind || '-'}`);
    l.push(`LOSS   ember lvl ${M.lossStreak.ember} (next loss +${lossBonus(M.lossStreak.ember)})   tide lvl ${M.lossStreak.tide} (next loss +${lossBonus(M.lossStreak.tide)})`);
    l.push(`BEACON ${B.state.toUpperCase()} site:${B.site || '-'}  carrier:${B.carrier?.name || '-'}  progress:${(B.progress * 100).toFixed(0)}%${B.actor ? ' by ' + B.actor.name : ''}${B.state === 'armed' || B.state === 'disarming' ? `  fuse:${B.fuseLeft.toFixed(1)}s beep:${B.interval.toFixed(2)}s` : ''}`);
    l.push('');
    for (const t of ['ember', 'tide']) {
      const alive = M.teams[t].filter((a) => a.alive).length;
      l.push(`--- ${t.toUpperCase()} (${M.sideOf(t)}) alive ${alive}/${M.teams[t].length}  squad ${M.squadOf(t)} ---`);
      l.push(`${pad('name', 9)} ${pad('st', 2)} ${rpad('credits', 7)} ${rpad('tags', 4)} ${rpad('inc', 6)}  loadout`);
      for (const a of M.teams[t]) {
        const o = a.match?.owned; const r = a.match?.round;
        const load = o ? `${o.primary || '-'}/${o.secondary || '-'}${o.utility.length ? ' +' + o.utility.join(',') : ''}${o.vest ? ' V' : ''}${a.hasKit ? ' K' : ''}${a.hasBeacon ? ' *BEACON*' : ''}` : '';
        l.push(`${pad(a.name + (a === me ? '*' : ''), 9)} ${a.alive ? 'ok' : 'xx'} ${rpad(a.credits, 7)} ${rpad(a.match?.total.tags ?? 0, 4)} ${rpad(r?.income ?? 0, 6)}  ${load}`);
      }
    }
    const lr = M.lastRound;
    if (lr) l.push('', `LAST   r${lr.n} ${lr.winner.toUpperCase()} by ${lr.reason}  MVP ${lr.mvp?.name || '-'}  win +${ECON.win} / loss +${lr.econ.award[lr.econ.loser].amount} (lvl ${lr.econ.award[lr.econ.loser].level})  plant ${lr.econ.plant.ember}  kills e${lr.econ.kills.ember}/t${lr.econ.kills.tide}`);
    l.push(`HIST   ${M.history.map((h) => `${h.n}${h.winner === 'ember' ? 'E' : 'T'}${h.reason[0]}`).join(' ')}`);
    l.push('', 'keys: Y skip>EMBER  U skip>TIDE  P autoplay  O top/free cam  H hide  ,/. time x0.5 x2');
    return l.join('\n');
  }
  L.text = text;

  function marker(a) {
    let m = L.markers.get(a); if (m) return m;
    const col = TEAMS[a.team].color;
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.0, 4, 10), new THREE.MeshBasicMaterial({ color: col }));
    const tag = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); tag.position.y = 2.2; tag.visible = false;
    const g = new THREE.Group(); g.add(mesh, tag); L.root.add(g);
    m = { g, mesh, tag, team: a.team }; L.markers.set(a, m); return m;
  }

  L.start = () => {
    if (L.active) return; L.active = true;
    L.root = new THREE.Group(); L.root.name = 'match-lab'; ctx.render?.scene?.add?.(L.root);
    const el = document.createElement('pre'); el.id = 'match-lab-overlay';
    el.style.cssText = 'position:fixed;left:8px;top:8px;margin:0;padding:8px 10px;z-index:9999;pointer-events:none;font:11px/1.28 ui-monospace,Menlo,Consolas,monospace;color:#dfe7f5;background:rgba(8,10,16,.84);border:1px solid rgba(255,255,255,.12);border-radius:4px;white-space:pre;max-width:96vw;overflow:hidden';
    document.body.appendChild(el); L.el = el;
    for (const id of ['A', 'B']) {
      const s = M.beaconApi.sites()[id]; if (!s) continue; const c = s.center || s.pos;
      const ring = new THREE.Mesh(new THREE.RingGeometry((s.radius ?? 6) - 0.25, s.radius ?? 6, 48), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(c.x, c.y + 0.06, c.z); L.root.add(ring);
    }
    L.keyFn = (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'y') M.debug.skipRound('ember'); else if (k === 'u') M.debug.skipRound('tide');
      else if (k === 'p') driver.enabled = !driver.enabled;
      else if (k === 'o') L.view = L.view === 'top' ? 'free' : 'top';
      else if (k === 'h') { L.hidden = !L.hidden; el.style.display = L.hidden ? 'none' : ''; }
      else if (k === ',') ctx.engine.timeScale = Math.max(0.25, ctx.engine.timeScale * 0.5);
      else if (k === '.') ctx.engine.timeScale = Math.min(16, ctx.engine.timeScale * 2);
    };
    addEventListener('keydown', L.keyFn);
  };

  L.update = (dt) => {
    if (!L.active) return;
    for (const a of ctx.actors) {
      if (!TEAMS[a.team]) continue;
      const m = marker(a);
      if (m.team !== a.team) { m.mesh.material.color.setHex(TEAMS[a.team].color); m.team = a.team; }
      m.g.position.set(a.pos.x, a.pos.y + (a.alive ? 1 : 0.35) * (L.scale || 1), a.pos.z);
      const sc = L.scale || 1; m.mesh.scale.set(sc, sc * (a.alive ? 1 : 0.35), sc); m.tag.scale.setScalar(sc);
      m.mesh.material.color.setHex(a.alive ? TEAMS[a.team].color : 0x59606c);
      m.tag.visible = !!a.hasBeacon; m.tag.rotation.y += dt * 3;
      if (a === ctx.localActor) m.mesh.scale.multiplyScalar(1.25);
    }
    // view
    if (L.view === 'top' && ctx.render?.camera) {
      const cam = ctx.render.camera, b = ctx.map?.bounds;
      const cx = b ? (b.min.x + b.max.x) / 2 : 0, cz = b ? (b.min.z + b.max.z) / 2 : 0;
      const ext = b ? Math.max(b.max.x - b.min.x, b.max.z - b.min.z) : 120;
      const h = (ext / 2) / Math.tan(THREE.MathUtils.degToRad((cam.fov || 70) / 2)) * 1.08;
      cam.position.set(cx - ext * 0.16, h, cz + 0.001); cam.rotation.set(-Math.PI / 2, 0, 0, 'YXZ');
      L.scale = Math.max(1, ext / 70);
    }
    if (L.el && !L.hidden && M.clock - L.last >= 0.1) { L.last = M.clock; L.el.textContent = text(); }
  };

  L.forceRefresh = () => { if (L.el) L.el.textContent = text(); };
  L.dispose = () => {
    if (!L.active) return; L.active = false;
    removeEventListener('keydown', L.keyFn); L.el?.remove(); L.root?.parent?.remove(L.root);
    L.root?.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); L.markers.clear();
  };
  return L;
}
