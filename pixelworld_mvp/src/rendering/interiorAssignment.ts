import type {
  ActivityIconKind,
  AgentAction,
  Facing,
  FurnitureSemantic,
  GridPoint,
  InteriorDefinition,
  WorldEventKind,
} from '../world/types';
import {
  nearestSemanticStation,
  semanticForAction,
} from './interiorFurnitureSemantics';
import { navigationBlockedCellKeys } from './interiorPlacement';
import { interactionAccess } from './interiorNavigationPolicy';

export interface InteriorAgentSnapshot {
  agentId: string;
  role: 'main' | 'subagent';
  buildingId: string | undefined;
  action: AgentAction;
  eventKind: WorldEventKind;
  eventId: string;
  activityLabel?: string;
  bubbleText?: string;
  interiorElapsedMs?: number;
}

export interface InteriorOccupantAssignment extends InteriorAgentSnapshot {
  point: GridPoint;
  facing: Facing;
  furnitureId?: string;
  icon: ActivityIconKind;
  seated: boolean;
  missingSemantic?: FurnitureSemantic;
}

const pointKey = ({ x, y }: GridPoint): string => `${Math.round(x)},${Math.round(y)}`;

const reachableFromEntrance = (interior: InteriorDefinition, entrance: GridPoint): Set<string> => {
  const blocked = navigationBlockedCellKeys(interior.furniture, entrance);
  const blockedTargets = new Set(blocked);
  const open = [{ x: Math.round(entrance.x), y: Math.round(entrance.y) }];
  const visited = new Set([pointKey(open[0]!)]);
  blocked.delete(pointKey(entrance));
  while (open.length > 0) {
    const current = open.shift()!;
    for (const next of [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]) {
      const key = pointKey(next);
      if (next.x < 0 || next.y < 0 || next.x >= interior.width || next.y >= interior.height
        || blocked.has(key) || visited.has(key)) continue;
      visited.add(key);
      open.push(next);
    }
  }
  blockedTargets.forEach((key) => visited.delete(key));
  return visited;
};

const stableEntrancePoints = (interior: InteriorDefinition, entrance: GridPoint): GridPoint[] => {
  const stableSort = (first: GridPoint, second: GridPoint): number => (
    Math.abs(first.x - entrance.x) + Math.abs(first.y - entrance.y)
      - Math.abs(second.x - entrance.x) - Math.abs(second.y - entrance.y)
    || second.y - first.y
    || first.x - second.x
  );
  const authored = [entrance, ...interior.overflow].sort(stableSort);
  const generated: GridPoint[] = [];
  for (let y = Math.max(0, interior.height - 3); y < interior.height; y += 1) {
    for (let x = 0; x < interior.width; x += 1) generated.push({ x, y });
  }
  const unique = new Map<string, GridPoint>();
  [...authored, ...generated.sort(stableSort)].forEach((point) => unique.set(pointKey(point), point));
  const reachable = reachableFromEntrance(interior, entrance);
  return [...unique.values()].filter((point) => reachable.has(pointKey(point)));
};

export function assignInteriorOccupants(
  interior: InteriorDefinition,
  snapshots: readonly InteriorAgentSnapshot[],
  buildingId: string = interior.id,
): InteriorOccupantAssignment[] {
  const used = new Set<string>();
  const usedFurniture = new Set<string>();
  const entrance = { x: Math.floor(interior.width / 2), y: interior.height - 1 };
  let entrancePoints: GridPoint[] | undefined;
  const ordered = snapshots
    .filter((snapshot) => snapshot.buildingId === buildingId)
    .sort((first, second) => first.agentId.localeCompare(second.agentId));
  const assignments = new Map<string, InteriorOccupantAssignment>();
  const unmatched: InteriorAgentSnapshot[] = [];
  for (const snapshot of ordered) {
    const matched = nearestSemanticStation(interior, snapshot.action, entrance, used, usedFurniture);
    if (!matched) {
      unmatched.push(snapshot);
      continue;
    }
    const furniture = interior.furniture.find(({ id }) => id === matched.furnitureId)!;
    const { point } = matched;
    used.add(pointKey(point));
    usedFurniture.add(furniture.id);
    assignments.set(snapshot.agentId, {
      ...snapshot,
      point: { ...point },
      facing: furniture.facing,
      furnitureId: furniture.id,
      icon: furniture.icon,
      seated: ['seat', 'sleep'].includes(interactionAccess(furniture, snapshot.action)),
    });
  }
  for (const snapshot of unmatched) {
      const hasReachableCategory = nearestSemanticStation(interior, snapshot.action, entrance) !== undefined;
      entrancePoints ??= stableEntrancePoints(interior, entrance);
      const point = entrancePoints.find((candidate) => !used.has(pointKey(candidate))) ?? entrance;
      used.add(pointKey(point));
      assignments.set(snapshot.agentId, {
        ...snapshot,
        point: { ...point },
        facing: 'down' as const,
        icon: 'generic' as const,
        seated: false,
        ...(!hasReachableCategory ? { missingSemantic: semanticForAction(snapshot.action) } : {}),
      });
  }
  return ordered.map(({ agentId }) => assignments.get(agentId)!);
}
