// Buy catalogue. Costs are the CS2 analogue. `killReward` is the fallback; ctx.combat.taggers[id].killReward wins if present.
import { KILL_REWARD } from './economy.js';

const B = ['ember', 'tide'];
const item = (id, name, cost, slot, category, teams, desc, extra = {}) => ({
  id, name, cost, slot, category, teams, killReward: KILL_REWARD[id] ?? KILL_REWARD.default, desc, ...extra,
});

export const CATEGORIES = [
  { id: 'pistol', name: 'Sidearms', slot: 2 },
  { id: 'heavy', name: 'Heavy', slot: 1 },
  { id: 'smg', name: 'SMGs', slot: 1 },
  { id: 'rifle', name: 'Rifles', slot: 1 },
  { id: 'util', name: 'Utility', slot: 4 },
  { id: 'gear', name: 'Gear', slot: 5 },
];

export const CATALOG = [
  item('pip', 'Pip', 0, 2, 'pistol', B, 'Default sidearm. Reliable, free.', { default: true }),
  item('twin', 'Twin', 300, 2, 'pistol', B, 'Fast burst pistol.'),
  item('judge', 'Judge', 700, 2, 'pistol', B, 'Heavy revolver-style sidearm.'),
  item('scatter', 'Scatter', 1100, 1, 'heavy', B, 'Pellet spread. Brutal up close.'),
  item('storm', 'Storm', 5200, 1, 'heavy', B, 'LMG with a huge magazine.'),
  item('zip', 'Zip', 1050, 1, 'smg', B, 'Very high rate, low damage.'),
  item('hum', 'Hum', 1250, 1, 'smg', B, 'Mid-rate all-round SMG.'),
  item('arc', 'Arc', 2700, 1, 'rifle', ['ember'], 'Ember rifle. High damage, harsh recoil.'),
  item('rail', 'Rail', 2900, 1, 'rifle', ['tide'], 'Tide rifle. Accurate and controllable.'),
  item('halo', 'Halo', 3100, 1, 'rifle', B, 'Scoped burst rifle.'),
  item('lance', 'Lance', 4750, 1, 'rifle', B, 'Bolt-action. One tag, heavy movement penalty.'),
  item('haze', 'Haze', 300, 4, 'util', B, 'Smoke sphere that blocks vision.', { utility: true, max: 1 }),
  item('strobe', 'Strobe', 200, 4, 'util', B, 'Blinding flash and ear ring.', { utility: true, max: 2 }),
  item('pulse', 'Pulse', 300, 4, 'util', B, 'Area pulse, partial Charge drain.', { utility: true, max: 1 }),
  item('kit', 'Kit', 400, 5, 'gear', ['tide'], 'Halves beacon disarm time.', { gear: true }),
  item('vest', 'Vest', 1000, 5, 'gear', B, 'Armor and helmet (absorbs 50%).', { gear: true }),
];
export const BY_ID = Object.fromEntries(CATALOG.map((i) => [i.id, i]));
export const MAX_UTILITY = 3;
export const isPrimary = (it) => it.slot === 1;
export const isSecondary = (it) => it.slot === 2;
