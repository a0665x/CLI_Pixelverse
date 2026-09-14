import { BED_MATTRESS } from './villageBed';
import type { ModernOfficeCatalogItem } from './modernOfficeCatalog';
import type { FurnitureAlphaMask } from './furnitureAlphaMasks';

// Existing bundled LimeZu sprites; source pixels and opaque masks stay aligned.
export const VILLAGE_FURNITURE_CATALOG: readonly ModernOfficeCatalogItem[] = [
  {
    "id": 1001,
    "key": "village-furniture-bed",
    "path": "/assets/limezu/modern-interiors-free/bed.png",
    "label": "Village Bed",
    "category": "seating-plants",
    "opaqueBounds": {
      "x": 3,
      "y": 0,
      "width": 42,
      "height": 48
    },
    "footprint": {
      "width": 2,
      "height": 3
    },
    "visualOffset": {
      "x": 0,
      "y": 0
    },
    "sourceWidth": 48,
    "sourceHeight": 48
  },
  {
    "id": 1002,
    "key": "village-furniture-bookcase",
    "path": "/assets/limezu/modern-interiors-free/bookcase.png",
    "label": "Village Bookcase",
    "category": "storage-partitions",
    "opaqueBounds": {
      "x": 0,
      "y": 0,
      "width": 32,
      "height": 32
    },
    "footprint": {
      "width": 2,
      "height": 2
    },
    "visualOffset": {
      "x": 0,
      "y": 0
    },
    "sourceWidth": 32,
    "sourceHeight": 32
  },
  {
    "id": 1004,
    "key": "village-furniture-sofa",
    "path": "/assets/limezu/modern-interiors-free/sofa.png",
    "label": "Village Sofa",
    "category": "seating-plants",
    "opaqueBounds": {
      "x": 0,
      "y": 0,
      "width": 32,
      "height": 26
    },
    "footprint": {
      "width": 2,
      "height": 2
    },
    "visualOffset": {
      "x": 0,
      "y": 0
    },
    "sourceWidth": 32,
    "sourceHeight": 32
  },
  {
    "id": 1006,
    "key": "village-furniture-chair",
    "path": "/assets/limezu/modern-interiors-free/chair.png",
    "label": "Village Chair",
    "category": "seating-plants",
    "opaqueBounds": {
      "x": 1,
      "y": 0,
      "width": 14,
      "height": 19
    },
    "footprint": {
      "width": 1,
      "height": 1
    },
    "visualOffset": {
      "x": 0,
      "y": 0
    },
    "sourceWidth": 16,
    "sourceHeight": 32
  },
  {
    "id": 1007,
    "key": "village-furniture-table",
    "path": "/assets/limezu/modern-interiors-free/table.png",
    "label": "Village Table",
    "category": "surfaces",
    "opaqueBounds": {
      "x": 5,
      "y": 8,
      "width": 38,
      "height": 21
    },
    "footprint": {
      "width": 2,
      "height": 1
    },
    "visualOffset": {
      "x": 0,
      "y": 0
    },
    "sourceWidth": 48,
    "sourceHeight": 32
  }
];
export const VILLAGE_FURNITURE_MASKS = new Map<number, FurnitureAlphaMask>(Object.entries({"1001":{"width":48,"height":48,"runs":[[0,3,45],[1,3,45],[2,3,45],[3,3,45],[4,3,45],[5,3,45],[6,3,45],[7,3,45],[8,3,45],[9,3,45],[10,3,45],[11,3,45],[12,3,45],[13,3,45],[14,3,45],[15,3,45],[16,3,45],[17,3,45],[18,3,16],[18,32,45],[19,3,16],[19,32,45],[20,3,16],[20,32,45],[21,3,16],[21,32,45],[22,3,16],[22,32,45],[23,3,16],[23,32,45],[24,3,16],[24,32,45],[25,3,16],[25,32,45],[26,3,16],[26,32,45],[27,3,16],[27,32,45],[28,3,16],[28,32,45],[29,3,16],[29,32,45],[30,3,16],[30,32,45],[31,3,16],[31,32,45],[32,3,45],[33,3,45],[34,3,45],[35,3,45],[36,3,45],[37,3,45],[38,3,45],[39,3,45],[40,3,45],[41,3,45],[42,3,45],[43,3,45],[44,3,45],[45,3,45],[46,3,45],[47,4,44]]},"1002":{"width":32,"height":32,"runs":[[0,0,6],[0,25,31],[1,0,31],[2,0,31],[3,0,31],[4,0,31],[5,0,31],[6,0,31],[7,0,31],[8,0,31],[9,0,31],[10,0,31],[11,0,31],[12,0,31],[13,0,31],[14,0,31],[15,0,31],[16,0,31],[17,0,31],[18,0,31],[19,0,31],[20,0,31],[21,0,31],[22,0,31],[23,0,31],[24,0,31],[25,0,31],[26,0,32],[27,0,32],[28,0,32],[29,0,32],[30,0,32],[31,0,32]]},"1004":{"width":32,"height":32,"runs":[[0,0,4],[0,28,32],[1,0,32],[2,0,32],[3,0,32],[4,0,32],[5,0,32],[6,0,32],[7,0,32],[8,0,32],[9,0,32],[10,0,32],[11,0,32],[12,0,32],[13,0,32],[14,0,32],[15,0,32],[16,0,32],[17,0,32],[18,0,32],[19,0,32],[20,0,32],[21,0,32],[22,0,32],[23,0,32],[24,0,32],[25,0,32]]},"1006":{"width":16,"height":32,"runs":[[0,2,14],[1,2,14],[2,2,14],[3,2,5],[3,11,14],[4,2,5],[4,11,14],[5,2,14],[6,2,14],[7,1,15],[8,1,15],[9,1,15],[10,1,15],[11,1,15],[12,1,15],[13,1,15],[14,1,15],[15,1,15],[16,1,15],[17,1,15],[18,1,15]]},"1007":{"width":48,"height":32,"runs":[[8,7,41],[9,6,42],[10,5,43],[11,5,43],[12,5,43],[13,5,43],[14,5,43],[15,5,43],[16,5,43],[17,5,43],[18,5,43],[19,5,43],[20,5,43],[21,5,43],[22,5,43],[23,5,43],[24,5,43],[25,6,42],[26,6,42],[27,6,42],[28,7,11],[28,37,41]]}}).map(([id, mask]) => [Number(id), { ...mask, runs: mask.runs as [number, number, number][] }]));

const bedMask = VILLAGE_FURNITURE_MASKS.get(1001)!;
const bedRuns: [number, number, number][] = [];
for (let y = 0; y < bedMask.height; y++) {
  const occupied = Array.from({ length: bedMask.width }, (_, x) => (
    bedMask.runs.some(([row, start, end]) => row === y && x >= start && x < end)
    || (x >= BED_MATTRESS.x && x < BED_MATTRESS.x + BED_MATTRESS.width
      && y >= BED_MATTRESS.y && y < BED_MATTRESS.y + BED_MATTRESS.height)
  ));
  let start = -1;
  for (let x = 0; x <= occupied.length; x++) {
    if (occupied[x] && start < 0) start = x;
    if (!occupied[x] && start >= 0) { bedRuns.push([y, start, x]); start = -1; }
  }
}
VILLAGE_FURNITURE_MASKS.set(1001, { ...bedMask, runs: bedRuns });
