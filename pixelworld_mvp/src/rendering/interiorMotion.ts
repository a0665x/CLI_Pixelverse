import type { Facing, FurnitureDefinition, GridPoint, InteriorDefinition } from '../world/types';
import { furnitureFootprint } from '../world/interiorDefinitions';
import type { InteriorAgentSnapshot, InteriorOccupantAssignment } from './interiorAssignment';
import { furnitureCells } from './interiorLayoutEditor';

export type InteriorMotionPhase = 'ingress' | 'working';
export interface InteriorMotionState {
  phase: InteriorMotionPhase;
  point: { x: number; y: number };
  facing: Facing;
  bob: number;
  bubbleText: string;
  walking: boolean;
}

const STEP_MS = 240;
const WORK_STOP_MS = 1_800;
const WORK_TRANSITION_MS = 720;

const eventBubble = (snapshot: InteriorAgentSnapshot): string => snapshot.bubbleText ?? ({
  session_start: '準備開始工作', think: '正在思考', plan: '整理計畫', read: '查閱檔案',
  edit: '修改程式', tool: '正在處理工具調用', web: '連接 Web / MCP', clone: '建立 Subagent',
  respond: '傳送結果', await: '等待輸入', blocked: '工作受阻', self_heal: '正在修復',
  idle: '暫時休息', offline: 'Agent 離線', heartbeat: '保持連線', unknown: '處理工作',
})[snapshot.eventKind];

const firstKind = (
  interior: InteriorDefinition,
  kind: FurnitureDefinition['kind'],
  action: InteriorAgentSnapshot['action'],
): FurnitureDefinition | undefined => interior.furniture.find((item) => (
  item.kind === kind && item.supportedActions.includes(action)
));

export function interiorRouteFor(
  snapshot: InteriorAgentSnapshot,
  interior: InteriorDefinition,
  assignment: InteriorOccupantAssignment,
): FurnitureDefinition[] {
  const byKinds = (kinds: FurnitureDefinition['kind'][]): FurnitureDefinition[] =>
    kinds.flatMap((kind) => {
      const match = firstKind(interior, kind, snapshot.action);
      return match ? [match] : [];
    });
  let route: FurnitureDefinition[];
  if (snapshot.action === 'terminal') route = byKinds(['computer', 'bookcase', 'planning-board', 'computer']);
  else if (snapshot.action === 'signal') route = byKinds(['computer', 'bookcase', 'computer']);
  else if (snapshot.action === 'type') route = byKinds(['computer', 'workbench', 'computer']);
  else if (snapshot.action === 'plan' || snapshot.action === 'ponder') route = byKinds(['planning-board', 'map-table', 'planning-board']);
  else if (snapshot.action === 'read') route = byKinds(['reading-desk', 'bookcase', 'reading-desk']);
  else route = [];

  const assignedFurniture = interior.furniture.find(({ id }) => id === assignment.furnitureId);
  if (route.length === 0 && assignedFurniture) route = [assignedFurniture];
  return route.length > 0 ? route : [{
    id: 'interior-overflow', kind: 'decor', point: assignment.point, facing: assignment.facing,
    supportedActions: [snapshot.action], icon: assignment.icon,
  }];
}

const key = ({ x, y }: GridPoint): string => `${x},${y}`;
const distance = (from: GridPoint, to: GridPoint): number => Math.abs(to.x - from.x) + Math.abs(to.y - from.y);

export function interiorPath(interior: InteriorDefinition, from: GridPoint, to: GridPoint): GridPoint[] {
  const start = { x: Math.round(from.x), y: Math.round(from.y) };
  const goal = { x: Math.round(to.x), y: Math.round(to.y) };
  const blocked = new Set(interior.furniture.flatMap(furnitureCells).map(key));
  blocked.delete(key(start));
  blocked.delete(key(goal));
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
      return path.reverse();
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
  return [start];
}

