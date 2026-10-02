// Pure ballistics helpers: inaccuracy model, damage/armour maths, built-in hitboxes, material penetration.
import { HITGROUP_MUL, FALLOFF_UNIT } from './taggers.js';

export const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** CS accuracy rule: no movement penalty below 34 % of max speed, ramping to full at 100 %. */
export function moveFrac(speed, maxSpeed) {
  const f = speed / Math.max(0.01, maxSpeed), th = 0.34;
  return f <= th ? 0 : clamp((f - th) / (1 - th), 0, 1.2);
}

/**
 * Total inaccuracy half-angle in degrees.
 * s = { speed, onGround, crouch, vy, fire (accumulated fire inaccuracy), land (0..1 landing penalty), scopeLevel }
 */
export function inaccuracyDeg(def, s) {
  const t = def.inacc, sc = def.scope;
  const scoped = s.scopeLevel > 0 && sc;
  let base, move, air;
  if (def.id === 'lance') {            // AWP: separate tables for scoped / unscoped
    base = scoped ? (s.crouch ? t.scopedCrouch : t.scopedStand) : (s.crouch ? t.crouch : t.stand);
    move = scoped ? t.scopedMove : t.move; air = scoped ? t.scopedAir : t.air;
  } else {
    const k = sc ? (scoped ? sc.scopedMul : sc.hipMul) : 1;
    base = (s.crouch ? t.crouch : t.stand) * k; move = t.move * (sc && scoped ? 0.85 : 1); air = t.air;
  }
  let d = base + move * moveFrac(s.speed, s.maxSpeed || def.moveSpeed);
  if (!s.onGround) d += air * clamp(0.55 + Math.abs(s.vy) / 9, 0.55, 1.15);
  else if (s.land > 0) d += air * 0.55 * s.land;
  d += s.fire;
  if (t.tighten && s.shots != null) d *= 1 - t.tighten * clamp(s.shots / t.tightenShots, 0, 1);   // Negev: tightens to a laser
  return d;
}

/** Map an inaccuracy angle to 0..1 for the HUD crosshair. */
export const crosshairFrac = (def, deg) => clamp(deg / def.crosshairMax, 0, 1);

// ---------------------------------------------------------------------------------------------------------------------
// Damage
const GROUPS = { head: 'head', crown: 'head', helmet: 'head', neck: 'head', chest: 'chest', torso: 'chest', spine: 'chest', upper: 'chest',
  stomach: 'stomach', belly: 'stomach', pelvis: 'stomach', hip: 'stomach', arm: 'arm', arms: 'arm', hand: 'arm', shoulder: 'arm',
  leg: 'leg', legs: 'leg', foot: 'leg', thigh: 'leg', shin: 'leg', body: 'chest' };
export function normGroup(g) {
  if (!g) return 'chest';
  const s = String(g).toLowerCase();
  if (GROUPS[s]) return GROUPS[s];
  for (const k in GROUPS) if (s.includes(k)) return GROUPS[k];
  return 'chest';
}

/** Unmitigated damage at a distance, before armour. */
export function rawDamage(def, group, distance, penMul = 1, base = def.damage) {
  const gm = def.melee ? (group === 'leg' ? 1 : 1) : (HITGROUP_MUL[group] ?? 1);
  const fall = def.melee ? 1 : Math.pow(def.rangeMod, distance / FALLOFF_UNIT);
  return base * gm * fall * penMul;
}

/**
 * Apply CS armour: the ratio (armorPen) of the damage reaches health, half of the rest is absorbed by armour points.
 * Returns {health, absorbed, armorLoss} — integers (CS truncates).
 */
