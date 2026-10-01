// Procedural emote poses for the preview stand-in rig. Pure functions writing into a pose struct P (no allocation).
// Hand targets are in chest-local space (shoulders at x=±0.29,y=0.40). Angles in radians.
export const EMOTE_DUR = { wave: 3.2, salute: 2.6, flex: 3.4, shuffle: 4.0, shrug: 2.6, spin: 2.4, cheer: 3.2, point: 3.2, clap: 3.2, robot: 4.4, bow: 3.0, sway: 4.4 };

export function makePose() {
  return { bodyY: 0, bodyYaw: 0, bodyRoll: 0, spX: 0, spY: 0, spZ: 0, hdX: 0, hdY: 0, hdZ: 0, lhip: 0, lknee: 0, rhip: 0, rknee: 0, lhipZ: 0, rhipZ: 0, gun: 1,
    L: [-0.31, -0.12, 0.05], R: [0.31, -0.12, 0.05], pL: [-0.7, -0.5, -0.5], pR: [0.7, -0.5, -0.5], sL: 1, sR: 1, shrug: 0 };
}
export function resetPose(P) {
  P.bodyY = P.bodyYaw = P.bodyRoll = P.spX = P.spY = P.spZ = P.hdX = P.hdY = P.hdZ = P.lhip = P.lknee = P.rhip = P.rknee = P.lhipZ = P.rhipZ = P.shrug = 0; P.gun = 0; P.sL = P.sR = 1;
  P.L[0] = -0.31; P.L[1] = -0.14; P.L[2] = 0.04; P.R[0] = 0.31; P.R[1] = -0.14; P.R[2] = 0.04;
  P.pL[0] = -0.7; P.pL[1] = -0.5; P.pL[2] = -0.5; P.pR[0] = 0.7; P.pR[1] = -0.5; P.pR[2] = -0.5;
}
const sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => sm((t - a) / (b - a));
const S = Math.sin, C = Math.cos, PI = Math.PI;
const set3 = (v, x, y, z) => { v[0] = x; v[1] = y; v[2] = z; };

