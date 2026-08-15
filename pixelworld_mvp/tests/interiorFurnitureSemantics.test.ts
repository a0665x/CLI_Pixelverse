import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition, InteriorDefinition } from '../src/world/types';
import {
  nearestSemanticStation,
  semanticForAction,
  semanticForFurniture,
} from '../src/rendering/interiorFurnitureSemantics';
import { missingSemanticFurnitureCopy } from '../src/rendering/interiorLocale';
import { catalogItem, MODERN_OFFICE_CATALOG } from '../src/rendering/modernOfficeCatalog';
import { navigationCells } from '../src/rendering/interiorPlacement';

const furniture = (
  id: string,
  kind: FurnitureDefinition['kind'],
  point: FurnitureDefinition['point'],
  extras: Partial<FurnitureDefinition> = {},
): FurnitureDefinition => ({
  id, kind, point, facing: 'up', supportedActions: [], icon: 'generic',
  blocksNavigation: true, ...extras,
});

const room = (items: FurnitureDefinition[]): InteriorDefinition => ({
  id: 'maker-workshop', label: 'Semantic test room', width: 9, height: 7,
  floor: 'tile', wall: 'brick', furniture: items, overflow: [],
});

describe('interior furniture semantics', () => {
  it('maps fine-grained actions into the three user-facing Hook categories', () => {
    expect(semanticForAction('rest')).toBe('rest');
    expect(semanticForAction('offline')).toBe('rest');
    expect(semanticForAction('read')).toBe('search');
    expect(semanticForAction('signal')).toBe('search');
    expect(semanticForAction('terminal')).toBe('work');
    expect(semanticForAction('repair')).toBe('work');
  });

  it('derives furniture semantics without depending on an exact ID or requirementId', () => {
    expect(semanticForFurniture(furniture('custom-lounge', 'sofa', { x: 1, y: 1 }))).toBe('rest');
    expect(semanticForFurniture(furniture('custom-archive', 'cabinet', { x: 1, y: 1 }))).toBe('search');
    expect(semanticForFurniture(furniture('custom-desk', 'desk', { x: 1, y: 1 }))).toBe('work');
    expect(semanticForFurniture(furniture('legacy-tool', 'decor', { x: 1, y: 1 }, {
      supportedActions: ['terminal'], requirementId: 'obsolete:terminal',
    }))).toBe('work');
    expect(semanticForFurniture(furniture('catalog-workstation', 'decor', { x: 1, y: 1 }, {
      assetId: 247,
    }))).toBe('work');
  });

  it.each([207, 208, 209])('does not treat decorative glass divider asset %i as Search furniture', (assetId) => {
    expect(semanticForFurniture(furniture(`divider-${assetId}`, 'decor', { x: 1, y: 1 }, {
      assetId,
    }))).toBeUndefined();
  });

  it.each([
    [102, 'rest'], [116, 'rest'],
    [165, 'search'], [199, 'search'], [204, 'search'],
    [225, 'work'], [247, 'work'], [252, 'work'], [267, 'work'], [311, 'work'], [323, 'work'],
    [98, undefined], [121, undefined], [188, undefined], [207, undefined], [208, undefined],
    [209, undefined], [239, undefined],
  ] as const)('uses authoritative catalog semantics for asset %i', (assetId, expected) => {
    expect(semanticForFurniture(furniture(`catalog-${assetId}`, 'decor', { x: 1, y: 1 }, { assetId })))
      .toBe(expected);
  });

  it('keeps catalog semantics stable when a display label changes', () => {
    const asset = catalogItem(165)!;
    const label = asset.label;
    try {
      (asset as { label: string }).label = 'Renamed decorative object';
      expect(semanticForFurniture(furniture('renamed-catalog-search', 'decor', { x: 1, y: 1 }, {
        assetId: asset.id,
      }))).toBe('search');
    } finally {
      (asset as { label: string }).label = label;
    }
  });

  it('never promotes the surfaces catalog range to a semantic station', () => {
    expect(MODERN_OFFICE_CATALOG
      .filter(({ category }) => category === 'surfaces')
      .every(({ id }) => semanticForFurniture(furniture(`surface-${id}`, 'decor', { x: 1, y: 1 }, {
        assetId: id,
      })) === undefined)).toBe(true);
  });

  it('rejects floor, surface, and attached items before persisted or legacy semantics', () => {
    const candidates: FurnitureDefinition[] = [
      furniture('persisted-floor', 'desk', { x: 1, y: 1 }, { layer: 'floor', semantic: 'work' }),
      furniture('legacy-surface', 'desk', { x: 1, y: 1 }, {
        layer: 'surface', supportedActions: ['terminal'], semantic: 'work',
      }),
      furniture('attached-station', 'cabinet', { x: 1, y: 1 }, {
        supportedByIds: ['support'], semantic: 'search',
      }),
      furniture('catalog-surface-role', 'decor', { x: 1, y: 1 }, {
        assetId: 239, semantic: 'work',
      }),
    ];

    expect(candidates.map(semanticForFurniture)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('chooses the nearest reachable adjacent fallback when a persisted anchor is unreachable', () => {
    const blockedDesk = furniture('a-blocked-near', 'desk', { x: 4, y: 2 }, {
      interactionPoint: { x: 4, y: 3 },
    });
    const reachableDesk = furniture('z-reachable-far', 'desk', { x: 1, y: 1 }, {
      interactionPoint: { x: 1, y: 2 },
    });
    const blockers = [
      furniture('wall-left', 'decor', { x: 3, y: 3 }),
      furniture('wall-right', 'decor', { x: 5, y: 3 }),
      furniture('wall-up', 'decor', { x: 4, y: 2 }),
      furniture('wall-down', 'decor', { x: 4, y: 4 }),
    ];
    const station = nearestSemanticStation(
      room([blockedDesk, reachableDesk, ...blockers]),
      'terminal',
      { x: 4, y: 6 },
    );

    expect(station).toEqual({ furnitureId: 'a-blocked-near', point: { x: 3, y: 2 } });
  });

  it('falls back to a reachable adjacent cell when a persisted explicit point is outside the room', () => {
    const desk = furniture('edge-work-desk', 'desk', { x: 1, y: 5 }, {
      interactionPoint: { x: 1, y: 9 },
    });
    const candidateRoom = room([desk]);

    const station = nearestSemanticStation(candidateRoom, 'terminal', { x: 7, y: 5 });

    expect(station?.furnitureId).toBe(desk.id);
    expect(station?.point.x).toBeGreaterThanOrEqual(0);
    expect(station?.point.x).toBeLessThan(candidateRoom.width);
    expect(station?.point.y).toBeGreaterThanOrEqual(0);
    expect(station?.point.y).toBeLessThan(candidateRoom.height);
    expect(station?.point).not.toEqual(desk.interactionPoint);
  });

  it('falls back when an in-room explicit point is blocked by unrelated furniture', () => {
    const desk = furniture('blocked-anchor-desk', 'desk', { x: 4, y: 2 }, {
      interactionPoint: { x: 4, y: 3 },
    });
    const blocker = furniture('anchor-blocker', 'decor', { x: 4, y: 3 });

    const station = nearestSemanticStation(room([desk, blocker]), 'terminal', { x: 4, y: 6 });

    expect(station?.furnitureId).toBe(desk.id);
    expect(station?.point).not.toEqual(desk.interactionPoint);
  });

  it('falls back when a reachable persisted point is not on or adjacent to its furniture', () => {
    const desk = furniture('far-anchor-desk', 'desk', { x: 1, y: 1 }, {
      interactionPoint: { x: 7, y: 5 },
    });

    const station = nearestSemanticStation(room([desk]), 'terminal', { x: 8, y: 6 });

    expect(station?.furnitureId).toBe(desk.id);
    expect(station?.point).not.toEqual(desk.interactionPoint);
    expect(Math.abs(station!.point.x - desk.point.x) + Math.abs(station!.point.y - desk.point.y)).toBe(1);
  });

  it('replaces a reachable on-footprint persisted point with an adjacent candidate', () => {
    const desk = furniture('on-footprint-desk', 'desk', { x: 4, y: 2 }, {
      interactionPoint: { x: 4, y: 2 },
    });

    const station = nearestSemanticStation(room([desk]), 'terminal', { x: 4, y: 6 });

    expect(station?.furnitureId).toBe(desk.id);
    expect(station?.point).not.toEqual(desk.interactionPoint);
    expect(Math.abs(station!.point.x - desk.point.x) + Math.abs(station!.point.y - desk.point.y)).toBe(1);
  });

  it('uses furniture ID as a stable tie-breaker for equally near stations', () => {
    const candidateRoom = room([
      furniture('z-desk', 'desk', { x: 6, y: 2 }, { interactionPoint: { x: 6, y: 4 } }),
      furniture('a-desk', 'desk', { x: 2, y: 2 }, { interactionPoint: { x: 2, y: 4 } }),
    ]);

    expect(nearestSemanticStation(candidateRoom, 'terminal', { x: 4, y: 6 })?.furnitureId).toBe('a-desk');
  });

  it('does not reach an adjacent interaction point by walking through its station', () => {
    const station = furniture('selected-desk', 'desk', { x: 1, y: 2 }, {
      interactionPoint: { x: 1, y: 1 },
    });
    const barrier = [
      furniture('left-blocker', 'decor', { x: 0, y: 2 }),
      furniture('right-blocker', 'decor', { x: 2, y: 2 }),
    ];
    const narrowRoom = { ...room([station, ...barrier]), width: 3, height: 5 };

    expect(nearestSemanticStation(narrowRoom, 'terminal', { x: 1, y: 4 })).toEqual({
      furnitureId: 'selected-desk', point: { x: 1, y: 3 },
    });
  });

  it('replaces an on-footprint target while keeping the rest of a 1x3 station blocked', () => {
    const vertical = (id: string, x: number): FurnitureDefinition => furniture(id, 'decor', { x, y: 1 }, {
      assetId: 207, scale: 1.5, visualOffset: { x: -1.5 / 16, y: 2.5 / 16 },
      layer: 'wall', ...(id === 'station' ? { semantic: 'work' as const } : {}),
    });
    const station = vertical('station', 1);
    const occupied = navigationCells(station);
    expect(occupied).toHaveLength(3);
    station.interactionPoint = { ...occupied[0]! };
    const barrierRoom = {
      ...room([vertical('left-wall', 0), station, vertical('right-wall', 2)]), width: 3, height: 5,
    };
    const origin = { x: 1, y: 4 };

    expect(nearestSemanticStation(barrierRoom, 'terminal', origin)).toEqual({
      furnitureId: 'station', point: { x: 1, y: 3 },
    });

    station.interactionPoint = { x: 1, y: Math.max(...occupied.map(({ y }) => y)) + 1 };
    expect(nearestSemanticStation(barrierRoom, 'terminal', origin)).toEqual({
      furnitureId: 'station', point: station.interactionPoint,
    });
  });

  it('localizes concise missing-category feedback in every supported locale', () => {
    expect(missingSemanticFurnitureCopy('en-US', 'rest')).toContain('Rest');
    expect(missingSemanticFurnitureCopy('zh-TW', 'search')).toContain('搜尋');
    expect(missingSemanticFurnitureCopy('ja-JP', 'work')).toContain('作業');
    expect(missingSemanticFurnitureCopy('ko-KR', 'work')).toContain('작업');
  });
});
