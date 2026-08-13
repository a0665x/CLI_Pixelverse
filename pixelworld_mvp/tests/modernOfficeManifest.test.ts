import { describe, expect, it } from 'vitest';
import {
  MODERN_OFFICE_ASSETS,
  modernOfficeAsset,
  type ModernOfficeFurnitureKind,
} from '../src/rendering/modernOfficeManifest';
import { catalogItem } from '../src/rendering/modernOfficeCatalog';
import { resolvedFurnitureAsset } from '../src/rendering/interiorPlacement';

describe('private Modern Office v1.2 manifest', () => {
  it('keeps every office furnishing in the purchased asset family', () => {
    expect(MODERN_OFFICE_ASSETS.atlas.path).toBe('/assets/private/modern-office-v1.2/Modern_Office_16x16.png');
    expect(MODERN_OFFICE_ASSETS.roomBuilder.path).toContain('Room_Builder_Office_16x16.png');
    const kinds: ModernOfficeFurnitureKind[] = [
      'sofa', 'office-chair', 'computer', 'bookcase', 'whiteboard', 'display',
      'desk', 'meeting-table', 'cabinet', 'plant', 'beverage-station', 'printer',
    ];
    kinds.forEach((kind) => {
      expect(modernOfficeAsset(kind).key).toMatch(/^modern-office-v1\.2-/);
      expect(modernOfficeAsset(kind).path).toMatch(/^\/assets\/private\/modern-office-v1\.2\//);
    });
  });

  it('resolves every meeting-table fallback to the real table surface rather than divider 207', () => {
    const manifest = modernOfficeAsset('meeting-table');
    const assetId = Number(manifest.path.match(/Singles_(\d+)\.png$/)?.[1]);
    const catalog = catalogItem(assetId);
    const placement = resolvedFurnitureAsset({ kind: 'meeting-table' });

    expect(assetId).toBe(4);
    expect(placement?.id).toBe(assetId);
    expect(catalog).toMatchObject({ id: 4, category: 'surfaces' });
    expect(catalog?.label).toMatch(/table|surface/i);
    expect(catalog?.label).not.toMatch(/divider|partition|storage/i);
  });
});