export function armourSplit(def, dmg, group, armor, helmet) {
  const covered = armor > 0 && group !== 'leg' && (group !== 'head' || helmet);
  if (!covered) return { health: Math.floor(dmg), absorbed: 0, armorLoss: 0 };
  const bonus = 0.5;
  let health = dmg * def.armorPen, armorLoss = (dmg - health) * bonus;
  if (armorLoss > armor) { armorLoss = armor; health = dmg - armorLoss / bonus; }
  return { health: Math.floor(health), absorbed: Math.floor(dmg - health), armorLoss: Math.floor(armorLoss) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Materials (penetration): pen = thickness multiplier (× tagger.pen metres), dmg = damage kept per wall.
export const MATERIALS = {
  glass: { pen: 2.4, dmg: 0.95 }, wood: { pen: 1.0, dmg: 0.9 }, plastic: { pen: 1.4, dmg: 0.9 }, thin: { pen: 1.6, dmg: 0.85 },
  sand: { pen: 0.6, dmg: 0.8 }, metal: { pen: 0.45, dmg: 0.7 }, stone: { pen: 0.2, dmg: 0.5 }, concrete: { pen: 0.2, dmg: 0.5 }, default: { pen: 0.15, dmg: 0.5 },
};
export const matOf = (name) => MATERIALS[name] || MATERIALS.default;

// ---------------------------------------------------------------------------------------------------------------------
// Built-in hitboxes (used for dummies / bots without character models and as a fallback before ctx.characters lands).
// Ray vs vertical cylinder incl. caps.  Returns t or -1.
function rayCylY(ox, oy, oz, dx, dy, dz, cx, cz, r, y0, y1, maxT) {
  let best = -1;
  const px = ox - cx, pz = oz - cz, a = dx * dx + dz * dz;
  if (a > 1e-9) {
    const b = px * dx + pz * dz, c = px * px + pz * pz - r * r, disc = b * b - a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      for (const t of [(-b - sq) / a, (-b + sq) / a]) {
        if (t < 0 || t > maxT) continue;
        const y = oy + dy * t; if (y >= y0 && y <= y1) { best = t; break; }
      }
    }
  }
  if (Math.abs(dy) > 1e-9) {
    for (const yy of [y0, y1]) {
      const t = (yy - oy) / dy; if (t < 0 || t > maxT || (best >= 0 && t >= best)) continue;
      const x = px + dx * t, z = pz + dz * t; if (x * x + z * z <= r * r) best = t;
    }
  }
  return best;
}
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxT) {
  const px = ox - cx, py = oy - cy, pz = oz - cz, b = px * dx + py * dy + pz * dz, c = px * px + py * py + pz * pz - r * r, disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc); return t >= 0 && t <= maxT ? t : (c < 0 ? 0 : -1);
}
/** Actor body height for hitboxes (crouch aware). */
export const bodyHeight = (a) => (a.crouching ? Math.min(a.height || 1.8, 1.25) : (a.height || 1.8));
/**
 * Ray vs humanoid hitboxes of `a`. Writes {t, group} into `out`; returns true on hit.
 * head sphere, chest/stomach torso, two arm cylinders, leg cylinder.
 */
export function hitActorBuiltin(o, d, a, maxT, out) {
  const h = bodyHeight(a), px = a.pos.x, pz = a.pos.z, py = a.pos.y;
  // quick reject: bounding cylinder
  if (rayCylY(o.x, o.y, o.z, d.x, d.y, d.z, px, pz, 0.62, py, py + h + 0.05, maxT) < 0) return false;
  let bt = 1e9, bg = null;
  const th = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, px, py + h * 0.905, pz, 0.165 * (h / 1.8 * 0.3 + 0.7), maxT);
  if (th >= 0) { bt = th; bg = 'head'; }
  const tt = rayCylY(o.x, o.y, o.z, d.x, d.y, d.z, px, pz, 0.27, py + h * 0.46, py + h * 0.85, maxT);
  if (tt >= 0 && tt < bt) { bt = tt; const y = (o.y + d.y * tt - py) / h; bg = y > 0.66 ? 'chest' : 'stomach'; }
  const rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
  for (const sgn of [-1, 1]) {
    const ta = rayCylY(o.x, o.y, o.z, d.x, d.y, d.z, px + rx * 0.36 * sgn, pz + rz * 0.36 * sgn, 0.105, py + h * 0.5, py + h * 0.83, maxT);
    if (ta >= 0 && ta < bt) { bt = ta; bg = 'arm'; }
  }
  const tl = rayCylY(o.x, o.y, o.z, d.x, d.y, d.z, px, pz, 0.21, py, py + h * 0.5, maxT);
  if (tl >= 0 && tl < bt) { bt = tl; bg = 'leg'; }
  if (!bg) return false;
  out.t = bt; out.group = bg; return true;
}
