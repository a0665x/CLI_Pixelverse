import type Phaser from 'phaser';
import type { WorldBuilding } from '../world/types';

export interface PixelRect { x: number; y: number; width: number; height: number }
export type VillageForegroundKind = 'roof' | 'canopy' | 'door-frame';
export interface ForegroundGeometry {
  kind: Extract<VillageForegroundKind, 'roof' | 'door-frame'>;
  bounds: PixelRect;
  baselineY: number;
}
export interface ForegroundRenderable {
  alpha: number;
  depth: number;
  setAlpha(alpha: number): ForegroundRenderable;
  setDepth(depth: number): ForegroundRenderable;
}
export interface RenderedForeground {
  object: ForegroundRenderable;
  bounds: Phaser.Geom.Rectangle;
  baselineY: number;
  kind?: VillageForegroundKind;
}

export function buildingForegroundGeometry(building: WorldBuilding, tileSize: number): ForegroundGeometry[] {
  const frontY = (building.bounds.y + building.bounds.height) * tileSize;
  return [
    {
      kind: 'roof',
      bounds: {
        x: building.bounds.x * tileSize,
        y: building.bounds.y * tileSize,
        width: building.bounds.width * tileSize,
        height: 2 * tileSize,
      },
      baselineY: (building.bounds.y + 2) * tileSize,
    },
    {
      kind: 'door-frame',
      bounds: {
        x: building.entrance.threshold.x * tileSize,
        y: building.entrance.threshold.y * tileSize,
        width: tileSize,
        height: tileSize,
      },
      baselineY: frontY,
    },
  ];
}
