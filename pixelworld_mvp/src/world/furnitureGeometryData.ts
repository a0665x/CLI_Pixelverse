import type { FurnitureKind } from './types';

const FURNITURE_FOOTPRINTS: Record<FurnitureKind, { width: number; height: number }> = {
  sofa: { width: 2, height: 2 }, chair: { width: 1, height: 1 }, television: { width: 2, height: 2 },
  bed: { width: 2, height: 3 }, bookcase: { width: 2, height: 2 }, computer: { width: 1, height: 2 },
  'map-table': { width: 3, height: 2 }, 'planning-board': { width: 2, height: 2 },
  'reading-desk': { width: 3, height: 2 }, workbench: { width: 3, height: 2 },
  'tool-wall': { width: 2, height: 2 }, 'repair-table': { width: 3, height: 2 },
  'dispatch-pod': { width: 2, height: 2 }, 'radio-console': { width: 2, height: 2 },
  'response-desk': { width: 2, height: 2 }, 'meeting-table': { width: 3, height: 2 },
  decor: { width: 1, height: 1 },
  'office-chair': { width: 1, height: 1 }, display: { width: 2, height: 2 },
  desk: { width: 3, height: 2 }, cabinet: { width: 2, height: 2 }, plant: { width: 1, height: 2 },
  'beverage-station': { width: 1, height: 2 }, printer: { width: 2, height: 2 },
};

export const furnitureFootprint = (kind: FurnitureKind): { width: number; height: number } => ({
  ...FURNITURE_FOOTPRINTS[kind],
});
