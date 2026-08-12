import type {
  AgentAction,
  FurnitureDefinition,
  FurnitureRotation,
  GridPoint,
  InteriorDefinition,
  OfficePrefabDefinition,
} from '../world/types';
import {
  furnitureBlocksNavigation,
  navigationCells,
  resolvedFurnitureAsset,
  transformedAlphaBounds,
  type FurnitureBounds,
} from './interiorPlacement';

export type PrefabPlacementDiagnostic =
  | 'outside-room'
  | 'blocks-door'
  | 'invalid-asset'
  | 'overlap'
  | 'unreachable-interaction-anchor';

export interface PrefabPlacementResult {
  accepted: boolean;
  layout: FurnitureDefinition[];
  diagnostics: PrefabPlacementDiagnostic[];
}

const clonePoint = (point: GridPoint): GridPoint => ({ ...point });

const cloneFurniture = (item: FurnitureDefinition): FurnitureDefinition => ({
  ...item,
  point: clonePoint(item.point),
  supportedActions: [...item.supportedActions],
  ...(item.footprint ? { footprint: { ...item.footprint } } : {}),
  ...(item.visualOffset ? { visualOffset: { ...item.visualOffset } } : {}),
});

const cloneFurnitureLayout = (layout: readonly FurnitureDefinition[]): FurnitureDefinition[] => layout.map(cloneFurniture);

export function cloneOfficePrefab(prefab: OfficePrefabDefinition): OfficePrefabDefinition {
  return {
    ...prefab,
    anchor: clonePoint(prefab.anchor),
    hookActions: [...prefab.hookActions],
    interactionAnchors: prefab.interactionAnchors.map(({ point, actions }) => ({ point: clonePoint(point), actions: [...actions] })),
    items: cloneFurnitureLayout(prefab.items),
  };
}

