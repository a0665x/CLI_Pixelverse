import type {
  FurnitureDefinition,
  FurnitureRotation,
  FurnitureScale,
  OfficePrefabDefinition,
} from '../world/types';
import {
  MODERN_OFFICE_CATALOG,
  catalogItem,
  type ModernOfficeCatalogItem,
  type ModernOfficeCatalogRole,
  type ModernOfficeCategory,
} from './modernOfficeCatalog';

export type InteriorCatalogCategory = ModernOfficeCategory | 'grouped';

export interface ModernOfficeCompositeRecipe {
  id: string;
  label: string;
  role: ModernOfficeCatalogRole;
  defaultRotation: FurnitureRotation;
  defaultScale: FurnitureScale;
  parts: ReadonlyArray<{ assetId: number; offset: { x: number; y: number } }>;
}

export const MODERN_OFFICE_COMPOSITE_RECIPES: readonly ModernOfficeCompositeRecipe[] = Object.freeze([
  {
    id: 'modern-office-storage-run-dark', label: 'Dark Storage Run', role: 'support',
    defaultRotation: 0, defaultScale: 1,
    parts: [{ assetId: 179, offset: { x: 0, y: 0 } }, { assetId: 180, offset: { x: 1, y: 0 } }, { assetId: 181, offset: { x: 2, y: 0 } }],
  },
  {
    id: 'modern-office-storage-run-blue', label: 'Blue Storage Run', role: 'support',
    defaultRotation: 0, defaultScale: 1,
    parts: [{ assetId: 182, offset: { x: 0, y: 0 } }, { assetId: 183, offset: { x: 1, y: 0 } }, { assetId: 184, offset: { x: 2, y: 0 } }],
  },
  {
    id: 'modern-office-storage-run-light', label: 'Light Storage Run', role: 'support',
    defaultRotation: 0, defaultScale: 1,
    parts: [{ assetId: 185, offset: { x: 0, y: 0 } }, { assetId: 186, offset: { x: 1, y: 0 } }, { assetId: 187, offset: { x: 2, y: 0 } }],
  },
]);

export const consumedCompositeAssetIds = new Set(
  MODERN_OFFICE_COMPOSITE_RECIPES.flatMap(({ parts }) => parts.map(({ assetId }) => assetId)),
);

const recipeIdByAsset = new Map(
  MODERN_OFFICE_COMPOSITE_RECIPES.flatMap(({ id, parts }) => parts.map(({ assetId }) => [assetId, id] as const)),
);

// Audited against the provisioned v1.2 singles contact sheets. Each source asset is classified once;
// composite parts are authoring-only while standalone assets remain directly selectable.
export const MODERN_OFFICE_ASSET_CLASSIFICATION = Object.freeze(MODERN_OFFICE_CATALOG.map(({ id }) => {
  const recipeId = recipeIdByAsset.get(id);
  return recipeId ? { assetId: id, kind: 'composite' as const, recipeId } : { assetId: id, kind: 'standalone' as const };
}));

const SOURCE_TILE_PIXELS = 16;

const compositeItem = (
  recipe: ModernOfficeCompositeRecipe,
  asset: ModernOfficeCatalogItem,
  index: number,
  offset: { x: number; y: number },
): FurnitureDefinition => ({
  id: `${recipe.id}-part-${index + 1}`,
  kind: 'cabinet',
  point: { ...offset },
  facing: 'down',
  supportedActions: [],
  icon: 'generic',
  scale: recipe.defaultScale,
  rotation: recipe.defaultRotation,
  assetId: asset.id,
  footprint: { ...asset.footprint },
  visualOffset: {
    x: asset.visualOffset.x / SOURCE_TILE_PIXELS,
    y: asset.visualOffset.y / SOURCE_TILE_PIXELS,
  },
  layer: recipe.role === 'floor' ? 'floor' : recipe.role === 'surface' ? 'surface' : 'furniture',
  zIndex: index,
  blocksNavigation: recipe.role === 'support',
});

