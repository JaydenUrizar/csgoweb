// Emotes as post-animation bone offsets on the REAL in-game athlete rig (src/characters). Angles in radians.
// Convention (rest pose = arms hanging down, facing -Z): arm.z>0 raises RIGHT arm outward (left arm: z<0), arm.x>0 raises forward; fArm.x>0 bends the elbow.
export const BONE_EMOTE_DUR = { wave: 3.2, salute: 2.6, flex: 3.4, shuffle: 4.0, shrug: 2.6, spin: 2.4, cheer: 3.2, point: 3.2, clap: 3.2, robot: 4.4, bow: 3.0, sway: 4.4 };
const S = Math.sin, C = Math.cos, PI = Math.PI;
const sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => sm((t - a) / (b - a));
export function makePoseOut() {
  const e = () => [0, 0, 0];
  return { w: 0, armW: 0, rootY: 0, yaw: 0, pel: e(), spine: e(), chest: e(), head: e(), uL: e(), fL: e(), uR: e(), fR: e(), legL: e(), kneeL: e(), legR: e(), kneeR: e() };
}
const set = (a, x, y, z) => { a[0] = x; a[1] = y; a[2] = z; };
/** fills out; returns false when finished. arms are ABSOLUTE (slerped by armW), everything else additive scaled by w. */
export function boneEmote(anim, t, o) {
  const dur = BONE_EMOTE_DUR[anim] ?? 3; if (t > dur) return false;
  const inn = ramp(t, 0, 0.3), out = 1 - ramp(t, dur - 0.4, dur); o.w = inn * out; o.armW = o.w;
  for (const k of ['pel', 'spine', 'chest', 'head', 'uL', 'fL', 'uR', 'fR', 'legL', 'kneeL', 'legR', 'kneeR']) set(o[k], 0, 0, 0); o.rootY = 0; o.yaw = 0;
  set(o.uL, 0, 0, -0.1); set(o.uR, 0, 0, 0.1);
  switch (anim) {
    case 'wave': set(o.uR, 0, 0, 2.55); set(o.fR, 0, 0, S(t * 11) * 0.55 + 0.1); set(o.head, 0, 0, -0.12); set(o.spine, 0, -0.1, -0.05); break;
    case 'salute': { const k = ramp(t, 0, 0.3) * (1 - ramp(t, 1.9, 2.15)); set(o.uR, 0.55, 0, 1.15); set(o.fR, 2.25, 0, 0); set(o.head, -0.08, 0, 0); o.armW = o.w * k; break; }
    case 'flex': { const p = 0.5 + 0.5 * S(t * 7); set(o.uR, 0.1, 0, 1.45); set(o.uL, 0.1, 0, -1.45); set(o.fR, 2.3 + 0.1 * p, 0, 0); set(o.fL, 2.3 + 0.1 * p, 0, 0); set(o.spine, 0, S(t * 3.5) * 0.25, 0); set(o.head, 0, -S(t * 3.5) * 0.15, 0); o.rootY = -0.05 + 0.02 * p; set(o.legL, 0, 0, -0.1); set(o.legR, 0, 0, 0.1); break; }
    case 'shuffle': { const b = t * 8.4, s = S(b); set(o.legL, s > 0 ? -0.5 : 0, 0, 0); set(o.kneeL, s > 0 ? 0.9 : 0, 0, 0); set(o.legR, s < 0 ? -0.5 : 0, 0, 0); set(o.kneeR, s < 0 ? 0.9 : 0, 0, 0); set(o.uR, -0.5 + 0.5 * s, 0, 0.4); set(o.uL, -0.5 - 0.5 * s, 0, -0.4); set(o.fR, 1.3, 0, 0); set(o.fL, 1.3, 0, 0); set(o.spine, 0, s * 0.3, 0); o.yaw = S(b * 0.5) * 0.45; o.rootY = Math.abs(S(b * 0.5)) * 0.06; set(o.head, 0, 0, C(b) * 0.1); break; }
    case 'shrug': { const k = ramp(t, 0.1, 0.5) * (1 - ramp(t, 1.9, 2.4)); set(o.uR, 0, 0, 0.7); set(o.uL, 0, 0, -0.7); set(o.fR, 1.4, 0, 0); set(o.fL, 1.4, 0, 0); set(o.head, 0.05, 0.1, 0.14); o.armW = o.w * k; o.w *= k; break; }
    case 'spin': { const k = ramp(t, 0, 1.5); o.yaw = -k * PI * 2; const hop = S(Math.min(1, t / 1.5) * PI); o.rootY = hop * 0.22; set(o.legL, -0.3 * hop, 0, 0); set(o.kneeL, 0.9 * hop, 0, 0); set(o.kneeR, 0.9 * hop, 0, 0); set(o.uR, 0, 0, 1.4); set(o.uL, 0, 0, -1.4); break; }
    case 'cheer': { const hop = Math.abs(S(t * 7)); o.rootY = hop * 0.3; set(o.kneeL, hop * 1.3, 0, 0); set(o.kneeR, hop * 1.3, 0, 0); set(o.uR, 0, 0, 2.9 + S(t * 14) * 0.1); set(o.uL, 0, 0, -2.9 - S(t * 14 + 1) * 0.1); set(o.head, -0.2, 0, 0); break; }
    case 'point': { const k = ramp(t, 0, 0.35) * (1 - ramp(t, 2.7, 3.1)), sw = S(t * 2.2) * 0.4; set(o.uR, 1.55, 0, 0.5 + sw); set(o.fR, 0.05, 0, 0); set(o.spine, 0, 0.3 * k + sw * 0.2, 0); set(o.head, 0, 0.2, 0); set(o.uL, 0, 0, -0.1); break; }
    case 'clap': { const b = t * 6.4, c = 0.5 + 0.5 * C(b * PI); set(o.uR, 0.9, 0, 0.1 + 0.4 * c); set(o.uL, 0.9, 0, -0.1 - 0.4 * c); set(o.fR, 1.2, -0.5, 0); set(o.fL, 1.2, 0.5, 0); set(o.head, 0.1 + 0.05 * C(b * PI), 0, 0); break; }
    case 'robot': { const q = (v, n) => Math.round(v * n) / n, s1 = q(S(t * 2.4), 3), s2 = q(C(t * 2.4), 3); set(o.uR, s2 > 0 ? 1.57 : 0, 0, 0.3); set(o.uL, s2 < 0 ? 1.57 : 0, 0, -0.3); set(o.fR, s1 > 0 ? 1.57 : 0.2, 0, 0); set(o.fL, s1 < 0 ? 1.57 : 0.2, 0, 0); set(o.head, 0, q(S(t * 1.6), 2) * 0.7, 0); set(o.spine, 0, q(S(t * 1.2 + 1), 2) * 0.5, 0); set(o.legL, q(S(t * 2.4), 2) * -0.35, 0, 0); set(o.legR, q(S(t * 2.4), 2) * 0.35, 0, 0); break; }
    case 'bow': { const k = ramp(t, 0.1, 1.0) * (1 - ramp(t, 2.0, 2.8)); set(o.spine, 0.7 * k, 0, 0); set(o.chest, 0.4 * k, 0, 0); set(o.head, 0.2 * k, 0, 0); set(o.legL, -0.1 * k, 0, 0); set(o.legR, -0.1 * k, 0, 0); set(o.uR, 0.2, 0, 0.1); set(o.uL, 0.2, 0, -0.1); break; }
    case 'sway': { const b = t * 2.4, s = S(b); set(o.uR, 0, 0, 2.5 + 0.3 * S(b + 1)); set(o.uL, 0, 0, -2.5 - 0.3 * S(b + 2.6)); set(o.fR, 0.3, 0, 0); set(o.fL, 0.3, 0, 0); set(o.spine, 0, 0, -s * 0.15); set(o.head, 0, 0, s * 0.14); o.yaw = s * 0.28; set(o.legL, s * -0.15, 0, 0); set(o.legR, s * 0.15, 0, 0); o.rootY = -Math.abs(C(b)) * 0.03; break; }
    default: return false;
  }
  return true;
}
