// Tagger definitions — CS2-real numbers converted to metres / seconds.
// Owner: `tagger` piece.  Every stat that comes from Counter-Strike 2 keeps its CS2 value; only lengths are converted
// (1 CS unit = 0.0254 m).  Angles are DEGREES, times SECONDS, speeds m/s.
//
//   id       CS2 archetype           slot
//   tap      Knife                   3 (grip / melee)
//   pip      USP-S                   2 (default sidearm)
//   twin     Dual Berettas (burst)   2
//   judge    Desert Eagle            2
//   zip      MP9                     1
//   hum      MP5-SD / P90-ish        1
//   arc      AK-47 (Ember)           1
//   rail     M4A4 (Tide)             1
//   halo     AUG (scoped burst)      1
//   lance    AWP                     1
//   scatter  XM1014                  1
//   storm    Negev                   1
export const U = 0.0254;                  // metres per CS unit
export const FALLOFF_UNIT = 500 * U;      // damage *= rangeMod ^ (distance / 12.7 m)
export const HITGROUP_MUL = { head: 4, chest: 1, stomach: 1.25, arm: 1, leg: 0.75 };
export const VIEW_TRACK = 0.45;           // CS view_recoil_tracking: the camera shows 45 % of the punch bullets take

// ---------------------------------------------------------------------------------------------------------------------
// Spray patterns.  A pattern is a list of absolute bullet-offset angles [yawDeg(+right), pitchDeg(+up)] for shot 0,1,2…
// Shot 0 is always (0,0): first-shot accuracy.  They are FIXED (deterministic) and identical for every player and bot.
function fromKeys(keys, len) {
  const out = new Float32Array(len * 2);
  for (let k = 0; k < len; k++) {
    let a = keys[0], b = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) if (k >= keys[i][0] && k <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
    if (k >= keys[keys.length - 1][0]) { a = b = keys[keys.length - 1]; }
    const t = b[0] === a[0] ? 0 : (k - a[0]) / (b[0] - a[0]);
    out[k * 2] = a[1] + (b[1] - a[1]) * t; out[k * 2 + 1] = a[2] + (b[2] - a[2]) * t;
  }
  return out;
}
// Procedural climb + sway for the weapons that don't need a hand-authored curve.
function proc({ n, pitch, tau, yawA, yawW, yawPhi = 0, ramp = 5, alt = 0, kick0 = 0 }) {
  const out = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) {
    const p = k === 0 ? 0 : kick0 + pitch * (1 - Math.exp(-k / tau));
    const y = yawA * Math.sin(k * yawW + yawPhi) * (1 - Math.exp(-k / ramp)) + (alt ? (k % 2 ? alt : -alt) * Math.min(1, k) : 0);
    out[k * 2] = k === 0 ? 0 : y; out[k * 2 + 1] = p;
  }
  return out;
}
// Hand-authored AK-47: straight up for ~9 bullets, hooks left, sweeps right, then left again.
const AK = fromKeys([[0, 0, 0], [1, 0, 0.55], [2, 0.02, 1.55], [3, 0.1, 2.95], [4, 0.05, 4.45], [5, -0.1, 5.85], [6, -0.2, 7.05], [7, 0.1, 8.0],
  [8, 0.55, 8.75], [9, 0.5, 9.4], [10, -0.2, 9.9], [11, -1.3, 10.25], [12, -2.3, 10.5], [13, -2.7, 10.65], [14, -1.9, 10.75], [15, -0.4, 10.85],
  [16, 1.3, 10.9], [17, 2.7, 10.95], [18, 3.3, 11.0], [19, 2.5, 11.05], [20, 0.8, 11.1], [21, -1.2, 11.2], [22, -3.0, 11.25], [23, -4.2, 11.3],
  [24, -4.0, 11.35], [25, -2.8, 11.4], [26, -1.2, 11.4], [27, 0.0, 11.45], [28, 0.4, 11.5], [29, 0.6, 11.5]], 30);
