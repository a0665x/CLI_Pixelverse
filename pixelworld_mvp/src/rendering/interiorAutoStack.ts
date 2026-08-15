import type { FurnitureDefinition } from '../world/types';
import { furnitureRenderGeometry, resolvedFurnitureAsset, transformedAlphaBounds } from './interiorPlacement';
import { catalogFurnitureRole } from './modernOfficeCatalog';

export type StackRole = 'floor' | 'support' | 'surface' | 'free';
export type StackRoleFurniture = Pick<FurnitureDefinition, 'kind' | 'supportedActions'>
  & Partial<Pick<FurnitureDefinition, 'assetId' | 'layer' | 'zIndex'>>;

const SUPPORT_KINDS = new Set<FurnitureDefinition['kind']>([
  'bookcase', 'computer', 'map-table', 'reading-desk', 'workbench', 'repair-table',
  'dispatch-pod', 'radio-console', 'response-desk', 'meeting-table', 'desk', 'cabinet',
  'beverage-station',
]);

const SURFACE_KINDS = new Set<FurnitureDefinition['kind']>([
  'television', 'display', 'printer',
]);

export function stackRoleForFurniture(item: StackRoleFurniture): StackRole {
  if (item.layer === 'floor') return 'floor';
  if (item.kind === 'sofa' || item.kind === 'bed') return 'free';
  const asset = resolvedFurnitureAsset(item);
  if (item.layer === 'surface') return 'surface';
  if (SUPPORT_KINDS.has(item.kind)) return 'support';
  if (SURFACE_KINDS.has(item.kind)) return 'surface';
  if (!asset) return 'free';
  return catalogFurnitureRole(asset.id);
}

const ROLE_ORDER: Record<StackRole, number> = { floor: 0, support: 1, free: 1, surface: 2 };

export function automaticStackRank(item: StackRoleFurniture): number {
  return ROLE_ORDER[stackRoleForFurniture(item)];
}

export function compareAutomaticStack(first: FurnitureDefinition, second: FurnitureDefinition): number {
  const role = automaticStackRank(first) - automaticStackRank(second);
  if (role !== 0) return role;
  const baseline = transformedAlphaBounds(first).y + transformedAlphaBounds(first).height
    - (transformedAlphaBounds(second).y + transformedAlphaBounds(second).height);
  return baseline || first.id.localeCompare(second.id);
}

export function isCompatibleStackSupport(item: FurnitureDefinition | undefined): item is FurnitureDefinition {
  return item !== undefined && stackRoleForFurniture(item) === 'support';
}

const cloneFurniture = (item: FurnitureDefinition): FurnitureDefinition => ({
  ...item,
  point: { ...item.point },
  supportedActions: [...item.supportedActions],
  ...(item.footprint ? { footprint: { ...item.footprint } } : {}),
  ...(item.visualOffset ? { visualOffset: { ...item.visualOffset } } : {}),
  ...(item.interactionPoint ? { interactionPoint: { ...item.interactionPoint } } : {}),
  ...(item.supportedByIds ? { supportedByIds: [...item.supportedByIds] } : {}),
});

export function resolveAutomaticSupport(
  candidate: FurnitureDefinition,
  layout: readonly FurnitureDefinition[],
): { item: FurnitureDefinition; attachedTo?: string } {
  const item = cloneFurniture(candidate);
  if (stackRoleForFurniture(item) !== 'surface') {
    delete item.supportedByIds;
    return { item };
  }
  const center = furnitureRenderGeometry(item).center;
  const support = layout
    .filter((other) => other.id !== item.id && isCompatibleStackSupport(other))
    .filter((other) => {
      const bounds = transformedAlphaBounds(other);
      return center.x >= bounds.x && center.x <= bounds.x + bounds.width
        && center.y >= bounds.y && center.y <= bounds.y + bounds.height;
    })
    .sort(compareAutomaticStack)
    .at(-1);
  if (!support) {
    delete item.supportedByIds;
    return { item };
  }
  item.supportedByIds = [support.id];
  return { item, attachedTo: support.id };
}

export function stackDependencies(
  itemIds: readonly string[],
  layout: readonly FurnitureDefinition[],
): string[] {
  const dependencies = new Set(itemIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of layout) {
      if (dependencies.has(item.id) || !item.supportedByIds?.some((id) => dependencies.has(id))) continue;
      dependencies.add(item.id);
      changed = true;
    }
  }
  return layout.filter(({ id }) => dependencies.has(id)).map(({ id }) => id);
}
