import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition } from '../src/world/types';
import {
  interactionAccess,
  navigationBlockerKind,
} from '../src/rendering/interiorNavigationPolicy';
import { navigationBlockedCellKeys } from '../src/rendering/interiorPlacement';

const item = (
  kind: FurnitureDefinition['kind'],
  layer: FurnitureDefinition['layer'] = 'furniture',
  blocksNavigation?: boolean,
): FurnitureDefinition => ({
  id: `${kind}-${layer}`,
  kind,
  point: { x: 2, y: 2 },
  facing: 'down',
  supportedActions: [],
  icon: 'generic',
  layer,
  blocksNavigation,
});

describe('interior navigation policy', () => {
  it('blocks every opaque non-floor item despite legacy non-blocking metadata', () => {
    for (const furniture of [
      item('desk'),
      item('plant'),
      item('cabinet', 'surface', false),
      item('decor', 'wall', false),
    ]) {
      expect(navigationBlockerKind(furniture)).toBe('solid');
    }
    expect(navigationBlockerKind(item('decor', 'floor', false))).toBe('passable');
  });

  it('opens beds only for offline sleep and seating only for rest actions', () => {
    expect(interactionAccess(item('bed'), 'offline')).toBe('sleep');
    expect(interactionAccess(item('bed'), 'rest')).toBe('none');
    expect(interactionAccess(item('chair'), 'rest')).toBe('seat');
    expect(interactionAccess(item('office-chair'), 'queue')).toBe('seat');
    expect(interactionAccess(item('sofa'), 'arrive')).toBe('seat');
    expect(interactionAccess(item('chair'), 'terminal')).toBe('none');
  });

  it('uses opaque policy blockers for route planning instead of legacy flags', () => {
    const cabinet = item('cabinet', 'surface', false);
    const floor = item('decor', 'floor', false);

    expect(navigationBlockedCellKeys([cabinet], { x: 8, y: 8 }).size).toBeGreaterThan(0);
    expect(navigationBlockedCellKeys([floor], { x: 8, y: 8 })).toEqual(new Set());
  });

  it('inflates blocker cells by the requested Agent feet clearance', () => {
    const desk = { ...item('desk'), assetId: 247 };
    const compact = navigationBlockedCellKeys(
      [desk],
      { x: 8, y: 8 },
      undefined,
      { clearance: { x: 0, y: 0 } },
    );
    const inflated = navigationBlockedCellKeys(
      [desk],
      { x: 8, y: 8 },
      undefined,
      { clearance: { x: 1.1, y: 1.1 } },
    );

    expect(inflated.size).toBeGreaterThan(compact.size);
    expect([...compact].every((key) => inflated.has(key))).toBe(true);
  });
});
