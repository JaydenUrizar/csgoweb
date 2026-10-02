// Match timings & objective numbers as flow uses them. Starts from core MATCH; balance overrides live here (the flow piece owns them).
import { MATCH } from '../core/config.js';
export const TIMING = {
  ...MATCH,
  roundTime: 100,      // 105 let attackers always finish; 95 swung bot matches to 42% Ember, 105 was 65% -> 100 aims at ~50% with real time-outs
  beaconFuse: 40,      // CS2 bomb timer is 40 s; 35 s made retakes hopeless for the AI defenders
};
