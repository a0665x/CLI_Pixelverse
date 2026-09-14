import { createRoomMemo } from './interiorRuntimeCache';
import type { Facing, FurnitureDefinition, GridPoint, InteriorDefinition } from '../world/types';
import type { InteriorAgentSnapshot, InteriorOccupantAssignment } from './interiorAssignment';
import { navigationBlockedCellKeys } from './interiorPlacement';
import { interiorInteractionPoint } from './prefabGeometry';
import { nearestSemanticStation } from './interiorFurnitureSemantics';

export { interiorInteractionPoint } from './prefabGeometry';

export type InteriorMotionPhase = 'ingress' | 'working';
export interface InteriorMotionState {
  phase: InteriorMotionPhase;
  furnitureId?: string;
  point: { x: number; y: number };
  path: GridPoint[];
  facing: Facing;
  bob: number;
  bubbleText: string;
  walking: boolean;
  blocked: boolean;
}

export const INTERIOR_CELLS_PER_SECOND = 2.5;
const WORK_STOP_MS = 1_800;

const eventBubble = (snapshot: InteriorAgentSnapshot): string => snapshot.bubbleText ?? ({
  session_start: '準備開始工作', think: '正在思考', plan: '整理計畫', read: '查閱檔案',
  edit: '修改程式', tool: '正在處理工具調用', web: '連接 Web / MCP', clone: '建立 Subagent',
  respond: '傳送結果', await: '等待輸入', blocked: '工作受阻', self_heal: '正在修復',
  idle: '暫時休息', offline: 'Agent 離線', heartbeat: '保持連線', unknown: '處理工作',
})[snapshot.eventKind];

export function interiorRouteFor(
  snapshot: InteriorAgentSnapshot,
  interior: InteriorDefinition,
  assignment: InteriorOccupantAssignment,
): FurnitureDefinition[] {
  const assignedFurniture = interior.furniture.find(({ id }) => id === assignment.furnitureId);
  if (assignedFurniture) {
    const excluded = new Set([assignedFurniture.id]);
    const patrol: FurnitureDefinition[] = [];
    let origin = assignment.point;
    for (let index = 0; index < 2; index += 1) {
      const station = nearestSemanticStation(interior, snapshot.action, origin, new Set(), excluded);
      if (!station) break;
      const furniture = interior.furniture.find(({ id }) => id === station.furnitureId);
      if (!furniture) break;
      patrol.push({ ...furniture, interactionPoint: { ...station.point } });
      excluded.add(furniture.id);
      origin = station.point;
    }
    return patrol.length > 0
      ? [assignedFurniture, ...patrol, assignedFurniture]
      : [assignedFurniture];
  }
  return [{
    id: 'interior-overflow', kind: 'decor', point: assignment.point, facing: assignment.facing,
    supportedActions: [snapshot.action], icon: assignment.icon,
  }];
}

const key = ({ x, y }: GridPoint): string => `${x},${y}`;
const distance = (from: GridPoint, to: GridPoint): number => Math.abs(to.x - from.x) + Math.abs(to.y - from.y);

const appendOrthogonal = (
  path: GridPoint[],
  target: GridPoint,
  blocked: ReadonlySet<string>,
): GridPoint[] => {
  const from = path.at(-1)!;
  if (from.x === target.x && from.y === target.y) return path;
  if (from.x === target.x || from.y === target.y) return [...path, { ...target }];
  const candidates = [{ x: target.x, y: from.y }, { x: from.x, y: target.y }];
  const intermediate = candidates.find((point) => !blocked.has(key({ x: Math.round(point.x), y: Math.round(point.y) })));
  return intermediate ? [...path, intermediate, { ...target }] : path;
};

