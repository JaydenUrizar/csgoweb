// Economy rules (CS2 analogue). Pure functions + constants so tools/match_test.mjs can verify them independently.
import { MATCH } from '../core/config.js';

export const ECON = {
  start: MATCH.startCredits ?? 800,
  cap: MATCH.maxCredits ?? 9000,
  win: 3250,                 // round win (any reason)
  lossBase: 1400,            // first consecutive loss
  lossStep: 500,             // +500 per extra consecutive loss
  lossMax: 3400,
  lossLevelMax: 4,           // streak counter saturates at 4 (1400,1900,2400,2900,3400)
  winStreakRule: 'decrement',// CS2: a round win lowers the loss level by one (not a full reset)
  startLevel: 1,             // loss level at the start of each half: pistol-round loser gets 1900 (CS2)
  plantLoss: 800,            // CS2 'bomb planted' consolation: each Ember when the round is lost after arming
  plant: 300,                // whole arming team, on beacon armed
  disarm: 300,               // the disarming player
  teamTag: -300,             // tagging a teammate out
  otStart: 5000,             // credits at the start of each overtime half (CS2 gives a full-buy)
};

/** Loss bonus for a team whose consecutive-loss level is `level` (0 = first loss). */
export function lossBonus(level) {
  return Math.min(ECON.lossMax, ECON.lossBase + ECON.lossStep * Math.min(Math.max(0, level | 0), ECON.lossLevelMax));
}
/** Loss level after a result. */
export function nextLossLevel(level, won) {
  if (won) return ECON.winStreakRule === 'reset' ? 0 : Math.max(0, level - 1);
  return Math.min(ECON.lossLevelMax, level + 1);
}
export function clampCredits(v) { return Math.max(0, Math.min(ECON.cap, Math.round(v))); }

/** Fallback tag rewards per tagger id, used when ctx.combat.taggers[id].killReward is missing. CS2 analogue. */
export const KILL_REWARD = {
  tap: 1500, pip: 300, twin: 300, judge: 300, zip: 600, hum: 600, arc: 300, rail: 300, halo: 300,
  lance: 100, scatter: 900, storm: 300, haze: 300, strobe: 300, pulse: 300, default: 300,
};
