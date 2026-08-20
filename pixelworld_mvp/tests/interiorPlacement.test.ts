import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition, InteriorDefinition } from '../src/world/types';
import {
  commitPlacementCandidate,
  fitBoundsDeltaToRoom,
  furniturePointFromRenderPoint,
  furnitureRenderGeometry,
  navigationCells,
  resolvePlacementCandidate,
  resolvedFurnitureAsset,
  rotatedFootprint,
  snapFurnitureCenter,
  snapFurniturePoint,
  transformedAlphaBounds,
} from '../src/rendering/interiorPlacement';
import { catalogItem } from '../src/rendering/modernOfficeCatalog';
import { translateFurnitureGeometry } from '../src/rendering/canonicalFurnitureGeometry';

const room: InteriorDefinition = {
  id: 'rest-cabin', label: 'Test', width: 14, height: 9, floor: 'wood', wall: 'cream',
  furniture: [], overflow: [],
};

const sofa: FurnitureDefinition = {
  id: 'sofa', kind: 'sofa', point: { x: 1, y: 1 }, facing: 'up',
  supportedActions: [], icon: 'generic', scale: 1, rotation: 0,
};

const room18x12: InteriorDefinition = {
  ...room, width: 18, height: 12,
};

const oneCellDesk: FurnitureDefinition = {
  ...sofa, id: 'one-cell-desk', kind: 'desk', assetId: 247,
  footprint: { width: 1, height: 1 }, rotation: 90,
};

