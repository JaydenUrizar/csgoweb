// Per-tagger feel profile: rest pose in view space, recoil kick, flash, timings. cm/deg unless noted.
// rest.p is the grip position in view space (x right, y up, -z forward) in CM; rest.r = [pitch, yaw, roll] degrees.
const base = { rest: { p: [20, -20, -48], r: [2, 2, 0] }, kick: { z: 1.6, pitch: 1.8, yaw: 0.5, roll: 0.9, max: 2.4, k: 260, c: 21 }, flash: { size: 1, len: 1, spikes: 8, style: 'star' }, heat: 0.05, draw: 0.5, reload: 2.1, inspect: 3.2, bob: 1, weight: 1, cool: 0.35 };
const P = (o) => ({ ...base, ...o, rest: { ...base.rest, ...(o.rest || {}) }, kick: { ...base.kick, ...(o.kick || {}) }, flash: { ...base.flash, ...(o.flash || {}) } });

export const PROFILES = {
  tap:     P({ rest: { p: [21, -19, -44], r: [16, 10, 8] }, draw: 0.55, reload: 0, inspect: 3.4, bob: 1, weight: 1.15, heat: 0 }),
  pip:     P({ rest: { p: [17, -17, -42], r: [2, 2, 0] }, kick: { z: 1.8, pitch: 2.6, yaw: 0.6, roll: 1.2, k: 300, c: 22 }, flash: { size: 0.75, len: 0.7 }, heat: 0.07, draw: 0.42, reload: 1.7, inspect: 3.0, weight: 0.7 }),
  twin:    P({ rest: { p: [17, -17, -42], r: [2, 2, 0] }, kick: { z: 1.2, pitch: 1.7, yaw: 0.9, roll: 1.4, k: 320, c: 22 }, flash: { size: 0.8, len: 0.8, spikes: 6 }, heat: 0.06, draw: 0.42, reload: 1.9, inspect: 3.1, weight: 0.7 }),
  judge:   P({ rest: { p: [18, -18, -42], r: [3, 2, 0] }, kick: { z: 4.2, pitch: 7, yaw: 1.4, roll: 2.5, max: 1.6, k: 190, c: 15 }, flash: { size: 1.5, len: 1.4, spikes: 10 }, heat: 0.22, draw: 0.6, reload: 3.4, inspect: 3.6, weight: 1.2, cool: 0.22 }),
  zip:     P({ rest: { p: [20, -19, -45], r: [2, 2, 0] }, kick: { z: 0.9, pitch: 0.9, yaw: 0.45, roll: 0.6, max: 3, k: 340, c: 24 }, flash: { size: 0.7, len: 0.7, spikes: 6 }, heat: 0.035, draw: 0.5, reload: 2.0, inspect: 3.0, weight: 0.8 }),
  hum:     P({ rest: { p: [20, -19, -46], r: [2, 2, 0] }, kick: { z: 1.2, pitch: 1.2, yaw: 0.5, roll: 0.7, max: 2.8, k: 300, c: 23 }, flash: { size: 0.85, len: 0.9, spikes: 8 }, heat: 0.045, draw: 0.55, reload: 2.3, inspect: 3.2, weight: 0.95 }),
  arc:     P({ rest: { p: [21, -20, -48], r: [2, 2, 0] }, kick: { z: 2.0, pitch: 2.2, yaw: 0.8, roll: 0.9, max: 2.4, k: 250, c: 20 }, flash: { size: 1.15, len: 1.1, spikes: 8 }, heat: 0.06, draw: 0.62, reload: 2.5, inspect: 3.6, weight: 1.05 }),
  rail:    P({ rest: { p: [21, -20, -48], r: [2, 2, 0] }, kick: { z: 1.5, pitch: 1.5, yaw: 0.4, roll: 0.6, max: 2.4, k: 280, c: 22 }, flash: { size: 1.0, len: 1.0, spikes: 8 }, heat: 0.05, draw: 0.6, reload: 2.4, inspect: 3.6, weight: 1.0 }),
  halo:    P({ rest: { p: [21, -20, -47], r: [2, 2, 0] }, kick: { z: 1.8, pitch: 2.0, yaw: 0.4, roll: 0.6, max: 2.0, k: 260, c: 21 }, flash: { size: 0.9, len: 1.0, spikes: 12, style: 'ring' }, heat: 0.09, draw: 0.68, reload: 2.7, inspect: 3.8, weight: 1.1 }),
  lance:   P({ rest: { p: [21, -21, -48], r: [1.5, 2.5, 0] }, kick: { z: 6, pitch: 9, yaw: 1.0, roll: 2.2, max: 1.4, k: 150, c: 13 }, flash: { size: 1.7, len: 2.4, spikes: 6, style: 'bolt' }, heat: 0.4, draw: 0.9, reload: 3.6, inspect: 4.2, weight: 1.5, cool: 0.18 }),
  scatter: P({ rest: { p: [21, -20, -47], r: [2, 2, 0] }, kick: { z: 5.4, pitch: 6, yaw: 0.9, roll: 2.4, max: 1.5, k: 170, c: 14 }, flash: { size: 1.7, len: 1.3, spikes: 12, style: 'wide' }, heat: 0.3, draw: 0.7, reload: 3.4, inspect: 3.8, weight: 1.3, cool: 0.2 }),
  storm:   P({ rest: { p: [22, -21, -49], r: [2, 2, 0] }, kick: { z: 1.4, pitch: 1.1, yaw: 0.6, roll: 0.7, max: 3.0, k: 240, c: 21 }, flash: { size: 1.25, len: 1.2, spikes: 8 }, heat: 0.04, draw: 0.9, reload: 4.2, inspect: 4.4, weight: 1.6, cool: 0.25 }),
  haze:    P({ rest: { p: [13.5, -13, -34], r: [8, -4, 0] }, draw: 0.5, reload: 0, heat: 0, weight: 0.8 }),
  strobe:  P({ rest: { p: [13.5, -13, -34], r: [8, -4, 0] }, draw: 0.5, reload: 0, heat: 0, weight: 0.8 }),
  pulse:   P({ rest: { p: [13.5, -13, -34], r: [8, -4, 0] }, draw: 0.5, reload: 0, heat: 0, weight: 0.8 }),
  beacon:  P({ rest: { p: [16, -20, -40], r: [0, 0, 0] }, draw: 0.6, reload: 0, heat: 0, weight: 1.1 }),
  kit:     P({ rest: { p: [18, -19, -40], r: [0, 0, 0] }, draw: 0.6, reload: 0, heat: 0, weight: 0.9 }),
  vest:    P({ rest: { p: [16, -22, -38], r: [0, 0, 0] }, draw: 0.5, reload: 0, heat: 0 }),
};
// Long arms are posed like CS2: closer to the camera and yawed so the left side profile runs diagonally into the lower right.
for (const id of ['zip', 'hum', 'arc', 'rail', 'halo', 'lance', 'scatter', 'storm']) {
  const r = PROFILES[id].rest, zs = id === 'lance' ? 3 : id === 'halo' ? 4 : 6.5; r.p = [r.p[0] - 2.2, r.p[1] + 2.6, r.p[2] + zs]; r.r = [r.r[0] + 3, r.r[1] + 8, r.r[2] + 2];
}
export const profile = (id) => PROFILES[id] || PROFILES.pip;
