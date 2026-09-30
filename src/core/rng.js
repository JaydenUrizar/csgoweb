// Seeded RNG so scenarios are reproducible: ?seed=123
export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const rng = { r: mulberry32(1), seed(n) { rng.r = mulberry32(n); }, next: () => rng.r(), range: (a, b) => a + rng.r() * (b - a), int: (a, b) => Math.floor(a + rng.r() * (b - a + 1)), pick: (arr) => arr[Math.floor(rng.r() * arr.length)] };
