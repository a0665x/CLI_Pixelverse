import { describe, expect, it } from 'vitest';
import {
  MODERN_OFFICE_COMPOSITE_RECIPES,
  MODERN_OFFICE_ASSET_CLASSIFICATION,
  consumedCompositeAssetIds,
  modernOfficeCompositePrefabs,
  isModernOfficeCompositeInstanceId,
  validateCompositeRecipes,
  visibleCatalogPage,
  visiblePrefabPage,
} from '../src/rendering/modernOfficeCompositeCatalog';

describe('Modern Office complete furniture recipes', () => {
  it('assembles the first storage modular families as atomic furniture', () => {
    expect(MODERN_OFFICE_COMPOSITE_RECIPES.map(({ parts }) => parts.map(({ assetId }) => assetId))).toEqual([
      [179, 180, 181],
      [182, 183, 184],
      [185, 186, 187],
    ]);
    expect(modernOfficeCompositePrefabs.every(({ items }) => items.length === 3)).toBe(true);
    expect(modernOfficeCompositePrefabs.every(({ immutable, source }) => immutable && source === 'modern-office-v1.2')).toBe(true);
  });

  it('keeps purchased composite instances atomic while user groups remain dissolvable', () => {
    expect(isModernOfficeCompositeInstanceId('prefab-12-modern-office-storage-run-dark-0')).toBe(true);
    expect(isModernOfficeCompositeInstanceId('prefab-12-user-group-12-1-0')).toBe(false);
    expect(isModernOfficeCompositeInstanceId(undefined)).toBe(false);
  });

  it('hides every consumed fragment from ordinary storage pages', () => {
    const visibleIds = Array.from({ length: 20 }, (_, page) => visibleCatalogPage('storage-partitions', page, 12).items)
      .flat().map(({ id }) => id);
    expect(visibleIds.filter((id) => consumedCompositeAssetIds.has(id))).toEqual([]);
    expect([...consumedCompositeAssetIds].sort((a, b) => a - b)).toEqual([179, 180, 181, 182, 183, 184, 185, 186, 187]);
  });

  it('validates unique recipes, source assets, finite offsets, and geometry', () => {
    expect(validateCompositeRecipes()).toEqual([]);
    expect(new Set(MODERN_OFFICE_COMPOSITE_RECIPES.map(({ id }) => id)).size).toBe(MODERN_OFFICE_COMPOSITE_RECIPES.length);
  });

  it('classifies all 339 purchased singles exactly once after visual audit', () => {
    expect(MODERN_OFFICE_ASSET_CLASSIFICATION).toHaveLength(339);
    expect(new Set(MODERN_OFFICE_ASSET_CLASSIFICATION.map(({ assetId }) => assetId)).size).toBe(339);
    expect(MODERN_OFFICE_ASSET_CLASSIFICATION.filter(({ kind }) => kind === 'composite').map(({ assetId }) => assetId))
      .toEqual([179, 180, 181, 182, 183, 184, 185, 186, 187]);
  });

  it('paginates every persisted user group instead of stranding groups after the first shelf', () => {
    const users = Array.from({ length: 13 }, (_, index) => ({
      ...modernOfficeCompositePrefabs[0]!, id: `user-${index}`, name: `Group ${index + 1}`,
      source: 'user' as const, immutable: false,
    }));
    expect(visiblePrefabPage(users, 'grouped', 0, 12).items).toHaveLength(12);
    expect(visiblePrefabPage(users, 'grouped', 1, 12)).toMatchObject({ page: 1, totalPages: 2 });
    expect(visiblePrefabPage(users, 'grouped', 1, 12).items.map(({ id }) => id)).toEqual(['user-12']);
    expect(visiblePrefabPage(users.slice(0, 12), 'grouped', 1, 12).page).toBe(0);
  });
});
