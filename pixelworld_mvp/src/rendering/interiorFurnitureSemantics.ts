import { createRoomMemo } from './interiorRuntimeCache';
import type {
  AgentAction,
  FurnitureDefinition,
  FurnitureSemantic,
  GridPoint,
  InteriorDefinition,
} from '../world/types';
import { catalogFurnitureRole, catalogFurnitureSemantic } from './modernOfficeCatalog';
import { navigationBlockedCellKeys, navigationCells } from './interiorPlacement';
import { AGENT_FEET_CLEARANCE, interactionAccess } from './interiorNavigationPolicy';

const ACTION_SEMANTICS = {
  arrive: 'rest',
  ponder: 'search',
  plan: 'search',
  read: 'search',
  type: 'work',
  terminal: 'work',
  signal: 'search',
  dispatch: 'work',
  respond: 'work',
  queue: 'rest',
  repair: 'work',
  rest: 'rest',
  offline: 'rest',
  pulse: 'work',
} as const satisfies Record<AgentAction, FurnitureSemantic>;

const KIND_SEMANTICS: Partial<Record<FurnitureDefinition['kind'], FurnitureSemantic>> = {
  sofa: 'rest',
  chair: 'rest',
  'office-chair': 'rest',
  bed: 'rest',
  bookcase: 'search',
  cabinet: 'search',
  'planning-board': 'search',
  'map-table': 'search',
  'reading-desk': 'search',
  computer: 'work',
  desk: 'work',
  workbench: 'work',
  'repair-table': 'work',
  'dispatch-pod': 'work',
  'radio-console': 'work',
  'response-desk': 'work',
  'meeting-table': 'work',
  printer: 'work',
};

export interface SemanticStation {
  furnitureId: string;
  point: GridPoint;
}

export function semanticForAction(action: AgentAction): FurnitureSemantic {
  return ACTION_SEMANTICS[action];
}

const legacyActionSemantic = (actions: readonly AgentAction[]): FurnitureSemantic | undefined => {
  const semantics = new Set(actions.map(semanticForAction));
  return semantics.size === 1 ? [...semantics][0] : undefined;
};

export function semanticForFurniture(item: FurnitureDefinition): FurnitureSemantic | undefined {
  if (item.layer === 'floor' || item.layer === 'surface' || item.supportedByIds?.length) return undefined;
  const catalogRole = item.assetId === undefined ? undefined : catalogFurnitureRole(item.assetId);
  if (catalogRole === 'floor' || catalogRole === 'surface') return undefined;
  if (item.semantic) return item.semantic;
  const legacy = legacyActionSemantic(item.supportedActions);
  if (legacy) return legacy;
  const kind = KIND_SEMANTICS[item.kind];
  if (kind) return kind;
  return item.assetId === undefined ? undefined : catalogFurnitureSemantic(item.assetId);
}

const pointKey = ({ x, y }: GridPoint): string => `${Math.round(x)},${Math.round(y)}`;
const inside = (room: InteriorDefinition, point: GridPoint): boolean => (
  point.x >= 0 && point.y >= 0 && point.x < room.width && point.y < room.height
);

const fallbackInteractionCandidates = (
  room: InteriorDefinition,
  furniture: FurnitureDefinition,
): GridPoint[] => {
  if (semanticForFurniture(furniture) === 'rest') return [{ ...furniture.point }];
  const occupied = navigationCells({ ...furniture, blocksNavigation: true });
  const occupiedKeys = new Set(occupied.map(pointKey));
  const candidates = new Map<string, GridPoint>();
  for (const cell of occupied) {
    for (const point of [
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x + 1, y: cell.y },
      { x: cell.x, y: cell.y - 1 },
    ]) {
      if (inside(room, point) && !occupiedKeys.has(pointKey(point))) candidates.set(pointKey(point), point);
    }
  }
  return [...candidates.values()].sort((first, second) => first.y - second.y || first.x - second.x);
};

