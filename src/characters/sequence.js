// Tag-out sequence: flash-freeze into crystal glass -> shatter into confetti / light shards (harmless, no gore).
import * as THREE from 'three';
import { rng } from '../core/rng.js';
import { sampleBody, refreshHb } from './hitboxes.js';
import { sstep, clamp } from './anim.js';

const _pt = { x: 0, y: 0, z: 0 }, _col = new THREE.Color();
let _ice = null;
const iceMat = () => _ice || (_ice = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.08, metalness: 0.35, emissive: 0x2f6f9f, emissiveIntensity: 0.9 }));
const T_FREEZE = 0.16, T_SHATTER = 0.52;

const lin = (hex, mul = 1) => { _col.set(hex); return [_col.r * mul, _col.g * mul, _col.b * mul]; };

export function startTagOut(ctx, m, dir, opts = {}) {
  if (m.tag) return false;
  const style = opts.style || m.spec.tagOutEffect || 'shatter';
  const d = dir ? { x: dir.x, y: dir.y || 0, z: dir.z } : { x: Math.sin(m.actor.yaw), y: 0, z: Math.cos(m.actor.yaw) };
  const l = Math.hypot(d.x, d.z) || 1; d.x /= l; d.z /= l;
  const speedScale = opts.compat ? 0.3 : 1;
  m.tag = { t: 0, style, dir: d, phase: 0, shatterT: T_SHATTER * speedScale, freezeT: T_FREEZE * speedScale, dissolve: 0 };
  // stagger away from the hit
  const c = Math.cos(m.hipsYaw), s = Math.sin(m.hipsYaw), lx = d.x * c - d.z * s, lz = d.x * s + d.z * c;
  m.sp.fp[1] += lz * 2.2; m.sp.fr[1] += -lx * 2.2; m.sp.hp[1] += 1.2 * Math.sign(lz || 1);
  m.tag.tiltX = -lz * 0.09; m.tag.tiltZ = lx * 0.09;
  m.u.uFlash.value = 1.2;
  if (m.held.obj) { m.heldFreeze = []; m.held.obj.traverse((o) => { if (o.isMesh) { m.heldFreeze.push([o, o.material]); o.material = iceMat(); } }); }
  return true;
}

function palette(m) {
  const u = m.u, t = m.teamColor;
  const p = [lin(t, 1.0), lin(u.uSuit.value.getHex(), 1.0), lin(u.uAccent.value.getHex(), 1.0), lin(u.uVisor.value.getHex(), 1.0), lin(u.uHelmet.value.getHex(), 1.0)];
  return p;
}

/** Returns true while the model is under tag-out control (skip the normal animation). */
export function tickTag(ctx, m, dt, fx, tick) {
  const tg = m.tag; if (!tg) return false;
  tg.t += dt; const t = tg.t, u = m.u;
  if (tg.phase === 0) {
    const f = sstep(t / tg.freezeT);
    u.uFreeze.value = f; u.uFlash.value = t < tg.freezeT ? 1.1 * (1 - f) : 0.05 + 0.05 * Math.sin(t * 40);
    const k = sstep(t / tg.shatterT), sh = (1 - k);
    m.root.position.y = m.gy + 0.05 * k; m.root.rotation.x = tg.tiltX * f; m.root.rotation.z = tg.tiltZ * f + Math.sin(t * 90) * 0.012 * sh * f;
    m.root.updateMatrixWorld(true);
    if (t >= tg.shatterT) shatter(ctx, m, fx, tick);
  } else if (tg.phase === 1) {  // pixel dissolve
    tg.dissolve += dt; u.uMat.value = 1 - sstep(tg.dissolve / 0.38); u.uFlash.value = 0.3;
    if (tg.dissolve >= 0.4) hideModel(m, tg);
  }
  return tg.phase < 2;
}

function hideModel(m, tg) { tg.phase = 2; m.root.visible = false; m.hidden = true; }

function shatter(ctx, m, fx, tick) {
  const tg = m.tag; refreshHb(m, tick, true);
  const center = new THREE.Vector3(m.actor.pos.x, m.gy + 1.0, m.actor.pos.z);
  const pal = palette(m);
  if (fx) fx.burst(tg.style, { samples: (o) => sampleBody(m, o, rng.next), dir: tg.dir, center, floor: m.gy, pal, team: m.teamColor });
  ctx.events.emit('character:shattered', { actor: m.actor, point: center, color: m.teamColor, style: tg.style, dir: tg.dir });
  m.u.uFlash.value = 0;
  if (tg.style === 'pixelate') { tg.phase = 1; tg.dissolve = 0; m.u.uFreeze.value = 0.6; }
  else hideModel(m, tg);
}

/** Bring a tagged-out (or dissolving) model back: spawn-in materialise. */
export function resetTag(m) {
  if (m.heldFreeze) { for (const [o, mt] of m.heldFreeze) o.material = mt; m.heldFreeze = null; }
  m.tag = null; m.hidden = false; m.root.visible = true; m.root.rotation.x = m.root.rotation.z = 0;
  m.u.uFreeze.value = 0; m.u.uFlash.value = 0; m.u.uMat.value = 0; m.spawnT = 0;
  for (const k of Object.keys(m.sp)) { m.sp[k][0] = 0; m.sp[k][1] = 0; }
  m.feetInit = false;
}
