import { describe, expect, it } from 'vitest';
import { officeLayoutIssues } from '../src/rendering/prefabGeometry';
import { interiorDefinitionForBuilding } from '../src/world/interiorDefinitions';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

const compactFurnitureIds = {
  'arrival-lodge': [
    'collab-dispatch-a', 'collab-display-a', 'collab-dispatch-b', 'collab-display-b',
    'collab-radio-a', 'collab-radio-screen-a', 'collab-radio-b', 'collab-radio-screen-b',
    'collab-chair-a', 'collab-chair-b', 'collab-chair-c', 'collab-chair-d', 'collab-meeting-rug',
    'collab-meeting', 'collab-meeting-notes', 'collab-meeting-chair-w', 'collab-meeting-chair-e',
    'collab-meeting-chair-s', 'collab-message-board', 'collab-storage-a', 'collab-storage-b',
  ],
  'awaiting-post': [
    'collab-dispatch-a', 'collab-display-a', 'collab-dispatch-b', 'collab-display-b',
    'collab-radio-a', 'collab-radio-screen-a', 'collab-radio-b', 'collab-radio-screen-b',
    'collab-chair-a', 'collab-chair-b', 'collab-chair-c', 'collab-chair-d', 'collab-meeting-rug',
    'collab-meeting', 'collab-meeting-notes', 'collab-meeting-chair-w', 'collab-meeting-chair-e',
    'collab-meeting-chair-s', 'collab-message-board', 'collab-storage-a', 'collab-storage-b',
  ],
  'offline-dormitory': [
    'rest-rug', 'rest-sofa-a', 'rest-sofa-b', 'rest-coffee-table', 'rest-coffee-cups', 'rest-tv',
    'rest-bed-a', 'rest-bed-b', 'rest-bedside-a', 'rest-bedside-b', 'rest-lamp', 'rest-plant',
    'rest-blocked-board',
  ],
  'rest-cabin': [
    'rest-rug', 'rest-sofa-a', 'rest-sofa-b', 'rest-coffee-table', 'rest-coffee-cups', 'rest-tv',
    'rest-bed-a', 'rest-bed-b', 'rest-bedside-a', 'rest-bedside-b', 'rest-lamp', 'rest-plant',
    'rest-blocked-board',
  ],
} as const;

describe('compact interior preservation', () => {
  it.each(Object.entries(compactFurnitureIds))('%s retains its 14x9 authored compact profile', (buildingId, expectedIds) => {
    const building = WORLD_DEFINITION.buildings.find(({ id }) => id === buildingId)!;
    const room = interiorDefinitionForBuilding(building);

    expect(building.interiorProfile).toBe('compact');
    expect(room).toMatchObject({ width: 14, height: 9 });
    expect(room.furniture.map(({ id }) => id)).toEqual(expectedIds);
    expect(officeLayoutIssues(room)).toEqual([]);
  });
});