// Hand-authored M4A4: softer climb, tighter sway.
const M4 = fromKeys([[0, 0, 0], [1, 0, 0.4], [2, 0, 1.1], [3, 0.1, 2.0], [4, 0.05, 3.0], [5, -0.1, 3.9], [6, -0.25, 4.7], [7, -0.2, 5.3], [8, 0.2, 5.8],
  [9, 0.6, 6.2], [10, 0.9, 6.5], [11, 0.4, 6.75], [12, -0.5, 6.9], [13, -1.4, 7.05], [14, -1.6, 7.15], [15, -1.2, 7.25], [16, -0.3, 7.3], [17, 0.7, 7.4],
  [18, 1.6, 7.45], [19, 1.9, 7.5], [20, 1.4, 7.55], [21, 0.4, 7.6], [22, -0.9, 7.65], [23, -1.8, 7.7], [24, -2.0, 7.75], [25, -1.4, 7.8], [26, -0.3, 7.8],
  [27, 0.6, 7.85], [28, 1.2, 7.9], [29, 1.0, 7.9]], 30);
const PIP = fromKeys([[0, 0, 0], [1, 0.05, 0.95], [2, 0.2, 1.85], [3, -0.05, 2.6], [4, -0.25, 3.2], [5, -0.1, 3.7], [6, 0.2, 4.1], [7, 0.35, 4.4], [8, 0.1, 4.6],
  [9, -0.2, 4.75], [10, -0.3, 4.85], [11, 0, 4.9], [12, 0.2, 4.95]], 13);
const JUDGE = fromKeys([[0, 0, 0], [1, 0.2, 3.3], [2, 0.5, 5.6], [3, 0.2, 7.3], [4, -0.3, 8.5], [5, -0.5, 9.3], [6, -0.3, 9.8], [7, 0, 10.1]], 8);

// ---------------------------------------------------------------------------------------------------------------------
// Inaccuracy model (all degrees, half-angle of a uniform disc):
//   total = stance(stand|crouch) + move * f(speed) + air + fireInaccuracy
//   f(speed) = 0 below 34 % of the weapon's max speed (walk / counter-strafe is dead accurate), rising to 1 at 100 %.
//   fireInaccuracy grows `fire` per shot up to `fireMax` and decays `decay` deg/s (CS "inaccuracy_fire / recovery").
const inacc = (stand, crouch, move, air, fire, fireMax, decay, extra = {}) => ({ stand, crouch, move, air, fire, fireMax, decay, ...extra });

const mk = (d) => {
  d.headMul = d.headMul ?? HITGROUP_MUL.head;
  d.armorPen = d.armorPen ?? Math.min(1, d.armorRatio * 0.5);
  d.moveSpeed = d.moveSpeedU * U;
  d.cycle = d.cycle ?? 60 / d.rpm;
  d.rpm = d.rpm ?? 60 / d.cycle;
  d.pellets = d.pellets ?? 1;
  d.pattern = d.pattern || new Float32Array([0, 0]);
  d.patternLen = d.pattern.length / 2;
  d.recoilScale = d.recoilScale ?? 1;
  d.pen = (d.penPower ?? 1) * 0.3;       // metres of "solid" (material multiplier 1.0) this tagger can shoot through
  d.tracerEvery = d.tracerEvery ?? 1;
  d.range = d.range ?? 120;
  d.crosshairMax = d.crosshairMax ?? 7;
  d.equipped = d.equipped ?? {};
  return Object.freeze(d);
};

