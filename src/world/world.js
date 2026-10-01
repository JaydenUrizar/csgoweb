// Composes the whole level into visual + collision builders. Pure (no DOM) so it can also run in Node for verification.
import { buildLayout } from './layout.js';
import { VisBuilder, ColBuilder } from './builder.js';
import { meshTerrain } from './terrain.js';
import { Dress } from './props.js';
import { dressWorld } from './dress.js';

export function buildWorld() {
  const layout = buildLayout();
  const VB = new VisBuilder(), VBroof = new VisBuilder(), CB = new ColBuilder();
  const terrain = meshTerrain(layout.grid, VB, CB);
  const D = new Dress(VB, VBroof, CB, layout.grid);
  D.terrainWalls = terrain.walls;
  dressWorld(D);
  return { layout, VB, VBroof, CB, terrain, D };
}
