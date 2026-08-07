import { describe, expect, it } from 'vitest';
import { StationAllocator } from '../src/stations/stationAllocator';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

describe('StationAllocator', () => {
  it('uses unique interaction slots, then queue anchors, then reports full', () => {
    const allocator = new StationAllocator(WORLD_DEFINITION.stations);
    const station = WORLD_DEFINITION.stations.find((item) => item.id === 'editing-desk')!;
    const capacity = station.interactionSlots.length + station.queueAnchors.length;
    const results = Array.from({ length: capacity }, (_, index) => allocator.assign(`a-${index}`, station.id));
    expect(results.every((result) => result.ok)).toBe(true);
    expect(new Set(results.flatMap((result) => result.ok ? [`${result.assignment.point.x},${result.assignment.point.y}`] : [])).size).toBe(capacity);
    expect(allocator.assign('overflow', station.id)).toEqual({ ok: false, reason: 'station-full' });
  });

  it('releases an old slot when an Agent changes station', () => {
    const allocator = new StationAllocator(WORLD_DEFINITION.stations);
    const first = allocator.assign('main', 'editing-desk');
    expect(first.ok).toBe(true);
    expect(allocator.assign('main', 'lounge').ok).toBe(true);
    expect(allocator.assignments().filter((item) => item.agentId === 'main')).toHaveLength(1);
  });

  it('skips an unreachable anchor supplied by the route dispatcher', () => {
    const allocator = new StationAllocator(WORLD_DEFINITION.stations);
    const first = allocator.assign('main', 'editing-desk');
    expect(first.ok).toBe(true);
    const excluded = new Set(first.ok ? [first.assignment.anchorId] : []);
    const second = allocator.assign('main', 'editing-desk', excluded);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.assignment.anchorId).not.toBe(first.assignment.anchorId);
  });
});