describe('interior fine-grid placement', () => {
  it('centers even footprints on half coordinates', () => {
    expect(snapFurnitureCenter({ x: 4.2, y: 3.8 }, { width: 2, height: 3 }))
      .toEqual({ x: 4.5, y: 4 });
  });

  it('snaps anchors to quarter-cell coordinates', () => {
    expect(snapFurniturePoint({ x: 2.38, y: 3.62 })).toEqual({ x: 2.5, y: 3.5 });
  });

  it('uses the exact opaque pixel rectangle without tile inflation', () => {
    const asset = catalogItem(98)!;
    const bounds = transformedAlphaBounds({ ...sofa, assetId: 98, point: { x: 4, y: 3 } }, asset);
    expect(bounds.width).toBeCloseTo(asset.opaqueBounds.width / 22);
    expect(bounds.height).toBeCloseTo(asset.opaqueBounds.height / 22);
  });

  it('uses one scaled visual center for rendering, alpha bounds, and drag inversion', () => {
    const item = {
      ...sofa, assetId: 98, point: { x: 4, y: 3 }, scale: 2 as const,
      visualOffset: { x: 0.25, y: -0.5 },
    };
    const geometry = furnitureRenderGeometry(item);

    expect(geometry.center).toEqual({ x: 5, y: 2.5 });
    expect(transformedAlphaBounds(item)).toEqual(geometry.bounds);
    expect(furniturePointFromRenderPoint(item, { x: 4.5, y: 2 })).toEqual(item.point);
  });

  it('translates an authored interaction point with its logical furniture point', () => {
    const item: FurnitureDefinition = {
      ...sofa,
      id: 'station',
      point: { x: 2, y: 2 },
      interactionPoint: { x: 2, y: 4 },
    };
    const candidate = resolvePlacementCandidate(room, [], item, { x: 5, y: 3 });

    expect(candidate.furniture.point).toEqual({ x: 5, y: 3 });
    expect(candidate.furniture.interactionPoint).toEqual({ x: 5, y: 5 });
  });

  it('uses the canonical translation path without sharing mutable geometry', () => {
    const source: FurnitureDefinition = {
      ...sofa,
      id: 'canonical-candidate',
      point: { x: 2, y: 2 },
      supportedActions: ['terminal'],
      footprint: { width: 2, height: 1 },
      visualOffset: { x: -0.25, y: 0.125 },
      interactionPoint: { x: 3, y: 4 },
    };
    const candidate = resolvePlacementCandidate(room, [], source, { x: 5, y: 3 });
    const expected = translateFurnitureGeometry({ ...source, rotation: 0 }, { x: 3, y: 1 });

    expect(candidate.furniture).toEqual(expected);
    expect(candidate.furniture.point).toEqual({ x: 5, y: 3 });
    expect(candidate.furniture.interactionPoint).toEqual({ x: 6, y: 5 });
    candidate.furniture.supportedActions.push('read');
    candidate.furniture.footprint!.width = 99;
    candidate.furniture.visualOffset!.x = 99;
    expect(source.supportedActions).toEqual(['terminal']);
    expect(source.footprint).toEqual({ width: 2, height: 1 });
    expect(source.visualOffset).toEqual({ x: -0.25, y: 0.125 });
  });

  it('resolves authored and explicit catalog furniture to the same alpha asset', () => {
    expect(resolvedFurnitureAsset(sofa)?.id).toBe(200);
    expect(transformedAlphaBounds(sofa)).toEqual(transformedAlphaBounds({ ...sofa, assetId: 200 }));
  });

  it('fits intersecting alpha pixels flush to every room edge', () => {
    const left = resolvePlacementCandidate(room, [], sofa, { x: -0.25, y: 2 });
    const right = resolvePlacementCandidate(room, [], sofa, { x: 13.75, y: 2 });
    const top = resolvePlacementCandidate(room, [], sofa, { x: 2, y: -0.25 });
    const bottom = resolvePlacementCandidate(room, [], sofa, { x: 2, y: 8.75 });

    expect(left.diagnostic).toBe('valid');
    expect(left.bounds.x).toBeCloseTo(0);
    expect(right.bounds.x + right.bounds.width).toBeCloseTo(room.width);
    expect(top.bounds.y).toBeCloseTo(0);
    expect(bottom.bounds.y + bottom.bounds.height).toBeCloseTo(room.height);
  });

  it('rejects fully outside furniture and still protects the door', () => {
    expect(resolvePlacementCandidate(room, [], sofa, { x: -3, y: 2 }).diagnostic).toBe('outside-room');
    expect(resolvePlacementCandidate(room, [], sofa, { x: 7, y: 9 }).diagnostic).toBe('blocks-door');
  });

  it.each([
    { x: -40, y: 4 }, { x: 40, y: 4 }, { x: 4, y: -30 }, { x: 4, y: 30 }, { x: -40, y: -30 },
  ])('leaves a fully outside item at %j rejected instead of snapping it across the room', (pointer) => {
    const candidate = resolvePlacementCandidate(room18x12, [], oneCellDesk, pointer);
    expect(candidate.furniture.point).toEqual(pointer);
    expect(candidate.diagnostic).toBe('outside-room');
    expect(candidate.furniture.rotation).toBe(oneCellDesk.rotation);
  });

  it('rejects an unknown explicit asset and furniture that cannot fit in the room', () => {
    expect(resolvePlacementCandidate(room, [], { ...sofa, assetId: 999_999 }, { x: 4, y: 3 }).diagnostic)
      .toBe('invalid-asset');
    expect(resolvePlacementCandidate(
      { ...room, width: 1, height: 1 }, [], { ...sofa, scale: 3 }, { x: 0, y: 0 },
    ).diagnostic).toBe('outside-room');
  });

  it('returns one closest-edge delta for transformed opaque bounds', () => {
    expect(fitBoundsDeltaToRoom(room18x12, { x: -42, y: 3, width: 2, height: 4 }))
      .toEqual({ x: 42, y: 0 });
    expect(fitBoundsDeltaToRoom(room18x12, { x: 40, y: 30, width: 2, height: 1 }))
      .toEqual({ x: -24, y: -19 });
  });

  it('swaps footprint axes after a quarter turn', () => {
    expect(rotatedFootprint({ width: 4, height: 2 }, 90)).toEqual({ width: 2, height: 4 });
    expect(rotatedFootprint({ width: 4, height: 2 }, 180)).toEqual({ width: 4, height: 2 });
  });

  it('commits the exact immutable green preview candidate', () => {
    const candidate = resolvePlacementCandidate(room, [], sofa, { x: 4.2, y: 3.8 });
    expect(candidate.diagnostic).toBe('valid');
    expect(candidate.furniture.point).toEqual({ x: 4.25, y: 3.75 });

    const committed = commitPlacementCandidate(room, [], candidate);
    expect(committed).toEqual([candidate.furniture]);
    expect(committed[0]).not.toBe(candidate.furniture);
  });

  it('deeply clones visual offsets when rejecting a placement candidate', () => {
    const source = { ...sofa, visualOffset: { x: -0.25, y: 0.125 } };
    const candidate = resolvePlacementCandidate(room, [source], source, { x: -30, y: 2 });
    const rejected = commitPlacementCandidate(room, [source], candidate);

    rejected[0]!.visualOffset!.x = 9;
    expect(source.visualOffset).toEqual({ x: -0.25, y: 0.125 });
  });

  it('allows visual overlap while retaining edge fitting and door rejection', () => {
    const overlapping = resolvePlacementCandidate(room, [sofa], { ...sofa, id: 'chair', kind: 'chair' }, sofa.point);
    expect(overlapping.diagnostic).toBe('valid');
    expect(resolvePlacementCandidate(room, [], sofa, { x: -0.25, y: 1 }).bounds.x).toBeCloseTo(0);
    expect(resolvePlacementCandidate(room, [], sofa, { x: 7, y: 8 }).diagnostic).toBe('blocks-door');
  });

  it('projects every touched half-cell to conservative navigation cells', () => {
    const cells = navigationCells({ ...sofa, point: { x: 4.5, y: 4.5 } });
    expect(cells).toEqual([
      { x: 4, y: 4 }, { x: 5, y: 4 },
      { x: 4, y: 5 }, { x: 5, y: 5 },
    ]);
  });

  it('does not project non-blocking decoration into navigation', () => {
    expect(navigationCells({ ...sofa, layer: 'floor', blocksNavigation: false })).toEqual([]);
  });
});
