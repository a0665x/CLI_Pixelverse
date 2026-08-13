import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_OFFICE_PREFABS,
  builtInPrefab,
  prefabsForTheme,
} from '../src/rendering/builtInOfficePrefabs';
import { cloneOfficePrefab, rotatePrefab } from '../src/rendering/prefabGeometry';
import { MODERN_OFFICE_CATALOG, catalogItem } from '../src/rendering/modernOfficeCatalog';
import type { Facing, GridPoint } from '../src/world/types';

const prefabIds = ['bench-four', 'pod-l-two', 'control-m-three'] as const;

const adjacentPoint = ({ x, y }: GridPoint, facing: Facing): GridPoint => ({
  x: x + (facing === 'right' ? 1 : facing === 'left' ? -1 : 0),
  y: y + (facing === 'down' ? 1 : facing === 'up' ? -1 : 0),
});

describe('built-in Modern Office prefabs', () => {
  it.each(prefabIds)('%s is a complete v1.2 workstation', (id) => {
    const prefab = builtInPrefab(id)!;

    expect(prefab.source).toBe('modern-office-v1.2');
    expect(prefab.immutable).toBe(true);
    expect(prefab.items.some(({ layer }) => layer === 'furniture')).toBe(true);
    expect(prefab.items.some(({ layer }) => layer === 'surface')).toBe(true);
    expect(prefab.items.every(({ assetId }) => (
      assetId === undefined || catalogItem(assetId)?.path.includes('modern-office-v1.2')
    ))).toBe(true);
    expect(prefab.interactionAnchors.length).toBeGreaterThanOrEqual(2);
    expect(prefab.hookActions.every((action) => (
      prefab.interactionAnchors.some(({ actions }) => actions.includes(action))
    ))).toBe(true);
  });

  it('ships exactly the three approved archetypes as deeply frozen templates', () => {
    expect(BUILT_IN_OFFICE_PREFABS.map(({ id }) => id)).toEqual(prefabIds);
    expect(BUILT_IN_OFFICE_PREFABS.map(({ items }) => items.length)).toEqual([18, 12, 17]);
    expect(Object.isFrozen(BUILT_IN_OFFICE_PREFABS)).toBe(true);
    for (const prefab of BUILT_IN_OFFICE_PREFABS) {
      expect(Object.isFrozen(prefab)).toBe(true);
      expect(Object.isFrozen(prefab.items)).toBe(true);
      expect(Object.isFrozen(prefab.interactionAnchors)).toBe(true);
      expect(prefab.items.every(Object.isFrozen)).toBe(true);
    }
  });

  it('uses only concrete routed actions for the M control console', () => {
    const control = builtInPrefab('control-m-three')!;

    expect(control.hookActions).toEqual(['terminal', 'type', 'signal']);
    expect(control.hookActions).not.toContain('repair');
    expect(control.items.flatMap(({ supportedActions }) => supportedActions)).not.toContain('repair');
    expect(control.interactionAnchors.flatMap(({ actions }) => actions)).not.toContain('repair');
  });

  it.each(prefabIds)('%s materializes canonical transforms in furniture-grid units', (id) => {
    const prefab = builtInPrefab(id)!;

    for (const item of prefab.items) {
      const asset = catalogItem(item.assetId!)!;
      expect(item.rotation, `${id}:${item.id}:rotation`).toBe(0);
      expect(item.scale, `${id}:${item.id}:scale`).toBe(1);
      expect(item.visualOffset, `${id}:${item.id}:visualOffset`).toEqual({
        x: asset.visualOffset.x / 16,
        y: asset.visualOffset.y / 16,
      });
    }
  });

  it('preserves canonical offsets through cloning and rotates them through 90 degrees', () => {
    const source = builtInPrefab('bench-four')!;
    const cloned = cloneOfficePrefab(source);
    const rotated = rotatePrefab(source, 90);
    const sourceItem = source.items[0]!;
    const clonedItem = cloned.items[0]!;
    const rotatedItem = rotated.items[0]!;

    expect(clonedItem.visualOffset).toEqual(sourceItem.visualOffset);
    expect(clonedItem.visualOffset).not.toBe(sourceItem.visualOffset);
    expect(clonedItem.rotation).toBe(0);
    expect(clonedItem.scale).toBe(1);
    expect(rotatedItem.visualOffset).toEqual({
      x: -sourceItem.visualOffset!.y,
      y: sourceItem.visualOffset!.x,
    });
    expect(rotatedItem.rotation).toBe(90);
    expect(rotatedItem.scale).toBe(1);
  });

  it.each(prefabIds)('%s seats face an adjacent desk surface', (id) => {
    const prefab = builtInPrefab(id)!;
    const deskPoints = new Set(prefab.items.filter(({ kind }) => kind === 'desk')
      .map(({ point }) => `${point.x},${point.y}`));
    const chairs = prefab.items.filter(({ kind }) => kind === 'office-chair');

    expect(chairs.length).toBeGreaterThanOrEqual(2);
    for (const chair of chairs) {
      const desk = adjacentPoint(chair.point, chair.facing);
      expect(deskPoints.has(`${desk.x},${desk.y}`), `${id}:${chair.id}`).toBe(true);
    }
  });

  it.each(prefabIds)('%s places every surface object on a desk at a higher z-index', (id) => {
    const prefab = builtInPrefab(id)!;
    const desks = prefab.items.filter(({ kind }) => kind === 'desk');
    const surfaces = prefab.items.filter(({ layer }) => layer === 'surface');

    expect(surfaces.length).toBeGreaterThanOrEqual(4);
    for (const surface of surfaces) {
      const desk = desks.find(({ point }) => point.x === surface.point.x && point.y === surface.point.y);
      expect(desk, `${id}:${surface.id}`).toBeDefined();
      expect(surface.zIndex!, `${id}:${surface.id}`).toBeGreaterThan(desk!.zIndex ?? 0);
      expect(surface.blocksNavigation).toBe(false);
    }
  });

  it('maps work themes to their approved workstation families', () => {
    const researchPrefabs = prefabsForTheme('research-library');
    const allWorkPrefabs = ['bench-four', 'pod-l-two', 'control-m-three'];

    expect(prefabsForTheme('rest-cabin')).toEqual([]);
    expect(Object.isFrozen(researchPrefabs)).toBe(true);
    expect(researchPrefabs.map(({ id }) => id)).toEqual(allWorkPrefabs);
    expect(prefabsForTheme('maker-workshop').map(({ id }) => id)).toEqual(allWorkPrefabs);
    expect(prefabsForTheme('collaboration-barn').map(({ id }) => id)).toEqual(allWorkPrefabs);
  });

  it('gives every selected asset a semantic catalog label', () => {
    const selectedIds = new Set(BUILT_IN_OFFICE_PREFABS.flatMap(({ items }) => (
      items.flatMap(({ assetId }) => assetId === undefined ? [] : [assetId])
    )));

    for (const id of selectedIds) {
      expect(catalogItem(id)?.label, `asset ${id}`).not.toMatch(/^Office \d{3}$/);
    }
    const semanticIds = MODERN_OFFICE_CATALOG
      .filter(({ label }) => !/^Office \d{3}$/.test(label))
      .map(({ id }) => id);
    expect(semanticIds.every((id) => selectedIds.has(id))).toBe(true);
  });
});
