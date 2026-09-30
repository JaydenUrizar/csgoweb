// Shared constants. Tuning knobs that belong to one module live in that module.
export const PHYS_HZ = 120;              // fixed simulation step
export const UNIT = 1;                   // 1 world unit = 1 metre
export const TEAMS = {
  ember: { id: 'ember', name: 'EMBER', color: 0xff7a2f, css: '#ff7a2f', role: 'attack' },  // T-side analogue
  tide:  { id: 'tide',  name: 'TIDE',  color: 0x2fd0ff, css: '#2fd0ff', role: 'defend' },  // CT-side analogue
};
export const PLAYER = { height: 1.8, crouchHeight: 1.25, eye: 1.62, crouchEye: 1.12, radius: 0.36 };
export const MATCH = { roundsToWin: 8, roundTime: 105, buyTime: 12, freezeTime: 6, beaconArmTime: 3.2, beaconDisarmTime: 5, beaconFuse: 35, endTime: 6, startCredits: 800, maxCredits: 9000 };
export const LAYER = { WORLD: 0, ACTOR: 1, FX: 2, VIEWMODEL: 3 };  // three.js Layers
