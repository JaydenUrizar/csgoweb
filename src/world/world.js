// Composes the whole level into visual + collision builders. Pure (no DOM) so it can also run in Node for verification.
import { buildLayout } from './layout.js';
import { VisBuilder, ColBuilder } from './builder.js';
import { meshTerrain } from './terrain.js';

export function buildWorld() {
  const layout = buildLayout();
  const VB = new VisBuilder(), CB = new ColBuilder();
  const terrain = meshTerrain(layout.grid, VB, CB);
  return { layout, VB, CB, terrain };
}
