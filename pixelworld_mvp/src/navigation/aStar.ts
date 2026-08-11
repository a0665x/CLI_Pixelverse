import type { GridPoint } from '../world/types';
import { NavigationGrid } from './navigationGrid';

const key = ({ x, y }: GridPoint) => `${x},${y}`;
const distance = (a: GridPoint, b: GridPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const DIRECTIONS: readonly GridPoint[] = [
  { x: 0, y: -1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 },
];

function reconstruct(cameFrom: Map<string, string>, points: Map<string, GridPoint>, goalKey: string): GridPoint[] {
  const path: GridPoint[] = [];
  let cursor: string | undefined = goalKey;
  while (cursor) {
    path.push(points.get(cursor)!);
    cursor = cameFrom.get(cursor);
  }
  return path.reverse();
}

export function findPath(grid: NavigationGrid, start: GridPoint, goal: GridPoint): GridPoint[] | null {
  if (!grid.isWalkable(start) || !grid.isWalkable(goal)) return null;
  const startKey = key(start);
  const goalKey = key(goal);
  const open = new Set([startKey]);
  const points = new Map<string, GridPoint>([[startKey, start]]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([[startKey, distance(start, goal)]]);

  while (open.size > 0) {
    const currentKey = [...open].sort((left, right) =>
      (fScore.get(left)! - fScore.get(right)!) || left.localeCompare(right),
    )[0]!;
    const current = points.get(currentKey)!;
    if (currentKey === goalKey) return reconstruct(cameFrom, points, goalKey);
    open.delete(currentKey);

    for (const direction of DIRECTIONS) {
      const neighbor = { x: current.x + direction.x, y: current.y + direction.y };
      const neighborCost = grid.costAt(neighbor);
      if (neighborCost === undefined) continue;
      const neighborKey = key(neighbor);
      const tentative = gScore.get(currentKey)! + neighborCost;
      if (tentative >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;
      cameFrom.set(neighborKey, currentKey);
      points.set(neighborKey, neighbor);
      gScore.set(neighborKey, tentative);
      fScore.set(neighborKey, tentative + distance(neighbor, goal));
      open.add(neighborKey);
    }
  }
  return null;
}

export function findPathVia(grid: NavigationGrid, start: GridPoint, waypoints: readonly GridPoint[]): GridPoint[] | null {
  const path = [start];
  let segmentStart = start;
  for (const waypoint of waypoints) {
    const segment = findPath(grid, segmentStart, waypoint);
    if (!segment) return null;
    path.push(...segment.slice(1));
    segmentStart = waypoint;
  }
  return path;
}
