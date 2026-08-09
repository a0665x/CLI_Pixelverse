import { describe, expect, it } from 'vitest';
import {
  MODERN_OFFICE_ASSETS,
  modernOfficeAsset,
  type ModernOfficeFurnitureKind,
} from '../src/rendering/modernOfficeManifest';

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
});
