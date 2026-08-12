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
  rotateGridPoint,
  resolvedFurnitureAsset,
  transformedAlphaBounds,
  type FurnitureBounds,
} from './interiorPlacement';
import { furnitureFootprint } from '../world/interiorDefinitions';

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
  ...(item.interactionPoint ? { interactionPoint: { ...item.interactionPoint } } : {}),
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

const rotateRelativePoint = (point: GridPoint, anchor: GridPoint, rotation: FurnitureRotation): GridPoint => {
  const relative = rotateGridPoint({ x: point.x - anchor.x, y: point.y - anchor.y }, rotation);
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
      ...(item.visualOffset ? { visualOffset: rotateGridPoint(item.visualOffset, rotation) } : {}),
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

const withInteractionPoints = (
  items: readonly FurnitureDefinition[],
  anchors: ReadonlyArray<{ point: GridPoint; actions: AgentAction[] }>,
): FurnitureDefinition[] => {
  const unused = new Set(anchors.map((_, index) => index));
  return items.map((item) => {
    if (item.supportedActions.length === 0) return cloneFurniture(item);
    const compatible = anchors
      .map((anchor, index) => ({ anchor, index }))
      .filter(({ anchor }) => anchor.actions.some((action) => item.supportedActions.includes(action)))
      .sort((first, second) => {
        const firstUnused = unused.has(first.index) ? 0 : 1;
        const secondUnused = unused.has(second.index) ? 0 : 1;
        const firstDistance = Math.abs(first.anchor.point.x - item.point.x) + Math.abs(first.anchor.point.y - item.point.y);
        const secondDistance = Math.abs(second.anchor.point.x - item.point.x) + Math.abs(second.anchor.point.y - item.point.y);
        return firstUnused - secondUnused || firstDistance - secondDistance || first.index - second.index;
      });
    const selected = compatible[0];
    if (!selected) return cloneFurniture(item);
    unused.delete(selected.index);
    return { ...cloneFurniture(item), interactionPoint: { ...selected.anchor.point } };
  });
};

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

const isOpen = (room: InteriorDefinition, blocked: ReadonlySet<string>, point: GridPoint): boolean =>
  insideRoom(room, point) && !blocked.has(key(point));

const hasTwoTileMainAisle = (room: InteriorDefinition, blocked: ReadonlySet<string>): boolean => {
  const door = doorPoint(room);
  const crossAisleY = Math.floor(room.height / 2);
  for (let y = door.y; y >= crossAisleY; y -= 1) {
    if (!isOpen(room, blocked, { x: door.x, y }) || !isOpen(room, blocked, { x: door.x - 1, y })) return false;
  }
  return true;
};

const appendDiagnostic = (diagnostics: PrefabPlacementDiagnostic[], diagnostic: PrefabPlacementDiagnostic): void => {
  if (!diagnostics.includes(diagnostic)) diagnostics.push(diagnostic);
};

const hasAction = (actions: readonly AgentAction[], action: AgentAction): boolean => actions.includes(action);
const overlapsOpaqueBounds = (first: FurnitureDefinition, second: FurnitureDefinition): boolean => {
  const a = transformedAlphaBounds(first);
  const b = transformedAlphaBounds(second);
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
};

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

  const existingBlocking = layout.filter(furnitureBlocksNavigation);
  const existingBlocked = new Set(existingBlocking.flatMap(navigationCells).map(key));
  const transformedBlocked = new Set<string>();
  const transformedBlocking: FurnitureDefinition[] = [];
  for (const item of transformed) {
    if (!furnitureBlocksNavigation(item)) continue;
    if (existingBlocking.some((existing) => overlapsOpaqueBounds(existing, item))
      || transformedBlocking.some((existing) => overlapsOpaqueBounds(existing, item))) {
      appendDiagnostic(diagnostics, 'overlap');
    }
    transformedBlocking.push(item);
    for (const cell of navigationCells(item)) {
      const cellKey = key(cell);
      transformedBlocked.add(cellKey);
    }
  }

  const blocked = new Set([...existingBlocked, ...transformedBlocked]);
  const requiredAnchors = interactionAnchors.filter(({ actions }) => actions.length > 0);
  const everyHookHasAnchor = hookActions.every((action) => requiredAnchors.some(({ actions }) => hasAction(actions, action)));
  if (!hasTwoTileMainAisle(room, blocked) || !everyHookHasAnchor || requiredAnchors.some(({ point }) => {
    const target = { x: Math.round(point.x), y: Math.round(point.y) };
    const assigned = transformed.filter((item) => item.interactionPoint
      && Math.round(item.interactionPoint.x) === target.x && Math.round(item.interactionPoint.y) === target.y);
    const allowed = new Set(blocked);
    assigned.flatMap(navigationCells).forEach((cell) => allowed.delete(key(cell)));
    return !reaches(room, allowed, target);
  })) {
    appendDiagnostic(diagnostics, 'unreachable-interaction-anchor');
  }
  return diagnostics;
};

