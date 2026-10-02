// Gameplay data for Crux Station: spawns, sites, strategic nodes for nav/bots.
import { H } from './layout.js';

export const SPAWNS = {
  ember: [[-8, 45.5], [-4, 46.8], [0, 45.5], [4, 46.8], [8, 45.5]].map(([x, z]) => ({ x, z, yaw: 0 })),
  tide: [[-8, -45.5], [-4, -46.8], [0, -45.5], [4, -46.8], [8, -45.5]].map(([x, z]) => ({ x, z, yaw: Math.PI })),
};

export const SITES = {
  A: { x: 34.5, z: -28.5, y: H.A, radius: 9.5, plant: { x: 34.5, z: -28.5, radius: 5.5 } },
  B: { x: -33, z: -31, y: H.BPLAZA, radius: 9.5, plant: { x: -33, z: -31, radius: 5.5 } },
};

// type: choke | hold | lurk | angle | cover | plant | rotate | entry | spawn
// team: who typically uses it ('ember' attackers / 'tide' defenders / 'both'). yaw: look direction (0 = -Z, PI/2 = -X).
const N = (id, type, team, site, x, z, yaw, note = '', extra = {}) => ({ id, type, team, site, x, z, yaw, note, ...extra });
const E = Math.PI * 1.5, W = Math.PI / 2, S = Math.PI;   // yaw looking east(+x), west(-x), south(+z)
export const NODES = [
  // ---------------- plant spots
  N('A-plant-default', 'plant', 'ember', 'A', 34.5, -28.5, 0, 'default plant, plinth'),
  N('A-plant-boxes', 'plant', 'ember', 'A', 35.5, -27.4, W, 'behind default boxes (cover from long)'),
  N('A-plant-ledge', 'plant', 'ember', 'A', 44.5, -37, W, 'on ledge, safe from long'),
  N('B-plant-default', 'plant', 'ember', 'B', -33, -31, 0, 'default plant, plinth'),
  N('B-plant-boxes', 'plant', 'ember', 'B', -29.8, -31.6, E, 'behind default boxes'),
  N('B-plant-balcony', 'plant', 'ember', 'B', -42, -41, 0, 'on balcony'),
  // ---------------- attacker staging / entries
  N('long-outer', 'hold', 'ember', 'A', 37, 40, 0, 'outer long, before doors'),
  N('long-doors', 'choke', 'both', 'A', 38, 29, 0, 'long doors choke', { width: 6 }),
  N('long-pit', 'lurk', 'ember', 'A', 46.5, 14, W, 'pit, covers lane flank'),
  N('long-cargo', 'cover', 'ember', 'A', 39.5, 7, 0, 'west of cargo container'),
  N('long-corner', 'angle', 'tide', 'A', 37.4, 5, S, 'AWP lane down long from corner box'),
  N('long-top', 'hold', 'tide', 'A', 38, -10, S, 'top of long ramp, long lane view'),
  N('long-ramp-entry', 'entry', 'ember', 'A', 38, -10, 0, 'long ramp entry onto site'),
  N('mid-doors', 'choke', 'both', 'MID', 0, 12.5, 0, 'mid doors', { width: 4 }),
  N('mid-lane-hold', 'hold', 'ember', 'MID', -3, 22, 0, 'behind lane cover'),
  N('mid-door-peek-w', 'angle', 'tide', 'MID', -3, 4.5, S, 'peek mid doors from hub west'),
  N('mid-door-peek-e', 'angle', 'tide', 'MID', 3, 4.5, S, 'peek mid doors from hub east'),
  N('hub-xbox', 'cover', 'both', 'MID', 3, -6.3, S, 'behind xbox box'),
  N('hub-pillar-w', 'cover', 'both', 'MID', -5.5, 6.2, 0, 'hub pillar west'),
  N('hub-pillar-e', 'cover', 'both', 'MID', 5.5, 6.2, 0, 'hub pillar east'),
  N('hub-ledge', 'hold', 'tide', 'MID', -8.5, -10, 0, 'raised ledge overlooking hub', { elevated: true }),
  N('hub-arch-w', 'choke', 'tide', 'MID', -6, -15, S, 'west arch', { width: 4 }),
  N('hub-arch-e', 'choke', 'tide', 'MID', 6, -15, S, 'east arch', { width: 4 }),
  N('short-ramp-mid', 'choke', 'both', 'A', 14.5, -6, 0, 'short ramp climb', { width: 5 }),
  N('catwalk-hold', 'hold', 'tide', 'A', 14.5, -24, S, 'catwalk deck, overlooks palace', { elevated: true }),
  N('catwalk-top', 'angle', 'ember', 'A', 14.5, -17, 0, 'catwalk top of short', { elevated: true }),
  N('terrace-hold', 'hold', 'tide', 'A', 18, -29, E, 'terrace, covers catwalk stairs & site west', { elevated: true }),
  N('catwalk-stairs', 'entry', 'ember', 'A', 24.5, -29, E, 'catwalk stairs down onto site'),
  N('under-catwalk', 'lurk', 'tide', 'MID', 14.5, -22, S, 'under catwalk nook'),
  N('palace-fountain-w', 'cover', 'both', 'MID', -3.2, -21, S, 'fountain cover west'),
  N('palace-fountain-e', 'cover', 'both', 'MID', 3.2, -21, S, 'fountain cover east'),
  // ---------------- B approach
  N('tun-approach', 'hold', 'ember', 'B', -23, 43, W, 'tunnel approach'),
  N('tun-corner-1', 'choke', 'both', 'B', -33, 27, 0, 'first bend'),
  N('tun-lower', 'hold', 'both', 'B', -39, 17, 0, 'lower tunnel'),
  N('tun-bend', 'choke', 'both', 'B', -37, 9, 0, 'second bend', { width: 6 }),
  N('tun-upper', 'hold', 'tide', 'B', -33, -4, S, 'upper tunnel, pillar'),
  N('tun-mouth', 'choke', 'both', 'B', -33, -15, 0, 'tunnel mouth arch', { width: 6 }),
  N('tun-mouth-in', 'entry', 'ember', 'B', -33, -21, 0, 'drop into plaza'),
  N('b-window-hold', 'angle', 'tide', 'B', -19.3, -34, S, 'peek B window from window room bench'),
  N('b-window-boost', 'lurk', 'ember', 'B', -23.5, -34, E, 'window boost steps'),
  N('b-conn-hold', 'angle', 'tide', 'B', -17, -23, W, 'connector ramp top'),
  N('b-conn-entry', 'entry', 'ember', 'B', -20.5, -23, W, 'connector ramp entry to plaza'),
  N('b-balcony', 'hold', 'tide', 'B', -42, -41, S, 'balcony overlooks site', { elevated: true }),
  N('b-pillar-s', 'cover', 'both', 'B', -41, -22.5, 0, 'south arcade pillar'),
  N('b-container', 'cover', 'tide', 'B', -37, -36.5, S, 'container north-west of plant'),
  N('b-boxes', 'cover', 'tide', 'B', -27, -33, E, 'default boxes east of plant'),
  N('b-tide-door', 'entry', 'tide', 'B', -20, -43, W, 'tide door onto plaza'),
  N('b-bigcrate', 'lurk', 'tide', 'B', -30, -42.3, S, 'behind big crate'),
  N('b-canal', 'lurk', 'ember', 'B', -45, -26, 0, 'canal low-ground lurk'),
  // ---------------- A defence
  N('a-door', 'choke', 'both', 'A', 19, -43, E, 'tide door onto A', { width: 6 }),
  N('a-ledge', 'hold', 'tide', 'A', 45.5, -41, S, 'ledge high ground', { elevated: true }),
  N('a-ledge-boxes', 'lurk', 'tide', 'A', 38.7, -36.3, E, 'jump-up box ninja'),
  N('a-default-boxes', 'cover', 'tide', 'A', 36, -30.5, S, 'default boxes cover'),
  N('a-big-crate', 'cover', 'tide', 'A', 35.5, -14.8, S, 'big crate behind long ramp'),
  N('a-triple', 'hold', 'tide', 'A', 25.5, -18, E, 'triple stack, covers catwalk & long'),
  N('a-container', 'cover', 'both', 'A', 42.5, -25.5, 0, 'container north face'),
  N('a-pillar', 'cover', 'both', 'A', 26, -39, E, 'pillar west'),
  N('a-stall', 'lurk', 'tide', 'A', 26.5, -12.8, E, 'pergola stall corner'),
  // ---------------- tide spawn exits
  N('tide-mid-hold', 'hold', 'tide', 'MID', 0, -30, S, 'tide mid lane'),
  N('tide-east-room', 'hold', 'tide', 'A', 10.5, -34.5, S, 'east room, covers palace east'),
  N('tide-window-room', 'hold', 'tide', 'B', -14, -31, S, 'window room'),
  N('ember-mid-gate', 'choke', 'ember', 'MID', 0, 38, 0, 'ember mid exit', { width: 10 }),
];

