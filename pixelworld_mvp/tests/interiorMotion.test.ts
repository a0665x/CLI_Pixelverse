import { describe, expect, it } from 'vitest';
import { interiorMotionAt, interiorPath, interiorRouteFor } from '../src/rendering/interiorMotion';
import { assignInteriorOccupants, type InteriorAgentSnapshot } from '../src/rendering/interiorAssignment';
import { INTERIOR_DEFINITIONS, furnitureFootprint } from '../src/world/interiorDefinitions';
import { furnitureCells } from '../src/rendering/interiorLayoutEditor';

const toolSnapshot = (elapsedMs: number): InteriorAgentSnapshot => ({
  agentId: 'main', role: 'main', buildingId: 'tool-smithy', action: 'terminal',
  eventKind: 'tool', eventId: 'tool-1', activityLabel: 'Calling terminal tools',
  bubbleText: '正在處理工具調用', interiorElapsedMs: elapsedMs,
});

describe('interior motion timeline', () => {
  const interior = INTERIOR_DEFINITIONS['maker-workshop'];

  it('starts at the interior door and advances toward assigned furniture over real time', () => {
    const snapshot = toolSnapshot(0);
    const assignment = assignInteriorOccupants(interior, [snapshot], 'tool-smithy')[0]!;
    const start = interiorMotionAt(snapshot, interior, assignment, 0);
    const middle = interiorMotionAt(toolSnapshot(700), interior, assignment, 700);
    const settled = interiorMotionAt(toolSnapshot(8_000), interior, assignment, 8_000);

    expect(start.phase).toBe('ingress');
    expect(start.walking).toBe(true);
    expect(start.point).toEqual({ x: Math.floor(interior.width / 2), y: interior.height - 1 });
    expect(middle.phase).toBe('ingress');
    expect(middle.point).not.toEqual(start.point);
    expect(settled.phase).toBe('working');
    expect(Array.from({ length: 18 }, (_, index) => interiorMotionAt(toolSnapshot(8_000 + index * 100), interior, assignment, 8_000 + index * 100))
      .some(({ walking }) => !walking)).toBe(true);
  });

  it('cycles tool work through desk, bookcase, board, and back to the desk', () => {
    const snapshot = toolSnapshot(10_000);
    const assignment = assignInteriorOccupants(interior, [snapshot], 'tool-smithy')[0]!;
    const route = interiorRouteFor(snapshot, interior, assignment);

    expect(route.map(({ kind }) => kind)).toEqual(['computer', 'bookcase', 'planning-board', 'computer']);
    const early = interiorMotionAt(snapshot, interior, assignment, 10_000);
    const later = interiorMotionAt(toolSnapshot(12_600), interior, assignment, 12_600);
    expect(later.point).not.toEqual(early.point);
  });

  it('adds a subtle breathing bob while an Agent remains at a work point', () => {
    const snapshot = toolSnapshot(20_000);
    const assignment = assignInteriorOccupants(interior, [snapshot], 'tool-smithy')[0]!;
    const first = interiorMotionAt(snapshot, interior, assignment, 20_000);
    const second = interiorMotionAt(toolSnapshot(20_350), interior, assignment, 20_350);

    expect(Math.abs(first.bob)).toBeLessThanOrEqual(1);
    expect(second.bob).not.toBe(first.bob);
    expect(first.bubbleText).toBe('正在處理工具調用');
  });

  it('uses a four-direction A* route that avoids furniture footprints', () => {
    const path = interiorPath(interior, { x: 7, y: 8 }, { x: 2, y: 4 });
    expect(path[0]).toEqual({ x: 7, y: 8 });
    expect(path.at(-1)).toEqual({ x: 2, y: 4 });
    for (let index = 1; index < path.length; index += 1) {
      const previous = path[index - 1]!;
      const current = path[index]!;
      expect(Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y)).toBe(1);
    }
  });

  it('stops at a free interaction cell instead of standing on non-seating furniture', () => {
    const snapshot = toolSnapshot(8_000);
    const assignment = assignInteriorOccupants(interior, [snapshot], 'tool-smithy')[0]!;
    const motion = interiorMotionAt(snapshot, interior, assignment, 8_000);
    const occupied = new Set(interior.furniture.flatMap(furnitureCells).map(({ x, y }) => `${x},${y}`));
    expect(occupied.has(`${Math.round(motion.point.x)},${Math.round(motion.point.y)}`)).toBe(false);
  });

  it('gives every interior visible seating and keeps functional furniture footprints separate', () => {
    for (const candidate of Object.values(INTERIOR_DEFINITIONS)) {
      expect(candidate.furniture.some(({ kind }) => kind === 'chair' || kind === 'sofa'), candidate.id).toBe(true);
      const functional = candidate.furniture.filter(({ supportedActions }) => supportedActions.length > 0);
      for (let firstIndex = 0; firstIndex < functional.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < functional.length; secondIndex += 1) {
          const first = functional[firstIndex]!;
          const second = functional[secondIndex]!;
          const firstSize = furnitureFootprint(first.kind);
          const secondSize = furnitureFootprint(second.kind);
          const separated = (
            Math.abs(first.point.x - second.point.x) >= (firstSize.width + secondSize.width) / 2 ||
            Math.abs(first.point.y - second.point.y) >= (firstSize.height + secondSize.height) / 2
          );
          expect(separated, `${candidate.id}: ${first.id} overlaps ${second.id}`).toBe(true);
        }
      }
    }
  });
});