export const interiorInteractionPoint = (interior: InteriorDefinition, furniture: FurnitureDefinition): GridPoint => {
  if (furniture.interactionPoint) return { ...furniture.interactionPoint };
  if (furniture.kind === 'chair' || furniture.kind === 'sofa' || furniture.kind === 'bed') return { ...furniture.point };
  const size = furnitureFootprint(furniture.kind);
  const offsets: Record<FurnitureDefinition['facing'], GridPoint[]> = {
    up: [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }],
    down: [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    left: [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }],
    right: [{ x: -1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }],
  };
  const initialDistance = furniture.facing === 'up' || furniture.facing === 'down'
    ? Math.floor(size.height / 2) + 1
    : Math.floor(size.width / 2) + 1;
  const occupied = new Set(interior.furniture
    .filter(({ id }) => id !== furniture.id)
    .flatMap(navigationCells)
    .map(key));
  for (const step of offsets[furniture.facing]) {
    for (let distance = initialDistance; distance < Math.max(interior.width, interior.height); distance += 1) {
      const point = { x: furniture.point.x + step.x * distance, y: furniture.point.y + step.y * distance };
      if (!insideRoom(interior, point)) break;
      if (!occupied.has(key({ x: Math.round(point.x), y: Math.round(point.y) }))) return point;
    }
  }
  return { ...furniture.point };
};

export function validateOfficeLayout(room: InteriorDefinition): PrefabPlacementDiagnostic[] {
  return [...new Set(officeLayoutIssues(room).map(({ diagnostic }) => diagnostic))];
}

export function officeLayoutIssues(room: InteriorDefinition): Array<{
  diagnostic: PrefabPlacementDiagnostic;
  furnitureId?: string;
  conflictingId?: string;
  point?: GridPoint;
}> {
  const issues: ReturnType<typeof officeLayoutIssues> = [];
  const door = doorPoint(room);
  const occupants = new Map<string, string>();
  const blockingFurniture: FurnitureDefinition[] = [];
  for (const item of room.furniture) {
    if (!resolvedFurnitureAsset(item)) issues.push({ diagnostic: 'invalid-asset', furnitureId: item.id });
    const bounds = transformedAlphaBounds(item);
    if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > room.width || bounds.y + bounds.height > room.height) {
      issues.push({ diagnostic: 'outside-room', furnitureId: item.id });
    }
    if (bounds.x < door.x + 1 && bounds.x + bounds.width > door.x && bounds.y < door.y + 1 && bounds.y + bounds.height > door.y) {
      issues.push({ diagnostic: 'blocks-door', furnitureId: item.id });
    }
    if (!furnitureBlocksNavigation(item)) continue;
    const conflict = blockingFurniture.find((existing) => overlapsOpaqueBounds(existing, item));
    if (conflict) issues.push({ diagnostic: 'overlap', furnitureId: item.id, conflictingId: conflict.id });
    blockingFurniture.push(item);
    for (const cell of navigationCells(item)) {
      const cellKey = key(cell);
      if (!occupants.has(cellKey)) occupants.set(cellKey, item.id);
    }
  }
  const blocked = new Set(occupants.keys());
  if (!hasTwoTileMainAisle(room, blocked)) issues.push({ diagnostic: 'unreachable-interaction-anchor', point: door });
  for (const furniture of room.furniture.filter(({ supportedActions }) => supportedActions.length > 0)) {
    const point = interiorInteractionPoint(room, furniture);
    const allowed = new Set(blocked);
    room.furniture.filter((item) => item.interactionPoint
      && Math.round(item.interactionPoint.x) === Math.round(point.x)
      && Math.round(item.interactionPoint.y) === Math.round(point.y))
      .flatMap(navigationCells).forEach((cell) => allowed.delete(key(cell)));
    if (!reaches(room, allowed, { x: Math.round(point.x), y: Math.round(point.y) })) {
      issues.push({ diagnostic: 'unreachable-interaction-anchor', furnitureId: furniture.id, point });
    }
  }
  return issues;
}

export function validateOfficePrefab(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  prefab: OfficePrefabDefinition,
  anchor: GridPoint,
): PrefabPlacementDiagnostic[] {
  const anchors = transformedInteractionAnchors(prefab, anchor);
  return validatePlacedItems(
    room,
    layout,
    withInteractionPoints(transformPrefabItems(prefab, anchor, `validation-${prefab.id}`), anchors),
    anchors,
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
  const anchors = transformedInteractionAnchors(prefab, anchor);
  const transformed = withInteractionPoints(
    transformPrefabItems(prefab, anchor, nextInstanceId(prefab, now)),
    anchors,
  );
  const diagnostics = validatePlacedItems(room, layout, transformed, anchors, prefab.hookActions);
  return diagnostics.length
    ? { accepted: false, layout: cloneFurnitureLayout(layout), diagnostics }
    : { accepted: true, layout: [...cloneFurnitureLayout(layout), ...transformed], diagnostics: [] };
}