/** Fill P for `anim` at time t (s). Caller has called resetPose(P). Returns false when the emote has ended. */
export function emotePose(anim, t, P) {
  const dur = EMOTE_DUR[anim] ?? 3;
  if (t > dur) return false;
  const inn = ramp(t, 0, 0.35), out = 1 - ramp(t, dur - 0.4, dur), w = inn * out;    // envelope
  switch (anim) {
    case 'wave': {
      set3(P.R, 0.36, 0.34 + 0.55 * w, 0.08); P.R[0] += S(t * 10) * 0.13 * w; P.R[1] += 0; set3(P.pR, 0.9, 0, -0.2);
      P.hdZ = -0.12 * w; P.hdY = -0.15 * w; P.spY = -0.1 * w; P.bodyY = S(t * 5) * 0.008;
      break;
    }
    case 'salute': {
      const up = ramp(t, 0, 0.3) * (1 - ramp(t, 1.9, 2.15));
      set3(P.R, 0.12 + 0.02 * (1 - up), -0.12 + 0.95 * up, 0.14 + 0.16 * up); set3(P.pR, 0.9, 0.2, -0.1);
      P.hdX = -0.06 * up; P.spX = -0.04 * up; P.bodyY = 0.012 * up;
      break;
    }
    case 'flex': {
      const k = w, pulse = 0.5 + 0.5 * S(t * 7);
      set3(P.R, 0.37, 0.10 + 0.55 * k, 0.16); set3(P.L, -0.37, 0.10 + 0.55 * k, 0.16); set3(P.pR, 0.9, 0.2, -0.2); set3(P.pL, -0.9, 0.2, -0.2);
      P.sL = P.sR = 1 + 0.16 * pulse * k; P.spY = S(t * 3.5) * 0.28 * k; P.hdY = -P.spY * 0.6; P.bodyY = -0.05 * k + 0.02 * pulse * k;
      P.lhip = -0.08 * k; P.rhip = -0.08 * k; P.lhipZ = -0.12 * k; P.rhipZ = 0.12 * k;
      break;
    }
    case 'shuffle': {
      const b = t * 8.4, e = inn * out;
      const s = S(b), c = C(b);
      P.bodyY = Math.abs(S(b * 0.5)) * 0.06 * e; P.spY = s * 0.32 * e; P.bodyYaw = S(b * 0.5) * 0.4 * e; P.bodyRoll = c * 0.05 * e; P.hdZ = -c * 0.1 * e;
      P.lhip = (s > 0 ? 0.55 : 0.05) * e; P.lknee = (s > 0 ? 0.9 : 0.1) * e; P.rhip = (s < 0 ? 0.55 : 0.05) * e; P.rknee = (s < 0 ? 0.9 : 0.1) * e;
      set3(P.R, 0.33 + c * 0.05, 0.05 + 0.25 * Math.max(0, s) * e, 0.28 + s * 0.12); set3(P.L, -0.33 - c * 0.05, 0.05 + 0.25 * Math.max(0, -s) * e, 0.28 - s * 0.12);
      break;
    }
    case 'shrug': {
      const k = ramp(t, 0.1, 0.5) * (1 - ramp(t, 1.9, 2.4));
      set3(P.R, 0.62, 0.22, 0.08); set3(P.L, -0.62, 0.22, 0.08); P.R[1] = -0.14 + 0.36 * k; P.L[1] = P.R[1]; P.R[0] = 0.31 + 0.31 * k; P.L[0] = -P.R[0];
      set3(P.pR, 0.9, -0.2, -0.3); set3(P.pL, -0.9, -0.2, -0.3);
      P.shrug = 0.05 * k; P.hdZ = 0.14 * k; P.hdY = 0.1 * k; P.hdX = 0.05 * k; P.spZ = -0.03 * k;
      break;
    }
    case 'spin': {
      const k = ramp(t, 0, 1.5) * 2 * PI * 1.0; const hop = S(Math.min(1, t / 1.5) * PI);
      P.bodyYaw = -k * (1 - 0.0); P.bodyY = hop * 0.22; P.lknee = 0.9 * hop; P.rknee = 0.9 * hop; P.lhip = 0.3 * hop; P.rhip = -0.1 * hop;
      const o = 0.55 * Math.min(1, t * 3) * (1 - ramp(t, 1.9, 2.4));
      set3(P.R, 0.35 + o, 0.3 * o, 0.1); set3(P.L, -0.35 - o, 0.3 * o, 0.1); P.spZ = 0.05 * hop; P.hdX = -0.1 * hop;
      break;
    }
    case 'cheer': {
      const b = t * 7, hop = Math.abs(S(b)) * inn * out;
      P.bodyY = hop * 0.3; P.lknee = 0.7 * (1 - hop / 0.3 * 0 + 0) * Math.min(1, hop * 4); P.rknee = P.lknee; P.lhip = 0.2 * hop * 3; P.rhip = P.lhip;
      const up = 0.8 * inn * out; set3(P.R, 0.33, 0.35 + up * 0.85 + S(b * 2) * 0.05, 0.08); set3(P.L, -0.33, 0.35 + up * 0.85 + S(b * 2 + 1) * 0.05, 0.08);
      set3(P.pR, 0.5, 0, -0.5); set3(P.pL, -0.5, 0, -0.5); P.hdX = -0.18 * inn * out; P.spX = -0.06 * inn * out;
      break;
    }
    case 'point': {
      const k = ramp(t, 0, 0.35) * (1 - ramp(t, 2.7, 3.1)), sweep = S(t * 2.2) * 0.5;
      set3(P.R, 0.32 + 0.22 * k + sweep * 0.25, 0.32 + 0.1 * k, 0.05 + 0.55 * k); set3(P.pR, 0.6, 0.3, -0.2);
      P.spY = -0.35 * k + sweep * 0.2; P.hdY = -0.22 * k - sweep * 0.2; P.bodyYaw = -0.2 * k; P.rhip = 0.1 * k; P.lhip = -0.12 * k; P.bodyY = -0.01 * k;
      break;
    }
    case 'clap': {
      const b = t * 6.4, c = 0.5 + 0.5 * C(b * PI), e = inn * out;
      set3(P.R, 0.05 + 0.24 * c, 0.15, 0.36); set3(P.L, -0.05 - 0.24 * c, 0.15, 0.36); P.R[1] += 0.05 * S(b * 3); P.L[1] = P.R[1];
      set3(P.pR, 0.7, 0.2, -0.3); set3(P.pL, -0.7, 0.2, -0.3);
      P.hdX = (0.05 + 0.05 * C(b * PI)) * e; P.bodyY = -0.02 * (1 - c) * e; P.spX = 0.05 * e;
      // blend hands back to relaxed at the edges
      if (e < 1) { const m = e; P.R[0] = 0.31 + (P.R[0] - 0.31) * m; P.R[1] = -0.14 + (P.R[1] + 0.14) * m; P.R[2] = 0.04 + (P.R[2] - 0.04) * m; P.L[0] = -0.31 + (P.L[0] + 0.31) * m; P.L[1] = P.R[1]; P.L[2] = P.R[2]; }
      break;
    }
    case 'robot': {
      const q = (v, n) => Math.round(v * n) / n, ph = q(t * 1.2, 4) * PI * 2 * 0.5 * 2, e = inn * out;
      const s1 = q(S(t * 2.4), 3), s2 = q(C(t * 2.4), 3);
      P.hdY = q(S(t * 1.6), 2) * 0.7 * e; P.spY = q(S(t * 1.2 + 1), 2) * 0.5 * e; P.bodyY = q(S(t * 4.8), 2) * 0.015 * e;
      set3(P.R, 0.42, 0.1 + 0.35 * (s1 > 0 ? 1 : 0.2) * e, 0.10 + 0.22 * (s2 > 0 ? 1 : 0) * e); set3(P.L, -0.42, 0.1 + 0.35 * (s1 < 0 ? 1 : 0.2) * e, 0.10 + 0.22 * (s2 < 0 ? 1 : 0) * e);
      set3(P.pR, 0.9, 0.1, -0.1); set3(P.pL, -0.9, 0.1, -0.1);
      P.lhip = q(S(t * 2.4), 2) * 0.35 * e; P.rhip = -P.lhip; P.lknee = Math.max(0, P.lhip) * 1.3; P.rknee = Math.max(0, P.rhip) * 1.3; void ph;
      break;
    }
    case 'bow': {
      const k = ramp(t, 0.1, 1.0) * (1 - ramp(t, 2.0, 2.8));
      P.spX = 0.95 * k; P.hdX = 0.25 * k; P.bodyY = -0.01 * k; P.lhip = -0.1 * k; P.rhip = -0.1 * k;
      set3(P.R, 0.16, -0.2 + 0.05 * k, 0.25 - 0.0 * k); set3(P.L, -0.16, -0.2 + 0.05 * k, 0.25); P.R[1] = 0.05 - 0.5 * k + 0.55 * (1 - k) * 0; P.L[1] = P.R[1];
      break;
    }
    case 'sway': {
      const b = t * 2.4, e = inn * out, s = S(b);
      P.bodyRoll = s * 0.09 * e; P.spZ = -s * 0.12 * e; P.bodyY = Math.abs(C(b)) * -0.035 * e; P.hdZ = s * 0.14 * e; P.bodyYaw = s * 0.25 * e;
      set3(P.R, 0.46, 0.55 + 0.25 * S(b + 1) , 0.1); set3(P.L, -0.46, 0.55 + 0.25 * S(b + 2.6), 0.1); set3(P.pR, 0.9, 0.3, -0.2); set3(P.pL, -0.9, 0.3, -0.2);
      P.lhip = s * 0.15 * e; P.rhip = -s * 0.15 * e; P.lhipZ = -0.06 * e; P.rhipZ = 0.06 * e;
      if (e < 1) { P.R[1] = -0.14 + (P.R[1] + 0.14) * e; P.L[1] = -0.14 + (P.L[1] + 0.14) * e; }
      break;
    }
    default: return false;
  }
  return true;
}
