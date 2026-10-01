export const MODULES = [
  ['render', () => import('../../../render/index.js')],
  ['map', () => import('../../../world/index.js')],
  ['player', () => import('../../../player/index.js')],
  ['menu', () => import('../index.js')],
];