function computeInteriorPath(
  interior: InteriorDefinition,
  from: GridPoint,
  to: GridPoint,
  stationFurnitureId?: string,
): GridPoint[] {
  const start = { x: Math.round(from.x), y: Math.round(from.y) };
  const goal = { x: Math.round(to.x), y: Math.round(to.y) };
  const blocked = navigationBlockedCellKeys(interior.furniture, to, stationFurnitureId);
  blocked.delete(key(start));
  if (blocked.has(key(goal))) return [{ ...from }];
  const open: GridPoint[] = [start];
  const cameFrom = new Map<string, GridPoint>();
  const g = new Map([[key(start), 0]]);
  while (open.length > 0) {
    open.sort((a, b) => (g.get(key(a))! + distance(a, goal)) - (g.get(key(b))! + distance(b, goal)));
    const current = open.shift()!;
    if (key(current) === key(goal)) {
      const path = [current];
      let cursor = current;
      while (cameFrom.has(key(cursor))) {
        cursor = cameFrom.get(key(cursor))!;
        path.push(cursor);
      }
      const gridPath = path.reverse();
      const withStart = appendOrthogonal([{ ...from }], start, blocked);
      const joined = [...withStart, ...gridPath.slice(1)];
      return appendOrthogonal(joined, to, blocked);
    }
    const neighbors = [
      { x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 },
    ].filter(({ x, y }) => x >= 0 && y >= 0 && x < interior.width && y < interior.height && !blocked.has(`${x},${y}`));
    for (const neighbor of neighbors) {
      const tentative = g.get(key(current))! + 1;
      if (tentative >= (g.get(key(neighbor)) ?? Number.POSITIVE_INFINITY)) continue;
      cameFrom.set(key(neighbor), current);
      g.set(key(neighbor), tentative);
      if (!open.some((item) => key(item) === key(neighbor))) open.push(neighbor);
    }
  }
  return [{ ...from }];
}

const pathMemo=createRoomMemo<GridPoint[]>();
export function interiorPath(interior:InteriorDefinition,from:GridPoint,to:GridPoint,stationFurnitureId?:string):GridPoint[]{
 return pathMemo(interior,JSON.stringify([from,to,stationFurnitureId]),()=>computeInteriorPath(interior,from,to,stationFurnitureId)).map(p=>({...p}));
}

const segmentDistance = (from: GridPoint, to: GridPoint): number => Math.hypot(to.x - from.x, to.y - from.y);

export function interiorPathDistance(path: readonly GridPoint[]): number {
  return path.slice(1).reduce((total, point, index) => total + segmentDistance(path[index]!, point), 0);
}

export function pointAtPathDistance(path: readonly GridPoint[], requestedDistance: number): InteriorMotionState['point'] {
  if (path.length <= 1) return { ...(path[0] ?? { x: 0, y: 0 }) };
  let remaining = Math.max(0, Math.min(requestedDistance, interiorPathDistance(path)));
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!;
    const to = path[index]!;
    const length = segmentDistance(from, to);
    if (length === 0) continue;
    if (remaining <= length) {
      const amount = remaining / length;
      return { x: lerp(from.x, to.x, amount), y: lerp(from.y, to.y, amount) };
    }
    remaining -= length;
  }
  return { ...path.at(-1)! };
}

const facingToward = (from: InteriorMotionState['point'], to: InteriorMotionState['point'], fallback: Facing): Facing => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  if (Math.abs(dy) > 0.01) return dy < 0 ? 'up' : 'down';
  return fallback;
};

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

function prepareMotion(snapshot:InteriorAgentSnapshot,interior:InteriorDefinition,assignment:InteriorOccupantAssignment){
  const route = interiorRouteFor(snapshot, interior, assignment);
  const door = { x: Math.floor(interior.width / 2), y: interior.height - 1 };
  const pointForRouteItem = (item: FurnitureDefinition): GridPoint => (
    item.id === assignment.furnitureId || item.id === 'interior-overflow'
      ? { ...assignment.point }
      : interiorInteractionPoint(interior, item)
  );
  const target = { ...assignment.point };
  const ingressPath = interiorPath(interior, door, target, assignment.furnitureId);
  const ingressDistance = interiorPathDistance(ingressPath);
  const ingressBlocked = distance(door, target) > 0 && ingressPath.length <= 1;
  const ingressDuration = ingressDistance / INTERIOR_CELLS_PER_SECOND * 1_000;
  const segments = route.map((from, index) => {
    const to = route[(index + 1) % route.length]!;
    const fromPoint = pointForRouteItem(from);
    const toPoint = pointForRouteItem(to);
    const path = interiorPath(interior, fromPoint, toPoint, to.id === 'interior-overflow' ? undefined : to.id);
    const blocked = distance(fromPoint, toPoint) > 0 && path.length <= 1;
    const pathDistance = interiorPathDistance(path);
    return { from, fromPoint, path, blocked, pathDistance, travelMs: pathDistance / INTERIOR_CELLS_PER_SECOND * 1_000 };
  });
  return {door,ingressPath,ingressDistance,ingressBlocked,ingressDuration,segments};
}
const motionPlanMemo=createRoomMemo<ReturnType<typeof prepareMotion>>();

