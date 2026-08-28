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

  it('delegates elevated surface collision to its supporting furniture', () => {
    const monitor = {
      ...item('display', 'surface', false),
      supportedByIds: ['desk-a'],
    };

    expect(navigationBlockerKind(monitor)).toBe('passable');
    expect(navigationBlockerKind(item('cabinet', 'surface', false))).toBe('solid');
  });

  it('opens beds only for offline sleep and seating only for rest actions', () => {
    expect(interactionAccess(item('bed'), 'offline')).toBe('sleep');
    expect(interactionAccess(item('bed'), 'rest')).toBe('none');
    expect(interactionAccess(item('chair'), 'rest')).toBe('seat');
    expect(interactionAccess(item('office-chair'), 'queue')).toBe('seat');
    expect(interactionAccess(item('sofa'), 'arrive')).toBe('seat');
    expect(interactionAccess(item('chair'), 'terminal')).toBe('none');
  });

  it('keeps seating and beds solid outside an eligible interaction route', () => {
    for (const kind of ['chair', 'office-chair', 'sofa'] as const) {
      expect(navigationBlockerKind(item(kind))).toBe('solid');
      expect(navigationBlockedCellKeys([item(kind)], { x: 8, y: 8 }).size).toBeGreaterThan(0);
    }
    expect(navigationBlockerKind(item('bed'))).toBe('solid');
    expect(navigationBlockerKind(item('desk'))).toBe('solid');
    const chair = {
      ...item('chair'), id: 'chair-a', supportedActions: ['rest' as const], interactionPoint: { x: 2, y: 2 },
    };
    expect(navigationBlockedCellKeys([chair], chair.interactionPoint, chair.id, { action: 'rest' })).toEqual(new Set());
  });

  it('opens the whole bed footprint only while routing its offline sleeper', () => {
    const bed = {
      ...item('bed'),
      id: 'bed-a',
      assetId: 315,
      interactionPoint: { x: 2, y: 2 },
      supportedActions: ['offline' as const],
    };

    expect(navigationBlockedCellKeys([bed], { x: 8, y: 8 }).size).toBeGreaterThan(0);
    expect(navigationBlockedCellKeys([bed], bed.interactionPoint, bed.id, { action: 'rest' }).size).toBeGreaterThan(0);
    expect(navigationBlockedCellKeys([bed], bed.interactionPoint, bed.id, { action: 'offline' })).toEqual(new Set());
    expect(navigationBlockedCellKeys([bed], bed.interactionPoint, bed.id)).toEqual(new Set());
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

  it('allows a genuine station target to overlap seating without opening the seat as a route', () => {
    const station = {
      ...item('desk'),
      id: 'desk-a',
      prefabInstanceId: 'pod-a',
      interactionPoint: { x: 2, y: 2 },
      supportedActions: ['terminal' as const],
    };
    const chair = { ...item('office-chair'), id: 'chair-a', prefabInstanceId: 'pod-a' };

    const stationRoute = navigationBlockedCellKeys(
      [station, chair],
      station.interactionPoint,
      station.id,
      { action: 'terminal' },
    );
    const ordinaryRoute = navigationBlockedCellKeys([station, chair], { x: 8, y: 8 });

    expect(stationRoute.has('2,2')).toBe(false);
    expect(ordinaryRoute.has('2,2')).toBe(true);
  });
});