export function prefabBounds(prefab: OfficePrefabDefinition): FurnitureBounds {
  if (prefab.items.length === 0) return { x: prefab.anchor.x, y: prefab.anchor.y, width: 0, height: 0 };
  const bounds = prefab.items.map((item) => transformedAlphaBounds(item));
  const left = Math.min(...bounds.map(({ x }) => x));
  const top = Math.min(...bounds.map(({ y }) => y));
  const right = Math.max(...bounds.map(({ x, width }) => x + width));
  const bottom = Math.max(...bounds.map(({ y, height }) => y + height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

const rotatePoint = ({ x, y }: GridPoint, rotation: FurnitureRotation): GridPoint => {
  if (rotation === 90) return { x: -y, y: x };
  if (rotation === 180) return { x: -x, y: -y };
  if (rotation === 270) return { x: y, y: -x };
  return { x, y };
};

const rotateRelativePoint = (point: GridPoint, anchor: GridPoint, rotation: FurnitureRotation): GridPoint => {
  const relative = rotatePoint({ x: point.x - anchor.x, y: point.y - anchor.y }, rotation);
  return { x: anchor.x + relative.x, y: anchor.y + relative.y };
};

const rotateFacing = (facing: FurnitureDefinition['facing'], rotation: FurnitureRotation): FurnitureDefinition['facing'] => {
  const facings: FurnitureDefinition['facing'][] = ['up', 'right', 'down', 'left'];
  return facings[(facings.indexOf(facing) + rotation / 90) % facings.length]!;
};

const rotateItemRotation = (rotation: FurnitureRotation | undefined, by: FurnitureRotation): FurnitureRotation =>
  (((rotation ?? 0) + by) % 360) as FurnitureRotation;

export function rotatePrefab(prefab: OfficePrefabDefinition, rotation: FurnitureRotation): OfficePrefabDefinition {
  const cloned = cloneOfficePrefab(prefab);
  return {
    ...cloned,
    ...(rotation % 180 === 0 ? {} : { width: cloned.height, height: cloned.width }),
    items: cloned.items.map((item) => ({
      ...item,
      point: rotateRelativePoint(item.point, cloned.anchor, rotation),
      facing: rotateFacing(item.facing, rotation),
      rotation: rotateItemRotation(item.rotation, rotation),
      ...(item.visualOffset ? { visualOffset: rotatePoint(item.visualOffset, rotation) } : {}),
    })),
    interactionAnchors: cloned.interactionAnchors.map(({ point, actions }) => ({
      point: rotateRelativePoint(point, cloned.anchor, rotation),
      actions: [...actions],
    })),
  };
}

let placementSequence = 0;
const nextInstanceId = (prefab: OfficePrefabDefinition, now: number): string => `prefab-${now}-${prefab.id}-${placementSequence++}`;

const transformPoint = (point: GridPoint, prefabAnchor: GridPoint, placementAnchor: GridPoint): GridPoint => ({
  x: placementAnchor.x + point.x - prefabAnchor.x,
  y: placementAnchor.y + point.y - prefabAnchor.y,
});

const transformPrefabItems = (
  prefab: OfficePrefabDefinition,
  anchor: GridPoint,
  prefabInstanceId: string,
): FurnitureDefinition[] => {
  return prefab.items.map((item, index) => ({
    ...cloneFurniture(item),
    id: `${prefabInstanceId}-${index}`,
    point: transformPoint(item.point, prefab.anchor, anchor),
    prefabInstanceId,
  }));
};

const transformedInteractionAnchors = (prefab: OfficePrefabDefinition, anchor: GridPoint) =>
  prefab.interactionAnchors.map(({ point, actions }) => ({
    point: transformPoint(point, prefab.anchor, anchor),
    actions: [...actions],
  }));

const key = ({ x, y }: GridPoint): string => `${x},${y}`;
const doorPoint = (room: InteriorDefinition): GridPoint => ({ x: Math.floor(room.width / 2), y: room.height - 1 });

const insideRoom = (room: InteriorDefinition, point: GridPoint): boolean => (
  point.x >= 0 && point.y >= 0 && point.x < room.width && point.y < room.height
);

const reaches = (room: InteriorDefinition, blocked: ReadonlySet<string>, target: GridPoint): boolean => {
  const start = doorPoint(room);
  if (blocked.has(key(start)) || blocked.has(key(target)) || !insideRoom(room, target)) return false;
  const queue = [start];
  const visited = new Set([key(start)]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (key(current) === key(target)) return true;
    for (const next of [
      { x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 },
    ]) {
      const nextKey = key(next);
      if (!insideRoom(room, next) || blocked.has(nextKey) || visited.has(nextKey)) continue;
      visited.add(nextKey);
      queue.push(next);
    }
  }
  return false;
};

type AislePair = readonly [GridPoint, GridPoint];

const pairKey = ([first, second]: AislePair): string => [key(first), key(second)].sort().join('|');
const adjacentPoints = ({ x, y }: GridPoint): GridPoint[] => [
  { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 },
];
const isOpen = (room: InteriorDefinition, blocked: ReadonlySet<string>, point: GridPoint): boolean =>
  insideRoom(room, point) && !blocked.has(key(point));

const twoTileAisleReaches = (room: InteriorDefinition, blocked: ReadonlySet<string>, target: GridPoint): boolean => {
  const door = doorPoint(room);
  if (!isOpen(room, blocked, door) || !isOpen(room, blocked, target)) return false;
  const queue: AislePair[] = adjacentPoints(door)
    .filter((neighbor) => isOpen(room, blocked, neighbor))
    .map((neighbor) => [door, neighbor]);
  const visited = new Set(queue.map(pairKey));
  while (queue.length > 0) {
    const pair = queue.shift()!;
    if (key(pair[0]) === key(target) || key(pair[1]) === key(target)) return true;
    const [first, second] = pair;
    const horizontal = first.y === second.y;
    const directions = horizontal ? [{ x: 0, y: -1 }, { x: 0, y: 1 }] : [{ x: -1, y: 0 }, { x: 1, y: 0 }];
    const nextPairs: AislePair[] = directions.flatMap(({ x, y }) => {
      const moved: AislePair = [{ x: first.x + x, y: first.y + y }, { x: second.x + x, y: second.y + y }];
      if (!isOpen(room, blocked, moved[0]) || !isOpen(room, blocked, moved[1])) return [];
      return [moved];
    });
    const turnDirections = horizontal ? [{ x: 0, y: -1 }, { x: 0, y: 1 }] : [{ x: -1, y: 0 }, { x: 1, y: 0 }];
    for (const { x, y } of turnDirections) {
      for (const [pivot, other] of [[first, second], [second, first]] as const) {
        const turned = { x: pivot.x + x, y: pivot.y + y };
        const corner = { x: other.x + x, y: other.y + y };
        if (isOpen(room, blocked, turned) && isOpen(room, blocked, corner)) nextPairs.push([pivot, turned]);
      }
    }
    for (const next of nextPairs) {
      const nextKey = pairKey(next);
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      queue.push(next);
    }
  }
  return false;
};

const appendDiagnostic = (diagnostics: PrefabPlacementDiagnostic[], diagnostic: PrefabPlacementDiagnostic): void => {
  if (!diagnostics.includes(diagnostic)) diagnostics.push(diagnostic);
};

const hasAction = (actions: readonly AgentAction[], action: AgentAction): boolean => actions.includes(action);

const validatePlacedItems = (
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  transformed: readonly FurnitureDefinition[],
  interactionAnchors: ReadonlyArray<{ point: GridPoint; actions: AgentAction[] }>,
  hookActions: readonly AgentAction[],
): PrefabPlacementDiagnostic[] => {
  const diagnostics: PrefabPlacementDiagnostic[] = [];
  const door = doorPoint(room);
  for (const item of transformed) {
    if (!resolvedFurnitureAsset(item)) appendDiagnostic(diagnostics, 'invalid-asset');
    const bounds = transformedAlphaBounds(item);
    if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > room.width || bounds.y + bounds.height > room.height) {
      appendDiagnostic(diagnostics, 'outside-room');
    }
    if (bounds.x < door.x + 1 && bounds.x + bounds.width > door.x && bounds.y < door.y + 1 && bounds.y + bounds.height > door.y) {
      appendDiagnostic(diagnostics, 'blocks-door');
    }
  }

  const existingBlocked = new Set(layout.flatMap(navigationCells).map(key));
  const transformedBlocked = new Set<string>();
  for (const item of transformed) {
    if (!furnitureBlocksNavigation(item)) continue;
    for (const cell of navigationCells(item)) {
      const cellKey = key(cell);
      if (existingBlocked.has(cellKey) || transformedBlocked.has(cellKey)) appendDiagnostic(diagnostics, 'overlap');
      transformedBlocked.add(cellKey);
    }
  }

  const blocked = new Set([...existingBlocked, ...transformedBlocked]);
  const requiredAnchors = interactionAnchors.filter(({ actions }) => actions.length > 0);
  const everyHookHasAnchor = hookActions.every((action) => requiredAnchors.some(({ actions }) => hasAction(actions, action)));
  if (!everyHookHasAnchor || requiredAnchors.some(({ point }) => {
    const target = { x: Math.round(point.x), y: Math.round(point.y) };
    return !reaches(room, blocked, target) || !twoTileAisleReaches(room, blocked, target);
  })) {
    appendDiagnostic(diagnostics, 'unreachable-interaction-anchor');
  }
  return diagnostics;
};

export function validateOfficePrefab(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  prefab: OfficePrefabDefinition,
  anchor: GridPoint,
): PrefabPlacementDiagnostic[] {
  return validatePlacedItems(
    room,
    layout,
    transformPrefabItems(prefab, anchor, `validation-${prefab.id}`),
    transformedInteractionAnchors(prefab, anchor),
    prefab.hookActions,
  );
}

export function placeOfficePrefab(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  prefab: OfficePrefabDefinition,
  anchor: GridPoint,
  now = Date.now(),
): PrefabPlacementResult {
  const transformed = transformPrefabItems(prefab, anchor, nextInstanceId(prefab, now));
  const diagnostics = validatePlacedItems(room, layout, transformed, transformedInteractionAnchors(prefab, anchor), prefab.hookActions);
  return diagnostics.length
    ? { accepted: false, layout: cloneFurnitureLayout(layout), diagnostics }
    : { accepted: true, layout: [...cloneFurnitureLayout(layout), ...transformed], diagnostics: [] };
}