const asCompositePrefab = (recipe: ModernOfficeCompositeRecipe): OfficePrefabDefinition => {
  const items = recipe.parts.map((part, index) => {
    const asset = catalogItem(part.assetId);
    if (!asset) throw new Error(`Missing Modern Office composite asset ${part.assetId}`);
    return compositeItem(recipe, asset, index, part.offset);
  });
  const maxX = Math.max(...items.map(({ point, footprint }) => point.x + (footprint?.width ?? 1)));
  const maxY = Math.max(...items.map(({ point, footprint }) => point.y + (footprint?.height ?? 1)));
  return Object.freeze({
    id: recipe.id,
    name: recipe.label,
    createdAt: 0,
    width: maxX,
    height: maxY,
    items: Object.freeze(items.map((item) => Object.freeze(item))) as unknown as FurnitureDefinition[],
    source: 'modern-office-v1.2',
    immutable: true,
    category: 'support',
    hookActions: [],
    anchor: { x: 0, y: 0 },
    interactionAnchors: [],
  });
};

export const modernOfficeCompositePrefabs: readonly OfficePrefabDefinition[] = Object.freeze(
  MODERN_OFFICE_COMPOSITE_RECIPES.map(asCompositePrefab),
);

export function isModernOfficeCompositeInstanceId(instanceId: string | undefined): boolean {
  return Boolean(instanceId && MODERN_OFFICE_COMPOSITE_RECIPES.some(({ id }) => instanceId.includes(`-${id}-`)));
}

export function visibleCatalogPage(category: InteriorCatalogCategory, page: number, pageSize = 24) {
  if (category === 'grouped') return { page: 0, totalPages: 1, items: [] as ModernOfficeCatalogItem[] };
  const matching = MODERN_OFFICE_CATALOG.filter((item) => (
    item.category === category && !consumedCompositeAssetIds.has(item.id)
  ));
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize));
  const safePage = Math.max(0, Math.min(totalPages - 1, page));
  return { page: safePage, totalPages, items: matching.slice(safePage * pageSize, (safePage + 1) * pageSize) };
}

export function visiblePrefabPage(
  prefabs: readonly OfficePrefabDefinition[],
  category: InteriorCatalogCategory,
  page: number,
  pageSize = 12,
) {
  const matching = category === 'grouped'
    ? prefabs.filter(({ source }) => source === 'user')
    : category === 'workstations'
      ? prefabs.filter(({ source, category: prefabCategory }) => source === 'modern-office-v1.2' && prefabCategory !== 'support')
      : category === 'storage-partitions'
        ? prefabs.filter(({ id }) => id.startsWith('modern-office-storage-run-'))
        : [];
  const size = Math.max(1, Math.trunc(pageSize));
  const totalPages = Math.max(1, Math.ceil(matching.length / size));
  const safePage = Math.max(0, Math.min(totalPages - 1, Math.trunc(page)));
  return { page: safePage, totalPages, items: matching.slice(safePage * size, (safePage + 1) * size) };
}

export function validateCompositeRecipes(): string[] {
  const issues: string[] = [];
  const recipeIds = new Set<string>();
  const assetIds = new Set<number>();
  for (const recipe of MODERN_OFFICE_COMPOSITE_RECIPES) {
    if (recipeIds.has(recipe.id)) issues.push(`duplicate-recipe:${recipe.id}`);
    recipeIds.add(recipe.id);
    if (recipe.parts.length < 2) issues.push(`not-composite:${recipe.id}`);
    for (const part of recipe.parts) {
      if (!catalogItem(part.assetId)) issues.push(`missing-asset:${part.assetId}`);
      if (assetIds.has(part.assetId)) issues.push(`duplicate-asset:${part.assetId}`);
      assetIds.add(part.assetId);
      if (!Number.isFinite(part.offset.x) || !Number.isFinite(part.offset.y)) issues.push(`invalid-offset:${part.assetId}`);
    }
  }
  return issues;
}
