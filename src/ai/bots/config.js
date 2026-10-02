// Bot difficulty profiles & global tuning. All times in seconds, angles in radians unless stated, lengths in metres.
// Knobs (per difficulty): react = reaction window [min,max]s after first stable sight, omega/zeta = aim spring (flick speed / overshoot),
// maxVel = angular speed cap (deg/s), errM = aim noise stddev at the target (m), rcs = recoil control 0..1, headP = chance to go for the head,
// tolM = how close (m at target) the bullet line must be before the trigger is pulled, cs = counter-strafe discipline 0..1,
// tactics = quality of team play 0..1 (utility, timing, rotations), util = utility use probability, hear = hearing range multiplier.
export const DIFF = {
  rookie: { id: 'rookie', engage: 36, react: [0.28, 0.46], motor: 0.09, flickDeg: 5, omega: 16, zeta: 0.50, maxVel: 450, errM: 0.45, errMove: 0.6, rcs: 0.35, headP: 0.03, tolM: 0.8, cs: 0.30, sprayDist: 14, burstMul: 1.3,
    tactics: 0.30, util: 0.30, hear: 0.65, visHz: 5, fov: 100, strafe: 0.55, peekSkill: 0.2, crouchP: 0.05, coverP: 0.5, panic: 0.5, execDelay: 0.0 },
  pro:    { id: 'pro', engage: 42, react: [0.17, 0.27], motor: 0.06, flickDeg: 2.8, omega: 21, zeta: 0.66, maxVel: 900, errM: 0.28, errMove: 0.35, rcs: 0.72, headP: 0.15, tolM: 0.55, cs: 0.80, sprayDist: 18, burstMul: 1.0,
    tactics: 0.70, util: 0.70, hear: 0.9, visHz: 8, fov: 104, strafe: 0.9, peekSkill: 0.6, crouchP: 0.25, coverP: 0.8, panic: 0.2, execDelay: 0.5 },
  elite:  { id: 'elite', engage: 55, react: [0.13, 0.22], motor: 0.03, flickDeg: 1.4, omega: 27, zeta: 0.76, maxVel: 1400, errM: 0.13, errMove: 0.2, rcs: 0.93, headP: 0.30, tolM: 0.40, cs: 1.0, sprayDist: 22, burstMul: 0.85,
    tactics: 1.0, util: 0.95, hear: 1.1, visHz: 11, fov: 108, strafe: 1.0, peekSkill: 0.95, crouchP: 0.4, coverP: 1.0, panic: 0.05, execDelay: 1.0 },
};
export const diffOf = (d) => DIFF[String(d || 'pro').toLowerCase()] || DIFF.pro;

export const K = {
  eye: 1.62, crouchEye: 1.12,
  headY: 1.58, headYCrouch: 1.04, chestY: 1.12, stomachY: 0.92, // aim heights above feet
  maxSight: 140,                // m
  closeSense: 4.0,              // anything this close is noticed regardless of facing
  hearRun: 22, hearShot: 70, hearSnipe: 110, hearReload: 10, hearLand: 14, hearUtil: 40, hearPlant: 28,
  memoryTime: 14,               // s a last-known position stays useful
  calloutDelay: [0.35, 1.0],
  arrive: 0.7, arriveHold: 0.35,
  stuckWindow: 0.8, stuckMove: 0.28,
  walkNearEnemy: 12,            // shift-walk radius around a heard/suspected enemy when sneaking
  plantStill: 1.0,              // m/s: below this the arm can start
  thinkHz: 15,
};
