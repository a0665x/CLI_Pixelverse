import type { FurnitureDefinition, FurniturePrefab, GridPoint, InteriorDefinition } from '../world/types';
import {
  diagnoseFinePlacement,
  fitFurniturePointToRoom,
  furnitureBlocksNavigation,
  resolvePlacementCandidate,
  snapFurniturePoint,
  transformedAlphaBounds,
  type FurnitureBounds,
} from './interiorPlacement';

export interface SelectionRect extends FurnitureBounds {}

const intersects = (left: FurnitureBounds, right: FurnitureBounds): boolean => (
  left.x < right.x + right.width && left.x + left.width > right.x &&
  left.y < right.y + right.height && left.y + left.height > right.y
);

const cloneFurniture = (item: FurnitureDefinition): FurnitureDefinition => ({
  ...item,
  point: { ...item.point },
  supportedActions: [...item.supportedActions],
  ...(item.footprint ? { footprint: { ...item.footprint } } : {}),
});

export function selectedFurnitureIds(
  rect: SelectionRect,
  layout: readonly FurnitureDefinition[],
): string[] {
  const normalized = {
    x: Math.min(rect.x, rect.x + rect.width), y: Math.min(rect.y, rect.y + rect.height),
    width: Math.abs(rect.width), height: Math.abs(rect.height),
  };
  return layout.filter((item) => intersects(normalized, transformedAlphaBounds(item))).map(({ id }) => id);
}

export function moveSelection(
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  delta: GridPoint,
): FurnitureDefinition[] {
  const selected = new Set(selectedIds);
  return layout.map((item) => selected.has(item.id)
    ? { ...cloneFurniture(item), point: snapFurniturePoint({ x: item.point.x + delta.x, y: item.point.y + delta.y }) }
    : cloneFurniture(item));
}

export interface SelectionMutationResult {
  accepted: boolean;
  layout: FurnitureDefinition[];
}

export interface DuplicateFurnitureResult extends SelectionMutationResult {
  selectedIds: string[];
}

export function removeSelection(
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
): FurnitureDefinition[] {
  const selected = new Set(selectedIds);
  return layout.filter(({ id }) => !selected.has(id)).map(cloneFurniture);
}

export function transformSelectionAtomically(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  transform: (item: FurnitureDefinition) => FurnitureDefinition,
): SelectionMutationResult {
  const selected = new Set(selectedIds);
  if (selected.size === 0) return { accepted: false, layout: layout.map(cloneFurniture) };
  const transformed = layout.map((item) => {
    if (!selected.has(item.id)) return cloneFurniture(item);
    const changed = transform(cloneFurniture(item));
    return { ...changed, point: fitFurniturePointToRoom(room, changed, changed.point) };
  });
  const accepted = transformed
    .filter(({ id }) => selected.has(id))
    .every((item) => diagnoseFinePlacement(room, item, transformed, item.id) === 'valid');
  return { accepted, layout: (accepted ? transformed : layout).map(cloneFurniture) };
}

const duplicateOffsets = (): GridPoint[] => {
  const offsets: GridPoint[] = [{ x: 0.25, y: 0.25 }];
  for (let radius = 1; radius <= 8; radius += 1) {
    const distance = radius * 0.25;
    offsets.push(
      { x: distance, y: 0 }, { x: 0, y: distance },
      { x: -distance, y: 0 }, { x: 0, y: -distance },
      { x: distance, y: distance }, { x: -distance, y: distance },
      { x: distance, y: -distance }, { x: -distance, y: -distance },
    );
  }
  return offsets;
};

export function duplicateFurniture(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  furnitureId: string,
  now: number = Date.now(),
): DuplicateFurnitureResult {
  const source = layout.find(({ id }) => id === furnitureId);
  if (!source) return { accepted: false, layout: layout.map(cloneFurniture), selectedIds: [] };
  const {
    requirementId: _requirementId,
    blocksNavigation: _blocksNavigation,
    ...visualSource
  } = cloneFurniture(source);
  const base: FurnitureDefinition = {
    ...visualSource,
    id: `duplicate-${now}-${source.id}`,
    supportedActions: [],
    icon: 'generic',
  };
  base.blocksNavigation = furnitureBlocksNavigation(base);
  for (const offset of duplicateOffsets()) {
    const point = { x: source.point.x + offset.x, y: source.point.y + offset.y };
    const candidate = resolvePlacementCandidate(room, layout, base, point);
    if (candidate.diagnostic !== 'valid') continue;
    return {
      accepted: true,
      layout: [...layout.map(cloneFurniture), cloneFurniture(candidate.furniture)],
      selectedIds: [source.id, candidate.furniture.id],
    };
  }
  return { accepted: false, layout: layout.map(cloneFurniture), selectedIds: [source.id] };
}

export function createFurniturePrefab(
  name: string,
  selection: readonly FurnitureDefinition[],
  createdAt: number = Date.now(),
): FurniturePrefab {
  const ordinary = selection.filter(({ supportedActions, requirementId }) => supportedActions.length === 0 && !requirementId);
  if (ordinary.length < 2) throw new Error('A prefab requires at least two ordinary furniture items');
  const minX = Math.min(...ordinary.map(({ point }) => point.x));
  const minY = Math.min(...ordinary.map(({ point }) => point.y));
  const bounds = ordinary.map((item) => transformedAlphaBounds(item));
  const right = Math.max(...bounds.map((item) => item.x + item.width));
  const bottom = Math.max(...bounds.map((item) => item.y + item.height));
  const left = Math.min(...bounds.map(({ x }) => x));
  const top = Math.min(...bounds.map(({ y }) => y));
  return {
    id: `prefab-${createdAt}-${ordinary.map(({ assetId }) => assetId ?? 0).join('-')}`,
    name: name.trim() || '未命名組裝件',
    createdAt,
    width: right - left,
    height: bottom - top,
    items: ordinary.map((item) => {
      const { requirementId: _requirementId, ...template } = cloneFurniture(item);
      return {
        ...template,
        id: `template-${item.id}`,
        point: snapFurniturePoint({ x: item.point.x - minX, y: item.point.y - minY }),
        supportedActions: [],
      };
    }),
  };
}
