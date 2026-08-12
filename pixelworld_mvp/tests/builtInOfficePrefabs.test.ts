import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_OFFICE_PREFABS,
  builtInPrefab,
  prefabsForTheme,
} from '../src/rendering/builtInOfficePrefabs';
import { catalogItem } from '../src/rendering/modernOfficeCatalog';
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

    expect(prefabsForTheme('rest-cabin')).toEqual([]);
    expect(Object.isFrozen(researchPrefabs)).toBe(true);
    expect(researchPrefabs.map(({ id }) => id)).toEqual(['bench-four', 'pod-l-two']);
    expect(prefabsForTheme('maker-workshop').map(({ id }) => id)).toEqual(['bench-four', 'control-m-three']);
    expect(prefabsForTheme('collaboration-barn').map(({ id }) => id)).toEqual(['pod-l-two', 'control-m-three']);
  });

  it('gives every selected asset a semantic catalog label', () => {
    const selectedIds = new Set(BUILT_IN_OFFICE_PREFABS.flatMap(({ items }) => (
      items.flatMap(({ assetId }) => assetId === undefined ? [] : [assetId])
    )));

    for (const id of selectedIds) {
      expect(catalogItem(id)?.label, `asset ${id}`).not.toMatch(/^Office \d{3}$/);
    }
  });
});