export const TAGGERS = {
  tap: mk({
    id: 'tap', name: 'Tap', cs: 'Knife', slot: 3, klass: 'melee', teams: ['ember', 'tide'], price: 0, killReward: 1500, melee: true,
    damage: 40, armorRatio: 1.7, rangeMod: 1, cycle: 0.5, auto: false, mag: 0, reserve: 0, reload: 0, draw: 0.5, moveSpeedU: 250,
    // slash (LMB): fast, 40 / 90 back.  stab (RMB): 65 / 180 back after a wind-up.
    slash: { damage: 40, back: 90, cycle: 0.5, delay: 0.06, reach: 1.55 }, stab: { damage: 65, back: 180, cycle: 1.0, delay: 0.2, reach: 1.15 },
    inacc: inacc(0, 0, 0, 0, 0, 0, 1), color: 0xffffff, desc: 'Grip bat. Melee tag: slash 40, stab 65, from behind 90 / 180.',
  }),
  pip: mk({
    id: 'pip', name: 'Pip', cs: 'USP-S', slot: 2, klass: 'pistol', teams: ['ember', 'tide'], price: 200, killReward: 300,
    damage: 35, armorRatio: 1.01, rangeMod: 0.79, cycle: 0.17, auto: false, mag: 12, reserve: 24, reload: 2.2, draw: 0.55, moveSpeedU: 240,
    penPower: 1.0, penDmg: 0.75, pattern: PIP, recover: { stand: 0.32, crouch: 0.26 }, range: 90,
    inacc: inacc(0.18, 0.13, 2.6, 4.5, 0.55, 3.2, 6.0), color: 0xffd23f, tracerEvery: 1,
    desc: 'Default sidearm. Accurate first tag, semi-auto.',
  }),
  twin: mk({
    id: 'twin', name: 'Twin', cs: 'Dual Berettas', slot: 2, klass: 'pistol', teams: ['ember', 'tide'], price: 400, killReward: 300,
    damage: 38, armorRatio: 1.15, rangeMod: 0.75, cycle: 0.12, auto: false, mag: 30, reserve: 120, reload: 3.8, draw: 0.9, moveSpeedU: 240,
    burst: { count: 2, interval: 0.075, cooldown: 0.33 },
    penPower: 1.0, penDmg: 0.75, pattern: proc({ n: 30, pitch: 5.0, tau: 7, yawA: 0.5, yawW: 0.9, alt: 0.3 }), recover: { stand: 0.42, crouch: 0.34 }, range: 80,
    inacc: inacc(0.36, 0.28, 3.2, 5.0, 0.42, 3.4, 5.5), color: 0xff5fa2, desc: 'Twin-barrel burst pistol: two quick tags per pull.',
  }),
  judge: mk({
    id: 'judge', name: 'Judge', cs: 'Desert Eagle', slot: 2, klass: 'pistol', teams: ['ember', 'tide'], price: 700, killReward: 300,
    damage: 63, armorRatio: 1.864, rangeMod: 0.81, cycle: 0.225, auto: false, mag: 7, reserve: 35, reload: 2.2, draw: 0.7, moveSpeedU: 230,
    penPower: 2.0, penDmg: 0.85, pattern: JUDGE, recover: { stand: 0.55, crouch: 0.45 }, range: 120,
    inacc: inacc(0.25, 0.18, 5.5, 9.0, 1.8, 7.0, 3.0), recoilScale: 1, color: 0xff8a3d,
    desc: 'Heavy revolver-style. Two body tags on armour, one-tag head. Punishing recoil.',
  }),
  zip: mk({
    id: 'zip', name: 'Zip', cs: 'MP9', slot: 1, klass: 'smg', teams: ['ember', 'tide'], price: 1250, killReward: 600,
    damage: 26, armorRatio: 1.2, rangeMod: 0.86, rpm: 857, auto: true, mag: 30, reserve: 120, reload: 2.1, draw: 0.7, moveSpeedU: 240,
    penPower: 1.0, penDmg: 0.65, pattern: proc({ n: 30, pitch: 6.4, tau: 9, yawA: 1.2, yawW: 0.55, yawPhi: 0.6 }), recover: { stand: 0.3, crouch: 0.24 }, range: 90,
    inacc: inacc(0.30, 0.22, 3.4, 6.0, 0.16, 2.4, 6.0), color: 0x7dffb0, tracerEvery: 2, desc: 'Rapid, low-damage SMG. Strong on the move.',
  }),
  hum: mk({
    id: 'hum', name: 'Hum', cs: 'MP5-SD', slot: 1, klass: 'smg', teams: ['ember', 'tide'], price: 1500, killReward: 600,
    damage: 27, armorRatio: 1.25, rangeMod: 0.84, rpm: 750, auto: true, mag: 30, reserve: 120, reload: 2.9, draw: 0.75, moveSpeedU: 235,
    penPower: 1.0, penDmg: 0.65, pattern: proc({ n: 30, pitch: 5.2, tau: 8, yawA: 0.95, yawW: 0.62, yawPhi: 1.9 }), recover: { stand: 0.3, crouch: 0.24 }, range: 100,
    inacc: inacc(0.26, 0.18, 3.0, 5.5, 0.13, 2.0, 6.0), color: 0x5ad1ff, tracerEvery: 2, desc: 'Controllable mid-rate SMG.',
  }),
  arc: mk({
    id: 'arc', name: 'Arc', cs: 'AK-47', slot: 1, klass: 'rifle', teams: ['ember'], price: 2700, killReward: 300,
    damage: 36, armorRatio: 1.55, rangeMod: 0.98, rpm: 600, auto: true, mag: 30, reserve: 90, reload: 2.43, draw: 0.85, moveSpeedU: 215,
    penPower: 2.0, penDmg: 0.85, pattern: AK, recover: { stand: 0.5, crouch: 0.4 }, range: 200,
    inacc: inacc(0.10, 0.07, 4.6, 7.0, 0.11, 1.9, 4.5), color: 0xff7a2f, desc: 'Ember rifle. 143 to the crown, brutal recoil. 4-tag armoured body kill.',
  }),
  rail: mk({
    id: 'rail', name: 'Rail', cs: 'M4A4', slot: 1, klass: 'rifle', teams: ['tide'], price: 3100, killReward: 300,
    damage: 33, armorRatio: 1.4, rangeMod: 0.97, rpm: 666, auto: true, mag: 30, reserve: 90, reload: 3.07, draw: 0.9, moveSpeedU: 225,
    penPower: 1.5, penDmg: 0.8, pattern: M4, recover: { stand: 0.45, crouch: 0.36 }, range: 200,
    inacc: inacc(0.09, 0.06, 4.0, 6.5, 0.09, 1.5, 5.0), color: 0x2fd0ff, desc: 'Tide rifle. Softer recoil, faster cycle, 30 in the mag.',
  }),
  halo: mk({
    id: 'halo', name: 'Halo', cs: 'AUG', slot: 1, klass: 'rifle', teams: ['ember', 'tide'], price: 3300, killReward: 300,
    damage: 28, armorRatio: 1.8, rangeMod: 0.98, cycle: 0.06, auto: false, mag: 30, reserve: 90, reload: 3.8, draw: 0.9, moveSpeedU: 220,
    burst: { count: 3, interval: 0.06, cooldown: 0.34 },
    scope: { zoom: [1.9], hipMul: 1.7, scopedMul: 0.5, recoilMul: 0.8, moveMul: 0.9, resume: true, toggleTime: 0.1 },
    penPower: 1.5, penDmg: 0.8, pattern: proc({ n: 30, pitch: 6.0, tau: 10, yawA: 0.9, yawW: 0.5, yawPhi: 2.6, kick0: 0.15 }), recover: { stand: 0.42, crouch: 0.34 }, range: 200,
    inacc: inacc(0.10, 0.07, 3.8, 6.0, 0.12, 1.4, 5.0), color: 0xb48cff, desc: 'Scoped burst rifle. Three-tag bursts; zoom for laser accuracy.',
  }),
  lance: mk({
    id: 'lance', name: 'Lance', cs: 'AWP', slot: 1, klass: 'sniper', teams: ['ember', 'tide'], price: 4750, killReward: 100,
    damage: 115, armorRatio: 1.95, rangeMod: 0.99, cycle: 1.45, auto: false, bolt: true, mag: 5, reserve: 30, reload: 3.7, draw: 1.1, moveSpeedU: 200, scopedSpeedU: 100,
    scope: { zoom: [2.75, 11.4], hipMul: 1, scopedMul: 1, recoilMul: 1, moveMul: 0.5, resume: true, toggleTime: 0.1, unscopedOnly: true },
    penPower: 2.5, penDmg: 0.9, pattern: new Float32Array([0, 0, 0, 1.1]), recover: { stand: 0.6, crouch: 0.5 }, range: 250,
    // unscoped / scoped tables (scoped stand ~ 0). `air` and `move` are the full penalty at max speed.
    inacc: inacc(3.6, 3.2, 8.5, 14, 0, 0, 1, { scopedStand: 0.02, scopedCrouch: 0.01, scopedMove: 4.6, scopedAir: 12 }),
    color: 0xe8fbff, desc: 'One-tag bolt sniper. 115 body, scope-only accuracy, heavy speed penalty.',
  }),
  scatter: mk({
    id: 'scatter', name: 'Scatter', cs: 'XM1014', slot: 1, klass: 'shotgun', teams: ['ember', 'tide'], price: 2000, killReward: 900,
    damage: 20, pellets: 6, armorRatio: 1.0, rangeMod: 0.7, cycle: 0.35, auto: true, mag: 7, reserve: 32, reload: 0, draw: 0.85, moveSpeedU: 240,
    shell: { start: 0.45, each: 0.5, end: 0.4 },
    penPower: 0.5, penDmg: 0.5, pattern: fromKeys([[0, 0, 0], [1, 0, 3.2], [2, 0.3, 5.8], [3, -0.2, 7.8], [4, 0.2, 9.4], [5, 0, 10.5], [6, 0, 11.2]], 7), recover: { stand: 0.42, crouch: 0.34 }, range: 45,
    inacc: inacc(2.4, 2.1, 3.0, 4.6, 0, 0, 1), color: 0xffe066, crosshairMax: 5, desc: 'Close-range pellet scatter. Six pellets, 20 each.',
  }),
  storm: mk({
    id: 'storm', name: 'Storm', cs: 'Negev', slot: 1, klass: 'heavy', teams: ['ember', 'tide'], price: 1700, killReward: 300,
    damage: 35, armorRatio: 1.5, rangeMod: 0.97, rpm: 1000, auto: true, mag: 150, reserve: 200, reload: 5.7, draw: 1.1, moveSpeedU: 150,
    penPower: 1.5, penDmg: 0.8, pattern: proc({ n: 45, pitch: 4.4, tau: 14, yawA: 2.6, yawW: 0.42, yawPhi: 0.4, ramp: 8 }), recover: { stand: 0.6, crouch: 0.5 }, range: 160,
    inacc: inacc(0.9, 0.7, 5.5, 8.0, 0.28, 3.6, 3.0), color: 0xff4d6d, tracerEvery: 3, desc: 'Heavy 150-round LMG. Slow, spraying, suppressive.',
  }),
};

