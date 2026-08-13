import { describe, expect, it } from 'vitest';
import { furnitureCells } from '../src/rendering/interiorLayoutEditor';
import { resolvedFurnitureAsset } from '../src/rendering/interiorPlacement';
import { interiorPath } from '../src/rendering/interiorMotion';
import { interiorInteractionPoint, officeLayoutIssues } from '../src/rendering/prefabGeometry';
import { catalogItem } from '../src/rendering/modernOfficeCatalog';
import { INTERIOR_DEFINITIONS } from '../src/world/interiorDefinitions';
import type { FurnitureDefinition, FurnitureLayer, InteriorDefinition } from '../src/world/types';

const workThemes = ['research-library', 'maker-workshop', 'collaboration-barn'] as const;

const supportZoneIds = {
  'research-library': [
    'research-archive-west', 'research-archive-center', 'research-archive-east',
    'research-reference-device', 'research-reading-console',
  ],
  'maker-workshop': [
    'maker-service-bookcase', 'maker-equipment-cabinet', 'maker-service-planning-board',
    'maker-repair-printer-station', 'maker-work-tool-wall',
  ],
  'collaboration-barn': [
    'collab-dispatch-console', 'collab-response-console', 'collab-communication-credenza',
    'collab-meeting-table-west', 'collab-meeting-table-center', 'collab-meeting-table-east',
  ],
} as const;

const supportItems = (themeId: typeof workThemes[number]) => (
  INTERIOR_DEFINITIONS[themeId].furniture.filter(({ prefabInstanceId }) => prefabInstanceId === undefined)
);

const testFurniture = (
  id: string,
  assetId: number,
  layer: FurnitureLayer,
  blocksNavigation: boolean,
): FurnitureDefinition => ({
  id, assetId, kind: layer === 'surface' ? 'display' : 'desk', point: { x: 1, y: 1 }, facing: 'up',
  supportedActions: [], icon: 'generic', layer, blocksNavigation,
});

