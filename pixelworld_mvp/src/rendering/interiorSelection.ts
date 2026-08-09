import type { FurnitureDefinition, FurniturePrefab, GridPoint } from '../world/types';
import { snapFurniturePoint, transformedAlphaBounds, type FurnitureBounds } from './interiorPlacement';

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
