import { describe, expect, it } from 'vitest';
import {
  MODERN_OFFICE_CATALOG,
  allCatalogPages,
  catalogCategories,
  catalogItem,
} from '../src/rendering/modernOfficeCatalog';

describe('Modern Office purchased catalog', () => {
  it('contains all 339 unique singles with usable geometry', () => {
    expect(MODERN_OFFICE_CATALOG).toHaveLength(339);
    expect(new Set(MODERN_OFFICE_CATALOG.map(({ id }) => id))).toHaveProperty('size', 339);
    expect(MODERN_OFFICE_CATALOG.every(({ opaqueBounds, footprint }) => (
      opaqueBounds.width > 0 && opaqueBounds.height > 0 && footprint.width > 0 && footprint.height > 0
    ))).toBe(true);
  });

  it('pages every catalog item once in 24-item pages', () => {
    const items = catalogCategories().flatMap((category) => allCatalogPages(category).flatMap(({ items }) => items));
    expect(items).toHaveLength(339);
    expect(new Set(items.map(({ id }) => id))).toHaveProperty('size', 339);
    expect(allCatalogPages('workstations').every(({ items: page }) => page.length <= 24)).toBe(true);
  });

  it('resolves stable asset paths by numeric ID', () => {
    expect(catalogItem(225)).toMatchObject({
      id: 225,
      key: 'modern-office-v1.2-single-225',
      path: '/assets/private/modern-office-v1.2/Modern_Office_Singles_225.png',
    });
  });
});
