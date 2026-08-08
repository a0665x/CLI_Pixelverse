import { describe, expect, it } from 'vitest';
import { StationAllocator } from '../src/stations/stationAllocator';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

describe('StationAllocator', () => {
  it('uses unique interaction slots, then queue anchors, then reports full', () => {
    const allocator = new StationAllocator(WORLD_DEFINITION.stations);
    const station = WORLD_DEFINITION.stations.find((item) => item.id === 'maker-edit')!;
    const capacity = station.interactionSlots.length + station.queueAnchors.length;
    const results = Array.from({ length: capacity }, (_, index) => allocator.assign(`a-${index}`, station.id));
    expect(results.every((result) => result.ok)).toBe(true);
    expect(new Set(results.flatMap((result) => result.ok ? [`${result.assignment.point.x},${result.assignment.point.y}`] : [])).size).toBe(capacity);
    expect(allocator.assign('overflow', station.id)).toEqual({ ok: false, reason: 'station-full' });
  });

  it('releases an old slot when an Agent changes station', () => {
    const allocator = new StationAllocator(WORLD_DEFINITION.stations);
    const first = allocator.assign('main', 'maker-edit');
    expect(first.ok).toBe(true);
    expect(allocator.assign('main', 'rest-sofa').ok).toBe(true);
    expect(allocator.assignments().filter((item) => item.agentId === 'main')).toHaveLength(1);
  });

  it('skips an unreachable anchor supplied by the route dispatcher', () => {
    const allocator = new StationAllocator(WORLD_DEFINITION.stations);
    const first = allocator.assign('main', 'maker-edit');
    expect(first.ok).toBe(true);
    const excluded = new Set(first.ok ? [first.assignment.anchorId] : []);
    const second = allocator.assign('main', 'maker-edit', excluded);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.assignment.anchorId).not.toBe(first.assignment.anchorId);
  });

  it('preserves an Agent assignment when a target station is full or unknown', () => {
    const allocator = new StationAllocator(WORLD_DEFINITION.stations);
    const first = allocator.assign('main', 'maker-edit');
    const lounge = WORLD_DEFINITION.stations.find((item) => item.id === 'rest-sofa')!;

    Array.from({ length: lounge.interactionSlots.length + lounge.queueAnchors.length }, (_, index) =>
      allocator.assign(`lounge-${index}`, lounge.id),
    );

    expect(allocator.assign('main', lounge.id)).toEqual({ ok: false, reason: 'station-full' });
    expect(allocator.assignmentFor('main')).toEqual(first.ok ? first.assignment : undefined);
    expect(allocator.assign('main', 'missing-station')).toEqual({ ok: false, reason: 'unknown-station' });
    expect(allocator.assignmentFor('main')).toEqual(first.ok ? first.assignment : undefined);
  });

  it('does not allocate the same physical point from different stations', () => {
    const point = { x: 4, y: 4 };
    const allocator = new StationAllocator([
      { id: 'alpha', zoneId: 'zone', approachAnchors: [point], interactionSlots: [{ id: 'slot', point, facing: 'down', action: 'arrive' }], queueAnchors: [] },
      { id: 'beta', zoneId: 'zone', approachAnchors: [point], interactionSlots: [{ id: 'slot', point, facing: 'down', action: 'arrive' }], queueAnchors: [] },
    ]);

    expect(allocator.assign('first', 'alpha').ok).toBe(true);
    expect(allocator.assign('second', 'beta')).toEqual({ ok: false, reason: 'station-full' });
  });

  it('restores only when its anchor and physical point are available', () => {
    const allocator = new StationAllocator(WORLD_DEFINITION.stations);
    const first = allocator.assign('first', 'maker-edit');
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    expect(allocator.restore({ ...first.assignment, agentId: 'second' })).toBe(false);
    expect(allocator.assignmentFor('second')).toBeUndefined();
    expect(allocator.assignmentFor('first')).toEqual(first.assignment);
  });
});
