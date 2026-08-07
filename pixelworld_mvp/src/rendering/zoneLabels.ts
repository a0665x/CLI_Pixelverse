import type { GridPoint, WorldZone } from '../world/types';

export interface ZoneLabelDefinition {
  id: string;
  label: string;
  anchor: GridPoint;
}

export function zoneLabelDefinitions(zones: readonly WorldZone[]): ZoneLabelDefinition[] {
  return zones.map((zone) => ({
    id: zone.id,
    label: zone.label,
    anchor: {
      x: zone.bounds.x + zone.bounds.width / 2,
      y: zone.bounds.y + 0.25,
    },
  }));
}
