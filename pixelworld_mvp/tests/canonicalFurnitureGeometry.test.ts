import { describe, expect, it } from 'vitest';
import { BUILT_IN_OFFICE_PREFABS } from '../src/rendering/builtInOfficePrefabs';
import { rotatePrefab } from '../src/rendering/prefabGeometry';
import { furnitureRenderScreenGeometry } from '../src/rendering/InteriorCutawaySystem';
import { navigationCells, transformedAlphaBounds } from '../src/rendering/interiorPlacement';
import { INTERIOR_DEFINITIONS } from '../src/world/interiorDefinitions';
import type { FurnitureDefinition, GridPoint, OfficePrefabDefinition } from '../src/world/types';
import {
  canonicalFurnitureGeometry,
  geometryInvariant,
  translateFurnitureGeometry,
} from '../src/rendering/canonicalFurnitureGeometry';

const translatedCells = (cells: readonly GridPoint[], delta: GridPoint): GridPoint[] => (
  cells.map(({ x, y }) => ({ x: x + delta.x, y: y + delta.y }))
);

describe('canonical furniture geometry', () => {
  it('provides the one canonical geometry API', () => {
    expect(canonicalFurnitureGeometry).toBeTypeOf('function');
    expect(translateFurnitureGeometry).toBeTypeOf('function');
    expect(geometryInvariant).toBeTypeOf('function');
  });

  it('preserves a Starting Cabin item across a differently sized work house', () => {
    const cabin = INTERIOR_DEFINITIONS['rest-cabin'];
    const workHouse = INTERIOR_DEFINITIONS['maker-workshop'];
    expect([cabin.width, cabin.height]).not.toEqual([workHouse.width, workHouse.height]);
    const source = cabin.furniture.find(({ id }) => id === 'rest-sofa-a')!;
    const delta = { x: 5, y: 2 };
    const moved = translateFurnitureGeometry(source, delta);

    expect(geometryInvariant(source, moved)).toBe(true);
    expect(canonicalFurnitureGeometry(moved)).toEqual({
      ...canonicalFurnitureGeometry(source),
      anchor: { x: source.point.x + delta.x, y: source.point.y + delta.y },
    });
    const beforeBounds = transformedAlphaBounds(source);
    const afterBounds = transformedAlphaBounds(moved);
    expect(afterBounds).toEqual({ ...beforeBounds, x: beforeBounds.x + delta.x, y: beforeBounds.y + delta.y });
    expect(afterBounds.width / afterBounds.height).toBeCloseTo(beforeBounds.width / beforeBounds.height);
    expect(navigationCells(moved)).toEqual(translatedCells(navigationCells(source), delta));
    expect(moved).toMatchObject({ scale: source.scale, rotation: source.rotation });

    const cabinScreen = furnitureRenderScreenGeometry({ x: 0, y: 0 }, source, 22);
    const workScreen = furnitureRenderScreenGeometry({ x: 0, y: 0 }, moved, 15);
    expect(cabinScreen.bounds.width / 22).toBeCloseTo(workScreen.bounds.width / 15);
    expect(cabinScreen.bounds.height / 22).toBeCloseTo(workScreen.bounds.height / 15);
  });

  it('uses the same default asset geometry for an asset-less legacy item in every consumer', () => {
    const legacyDesk: FurnitureDefinition = {
      id: 'legacy-desk', kind: 'desk', point: { x: 3, y: 2 }, facing: 'up',
      supportedActions: [], icon: 'generic', scale: 1.25, rotation: 90,
    };

    const canonical = canonicalFurnitureGeometry(legacyDesk);
    const collisionBounds = transformedAlphaBounds(legacyDesk);
    const rendered = furnitureRenderScreenGeometry({ x: 0, y: 0 }, legacyDesk, 22);

    expect(collisionBounds.width).toBeCloseTo(canonical.width);
    expect(collisionBounds.height).toBeCloseTo(canonical.height);
    expect(rendered.bounds.width / 22).toBeCloseTo(canonical.width);
    expect(rendered.bounds.height / 22).toBeCloseTo(canonical.height);
  });

  it('translates a built-in composite without changing member geometry or pairwise offsets', () => {
    const prefab = BUILT_IN_OFFICE_PREFABS[0]!;
    const delta = { x: 4, y: 3 };
    const moved = prefab.items.map((item) => translateFurnitureGeometry(item, delta));

    expect(moved.every((item, index) => geometryInvariant(prefab.items[index]!, item))).toBe(true);
    for (let left = 0; left < moved.length; left += 1) {
      for (let right = left + 1; right < moved.length; right += 1) {
        expect({
          x: moved[right]!.point.x - moved[left]!.point.x,
          y: moved[right]!.point.y - moved[left]!.point.y,
        }).toEqual({
          x: prefab.items[right]!.point.x - prefab.items[left]!.point.x,
          y: prefab.items[right]!.point.y - prefab.items[left]!.point.y,
        });
      }
    }
    prefab.items.forEach((source, index) => {
      const translated = moved[index]!;
      expect(translated.visualOffset).toEqual(source.visualOffset);
      if (source.interactionPoint) {
        expect(translated.interactionPoint).toEqual({
          x: source.interactionPoint.x + delta.x,
          y: source.interactionPoint.y + delta.y,
        });
      }
    });
  });

  it('rotates composite interaction anchors with the same canonical member transform', () => {
    const item = {
      ...INTERIOR_DEFINITIONS['rest-cabin'].furniture[0]!,
      id: 'rotating-member', point: { x: 4, y: 3 }, interactionPoint: { x: 5, y: 3 },
    };
    const prefab: OfficePrefabDefinition = {
      version: 2,
      id: 'rotating-prefab', name: 'Rotating prefab', createdAt: 1, width: 2, height: 1,
      origin: { x: 4, y: 3 }, memberOffsets: { 'rotating-member': { x: 0, y: 0 } }, items: [item],
      source: 'user', immutable: false, category: 'support', hookActions: [], anchor: { x: 4, y: 3 },
      interactionAnchors: [],
    };

    const rotated = rotatePrefab(prefab, 90);

    expect(rotated.items[0]!.point).toEqual({ x: 4, y: 3 });
    expect(rotated.items[0]!.interactionPoint).toEqual({ x: 4, y: 4 });
    expect(geometryInvariant(item, rotated.items[0]!)).toBe(false);
    expect(rotated.items[0]).toMatchObject({ scale: item.scale, rotation: 90 });
  });
});
