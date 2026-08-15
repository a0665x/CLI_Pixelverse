import { describe, expect, it } from 'vitest';
import { interiorMotionAt, interiorPath, interiorRouteFor } from '../src/rendering/interiorMotion';
import { assignInteriorOccupants, type InteriorAgentSnapshot } from '../src/rendering/interiorAssignment';
import { INTERIOR_DEFINITIONS } from '../src/world/interiorDefinitions';
import { furnitureCells } from '../src/rendering/interiorLayoutEditor';
import { semanticForFurniture } from '../src/rendering/interiorFurnitureSemantics';

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

  it('patrols nearby Work stations and returns to the assigned station', () => {
    const snapshot = toolSnapshot(10_000);
    const assignment = assignInteriorOccupants(interior, [snapshot], 'tool-smithy')[0]!;
    const route = interiorRouteFor(snapshot, interior, assignment);

    expect(route[0]!.id).toBe(assignment.furnitureId);
    expect(route.at(-1)!.id).toBe(assignment.furnitureId);
    expect(route.length).toBeGreaterThan(2);
    expect(route.every((item) => semanticForFurniture(item) === 'work')).toBe(true);
    const early = interiorMotionAt(snapshot, interior, assignment, 10_000);
    const later = interiorMotionAt(toolSnapshot(12_600), interior, assignment, 12_600);
    expect(later.point).not.toEqual(early.point);
  });

  it('enters orthogonally at the exact authored anchor of the selected terminal', () => {
    const custom = {
      ...interior, width: 8, height: 6,
      furniture: [
        {
          id: 'terminal-a', kind: 'computer' as const, point: { x: 1, y: 1 }, facing: 'down' as const,
          supportedActions: ['terminal' as const], icon: 'tool' as const, blocksNavigation: true,
          interactionPoint: { x: 1, y: 3 },
        },
        {
          id: 'terminal-b', kind: 'computer' as const, point: { x: 6, y: 1 }, facing: 'down' as const,
          supportedActions: ['terminal' as const], icon: 'tool' as const, blocksNavigation: true,
          interactionPoint: { x: 6, y: 3 },
        },
      ],
      overflow: [],
    };
    const assignment = {
      ...toolSnapshot(0), point: { x: 6, y: 3 }, facing: 'down' as const,
      furnitureId: 'terminal-b', icon: 'tool' as const, seated: true,
    };
    const motion = interiorMotionAt(toolSnapshot(0), custom, assignment, 0);

    expect(motion.path.at(-1)).toEqual(assignment.point);
    expect(motion.path.every((point, index, path) => index === 0
      || Math.abs(point.x - path[index - 1]!.x) + Math.abs(point.y - path[index - 1]!.y) === 1)).toBe(true);
    const route = interiorRouteFor(toolSnapshot(0), custom, assignment);
    expect(route[0]!.id).toBe('terminal-b');
    expect(route.at(-1)!.id).toBe('terminal-b');
  });

  it('appends an orthogonal fractional approach and settles on the exact authored point', () => {
    const maker = INTERIOR_DEFINITIONS['maker-workshop'];
    const furniture = maker.furniture.find(({ id }) => id === 'maker-work-tool-wall')!;
    const assignment = {
      ...toolSnapshot(0), point: { ...furniture.interactionPoint! }, facing: furniture.facing,
      furnitureId: furniture.id, icon: furniture.icon, seated: false,
    };
    const motion = interiorMotionAt(toolSnapshot(0), maker, assignment, 0);

    expect(motion.path.at(-1)).toEqual({ x: 10.5, y: 7 });
    expect(motion.path.every((point, index, path) => index === 0
      || (point.x === path[index - 1]!.x || point.y === path[index - 1]!.y))).toBe(true);
    const settledAt = (motion.path.length - 1) * 240 + 100;
    expect(interiorMotionAt(toolSnapshot(settledAt), maker, assignment, settledAt).point).toEqual(assignment.point);
  });

  it('does not route through an unrelated blocker occupying the target cell', () => {
    const station = {
      id: 'station', kind: 'computer' as const, assetId: 225, point: { x: 2, y: 2 },
      facing: 'down' as const, supportedActions: ['terminal' as const], icon: 'tool' as const,
      blocksNavigation: true, interactionPoint: { x: 2, y: 2 },
    };
    const blocker = {
      id: 'blocker', kind: 'chair' as const, assetId: 101, point: { x: 2, y: 2 },
      facing: 'up' as const, supportedActions: [], icon: 'generic' as const, blocksNavigation: true,
    };
    const room = { ...interior, width: 6, height: 6, furniture: [station, blocker], overflow: [] };
    const path = interiorPath(room, { x: 3, y: 5 }, station.interactionPoint, station.id);

    expect(path).toEqual([{ x: 3, y: 5 }]);
  });

  it('does not exempt an adjacent station as a passage through a solid barrier', () => {
    const station = {
      id: 'station', kind: 'desk' as const, point: { x: 1, y: 2 },
      facing: 'up' as const, supportedActions: ['terminal' as const], icon: 'tool' as const,
      blocksNavigation: true, interactionPoint: { x: 1, y: 1 },
    };
    const blocker = (id: string, x: number) => ({
      id, kind: 'decor' as const, point: { x, y: 2 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, blocksNavigation: true,
    });
    const narrowRoom = {
      ...interior, width: 3, height: 5,
      furniture: [station, blocker('left', 0), blocker('right', 2)], overflow: [],
    };

    expect(interiorPath(narrowRoom, { x: 1, y: 4 }, station.interactionPoint, station.id))
      .toEqual([{ x: 1, y: 4 }]);
  });

  it('adds a subtle breathing bob while an Agent remains at a work point', () => {
    const snapshot = Array.from({ length: 40 }, (_, index) => toolSnapshot(8_000 + index * 500))
      .find((candidate) => !interiorMotionAt(candidate, interior, assignInteriorOccupants(interior, [candidate], 'tool-smithy')[0]!, 20_000).walking)!;
    const assignment = assignInteriorOccupants(interior, [snapshot], 'tool-smithy')[0]!;
    const first = interiorMotionAt(snapshot, interior, assignment, 20_000);
    const second = interiorMotionAt(snapshot, interior, assignment, 20_350);

    expect(Math.abs(first.bob)).toBeLessThanOrEqual(1);
    expect(second.bob).not.toBe(first.bob);
    expect(first.bubbleText).toBe('正在處理工具調用');
  });

  it('keeps missing-category agents at the entrance without inventing a furniture route', () => {
    const empty = { ...interior, width: 9, height: 7, furniture: [], overflow: [] };
    const snapshot = toolSnapshot(8_000);
    const assignment = assignInteriorOccupants(empty, [snapshot], 'tool-smithy')[0]!;
    const motion = interiorMotionAt(snapshot, empty, assignment, 8_000);

    expect(assignment).toMatchObject({ point: { x: 4, y: 6 }, missingSemantic: 'work' });
    expect(interiorRouteFor(snapshot, empty, assignment)).toHaveLength(1);
    expect(motion.point).toEqual({ x: 4, y: 6 });
    expect(motion.walking).toBe(false);
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

  it('keeps every visible movement segment orthogonal around grouped blockers', () => {
    const snapshot = toolSnapshot(900);
    const assignment = assignInteriorOccupants(interior, [snapshot], 'tool-smithy')[0]!;
    const motion = interiorMotionAt(snapshot, interior, assignment, 900);

    expect(motion.walking).toBe(true);
    expect(motion.path.length).toBeGreaterThan(1);
    expect(motion.path.every((point, index, path) => index === 0
      || point.x === path[index - 1]!.x
      || point.y === path[index - 1]!.y)).toBe(true);
  });

  it('stops at a free interaction cell instead of standing on non-seating furniture', () => {
    const snapshot = toolSnapshot(8_000);
    const assignment = assignInteriorOccupants(interior, [snapshot], 'tool-smithy')[0]!;
    const motion = interiorMotionAt(snapshot, interior, assignment, 8_000);
    const occupied = new Set(interior.furniture.flatMap(furnitureCells).map(({ x, y }) => `${x},${y}`));
    expect(occupied.has(`${Math.round(motion.point.x)},${Math.round(motion.point.y)}`)).toBe(false);
  });

  it('gives every interior visible seating and keeps functional navigation cells separate', () => {
    for (const candidate of Object.values(INTERIOR_DEFINITIONS)) {
      expect(candidate.furniture.some(({ kind }) => kind === 'chair' || kind === 'sofa'), candidate.id).toBe(true);
      const functional = candidate.furniture.filter(({ supportedActions }) => supportedActions.length > 0);
      for (let firstIndex = 0; firstIndex < functional.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < functional.length; secondIndex += 1) {
          const first = functional[firstIndex]!;
          const second = functional[secondIndex]!;
          const firstCells = new Set(furnitureCells(first).map(({ x, y }) => `${x},${y}`));
          const separated = furnitureCells(second).every(({ x, y }) => !firstCells.has(`${x},${y}`));
          expect(separated, `${candidate.id}: ${first.id} overlaps ${second.id}`).toBe(true);
        }
      }
    }
  });
});
