import type { GridRect } from '../world/types';

interface PixelRect { x: number; y: number; width: number; height: number }
export interface BuildingEaveGeometry { bounds: PixelRect; baselineY: number }

const EAVE_HEIGHT = 28;

export function buildingEaveGeometry(buildingBounds: GridRect, tileSize: number): BuildingEaveGeometry {
  const y = (buildingBounds.y + buildingBounds.height) * tileSize;
  return {
    bounds: {
      x: buildingBounds.x * tileSize,
      y,
      width: buildingBounds.width * tileSize,
      height: EAVE_HEIGHT,
    },
    baselineY: y + EAVE_HEIGHT,
  };
}