const interactionPoint = (interior: InteriorDefinition, furniture: FurnitureDefinition): GridPoint => {
  if (furniture.kind === 'chair' || furniture.kind === 'sofa' || furniture.kind === 'bed') return { ...furniture.point };
  const size = furnitureFootprint(furniture.kind);
  const offsets: Record<Facing, GridPoint> = {
    up: { x: 0, y: 1 }, down: { x: 0, y: -1 }, left: { x: 1, y: 0 }, right: { x: -1, y: 0 },
  };
  const initialDistance = furniture.facing === 'up' || furniture.facing === 'down'
    ? Math.floor(size.height / 2) + 1
    : Math.floor(size.width / 2) + 1;
  const occupied = new Set(interior.furniture
    .filter(({ id }) => id !== furniture.id)
    .flatMap(furnitureCells)
    .map(key));
  const step = offsets[furniture.facing];
  for (let distanceFromFurniture = initialDistance; distanceFromFurniture < Math.max(interior.width, interior.height); distanceFromFurniture += 1) {
    const point = {
      x: furniture.point.x + step.x * distanceFromFurniture,
      y: furniture.point.y + step.y * distanceFromFurniture,
    };
    if (point.x < 0 || point.y < 0 || point.x >= interior.width || point.y >= interior.height) break;
    if (!occupied.has(key(point))) return point;
  }
  return { ...furniture.point };
};

function pointAlongPath(path: readonly GridPoint[], progress: number): InteriorMotionState['point'] {
  if (path.length <= 1) return { ...(path[0] ?? { x: 0, y: 0 }) };
  const travel = Math.max(0, Math.min(path.length - 1, (path.length - 1) * progress));
  const index = Math.min(path.length - 2, Math.floor(travel));
  const amount = travel - index;
  return {
    x: lerp(path[index]!.x, path[index + 1]!.x, amount),
    y: lerp(path[index]!.y, path[index + 1]!.y, amount),
  };
}

const facingToward = (from: InteriorMotionState['point'], to: InteriorMotionState['point'], fallback: Facing): Facing => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  if (Math.abs(dy) > 0.01) return dy < 0 ? 'up' : 'down';
  return fallback;
};

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

export function interiorMotionAt(
  snapshot: InteriorAgentSnapshot,
  interior: InteriorDefinition,
  assignment: InteriorOccupantAssignment,
  nowMs: number,
): InteriorMotionState {
  const elapsed = Math.max(0, snapshot.interiorElapsedMs ?? 10_000);
  const route = interiorRouteFor(snapshot, interior, assignment);
  const door = { x: Math.floor(interior.width / 2), y: interior.height - 1 };
  const target = interactionPoint(interior, route[0]!);
  const ingressPath = interiorPath(interior, door, target);
  const ingressDuration = Math.max(STEP_MS, (ingressPath.length - 1) * STEP_MS);
  const bob = Math.sin(nowMs / 280) * 0.85;
  const bubbleText = eventBubble(snapshot);
  if (elapsed < ingressDuration) {
    const point = pointAlongPath(ingressPath, elapsed / ingressDuration);
    return { phase: 'ingress', point, facing: facingToward(door, point, 'up'), bob: 0, bubbleText, walking: true };
  }

  const workElapsed = elapsed - ingressDuration;
  const index = Math.floor(workElapsed / WORK_STOP_MS) % route.length;
  const nextIndex = (index + 1) % route.length;
  const segmentElapsed = workElapsed % WORK_STOP_MS;
  const from = route[index]!;
  const to = route[nextIndex]!;
  const fromPoint = interactionPoint(interior, from);
  const toPoint = interactionPoint(interior, to);
  const workPath = interiorPath(interior, fromPoint, toPoint);
  const transition = Math.max(0, Math.min(1, (segmentElapsed - (WORK_STOP_MS - WORK_TRANSITION_MS)) / WORK_TRANSITION_MS));
  const point = pointAlongPath(workPath, transition);
  const walking = transition > 0 && workPath.length > 1;
  return {
    phase: 'working',
    point,
    facing: transition > 0 ? facingToward(point, pointAlongPath(workPath, Math.min(1, transition + 0.05)), from.facing) : from.facing,
    bob: walking ? 0 : bob,
    bubbleText,
    walking,
  };
}