// Hand-placed anchors; PATHS below is generated from them by `node src/world/verify.mjs genpaths` (clearance-checked, walkable without jumping).
export const PATH_SEEDS = [
  { id: 'ember-long', team: 'ember', site: 'A', pts: [[25, 43], [37, 40], [38, 29], [38, 12], [38, -4], [38, -14], [34.5, -26]] },
  { id: 'ember-short', team: 'ember', site: 'A', pts: [[0, 37], [0, 12.5], [0, 2], [11, 7], [14.5, 0], [14.5, -14], [14.5, -26], [20, -29], [26, -28], [32, -28]] },
  { id: 'ember-mid-b', team: 'ember', site: 'B', pts: [[0, 37], [0, 12.5], [0, 0], [-6, -13], [-6, -15], [-8, -20], [-16, -22], [-20, -23], [-26, -23], [-32, -28]] },
  { id: 'ember-tunnels', team: 'ember', site: 'B', pts: [[-23, 43], [-33, 43], [-33, 28], [-39, 26], [-39, 9], [-33, 9], [-33, -14], [-33, -21], [-33, -27]] },
  { id: 'tide-a', team: 'tide', site: 'A', pts: [[10, -43], [19, -43], [26, -42], [34.5, -36], [34.5, -29]] },
  { id: 'tide-b', team: 'tide', site: 'B', pts: [[-10, -43], [-19, -43], [-26, -42], [-30, -37], [-33, -31]] },
  { id: 'rotate-a-to-b-tide', team: 'tide', site: null, pts: [[30, -34], [24, -43], [19, -43], [10, -43], [-10, -43], [-19, -43], [-26, -42], [-31, -36]] },
  { id: 'rotate-a-to-b-palace', team: 'tide', site: null, pts: [[26, -27], [22, -19], [17, -19], [8, -18], [0, -18], [-10, -20], [-19, -23], [-26, -26]] },
  { id: 'rotate-b-to-a-palace', team: 'tide', site: null, pts: [[-26, -26], [-19, -23], [-10, -20], [0, -18], [8, -18], [17, -19], [22, -19], [26, -27]] },
  { id: 'rotate-b-to-a-tide', team: 'tide', site: null, pts: [[-31, -36], [-26, -42], [-19, -43], [-10, -43], [10, -43], [19, -43], [24, -43], [30, -34]] },
];
export const PATHS = [
  { id: 'ember-long', team: 'ember', site: 'A', pts: [[25, 44, 0], [26, 44, 0], [33, 42, 0], [38, 36, 0], [39.5, 9.5, 0], [38, -5, 0.25], [38, -18.5, 1.5], [34.5, -26, 1.5]] },
  { id: 'ember-short', team: 'ember', site: 'A', pts: [[0, 36.5, 0], [-2.5, 30, 0], [1.5, 10, 0], [3, 9, 0], [4, 9, 0], [8.5, 4.5, 0], [1, -2, 0], [1, -5, 0], [2, -10, 0], [2, -11, 0], [2.5, -11.5, 0], [5, -13.5, 0], [9.5, -18.5, 0], [17, -18.5, 0], [18, -18.5, 0.25], [19, -18.5, 0.55], [20, -18.5, 0.8], [21, -18.5, 1.15], [22, -18.5, 1.45], [23, -18.5, 1.5], [27, -18.5, 1.5], [28, -19.5, 1.5], [28, -28, 1.5], [32, -28, 1.5]] },
  { id: 'ember-mid-b', team: 'ember', site: 'B', pts: [[0, 36.5, 0], [-2.5, 30, 0], [1.5, 10, 0], [3, 9, 0], [4, 9, 0], [4.5, 8.5, 0], [4.5, 7.5, 0], [-0.5, -6.5, 0], [-0.5, -7.5, 0], [-3, -9.5, 0], [-10.5, -22, 0], [-21, -23.5, -1.2], [-26, -23.5, -1.4], [-27, -25, -1.4], [-32, -28, -1.4]] },
  { id: 'ember-tunnels', team: 'ember', site: 'B', pts: [[-23.5, 43, 0], [-33.5, 42.5, 0], [-34.5, 32.5, 0], [-33, 30, 0], [-34.5, 26.5, 0], [-35, 26, 0], [-38.5, 23.5, 0], [-37, 10, 0], [-34.5, 9.5, 0], [-33, 6.5, 0], [-34, -6.5, 0], [-33, -27, -1.4]] },
  { id: 'tide-a', team: 'tide', site: 'A', pts: [[11, -43, 0], [16, -43, 0], [17, -43, 0.2], [18, -43, 0.45], [19, -43, 0.7], [19.5, -42.5, 0.8], [20, -42, 0.95], [21, -42, 1.2], [22, -42, 1.45], [23, -42, 1.5], [35, -36, 1.5], [36, -35, 1.5], [36, -30.5, 1.5], [34.5, -29, 1.5]] },
  { id: 'tide-b', team: 'tide', site: 'B', pts: [[-10.5, -43, 0], [-11.5, -38, 0], [-16, -30.5, 0], [-16, -27.5, 0], [-17, -26.5, 0], [-17, -25.5, -0.3], [-17.5, -25, -0.4], [-20.5, -23.5, -1.1], [-25.5, -23.5, -1.4], [-33, -31, -1.4]] },
  { id: 'rotate-a-to-b-tide', team: 'tide', site: null, pts: [[29.5, -32.5, 1.5], [29, -31, 1.5], [27, -31, 1.55], [26.5, -31.5, 1.7], [26, -32, 1.5], [24, -43, 1.5], [-25.5, -42, -1.4], [-28.5, -36, -1.4]] },
  { id: 'rotate-a-to-b-palace', team: 'tide', site: null, pts: [[28, -26.5, 1.5], [28, -19.5, 1.5], [27, -18.5, 1.5], [9.5, -18.5, 0], [3.5, -18, 0], [-1.5, -17.5, 0], [-17.5, -23, -0.4], [-19, -23, -0.75], [-25.5, -23.5, -1.4], [-26, -25, -1.4], [-26, -26, -1.4]] },
  { id: 'rotate-b-to-a-palace', team: 'tide', site: null, pts: [[-26, -25, -1.4], [-25.5, -23.5, -1.4], [-21.5, -23, -1.35], [-20.5, -23, -1.1], [-19.5, -23, -0.85], [-18.5, -23, -0.65], [-18, -23, -0.5], [-17.5, -22.5, -0.4], [-17, -22, -0.3], [-16.5, -21.5, -0.2], [-16, -21, -0.05], [-15.5, -20.5, 0], [0, -17.5, 0], [3.5, -18, 0], [15, -18.5, 0], [17, -18.5, 0], [18, -18.5, 0.25], [19, -18.5, 0.55], [20, -18.5, 0.8], [21, -18.5, 1.15], [22, -18.5, 1.45], [23, -18.5, 1.5], [27, -18.5, 1.5], [28, -19.5, 1.5], [27.5, -27, 1.5]] },
  { id: 'rotate-b-to-a-tide', team: 'tide', site: null, pts: [[-28, -36.5, -1.4], [-21.5, -43, -1.35], [-20.5, -43, -1.1], [-19.5, -43, -0.85], [-18.5, -43, -0.65], [-18, -43, -0.5], [-17, -43, -0.3], [-16, -43, -0.05], [-15, -43, 0], [16, -43, 0], [17, -43, 0.2], [18, -43, 0.45], [19, -43, 0.7], [20, -43, 0.95], [21, -43, 1.2], [22, -43, 1.45], [26.5, -38.5, 1.5], [26.5, -32.5, 1.5], [26.5, -31.5, 1.7], [27, -31, 1.55], [29, -31, 1.5], [29.5, -32, 1.5], [29.5, -33, 1.5]] },
];