const validationRoom = (furniture: FurnitureDefinition[]): InteriorDefinition => ({
  id: 'research-library', label: 'Validation room', width: 8, height: 8,
  floor: 'wood', wall: 'blue', furniture, overflow: [],
});

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

  it.each(workThemes)('%s has its reviewed semantic support zone', (themeId) => {
    const room = INTERIOR_DEFINITIONS[themeId];
    const expectedIds = supportZoneIds[themeId];
    const byId = new Map(room.furniture.map((item) => [item.id, item]));

    expect(expectedIds.every((id) => byId.has(id))).toBe(true);
    expect(expectedIds.every((id) => byId.get(id)?.assetId !== undefined)).toBe(true);
  });

  it('uses genuinely different source assets and spatial patterns for each theme support zone', () => {
    const sets = new Map(workThemes.map((themeId) => [
      themeId,
      new Set(supportItems(themeId).flatMap(({ assetId }) => assetId === undefined ? [] : [assetId])),
    ]));
    const positions = workThemes.map((themeId) => supportItems(themeId)
      .map(({ point }) => `${point.x},${point.y}`).sort().join('|'));

    expect([...sets.get('research-library')!]).toEqual(expect.arrayContaining([199, 200, 204, 225]));
    expect([...sets.get('maker-workshop')!]).toEqual(expect.arrayContaining([168, 170, 175, 323]));
    expect([...sets.get('collaboration-barn')!]).toEqual(expect.arrayContaining([4, 165, 311, 312]));
    for (const themeId of workThemes) {
      const others = new Set(workThemes.filter((candidate) => candidate !== themeId)
        .flatMap((candidate) => [...sets.get(candidate)!]));
      expect([...sets.get(themeId)!].filter((assetId) => !others.has(assetId)).length, themeId).toBeGreaterThanOrEqual(3);
    }
    expect(new Set(positions).size).toBe(3);
  });

  it('builds the collaboration meeting assembly only from catalog-semantic table surfaces', () => {
    const meeting = supportItems('collaboration-barn').filter(({ id }) => id.includes('meeting-table'));
    const room = INTERIOR_DEFINITIONS['collaboration-barn'];
    const chairs = room.furniture.filter(({ id }) => id.includes('meeting-chair'));
    const notes = room.furniture.find(({ id }) => id === 'collab-meeting-notes')!;
    const center = room.furniture.find(({ id }) => id === 'collab-meeting-table-center')!;

    expect(meeting).toHaveLength(3);
    for (const item of meeting) {
      const asset = catalogItem(item.assetId!)!;
      expect(asset.label, item.id).toMatch(/table|surface/i);
      expect(asset.label, item.id).not.toMatch(/divider|partition|storage/i);
      expect(asset.category, item.id).toBe('surfaces');
      expect(asset.opaqueBounds.width, item.id).toBeGreaterThan(asset.opaqueBounds.height);
    }
    expect(resolvedFurnitureAsset({ kind: 'meeting-table' })?.id).toBe(4);
    expect(chairs).toHaveLength(4);
    expect(chairs.every((chair) => meeting.some((table) => (
      table.point.x === chair.point.x
      && (chair.facing === 'down' ? table.point.y > chair.point.y : table.point.y < chair.point.y)
    )))).toBe(true);
    expect(notes).toMatchObject({ layer: 'surface', point: center.point, supportedByIds: [center.id] });
  });

  it.each(workThemes)('%s keeps every surface item nonblocking', (themeId) => {
    const surfaces = INTERIOR_DEFINITIONS[themeId].furniture.filter(({ layer }) => layer === 'surface');

    expect(surfaces.length).toBeGreaterThan(0);
    expect(surfaces.every(({ blocksNavigation }) => blocksNavigation === false)).toBe(true);
  });

  it('rejects significant opaque overlap between unrelated nonblocking sprites with both bounds and cells', () => {
    const first = testFurniture('loose-monitor', 129, 'surface', false);
    const second = testFurniture('loose-printer', 148, 'surface', false);
    const issue = officeLayoutIssues(validationRoom([first, second]))
      .find(({ diagnostic }) => diagnostic === 'overlap');

    expect(issue).toMatchObject({ furnitureId: 'loose-printer', conflictingId: 'loose-monitor' });
    expect(issue?.bounds).toBeDefined();
    expect(issue?.conflictingBounds).toBeDefined();
    expect(issue?.cells?.length).toBeGreaterThan(0);
    expect(issue?.conflictingCells?.length).toBeGreaterThan(0);
  });

  it('allows a declared surface accessory to overlap only its supporting desk', () => {
    const desk = testFurniture('support-desk', 247, 'furniture', true);
    const monitor = {
      ...testFurniture('supported-monitor', 129, 'surface', false),
      supportedByIds: ['support-desk'],
    } as FurnitureDefinition & { supportedByIds: string[] };

    expect(officeLayoutIssues(validationRoom([desk, monitor]))
      .filter(({ diagnostic }) => diagnostic === 'overlap')).toEqual([]);
  });

  it('reports aisle blockage with an exact point, columns, item IDs, bounds, and cells', () => {
    const left = { ...testFurniture('aisle-left', 247, 'furniture', true), point: { x: 3, y: 4 } };
    const right = { ...testFurniture('aisle-right', 247, 'furniture', true), point: { x: 4, y: 4 } };
    const issue = officeLayoutIssues(validationRoom([left, right]))
      .find(({ diagnostic }) => diagnostic === 'unreachable-interaction-anchor');

    expect(issue).toMatchObject({ point: { y: 4 }, blockedColumns: [3, 4] });
    expect([issue?.furnitureId, issue?.conflictingId]).toEqual(expect.arrayContaining(['aisle-left', 'aisle-right']));
    expect(issue?.bounds).toBeDefined();
    expect(issue?.cells?.length).toBeGreaterThan(0);
  });
});