export const GEAR = {
  vest: { id: 'vest', name: 'Vest', price: 1000, slot: 5, teams: ['ember', 'tide'], desc: 'Armour + helmet: 100 armour.' },
  kit: { id: 'kit', name: 'Kit', price: 400, slot: 5, teams: ['tide'], desc: 'Faster beacon disarm.' },
  beacon: { id: 'beacon', name: 'Beacon', price: 0, slot: 5, teams: ['ember'], desc: 'The objective.' },
};
export const UTILITY_IDS = ['haze', 'strobe', 'pulse'];
export const SLOT_OF = (id) => TAGGERS[id]?.slot ?? (UTILITY_IDS.includes(id) ? 4 : GEAR[id] ? 5 : 0);
export const DEFAULT_LOADOUT = { 3: 'tap', 2: 'pip' };

/** Recoil offset (deg) for shot index `idx` (float allowed → linear interpolation). Beyond the table: last point + deterministic sway. */
export function patternAt(def, idx, out) {
  const p = def.pattern, n = def.patternLen;
  if (idx <= 0) { out.yaw = 0; out.pitch = 0; return out; }
  let i = Math.floor(idx), f = idx - i, y, pt;
  const at = (k) => {
    if (k < n) return [p[k * 2], p[k * 2 + 1]];
    const e = k - (n - 1), s = def.recoilScale;   // beyond the table: deterministic sway around the last point
    return [p[(n - 1) * 2] + Math.sin(e * 0.9) * 0.9 * s, p[(n - 1) * 2 + 1] + Math.min(e, 6) * 0.05];
  };
  const a = at(i), b = at(i + 1);
  y = a[0] + (b[0] - a[0]) * f; pt = a[1] + (b[1] - a[1]) * f;
  out.yaw = y * def.recoilScale; out.pitch = pt * def.recoilScale; return out;
}