const pathDistance = (
  room: InteriorDefinition,
  origin: GridPoint,
  target: GridPoint,
  furnitureId: string,
  action: AgentAction,
): number | undefined => {
  const start = { x: Math.round(origin.x), y: Math.round(origin.y) };
  const goal = { x: Math.round(target.x), y: Math.round(target.y) };
  if (!inside(room, start) || !inside(room, goal)) return undefined;
  const blocked = navigationBlockedCellKeys(room.furniture, target, furnitureId, {
    action,
    clearance: AGENT_FEET_CLEARANCE,
  });
  blocked.delete(pointKey(start));
  if (blocked.has(pointKey(goal))) return undefined;
  const open: Array<{ point: GridPoint; distance: number }> = [{ point: start, distance: 0 }];
  const best = new Map([[pointKey(start), 0]]);
  while (open.length > 0) {
    open.sort((first, second) => {
      const firstScore = first.distance + Math.abs(first.point.x - goal.x) + Math.abs(first.point.y - goal.y);
      const secondScore = second.distance + Math.abs(second.point.x - goal.x) + Math.abs(second.point.y - goal.y);
      return firstScore - secondScore || first.point.y - second.point.y || first.point.x - second.point.x;
    });
    const current = open.shift()!;
    if (pointKey(current.point) === pointKey(goal)) return current.distance;
    for (const next of [
      { x: current.point.x + 1, y: current.point.y },
      { x: current.point.x - 1, y: current.point.y },
      { x: current.point.x, y: current.point.y + 1 },
      { x: current.point.x, y: current.point.y - 1 },
    ]) {
      const nextKey = pointKey(next);
      const distance = current.distance + 1;
      if (!inside(room, next) || blocked.has(nextKey) || distance >= (best.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
      best.set(nextKey, distance);
      open.push({ point: next, distance });
    }
  }
  return undefined;
};

const explicitPointIsInvalid = (
  room: InteriorDefinition,
  furniture: FurnitureDefinition,
  point: GridPoint,
): boolean => {
  if (!inside(room, point)) return true;
  const target = pointKey(point);
  const targetPoint = { x: Math.round(point.x), y: Math.round(point.y) };
  const occupied = navigationCells({ ...furniture, blocksNavigation: true });
  if (!occupied.some((cell) => (
    Math.abs(cell.x - targetPoint.x) + Math.abs(cell.y - targetPoint.y) === 1
  ))) return true;
  return room.furniture.some((other) => {
    if (other.id === furniture.id) return false;
    const sharesEligiblePrefabTarget = Boolean(furniture.prefabInstanceId)
      && other.prefabInstanceId === furniture.prefabInstanceId
      && Boolean(other.interactionPoint)
      && pointKey(other.interactionPoint!) === target;
    return !sharesEligiblePrefabTarget
      && navigationCells(other).some((cell) => pointKey(cell) === target);
  });
};

function computeNearestSemanticStation(
  room: InteriorDefinition,
  action: AgentAction,
  origin: GridPoint,
  excludedPointKeys: ReadonlySet<string> = new Set(),
  excludedFurnitureIds: ReadonlySet<string> = new Set(),
): SemanticStation | undefined {
  const semantic = semanticForAction(action);
  const nearest = room.furniture
    .filter((item) => {
      if (semanticForFurniture(item) !== semantic || excludedFurnitureIds.has(item.id)) return false;
      if (item.kind === 'bed' || item.kind === 'chair' || item.kind === 'office-chair' || item.kind === 'sofa') {
        return interactionAccess(item, action) !== 'none';
      }
      return true;
    })
    .flatMap((furniture) => {
      const reachable = (point: GridPoint) => {
        if (excludedPointKeys.has(pointKey(point))) return undefined;
        const distance = pathDistance(room, origin, point, furniture.id, action);
        return distance === undefined ? undefined : { furnitureId: furniture.id, point, distance };
      };
      if (furniture.interactionPoint && !explicitPointIsInvalid(room, furniture, furniture.interactionPoint)) {
        const explicit = reachable({ ...furniture.interactionPoint });
        if (explicit) return [explicit];
      }
      return fallbackInteractionCandidates(room, furniture)
        .map(reachable)
        .filter((station): station is SemanticStation & { distance: number } => station !== undefined);
    })
    .sort((first, second) => first.distance - second.distance
      || first.furnitureId.localeCompare(second.furnitureId)
      || first.point.y - second.point.y
      || first.point.x - second.point.x)[0];
  return nearest ? { furnitureId: nearest.furnitureId, point: { ...nearest.point } } : undefined;
}

const stationMemo=createRoomMemo<SemanticStation|undefined>();
export function nearestSemanticStation(room:InteriorDefinition,action:AgentAction,origin:GridPoint,excludedPointKeys:ReadonlySet<string>=new Set(),excludedFurnitureIds:ReadonlySet<string>=new Set()):SemanticStation|undefined {
 const key=JSON.stringify([action,origin,[...excludedPointKeys].sort(),[...excludedFurnitureIds].sort()]);
 const result=stationMemo(room,key,()=>computeNearestSemanticStation(room,action,origin,excludedPointKeys,excludedFurnitureIds));
 return result?{...result,point:{...result.point}}:undefined;
}