export function interiorMotionAt(
  snapshot: InteriorAgentSnapshot,
  interior: InteriorDefinition,
  assignment: InteriorOccupantAssignment,
  nowMs: number,
): InteriorMotionState {
  const elapsed = Math.max(0, snapshot.interiorElapsedMs ?? 10_000);
  const {door,ingressPath,ingressDistance,ingressBlocked,ingressDuration,segments}=motionPlanMemo(interior,JSON.stringify([snapshot.action,assignment.furnitureId,assignment.point,assignment.facing]),()=>prepareMotion(snapshot,interior,assignment));
  const bob = Math.sin(nowMs / 280) * 0.85;
  const bubbleText = eventBubble(snapshot);
  if (ingressBlocked) {
    return {
      phase: 'ingress', point: { ...door }, path: ingressPath.map((step) => ({ ...step })),
      facing: 'up', bob: 0, bubbleText, walking: false, blocked: true,
    };
  }
  if (elapsed < ingressDuration) {
    const travelled = elapsed / 1_000 * INTERIOR_CELLS_PER_SECOND;
    const point = pointAtPathDistance(ingressPath, travelled);
    const ahead = pointAtPathDistance(ingressPath, Math.min(ingressDistance, travelled + 0.05));
    return {
      phase: 'ingress', point, path: ingressPath.map((step) => ({ ...step })),
      facing: facingToward(point, ahead, 'up'), bob: 0, bubbleText, walking: true, blocked: false,
    };
  }

  const workElapsed = elapsed - ingressDuration;
  const firstBlocked = segments.findIndex(({ blocked }) => blocked);
  const cycleDuration = segments.reduce((total, { travelMs }) => total + WORK_STOP_MS + travelMs, 0);
  let timelineElapsed = firstBlocked >= 0 ? workElapsed : workElapsed % Math.max(WORK_STOP_MS, cycleDuration);
  for (const segment of segments) {
    const mappedPath = segment.path.map((step) => ({ ...step }));
    if (timelineElapsed < WORK_STOP_MS) {
      return {
        phase: 'working', furnitureId: segment.from.id, point: { ...segment.fromPoint }, path: mappedPath, facing: segment.from.facing,
        bob, bubbleText, walking: false, blocked: false,
      };
    }
    timelineElapsed -= WORK_STOP_MS;
    if (segment.blocked) {
      return {
        phase: 'working', furnitureId: segment.from.id, point: { ...segment.fromPoint }, path: mappedPath, facing: segment.from.facing,
        bob, bubbleText, walking: false, blocked: true,
      };
    }
    if (timelineElapsed < segment.travelMs) {
      const travelled = timelineElapsed / 1_000 * INTERIOR_CELLS_PER_SECOND;
      const point = pointAtPathDistance(segment.path, travelled);
      const ahead = pointAtPathDistance(segment.path, Math.min(segment.pathDistance, travelled + 0.05));
      return {
        phase: 'working', point, path: mappedPath,
        facing: facingToward(point, ahead, segment.from.facing), bob: 0, bubbleText, walking: true, blocked: false,
      };
    }
    timelineElapsed -= segment.travelMs;
  }
  const fallback = segments.at(-1)!;
  return {
    phase: 'working', furnitureId: fallback.from.id, point: { ...fallback.fromPoint }, path: fallback.path.map((step) => ({ ...step })),
    facing: fallback.from.facing, bob, bubbleText, walking: false, blocked: false,
  };
}
