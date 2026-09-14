import { describe, expect, it } from 'vitest';
import { officeLayoutIssues } from '../src/rendering/prefabGeometry';
import { interiorDefinitionForBuilding } from '../src/world/interiorDefinitions';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

const compactBuildings = ['arrival-lodge', 'awaiting-post', 'offline-dormitory', 'rest-cabin'];

describe('compact interior preservation', () => {
  it.each(compactBuildings)('%s retains its 14x9 authored compact profile', (buildingId) => {
    const building = WORLD_DEFINITION.buildings.find(({ id }) => id === buildingId)!;
    const room = interiorDefinitionForBuilding(building);

    expect(building.interiorProfile).toBe('compact');
    expect(room).toMatchObject({ width: 14, height: 9 });
    expect(room.furniture.length).toBeGreaterThanOrEqual(6);
    expect(room.furniture.every(({ id }) => id.startsWith(buildingId))).toBe(true);
    expect(officeLayoutIssues(room)).toEqual([]);
  });
});
