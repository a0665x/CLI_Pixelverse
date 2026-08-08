import type Phaser from 'phaser';
import type { WorldBuilding } from '../world/types';

export interface PixelRect { x: number; y: number; width: number; height: number }
export type VillageForegroundKind = 'roof' | 'canopy' | 'door-frame';
export interface ForegroundGeometry {
  kind: Extract<VillageForegroundKind, 'roof' | 'door-frame'>;
  bounds: PixelRect;
  baselineY: number;
}
export interface RenderedForeground {
  object: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.Components.Depth;
  bounds: Phaser.Geom.Rectangle;
  baselineY: number;
  kind?: VillageForegroundKind;
}

export function buildingForegroundGeometry(building: WorldBuilding, tileSize: number): ForegroundGeometry[] {
  const frontY = (building.bounds.y + building.bounds.height) * tileSize;
  const thresholdCenterX = building.entrance.threshold.x * tileSize + tileSize / 2;
  return [
    {
      kind: 'roof',
      bounds: {
        x: building.bounds.x * tileSize,
        y: building.bounds.y * tileSize,
        width: building.bounds.width * tileSize,
        height: (building.bounds.height - 1) * tileSize,
      },
      baselineY: frontY - tileSize,
    },
    {
      kind: 'door-frame',
      bounds: {
        x: thresholdCenterX - tileSize,
        y: frontY - tileSize * 2,
        width: tileSize * 2,
        height: tileSize * 2,
      },
      baselineY: frontY,
    },
  ];
}
