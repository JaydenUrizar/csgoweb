// Utility tuning constants (metres, seconds). Everything gameplay-relevant lives here.
export const G = 15.24;                 // CS 800 u/s^2 in metres
export const GRENADE = {
  radius: 0.07,
  restitution: 0.45, tangentKeep: 0.80,  // per-bounce normal restitution / tangential velocity kept
  restSpeed: 1.1,                        // below this normal speed a contact is "resting/rolling", not a bounce
  rollFriction: 3.4,                     // m/s^2 deceleration while rolling on a floor
  slopeWalkable: 0.72,                   // normal.y above which a slope can hold a grenade at rest
  stopSpeed: 0.16, stopTime: 0.12,       // speed/time under which a grounded grenade is "at rest"
  maxSubstep: 0.055,                     // max movement per collision substep (< radius*0.8: no tunnelling)
  inherit: 1.25, inheritCrouch: 0.85,    // fraction of thrower velocity inherited
  vLong: 16.5, vShort: 0.30,             // CS: v = vLong * (0.3 + 0.7*strength)
  pitchLift: 10 * Math.PI / 180,         // CS throws 10 deg above the crosshair (tapering to 0 at the poles)
  releaseDelay: 0.16,                    // pin-pull/arm swing latency before the grenade leaves the hand
  maxAge: 12,
};
export const POWER = { strong: 1, long: 1, lob: 1, left: 1, medium: 0.5, mid: 0.5, both: 0.5, weak: 0, short: 0, right: 0, under: 0 };
export const TYPES = {
  haze:   { id: 'haze',   name: 'Haze',   fuse: 3.0,  popOnRest: true,  body: 0x8fa3b4, band: 0x6ff3c7, cap: 0x37424c },
  strobe: { id: 'strobe', name: 'Strobe', fuse: 1.55, popOnRest: false, body: 0xd9dde2, band: 0xfff2a8, cap: 0x555b63 },
  pulse:  { id: 'pulse',  name: 'Pulse',  fuse: 1.6,  popOnRest: false, body: 0x34304a, band: 0xb26bff, cap: 0x1c1a2b },
};
export const LIMITS = { haze: 1, strobe: 2, pulse: 1, total: 3 };
export const HAZE = {
  voxel: 0.5,             // flood-fill cell size
  budget: 1500,         // base cell budget (open air); confined clouds get `bonus` more
  bonus: 1700,            // cells filled (=112 m^3): sphere-ish in the open, longer in corridors
  maxRadius: 10.5,         // hard cap on flood distance from the seed
  squash: 1.7,            // vertical distance weight (>1 => flatter dome)
  seedHeight: 1.1,       // seed sits this far above the resting grenade (clamped by ceilings)
  expandTime: 1.15,       // seconds for the front to reach full size
  life: 18,               // seconds until fully gone
  fadeStart: 12.6,        // gentle dissipation begins
  blockDepth: 0.85,       // metres of full-density smoke that hides a line of sight
  maxPuffs: 760,
  wakeMax: 8,
};
export const STROBE = {
  range: 36, fullRange: 3.5, minDur: 0.5, maxDur: 4.0, sight: 3,
};
export const PULSE = {
  radius: 7.0, maxDamage: 60, falloffPow: 1.25, armorAbsorb: 0.5, knock: 6.2, knockUp: 2.0,
  shakeRadius: 15, expandTime: 0.5,
};
