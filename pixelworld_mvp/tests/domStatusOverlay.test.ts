import { describe, expect, it } from 'vitest';
import { buildingHitRegionToOverlay } from '../src/rendering/domStatusOverlay';
import type { WorldBuilding } from '../src/world/types';

const building: WorldBuilding = {
  id: 'maker-workshop',
  label: 'Maker Workshop',
  themeId: 'maker-workshop',
  bounds: { x: 10, y: 5, width: 4, height: 3 },
  labelAnchor: { x: 99, y: 99 },
  entrance: {
    outside: { x: 0, y: 0 }, threshold: { x: 0, y: 0 }, entryFacing: 'up', exitFacing: 'down',
  },
};

describe('DOM building hit-region evidence', () => {
  it('maps authoritative world bounds independently of label anchor or label height', () => {
    expect(buildingHitRegionToOverlay(building, {
      left: 10, top: 20, width: 1536, height: 896,
    })).toEqual({ left: 330, top: 180, width: 128, height: 96 });

    expect(buildingHitRegionToOverlay(building, {
      left: 25, top: 40, width: 768, height: 448,
    })).toEqual({ left: 185, top: 120, width: 64, height: 48 });
  });
});
