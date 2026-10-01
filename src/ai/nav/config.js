// Navigation tuning. All lengths in metres. Everything is overridable: ctx.nav.rebuild({ cell: 0.6 }).
export const NAV_DEFAULTS = {
  cell: 0.5,            // grid spacing (must be <= 0.7 so clear nodes can never straddle a thin wall)
  radius: 0.36,         // player capsule radius
  margin: 0.08,         // extra clearance baked into node validity (absorbs grid discretisation error)
  height: 1.8,          // capsule height
  headroom: 2.0,        // required free height above a node (height + tiny slack)
  stepUp: 0.45,         // max ledge the movement code steps over (CS: 0.46). Also the "lift" of the clearance capsule
  slopeDeg: 45,         // max walkable surface angle
  jumpMax: 1.1,         // highest crate/ledge a bot can jump onto
  jumpReach: 1.5,       // max horizontal distance of a jump-up link
  dropReach: 1.1,       // max horizontal distance of a drop-down link
  maxDrop: 4.5,         // highest drop a bot may take (cost grows with height)
  maxCells: 320000,     // safety: auto-coarsen the grid if bounds are huge
  eye: 1.62, crouchEye: 1.12,
  runSpeed: 6.3,        // m/s used by eta()
  jumpPenalty: 0.45,    // seconds added per jump link in eta()
  weight: 1.5,          // A* heuristic weight (1 = optimal, >1 = much faster, <1% longer paths)
  sliceExpansions: 2500,// A* node expansions per rendered frame for requestPath jobs
  areaRadius: 11,       // auto-region radius (m) when the map has no / few callouts
  cacheSize: 96,        // path LRU entries
  smoothing: true,
};
export const DIR = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]; // E SE S SW W NW N NE
export const DIR_E = 0, DIR_S = 2, DIR_W = 4, DIR_N = 6;
export const LINK_WALK = 0, LINK_JUMP = 1, LINK_DROP = 2;
