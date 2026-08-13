import { describe, expect, it } from 'vitest';
import { furnitureCells } from '../src/rendering/interiorLayoutEditor';
import { interiorPath } from '../src/rendering/interiorMotion';
import { interiorInteractionPoint, officeLayoutIssues } from '../src/rendering/prefabGeometry';
import { INTERIOR_DEFINITIONS } from '../src/world/interiorDefinitions';

const workThemes = ['research-library', 'maker-workshop', 'collaboration-barn'] as const;

const supportZoneIds = {
  'research-library': [
    'research-service-storage', 'research-service-bookcase', 'research-service-printer',
    'research-service-planning-board', 'research-support-meeting',
  ],
  'maker-workshop': [
    'maker-service-storage', 'maker-service-bookcase', 'maker-service-printer',
    'maker-service-planning-board', 'maker-support-meeting',
  ],
  'collaboration-barn': [
    'collab-service-storage', 'collab-service-bookcase', 'collab-service-device',
    'collab-service-planning-board', 'collab-support-meeting',
  ],
} as const;

describe('hybrid work-office room validation', () => {
  it.each(workThemes)('%s passes complete opaque geometry and route validation', (themeId) => {
    const room = INTERIOR_DEFINITIONS[themeId];
    const door = { x: Math.floor(room.width / 2), y: room.height - 1 };

    expect(officeLayoutIssues(room)).toEqual([]);
    room.furniture.filter(({ supportedActions }) => supportedActions.length > 0).forEach((item) => {
      const target = interiorInteractionPoint(room, item);
      const path = interiorPath(room, door, target, item.id);

      expect(path.length, `${themeId}:${item.id}`).toBeGreaterThanOrEqual(2);
      expect(path.at(-1), `${themeId}:${item.id}`).toEqual(target);
    });
  });

  it.each(workThemes)('%s preserves the two-wide entrance and central aisle', (themeId) => {
    const room = INTERIOR_DEFINITIONS[themeId];
    const blocked = new Set(room.furniture.flatMap(furnitureCells).map(({ x, y }) => `${x},${y}`));

    for (let y = 0; y < room.height; y += 1) {
      expect(blocked.has(`8,${y}`), `${themeId}:left aisle @ y=${y}`).toBe(false);
      expect(blocked.has(`9,${y}`), `${themeId}:right aisle @ y=${y}`).toBe(false);
    }
  });

  it.each(workThemes)('%s has aligned services and a compact collaboration zone', (themeId) => {
    const room = INTERIOR_DEFINITIONS[themeId];
    const expectedIds = supportZoneIds[themeId];
    const byId = new Map(room.furniture.map((item) => [item.id, item]));
    const backWallServices = expectedIds.slice(0, 4).map((id) => byId.get(id));

    expect(expectedIds.every((id) => byId.has(id))).toBe(true);
    expect(backWallServices.every((item) => item?.point.y === 1)).toBe(true);
    expect(byId.get(expectedIds[4])?.kind).toBe('meeting-table');
    expect(backWallServices.every((item) => item?.assetId !== undefined)).toBe(true);
  });

  it.each(workThemes)('%s keeps every surface item nonblocking', (themeId) => {
    const surfaces = INTERIOR_DEFINITIONS[themeId].furniture.filter(({ layer }) => layer === 'surface');

    expect(surfaces.length).toBeGreaterThan(0);
    expect(surfaces.every(({ blocksNavigation }) => blocksNavigation === false)).toBe(true);
  });
});
