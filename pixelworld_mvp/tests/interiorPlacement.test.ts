import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition, InteriorDefinition } from '../src/world/types';
import {
  commitPlacementCandidate,
  navigationCells,
  resolvePlacementCandidate,
  rotatedFootprint,
  snapFurnitureCenter,
} from '../src/rendering/interiorPlacement';

const room: InteriorDefinition = {
  id: 'rest-cabin', label: 'Test', width: 14, height: 9, floor: 'wood', wall: 'cream',
  furniture: [], overflow: [],
};

const sofa: FurnitureDefinition = {
  id: 'sofa', kind: 'sofa', point: { x: 1, y: 1 }, facing: 'up',
  supportedActions: [], icon: 'generic', scale: 1, rotation: 0,
};

describe('interior fine-grid placement', () => {
  it('centers even footprints on half coordinates', () => {
    expect(snapFurnitureCenter({ x: 4.2, y: 3.8 }, { width: 2, height: 3 }))
      .toEqual({ x: 4.5, y: 4 });
  });

  it('swaps footprint axes after a quarter turn', () => {
    expect(rotatedFootprint({ width: 4, height: 2 }, 90)).toEqual({ width: 2, height: 4 });
    expect(rotatedFootprint({ width: 4, height: 2 }, 180)).toEqual({ width: 4, height: 2 });
  });

  it('commits the exact immutable green preview candidate', () => {
    const candidate = resolvePlacementCandidate(room, [], sofa, { x: 4.2, y: 3.8 });
    expect(candidate.diagnostic).toBe('valid');
    expect(candidate.furniture.point).toEqual({ x: 4.5, y: 3.5 });

    const committed = commitPlacementCandidate(room, [], candidate);
    expect(committed).toEqual([candidate.furniture]);
    expect(committed[0]).not.toBe(candidate.furniture);
  });

  it('projects every touched half-cell to conservative navigation cells', () => {
    const cells = navigationCells({ ...sofa, point: { x: 4.5, y: 4.5 } });
    expect(cells).toEqual([
      { x: 4, y: 4 }, { x: 5, y: 4 },
      { x: 4, y: 5 }, { x: 5, y: 5 },
    ]);
  });
});
